<script setup lang="ts">
import type { ItunesAlbum } from '~/composables/useAppleMusic'

definePageMeta({ ssr: false })

const route = useRoute()
const router = useRouter()
const { searchArtists, getArtistAlbums, getArtworkUrl } = useAppleMusic()
const { albums: collectionAlbums, fetchCollection, addAlbum } = useCollection()
const { isWishlisted, fetchWishlist, addToWishlist, removeFromWishlist, getWishlistItem } =
  useWishlist()

const rawId = Number(route.params.id)
const artistNameParam = computed(() => (route.query.name as string) || 'Artist')

useSeoMeta({ title: () => `${artistNameParam.value} — Vinyl Collection` })

const itunesAlbums = ref<ItunesAlbum[]>([])
const loading = ref(true)

// Map itunesCollectionId → local album UUID for linking back to our album pages
const localAlbumMap = computed(() => {
  const map = new Map<number, string>()
  for (const a of collectionAlbums.value) {
    if (a.itunesCollectionId) map.set(a.itunesCollectionId, a.id)
  }
  return map
})

onMounted(async () => {
  await fetchCollection()
  await fetchWishlist()

  let artistId = rawId > 0 ? rawId : 0

  if (artistId <= 0) {
    try {
      const results = await searchArtists(artistNameParam.value)
      if (results.length > 0) artistId = results[0]!.artistId
    } catch {}
  }

  if (artistId > 0) {
    try {
      const albums = await getArtistAlbums(artistId)

      // Deduplicate only truly identical entries (same name, same collectionType)
      // "Back to Black" and "Back to Black (Deluxe Edition)" are different keys and both show.
      const seen = new Map<string, ItunesAlbum>()
      for (const album of albums) {
        const key = album.collectionName.toLowerCase().trim()
        const existing = seen.get(key)
        if (!existing || album.trackCount > existing.trackCount) {
          seen.set(key, album)
        }
      }

      itunesAlbums.value = [...seen.values()].sort(
        (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime(),
      )
    } catch {}
  }

  loading.value = false
})

// Section order preference
const TYPE_ORDER = ['Album', 'EP', 'Single', 'Remix', 'Compilation', 'Soundtrack', 'Live Album']

// Resolve album type using iTunes collectionType, Apple Music name conventions, keyword matching, then trackCount
function resolveType(album: ItunesAlbum): string {
  const type = album.collectionType || 'Album'
  const name = album.collectionName

  // Trust iTunes when it explicitly sets a non-Album type
  if (type === 'Single') return 'Single'
  if (type === 'EP') return 'EP'
  if (type === 'Compilation') return 'Compilation'

  // Apple Music appends " - EP" or " - Single" to the collection name
  if (/\s-\s*ep\s*$/i.test(name)) return 'EP'
  if (/\s-\s*single\s*$/i.test(name)) return 'Single'

  // Live album detection
  if (
    /\blive\s+(at|in|from|on)\b/i.test(name) ||
    /\bin\s+concert\b/i.test(name) ||
    /[\(\[]live[\)\]]/i.test(name)
  )
    return 'Live Album'

  // Remix detection
  if (/\b(remix(es)?|remixed|re-?mix)\b/i.test(name)) return 'Remix'

  // Soundtrack detection
  if (
    /\b(soundtrack|motion\s+picture|original\s+(score|music)|from\s+the\s+(film|movie|motion)|ost)\b/i.test(
      name,
    )
  )
    return 'Soundtrack'

  // Compilation/greatest hits detection
  if (
    /\b(greatest\s+hits?|best\s+of|the\s+collection|anthology|hits?\s+collection|complete\s+collection|itunes|definitive\s+collection|rarities|b-sides|vault|treasury|vol\s+\d|volume\s+\d)\b/i.test(
      name,
    ) ||
    /\bvol\.\s*\d/i.test(name)
  )
    return 'Compilation'

  // TrackCount fallback for when iTunes labels everything 'Album'
  if (album.trackCount === 1) return 'Single'
  if (album.trackCount >= 2 && album.trackCount <= 4) return 'EP'

  return 'Album'
}

const discographySections = computed(() => {
  const grouped = new Map<string, ItunesAlbum[]>()
  for (const album of itunesAlbums.value) {
    const type = resolveType(album)
    if (!grouped.has(type)) grouped.set(type, [])
    grouped.get(type)!.push(album)
  }
  return [...grouped.entries()].sort(([a], [b]) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
})

const inCollectionCount = computed(
  () => itunesAlbums.value.filter((a) => localAlbumMap.value.has(a.collectionId)).length,
)

function isInCollection(album: ItunesAlbum) {
  return localAlbumMap.value.has(album.collectionId)
}

const expandedSections = ref<Set<string>>(new Set(['Album']))

function toggleSection(type: string) {
  if (expandedSections.value.has(type)) {
    expandedSections.value.delete(type)
  } else {
    expandedSections.value.add(type)
  }
}

function goToAlbum(album: ItunesAlbum) {
  router.push(`/album/itunes/${album.collectionId}`)
}

// ── Wishlist ──────────────────────────────────────────────
const wishlistPending = ref<number | null>(null)

async function toggleWishlist(album: ItunesAlbum) {
  wishlistPending.value = album.collectionId
  try {
    const existing = getWishlistItem(album.collectionId)
    if (existing) {
      await removeFromWishlist(existing.id)
    } else {
      await addToWishlist({
        itunesCollectionId: album.collectionId,
        title: album.collectionName,
        artist: album.artistName,
        genre: album.primaryGenreName || 'Other',
        year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : 0,
        artworkUrl: getArtworkUrl(album.artworkUrl100, 500),
        trackCount: album.trackCount,
        priority: 'medium',
      })
    }
  } finally {
    wishlistPending.value = null
  }
}

// ── Add to Collection ─────────────────────────────────────
const addDialogVisible = ref(false)
const addSaving = ref(false)
const addForm = ref({
  title: '',
  artist: '',
  genre: '',
  year: new Date().getFullYear(),
  artworkUrl: '',
  notes: '',
  itunesCollectionId: undefined as number | undefined,
  trackCount: undefined as number | undefined,
})

function openAddDialog(album: ItunesAlbum) {
  addForm.value = {
    title: album.collectionName,
    artist: album.artistName,
    genre: album.primaryGenreName || '',
    year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : new Date().getFullYear(),
    artworkUrl: getArtworkUrl(album.artworkUrl100, 600),
    notes: '',
    itunesCollectionId: album.collectionId,
    trackCount: album.trackCount,
  }
  addDialogVisible.value = true
}

async function saveToCollection() {
  addSaving.value = true
  try {
    await addAlbum({ ...addForm.value })
    addDialogVisible.value = false
  } catch (error) {
    console.error('[Add to Collection Error]', error)
  } finally {
    addSaving.value = false
  }
}
</script>

<template>
  <div>
    <!-- Back button -->
    <div style="margin-bottom: 1.5rem">
      <Button text icon="pi pi-arrow-left" label="Tilbage" @click="router.back()" />
    </div>

    <!-- Artist Hero -->
    <div class="artist-hero">
      <div class="artist-hero-avatar">
        {{ artistNameParam.charAt(0).toUpperCase() }}
      </div>
      <div>
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem">
          <Badge value="Kunstner" severity="secondary" />
        </div>
        <h1 class="artist-hero-name">{{ artistNameParam }}</h1>
        <p v-if="loading" style="color: rgba(255, 255, 255, 0.5)">Henter diskografi…</p>
        <p v-else class="artist-hero-genre">
          {{ itunesAlbums.length }} udgivelse{{ itunesAlbums.length !== 1 ? 'r' : '' }} ·
          {{ inCollectionCount }} i din samling
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align: center; padding: 3rem">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <template v-else>
      <div v-if="itunesAlbums.length === 0" class="empty-state">
        <div class="empty-state-icon"><i class="pi pi-images" /></div>
        <p class="empty-state-title">Ingen udgivelser fundet</p>
        <p class="empty-state-text">Kunne ikke finde denne kunstners diskografi på iTunes</p>
      </div>

      <template v-else>
        <div
          v-for="[type, albums] in discographySections"
          :key="type"
          style="margin-bottom: 2.5rem"
        >
          <h2
            class="section-title section-title--collapsible"
            :class="{ 'is-collapsed': !expandedSections.has(type) }"
            @click="toggleSection(type)"
          >
            <i
              class="pi"
              :class="{
                'pi-disc': type === 'Album',
                'pi-headphones': type === 'EP',
                'pi-volume-up': type === 'Single',
                'pi-refresh': type === 'Remix',
                'pi-list': type === 'Compilation' || type === 'Live Album',
                'pi-video': type === 'Soundtrack',
                'pi-images': ![
                  'Album',
                  'EP',
                  'Single',
                  'Remix',
                  'Compilation',
                  'Soundtrack',
                  'Live Album',
                ].includes(type),
              }"
              style="color: var(--p-primary-500)"
            />
            {{
              type === 'Album'
                ? 'Albums'
                : type === 'EP'
                  ? "EP'er"
                  : type === 'Single'
                    ? 'Singler'
                    : type === 'Remix'
                      ? 'Remixes'
                      : type === 'Compilation'
                        ? 'Kompilationer'
                        : type === 'Soundtrack'
                          ? 'Soundtracks'
                          : type === 'Live Album'
                            ? 'Live albums'
                            : type + 's'
            }}
            <span class="title-count">{{ albums.length }}</span>
            <i class="pi pi-chevron-down section-chevron" />
          </h2>
          <div v-if="expandedSections.has(type)" class="artist-discog-grid">
            <div
              v-for="album in albums"
              :key="album.collectionId"
              class="artist-discog-card in-collection"
              @click="goToAlbum(album)"
            >
              <div class="artist-discog-art-wrap">
                <img
                  :src="getArtworkUrl(album.artworkUrl100, 300)"
                  :alt="album.collectionName"
                  class="artist-discog-art"
                />
                <div v-if="isInCollection(album)" class="artist-discog-badge">
                  <i class="pi pi-check" />
                </div>
                <div
                  v-else-if="isWishlisted(album.collectionId)"
                  class="artist-discog-badge artist-discog-badge--wishlist"
                >
                  <i class="pi pi-heart-fill" />
                </div>

                <!-- Hover actions overlay -->
                <div class="crate-item-actions" @click.stop>
                  <Button
                    v-if="!isInCollection(album)"
                    :icon="isWishlisted(album.collectionId) ? 'pi pi-heart-fill' : 'pi pi-heart'"
                    size="small"
                    rounded
                    :title="
                      isWishlisted(album.collectionId)
                        ? 'Fjern fra ønskeliste'
                        : 'Tilføj til ønskeliste'
                    "
                    :loading="wishlistPending === album.collectionId"
                    :class="{ 'btn-wishlisted': isWishlisted(album.collectionId) }"
                    @click="toggleWishlist(album)"
                  />
                  <Button
                    v-if="!isInCollection(album)"
                    icon="pi pi-plus"
                    size="small"
                    rounded
                    title="Tilføj til samling"
                    @click="openAddDialog(album)"
                  />
                  <Button
                    icon="pi pi-arrow-right"
                    size="small"
                    rounded
                    title="Se album"
                    @click.stop="goToAlbum(album)"
                  />
                </div>
              </div>
              <p class="artist-discog-title">{{ album.collectionName }}</p>
              <p class="artist-discog-year">
                {{
                  album.releaseDate && new Date(album.releaseDate).getFullYear() !== 0
                    ? new Date(album.releaseDate).getFullYear()
                    : ''
                }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Add to Collection Dialog -->
    <Dialog
      v-model:visible="addDialogVisible"
      header="Tilføj til samling"
      modal
      :style="{ width: '480px' }"
    >
      <div class="add-dialog-body">
        <div v-if="addForm.artworkUrl" class="add-dialog-preview">
          <img :src="addForm.artworkUrl" :alt="addForm.title" class="add-dialog-artwork" />
          <div>
            <p class="add-dialog-album-title">{{ addForm.title }}</p>
            <p class="add-dialog-album-artist">{{ addForm.artist }}</p>
          </div>
        </div>
        <div class="form-field">
          <label>Albumtitel</label>
          <InputText v-model="addForm.title" class="w-full" />
        </div>
        <div class="form-field">
          <label>Kunstner</label>
          <InputText v-model="addForm.artist" class="w-full" />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="addForm.genre" class="w-full" />
          </div>
          <div class="form-field form-field-year">
            <label>År</label>
            <InputNumber v-model="addForm.year" :use-grouping="false" class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label
            >Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span></label
          >
          <Textarea v-model="addForm.notes" rows="2" class="w-full" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="addDialogVisible = false" />
        <Button
          label="Tilføj til samling"
          icon="pi pi-plus"
          :loading="addSaving"
          @click="saveToCollection"
        />
      </template>
    </Dialog>
  </div>
</template>
