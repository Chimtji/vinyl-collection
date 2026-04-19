<script setup lang="ts">
import type { DiscogsRelease, DiscogsFullRelease } from '~/composables/useDiscogs'
import { parseCredits } from '~/composables/useDiscogs'

definePageMeta({ ssr: false })

const route = useRoute()
const router = useRouter()
const { getAlbumTracks, getArtworkUrl, formatReleaseYear } = useAppleMusic()
const { searchRelease, getRelease, getDiscogsUrl } = useDiscogs()
const { addAlbum, updateAlbum, deleteAlbum, albums, fetchCollection } = useCollection()
const { addToWishlist, removeFromWishlist, getWishlistItem, fetchWishlist } = useWishlist()

const itunesId = Number(route.params.id)

useSeoMeta({ title: 'Album — Vinyl Collection' })

// Fetch album + tracks directly from iTunes
const { data: itunesData, status: itunesStatus } = await useAsyncData(
  `itunes-preview-${itunesId}`,
  () => getAlbumTracks(itunesId),
)

const loading = computed(() => itunesStatus.value === 'pending')
const itunesAlbum = computed(() => itunesData.value?.album ?? null)
const tracks = computed(() => itunesData.value?.tracks ?? [])

useSeoMeta({ title: () => `${itunesAlbum.value?.collectionName ?? 'Album'} — Vinyl Collection` })

onMounted(() => fetchCollection())
onMounted(() => fetchWishlist())

const inCollection = computed(
  () => albums.value.find((a) => a.itunesCollectionId === itunesId) ?? null,
)

const displayTitle = computed(
  () => inCollection.value?.title || itunesAlbum.value?.collectionName || '',
)
const displayArtist = computed(
  () => inCollection.value?.artist || itunesAlbum.value?.artistName || '',
)
const displayYear = computed(() => {
  if (inCollection.value?.year && inCollection.value.year !== 0)
    return String(inCollection.value.year)
  return itunesAlbum.value ? formatReleaseYear(itunesAlbum.value.releaseDate) : ''
})
const displayGenre = computed(
  () => inCollection.value?.genre || itunesAlbum.value?.primaryGenreName || '',
)
const displayArtistId = computed(() => itunesAlbum.value?.artistId ?? null)
const artworkUrl = computed(() =>
  itunesAlbum.value?.artworkUrl100 ? getArtworkUrl(itunesAlbum.value.artworkUrl100, 500) : '',
)

// Load Discogs + Wikipedia in parallel after album loads
const discogsRelease = ref<DiscogsRelease | null>(null)
const discogsFullRelease = ref<DiscogsFullRelease | null>(null)
const discogsLoading = ref(false)
const discogsRateLimited = ref(false)
const wikiSummary = ref<{ title: string; extract: string; url: string } | null>(null)

const credits = computed(() =>
  discogsFullRelease.value ? parseCredits(discogsFullRelease.value) : null,
)

async function loadDiscogs(album: { artistName: string; collectionName: string }) {
  discogsLoading.value = true
  discogsRateLimited.value = false
  try {
    // Ensure collection is loaded before reading the saved discogsId
    await fetchCollection()
    // Use saved discogsId if available — skips the search request entirely
    const savedId = inCollection.value?.discogsId
    const [discogsResult, wikiResult] = await Promise.all([
      savedId
        ? Promise.resolve({ id: savedId } as DiscogsRelease)
        : searchRelease(album.artistName, album.collectionName),
      $fetch<{ title: string; extract: string; url: string } | null>(
        `/api/wikipedia/summary?artist=${encodeURIComponent(album.artistName)}&album=${encodeURIComponent(album.collectionName)}`,
      ).catch(() => null),
    ])
    discogsRelease.value = discogsResult
    wikiSummary.value = wikiResult
    discogsLoading.value = false
    // Fetch full release for credits (failure here doesn't break the page)
    if (discogsResult?.id) {
      discogsFullRelease.value = await getRelease(discogsResult.id).catch(() => null)
      // Persist the Discogs ID if not already stored
      if (!savedId && inCollection.value) {
        updateAlbum(inCollection.value.id, { discogsId: discogsResult.id }).catch(() => {})
      }
    }
  } catch {
    // 429 rate limit — don't mark as "not on Discogs", let user retry
    discogsRateLimited.value = true
    discogsLoading.value = false
  }
}

watch(
  itunesAlbum,
  (album) => {
    if (album) loadDiscogs(album)
  },
  { immediate: true },
)

const discogsUrl = computed(() =>
  discogsRelease.value ? getDiscogsUrl(discogsRelease.value) : null,
)

function toVinylpladenSlug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function stripEditionWords(title: string): string {
  return title
    .replace(
      /\s*[\(\[]\s*(deluxe|explicit|clean|remastered?|anniversary|expanded|special|bonus|standard|platinum|diamond|collectors?|definitive|ultimate|complete|re-?issue|re-?release|re-?master|limited|super|acoustic|unplugged|mono|stereo)\s*(edition|version|tracks?|mix)?\s*[\)\]]/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

const vinylpladenUrl = computed(() => {
  if (inCollection.value?.vinylpladenUrl) return inCollection.value.vinylpladenUrl
  const artist = displayArtist.value
  const title = displayTitle.value
  if (!artist || !title) return null
  return `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(artist)}/${toVinylpladenSlug(title)}-LP`
})

function tryAutoSaveVinylpladenUrl(url: string) {
  if (!inCollection.value || inCollection.value.vinylpladenUrl) return
  updateAlbum(inCollection.value.id, { vinylpladenUrl: url })
}

const vinylpladenPrice = ref<string | null>(null)
const vinylpladenActiveUrl = ref<string | null>(null)
const vinylpladenPriceLoading = ref(false)

watch(
  vinylpladenUrl,
  async (url) => {
    if (!url) return
    vinylpladenPrice.value = null
    vinylpladenActiveUrl.value = url
    vinylpladenPriceLoading.value = true
    try {
      const result = await $fetch<{ price: string | null }>(
        `/api/vinylpladen/price?url=${encodeURIComponent(url)}`,
      )
      if (result.price !== null) {
        vinylpladenPrice.value = result.price
        vinylpladenActiveUrl.value = url
        tryAutoSaveVinylpladenUrl(url)
      } else if (!inCollection.value?.vinylpladenUrl) {
        // Only try stripped fallback for auto-generated URLs, not manually saved ones
        const strippedTitle = stripEditionWords(displayTitle.value)
        if (strippedTitle !== displayTitle.value) {
          const fallbackUrl = `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(displayArtist.value)}/${toVinylpladenSlug(strippedTitle)}-LP`
          const fallback = await $fetch<{ price: string | null }>(
            `/api/vinylpladen/price?url=${encodeURIComponent(fallbackUrl)}`,
          )
          vinylpladenPrice.value = fallback.price
          if (fallback.price !== null) {
            vinylpladenActiveUrl.value = fallbackUrl
            tryAutoSaveVinylpladenUrl(fallbackUrl)
          }
        }
      }
    } catch {
      vinylpladenPrice.value = null
    } finally {
      vinylpladenPriceLoading.value = false
    }
  },
  { immediate: true },
)

// Handle race: collection loads after price is already fetched
watch(inCollection, (col) => {
  if (col && !col.vinylpladenUrl && vinylpladenActiveUrl.value) {
    updateAlbum(col.id, { vinylpladenUrl: vinylpladenActiveUrl.value })
  }
})

function openAppleMusic() {
  if (itunesAlbum.value?.collectionViewUrl) {
    window.open(itunesAlbum.value.collectionViewUrl, '_blank', 'noopener,noreferrer')
  }
}

// ── Edit ─────────────────────────────────────────────────
const editDialogVisible = ref(false)
const editSaving = ref(false)
const editForm = ref<{
  id: string
  title: string
  artist: string
  genre: string
  year: number
  notes: string
  signed: boolean
  vinylpladenUrl: string
  discogsId: string
} | null>(null)

function openEdit() {
  if (!inCollection.value) return
  editForm.value = {
    id: inCollection.value.id,
    title: inCollection.value.title,
    artist: inCollection.value.artist,
    genre: inCollection.value.genre,
    year: inCollection.value.year,
    notes: inCollection.value.notes ?? '',
    signed: inCollection.value.signed ?? false,
    vinylpladenUrl: inCollection.value.vinylpladenUrl ?? vinylpladenActiveUrl.value ?? '',
    discogsId: inCollection.value.discogsId ? String(inCollection.value.discogsId) : '',
  }
  editDialogVisible.value = true
}

function parseDiscogsId(input: string): number | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const match = trimmed.match(/\/release\/(\d+)/)
  return match ? Number(match[1]) : undefined
}

async function saveEdit() {
  if (!editForm.value) return
  editSaving.value = true
  try {
    const parsedDiscogsId = parseDiscogsId(editForm.value.discogsId)
    const prevDiscogsId = inCollection.value?.discogsId
    await updateAlbum(editForm.value.id, { ...editForm.value, discogsId: parsedDiscogsId })
    editDialogVisible.value = false
    // Reload Discogs data if the ID changed
    if (parsedDiscogsId !== prevDiscogsId && itunesAlbum.value) {
      discogsRelease.value = null
      discogsFullRelease.value = null
      loadDiscogs(itunesAlbum.value)
    }
  } finally {
    editSaving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────
const deleteConfirm = ref(false)
const deleting = ref(false)

async function doDelete() {
  if (!inCollection.value) return
  deleting.value = true
  try {
    await deleteAlbum(inCollection.value.id)
    deleteConfirm.value = false
    router.back()
  } finally {
    deleting.value = false
  }
}

const adding = ref(false)

const wishlisted = computed(() => getWishlistItem(itunesId) ?? null)
const wishlistPending = ref(false)

async function toggleWishlist() {
  if (!itunesAlbum.value) return
  wishlistPending.value = true
  try {
    if (wishlisted.value) {
      await removeFromWishlist(wishlisted.value.id)
    } else {
      const album = itunesAlbum.value
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
    wishlistPending.value = false
  }
}

async function addToCollection() {
  if (!itunesAlbum.value) return
  adding.value = true
  try {
    const album = itunesAlbum.value
    await addAlbum({
      title: album.collectionName,
      artist: album.artistName,
      genre: album.primaryGenreName || 'Other',
      year: album.releaseDate
        ? new Date(album.releaseDate).getFullYear()
        : new Date().getFullYear(),
      artworkUrl: getArtworkUrl(album.artworkUrl100, 500),
      itunesCollectionId: album.collectionId,
      trackCount: album.trackCount,
    })
    router.push(`/album/itunes/${itunesId}`)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div>
    <!-- Back -->
    <div style="margin-bottom: 1.5rem">
      <Button text icon="pi pi-arrow-left" label="Tilbage" @click="router.back()" />
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align: center; padding: 4rem">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <!-- Not found -->
    <div v-else-if="!itunesAlbum" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-exclamation-triangle" /></div>
      <p class="empty-state-title">Album ikke fundet</p>
    </div>

    <template v-else>
      <!-- Album Hero -->
      <div class="album-hero">
        <!-- Artwork -->
        <div>
          <img v-if="artworkUrl" :src="artworkUrl" :alt="displayTitle" class="album-cover" />
          <div v-else class="album-cover-placeholder">
            <i class="pi pi-disc" />
          </div>
        </div>

        <!-- Meta -->
        <div class="album-meta">
          <div
            style="
              display: flex;
              align-items: center;
              gap: 0.6rem;
              flex-wrap: wrap;
              margin-bottom: 1rem;
            "
          >
            <div class="album-type-badge" style="margin-bottom: 0">
              <i class="pi pi-disc" />
              {{ itunesAlbum.collectionType || 'Album' }}
            </div>

            <!-- Wishlist button (only when not in collection) -->
            <button
              v-if="!inCollection"
              class="album-type-badge collection-action-badge"
              :class="wishlisted ? 'wishlist-badge--active' : 'wishlist-badge--inactive'"
              style="margin-bottom: 0"
              :disabled="wishlistPending"
              @click="toggleWishlist"
            >
              <i
                class="pi"
                :class="
                  wishlistPending ? 'pi-spin pi-spinner' : wishlisted ? 'pi-heart-fill' : 'pi-heart'
                "
              />
              {{ wishlisted ? 'På ønskeliste' : 'Tilføj til ønskeliste' }}
            </button>

            <!-- Add / In collection — combined badge button -->
            <button
              v-if="!inCollection"
              class="album-type-badge collection-action-badge collection-action-badge--add"
              style="margin-bottom: 0"
              :disabled="adding"
              @click="addToCollection"
            >
              <i class="pi" :class="adding ? 'pi-spin pi-spinner' : 'pi-plus'" />
              {{ adding ? 'Tilføjer…' : 'Tilføj til samling' }}
            </button>
            <template v-else>
              <button
                class="album-type-badge collection-action-badge"
                style="margin-bottom: 0; cursor: default"
              >
                <i class="pi pi-check" /> I min samling
              </button>
              <div
                v-if="inCollection.signed"
                class="album-type-badge album-signed-badge"
                style="margin-bottom: 0"
              >
                <i class="pi pi-pen-to-square" /> Signeret
              </div>
              <button
                class="album-type-badge collection-action-badge collection-action-badge--edit"
                style="margin-bottom: 0"
                title="Rediger album"
                @click="openEdit"
              >
                <i class="pi pi-pencil" /> Rediger
              </button>
              <button
                class="album-type-badge collection-action-badge collection-action-badge--remove"
                style="margin-bottom: 0"
                title="Fjern fra samling"
                @click="deleteConfirm = true"
              >
                <i class="pi pi-trash" /> Fjern
              </button>
            </template>
          </div>

          <h1 class="album-title">{{ displayTitle }}</h1>

          <NuxtLink
            v-if="displayArtistId"
            :to="`/artist/${displayArtistId}?name=${encodeURIComponent(displayArtist)}`"
            class="album-artist-link"
          >
            {{ displayArtist }}
          </NuxtLink>
          <span v-else class="album-artist-link" style="cursor: default">{{ displayArtist }}</span>

          <div class="album-stats">
            <span v-if="displayYear" class="album-stat">
              <i class="pi pi-calendar" />
              {{ displayYear }}
            </span>
            <span v-if="tracks.length" class="album-stat">
              <i class="pi pi-list" />
              {{ tracks.length }} spor
            </span>
            <span v-if="displayGenre" class="album-stat">
              <i class="pi pi-tag" />
              {{ displayGenre }}
            </span>
            <span v-if="itunesAlbum.country" class="album-stat">
              <i class="pi pi-globe" />
              {{ itunesAlbum.country }}
            </span>
          </div>

          <div class="album-actions">
            <!-- Apple Music -->
            <Button
              icon="pi pi-apple"
              label="Apple Music"
              size="small"
              :disabled="!itunesAlbum.collectionViewUrl"
              @click="openAppleMusic"
            />

            <!-- Vinylpladen -->
            <a
              v-if="vinylpladenUrl"
              :href="vinylpladenActiveUrl ?? vinylpladenUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="vinylpladen-badge"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                />
              </svg>
              Vinylpladen
              <span v-if="vinylpladenPriceLoading" class="vinylpladen-price-loading" />
              <span v-else-if="vinylpladenPrice" class="vinylpladen-price">{{
                vinylpladenPrice
              }}</span>
            </a>

            <!-- Discogs -->
            <div>
              <ProgressSpinner
                v-if="discogsLoading"
                stroke-width="4"
                style="width: 32px; height: 32px"
              />
              <a
                v-else-if="discogsUrl"
                :href="discogsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="discogs-badge"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Discogs
              </a>
              <button
                v-else-if="discogsRateLimited"
                class="discogs-badge"
                style="background: none; border: none; cursor: pointer; font: inherit"
                title="Discogs hastighedsgrænse nået — klik for at prøve igen"
                @click="itunesAlbum && loadDiscogs(itunesAlbum)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Prøv igen
              </button>
              <span v-else-if="!discogsLoading" class="discogs-badge discogs-badge--none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Ikke på Discogs
              </span>
            </div>
          </div>

          <!-- Discogs community stats -->
          <div
            v-if="discogsRelease?.community"
            style="margin-top: 1.25rem; display: flex; gap: 1.5rem"
          >
            <div style="text-align: center">
              <p style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0">
                {{ discogsRelease.community.have.toLocaleString() }}
              </p>
              <p style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin: 0.15rem 0 0">
                Har
              </p>
            </div>
            <div style="text-align: center">
              <p style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0">
                {{ discogsRelease.community.want.toLocaleString() }}
              </p>
              <p style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin: 0.15rem 0 0">
                Vil have
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Track List -->
      <div v-if="tracks.length > 0">
        <h2 class="section-title">
          <i class="pi pi-list" style="color: var(--p-primary-500)" />
          Spor
          <span class="title-count">{{ tracks.length }}</span>
        </h2>
        <TrackList :tracks="tracks" />
      </div>

      <!-- Production Credits -->
      <div
        v-if="
          credits &&
          (credits.studios.length ||
            credits.producers.length ||
            credits.mixers.length ||
            credits.lacquerCutAt.length ||
            credits.lacquerCutBy.length)
        "
        class="album-credits"
      >
        <h2 class="section-title">
          <i class="pi pi-id-card" style="color: var(--p-primary-500)" />
          Produktionskreditter
        </h2>
        <div class="credits-grid">
          <div v-if="credits.studios.length" class="credits-row">
            <span class="credits-label"><i class="pi pi-building" /> Studiet</span>
            <span class="credits-value">{{ credits.studios.join(', ') }}</span>
          </div>
          <div v-if="credits.producers.length" class="credits-row">
            <span class="credits-label"><i class="pi pi-sliders-h" /> Producer</span>
            <span class="credits-value">{{ credits.producers.join(', ') }}</span>
          </div>
          <div v-if="credits.mixers.length" class="credits-row">
            <span class="credits-label"><i class="pi pi-chart-bar" /> Mixer</span>
            <span class="credits-value">{{ credits.mixers.join(', ') }}</span>
          </div>
          <div v-if="credits.lacquerCutAt.length" class="credits-row">
            <span class="credits-label"><i class="pi pi-map-marker" /> Lak skåret ved</span>
            <span class="credits-value">{{ credits.lacquerCutAt.join(', ') }}</span>
          </div>
          <div v-if="credits.lacquerCutBy.length" class="credits-row">
            <span class="credits-label"><i class="pi pi-user" /> Lak skåret af</span>
            <span class="credits-value">{{ credits.lacquerCutBy.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Wikipedia summary -->
      <div v-if="wikiSummary" class="album-wiki">
        <h2 class="section-title">
          <i class="pi pi-book" style="color: var(--p-primary-500)" />
          Om
        </h2>
        <p class="album-wiki-text">{{ wikiSummary.extract }}</p>
        <a
          :href="wikiSummary.url"
          target="_blank"
          rel="noopener noreferrer"
          class="album-wiki-link"
        >
          Læs mere på Wikipedia
          <i class="pi pi-external-link" style="font-size: 0.7rem" />
        </a>
      </div>
    </template>

    <!-- ── Edit Dialog ─────────────────────────────────── -->
    <Dialog
      v-model:visible="editDialogVisible"
      header="Rediger album"
      modal
      :style="{ width: '520px' }"
    >
      <div v-if="editForm" class="add-dialog-body">
        <!-- Apple Music reference -->
        <div v-if="itunesAlbum" class="edit-itunes-ref">
          <img
            v-if="artworkUrl"
            :src="artworkUrl"
            :alt="itunesAlbum.collectionName"
            class="edit-itunes-ref-art"
          />
          <div class="edit-itunes-ref-info">
            <p class="edit-itunes-ref-label">
              <i class="pi pi-apple" style="font-size: 0.7rem" /> Apple Music
            </p>
            <p class="edit-itunes-ref-title">{{ itunesAlbum.collectionName }}</p>
            <p class="edit-itunes-ref-sub">
              {{ itunesAlbum.artistName }}
              <span v-if="itunesAlbum.primaryGenreName"> · {{ itunesAlbum.primaryGenreName }}</span>
              <span v-if="itunesAlbum.releaseDate">
                · {{ formatReleaseYear(itunesAlbum.releaseDate) }}</span
              >
            </p>
          </div>
        </div>

        <div class="form-field">
          <label>Albumtitel</label>
          <InputText v-model="editForm.title" class="w-full" />
          <button
            v-if="itunesAlbum && itunesAlbum.collectionName !== editForm.title"
            class="edit-itunes-hint"
            type="button"
            @click="editForm.title = itunesAlbum.collectionName"
          >
            <i class="pi pi-apple" /> {{ itunesAlbum.collectionName }}
          </button>
        </div>
        <div class="form-field">
          <label>Kunstner</label>
          <InputText v-model="editForm.artist" class="w-full" />
          <button
            v-if="itunesAlbum && itunesAlbum.artistName !== editForm.artist"
            class="edit-itunes-hint"
            type="button"
            @click="editForm.artist = itunesAlbum.artistName"
          >
            <i class="pi pi-apple" /> {{ itunesAlbum.artistName }}
          </button>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="editForm.genre" class="w-full" />
            <button
              v-if="
                itunesAlbum?.primaryGenreName && itunesAlbum.primaryGenreName !== editForm.genre
              "
              class="edit-itunes-hint"
              type="button"
              @click="editForm.genre = itunesAlbum.primaryGenreName"
            >
              <i class="pi pi-apple" /> {{ itunesAlbum.primaryGenreName }}
            </button>
          </div>
          <div class="form-field form-field-year">
            <label>År</label>
            <InputNumber v-model="editForm.year" :use-grouping="false" class="w-full" />
            <button
              v-if="
                itunesAlbum?.releaseDate &&
                Number(formatReleaseYear(itunesAlbum.releaseDate)) !== editForm.year
              "
              class="edit-itunes-hint"
              type="button"
              @click="editForm.year = Number(formatReleaseYear(itunesAlbum.releaseDate))"
            >
              <i class="pi pi-apple" /> {{ formatReleaseYear(itunesAlbum.releaseDate) }}
            </button>
          </div>
        </div>
        <div class="form-field">
          <label>
            Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span>
          </label>
          <Textarea v-model="editForm.notes" rows="2" class="w-full" auto-resize />
        </div>
        <div class="form-field">
          <label>
            Vinylpladen URL
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span>
          </label>
          <InputText
            v-model="editForm.vinylpladenUrl"
            class="w-full"
            placeholder="https://vinylpladen.dk/vinyl/..."
          />
        </div>
        <div class="form-field">
          <label>
            Discogs release
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span>
          </label>
          <InputText
            v-model="editForm.discogsId"
            class="w-full"
            placeholder="https://www.discogs.com/release/123456 eller 123456"
          />
          <small
            v-if="editForm.discogsId && parseDiscogsId(editForm.discogsId)"
            style="color: var(--p-green-500); margin-top: 0.25rem; display: block"
          >
            <i class="pi pi-check" /> ID: {{ parseDiscogsId(editForm.discogsId) }}
          </small>
          <small
            v-else-if="editForm.discogsId && !parseDiscogsId(editForm.discogsId)"
            style="color: var(--p-red-400); margin-top: 0.25rem; display: block"
          >
            <i class="pi pi-times" /> Ugyldigt format
          </small>
        </div>
        <label class="edit-signed-toggle">
          <Checkbox v-model="editForm.signed" :binary="true" input-id="signed-cb" />
          <span>
            <i class="pi pi-pen-to-square" style="font-size: 0.85rem" />
            Signeret eksemplar
          </span>
        </label>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="editDialogVisible = false" />
        <Button label="Gem" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- ── Delete Confirm Dialog ─────────────────────────── -->
    <Dialog
      v-model:visible="deleteConfirm"
      header="Fjern fra samling"
      modal
      :style="{ width: '400px' }"
    >
      <p style="margin: 0">
        Er du sikker på, at du vil fjerne
        <strong>{{ displayTitle }}</strong> fra din samling?
      </p>
      <template #footer>
        <Button label="Annuller" text @click="deleteConfirm = false" />
        <Button
          label="Fjern"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="doDelete"
        />
      </template>
    </Dialog>
  </div>
</template>
