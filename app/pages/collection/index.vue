<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ ssr: false })
useSeoMeta({ title: 'Samling — Vinylsamling' })

// ── View state — driven by URL query param ────────────────
type View = 'genres' | 'albums' | 'artists'
const route = useRoute()
const router = useRouter()

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'genres', label: 'Genrer', icon: 'pi pi-tag' },
  { id: 'albums', label: 'Albums', icon: 'pi pi-th-large' },
  { id: 'artists', label: 'Kunstnere', icon: 'pi pi-user' },
]

function viewFromQuery(): View {
  const v = route.query.view
  if (v === 'albums' || v === 'artists') return v
  return 'genres'
}

const activeView = ref<View>(viewFromQuery())

watch(
  () => route.query.view,
  () => {
    activeView.value = viewFromQuery()
  },
)

const {
  albums,
  loading,
  fetchCollection,
  addAlbum,
  updateAlbum,
  deleteAlbum,
  genreToSlug,
  genres,
} = useCollection()

onMounted(() => fetchCollection())

// ── Search / filter ───────────────────────────────────────
const search = ref('')
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return albums.value
  return albums.value.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.artist.toLowerCase().includes(q) ||
      a.genre.toLowerCase().includes(q),
  )
})

// ── Display toggles ───────────────────────────────────────
const groupBySections = ref(false)
const listView = ref(false)

// ── Genres view ───────────────────────────────────────────
const groupedByGenre = computed(() => {
  const map = new Map<string, CollectionAlbum[]>()
  for (const album of filtered.value) {
    if (!map.has(album.genre)) map.set(album.genre, [])
    map.get(album.genre)!.push(album)
  }
  const genres = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([genre, list]) => ({ genre, slug: genreToSlug(genre), albums: list }))
  return byLetter(genres, (g) => g.genre)
})

const groupedAlbumsByLetter = computed(() => {
  const sorted = [...filtered.value].sort((a, b) => a.title.localeCompare(b.title))
  return byLetter(sorted, (a) => a.title)
})

const groupedArtistsByLetter = computed(() => {
  const map = new Map<string, { albums: CollectionAlbum[]; genres: Set<string> }>()
  for (const album of filtered.value) {
    if (!map.has(album.artist)) map.set(album.artist, { albums: [], genres: new Set() })
    map.get(album.artist)!.albums.push(album)
    map.get(album.artist)!.genres.add(album.genre)
  }
  const artists = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([artist, data]) => ({
      artist,
      albumCount: data.albums.length,
      genres: Array.from(data.genres).join(', '),
      artworks: data.albums.map((a) => a.artworkUrl).filter(Boolean),
    }))
  return byLetter(artists, (a) => a.artist)
})

function byLetter<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const sections = new Map<string, T[]>()
  for (const item of items) {
    const name = key(item)
    const letter = /^[a-zA-Z]/.test(name) ? name[0]!.toUpperCase() : '#'
    if (!sections.has(letter)) sections.set(letter, [])
    sections.get(letter)!.push(item)
  }
  return Array.from(sections.entries()).sort((a, b) => {
    if (a[0] === '#') return 1
    if (b[0] === '#') return -1
    return a[0].localeCompare(b[0])
  })
}

// ── Flat (unsectioned) versions ───────────────────────────
const flatGenres = computed(() => groupedByGenre.value.flatMap(([, items]) => items))
const flatAlbums = computed(() =>
  [...filtered.value].sort((a, b) => a.title.localeCompare(b.title)),
)
const flatArtists = computed(() => groupedArtistsByLetter.value.flatMap(([, items]) => items))

// ── Section-aware display arrays ──────────────────────────
// Each entry is [letter | null, items[]]
// null letter → no heading rendered (flat mode)
type Sec<T> = [string | null, T[]]

const genreSections = computed<Sec<(typeof flatGenres.value)[number]>[]>(() =>
  groupBySections.value ? groupedByGenre.value : [[null, flatGenres.value]],
)

const albumSections = computed<Sec<CollectionAlbum>[]>(() =>
  groupBySections.value ? groupedAlbumsByLetter.value : [[null, flatAlbums.value]],
)

type ArtistRow = (typeof flatArtists.value)[number]
const artistSections = computed<Sec<ArtistRow>[]>(() =>
  groupBySections.value ? groupedArtistsByLetter.value : [[null, flatArtists.value]],
)

// ── Album detail link helper ─────────────────────────────
function albumDetailHref(album: CollectionAlbum) {
  return album.itunesCollectionId ? `/album/itunes/${album.itunesCollectionId}` : '#'
}

// ── Edit dialog ───────────────────────────────────────────
const editDialogVisible = ref(false)
const editSaving = ref(false)
const editForm = ref<CollectionAlbum | null>(null)

function openEdit(album: CollectionAlbum) {
  editForm.value = { ...album }
  editDialogVisible.value = true
}

async function saveEdit() {
  if (!editForm.value) return
  editSaving.value = true
  try {
    await updateAlbum(editForm.value.id, editForm.value)
    editDialogVisible.value = false
  } finally {
    editSaving.value = false
  }
}

// ── Discogs import ───────────────────────────────────────
interface ImportCandidate {
  discogsReleaseId: number
  title: string
  artist: string
  genre: string
  year: number
  artworkUrl: string
  matchConfidence: 'exact' | 'review' | 'no-match'
  matchedTitle: string
  matchedArtist: string
  itunesCollectionId?: number
  selected: boolean
  duplicate: boolean
}

const importDialogVisible = ref(false)
const importUsername = ref('')
const importLoading = ref(false)
const importSaving = ref(false)
const importError = ref('')
const importCandidates = ref<ImportCandidate[]>([])
const importStep = ref<'input' | 'preview'>('input')

const importSelectedCount = computed(() => importCandidates.value.filter((c) => c.selected).length)

async function fetchDiscogsCollection() {
  if (!importUsername.value.trim()) return
  importLoading.value = true
  importError.value = ''
  importCandidates.value = []
  try {
    const existing = new Set(
      albums.value.map((a) => `${a.title.toLowerCase()}|||${a.artist.toLowerCase()}`),
    )
    const data = await $fetch<ImportCandidate[]>(
      `/api/discogs/collection?username=${encodeURIComponent(importUsername.value.trim())}`,
    )
    importCandidates.value = data.map((d) => ({
      ...d,
      selected: !existing.has(`${d.title.toLowerCase()}|||${d.artist.toLowerCase()}`),
      duplicate: existing.has(`${d.title.toLowerCase()}|||${d.artist.toLowerCase()}`),
    }))
    importStep.value = 'preview'
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message
    importError.value = msg ?? 'Kunne ikke hente samling'
  } finally {
    importLoading.value = false
  }
}

async function doImport() {
  importSaving.value = true
  importError.value = ''
  try {
    const toAdd = importCandidates.value.filter((c) => c.selected && !c.duplicate)
    for (const item of toAdd) {
      await addAlbum({
        title: item.title,
        artist: item.artist,
        genre: item.genre,
        year: item.year,
        artworkUrl: item.artworkUrl,
        itunesCollectionId: item.itunesCollectionId,
      })
    }
    importDialogVisible.value = false
    importStep.value = 'input'
    importUsername.value = ''
    importCandidates.value = []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    importError.value = `Import failed: ${msg}`
    console.error('[doImport]', err)
  } finally {
    importSaving.value = false
  }
}

function openImportDialog() {
  importStep.value = 'input'
  importError.value = ''
  importCandidates.value = []
  importDialogVisible.value = true
}

// Open import dialog when navigated to with ?action=import
watch(
  () => route.query.action,
  (action) => {
    if (action === 'import') {
      openImportDialog()
      // Strip ?action= so re-clicking the sidebar button always triggers again
      const { action: _a, ...rest } = route.query
      router.replace({ query: rest })
    }
  },
  { immediate: true },
)

// ── Manual iTunes search — 2-step: artist → discography ──
interface ItunesArtistResult {
  wrapperType: string
  artistId: number
  artistName: string
  primaryGenreName?: string
  artworkUrl?: string
}

interface ItunesSearchResult {
  wrapperType: string
  collectionId: number
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  primaryGenreName?: string
  releaseDate?: string
}

const manualModalVisible = ref(false)
const manualModalItem = ref<ImportCandidate | null>(null)
const manualStep = ref<'artist' | 'albums'>('artist')
const manualArtistQuery = ref('')
const manualArtistResults = ref<ItunesArtistResult[]>([])
const manualSelectedArtist = ref<ItunesArtistResult | null>(null)
const manualAlbums = ref<ItunesSearchResult[]>([])
const manualSearchLoading = ref(false)

function openManualSearch(item: ImportCandidate) {
  manualModalItem.value = item
  manualModalVisible.value = true
  manualStep.value = 'artist'
  manualArtistQuery.value = item.artist
  manualArtistResults.value = []
  manualSelectedArtist.value = null
  manualAlbums.value = []
  searchArtists()
}

async function searchArtists() {
  const q = manualArtistQuery.value.trim()
  if (!q) return
  manualSearchLoading.value = true
  manualArtistResults.value = []
  try {
    const data = await $fetch<{ resultCount: number; results: ItunesArtistResult[] }>(
      `/api/itunes/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=12&media=music`,
    )
    manualArtistResults.value = (data.results ?? []).filter((r) => r.wrapperType === 'artist')

    // Batch-fetch one album per artist to use as the avatar image
    const ids = manualArtistResults.value.map((a) => a.artistId).join(',')
    if (ids) {
      const lookup = await $fetch<{
        results: Array<{ wrapperType?: string; artistId?: number; artworkUrl100?: string }>
      }>(`/api/itunes/lookup?id=${ids}&entity=album&limit=1`).catch(() => null)
      if (lookup) {
        const artMap = new Map<number, string>()
        for (const r of lookup.results ?? []) {
          if (
            r.wrapperType === 'collection' &&
            r.artistId &&
            r.artworkUrl100 &&
            !artMap.has(r.artistId)
          ) {
            artMap.set(r.artistId, r.artworkUrl100.replace('100x100bb', '160x160bb'))
          }
        }
        manualArtistResults.value = manualArtistResults.value.map((a) => ({
          ...a,
          artworkUrl: artMap.get(a.artistId),
        }))
      }
    }
  } catch {
    // ignore
  } finally {
    manualSearchLoading.value = false
  }
}

async function selectArtist(artist: ItunesArtistResult) {
  manualSelectedArtist.value = artist
  manualStep.value = 'albums'
  manualSearchLoading.value = true
  manualAlbums.value = []
  try {
    const data = await $fetch<{ resultCount: number; results: ItunesSearchResult[] }>(
      `/api/itunes/lookup?id=${artist.artistId}&entity=album&limit=100`,
    )
    manualAlbums.value = (data.results ?? [])
      .filter((r) => r.wrapperType === 'collection' && r.artworkUrl100)
      .sort((a, b) => {
        const ya = a.releaseDate ? new Date(a.releaseDate).getFullYear() : 0
        const yb = b.releaseDate ? new Date(b.releaseDate).getFullYear() : 0
        return ya - yb
      })
  } catch {
    // ignore
  } finally {
    manualSearchLoading.value = false
  }
}

function applyManualMatch(item: ImportCandidate, result: ItunesSearchResult) {
  item.artworkUrl = (result.artworkUrl100 ?? '').replace('100x100bb', '600x600bb')
  item.genre = result.primaryGenreName ?? ''
  item.matchedTitle = result.collectionName ?? ''
  item.matchedArtist = result.artistName ?? ''
  item.matchConfidence = 'exact'
  item.itunesCollectionId = result.collectionId
  manualModalVisible.value = false
}

// ── Share link ───────────────────────────────────────────
const { user } = useAuth()
const copied = ref(false)
function copyShareLink() {
  const userId = user.value?.id ?? ''
  const url = `${window.location.origin}/collection/share${userId ? `?userId=${userId}` : ''}`
  navigator.clipboard.writeText(url).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}

// ── Delete ────────────────────────────────────────────────
const confirmDelete = ref<CollectionAlbum | null>(null)
const deleting = ref(false)
const showDeleteDialog = computed({
  get: () => !!confirmDelete.value,
  set: (v) => {
    if (!v) confirmDelete.value = null
  },
})

async function doDelete() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await deleteAlbum(confirmDelete.value.id)
    confirmDelete.value = null
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="collection-main">
    <div class="collection-main-header">
      <h2 class="collection-main-title">
        <i :class="navItems.find((n) => n.id === activeView)?.icon" />
        {{ navItems.find((n) => n.id === activeView)?.label }}
      </h2>
      <div class="collection-main-controls">
        <InputText
          v-model="search"
          placeholder="Filtrer…"
          size="small"
          class="collection-search-input"
        />
        <button
          class="view-toggle-btn share-btn"
          :class="{ 'share-btn--copied': copied }"
          :title="copied ? 'Kopieret!' : 'Kopier delt visning'"
          @click="copyShareLink"
        >
          <i :class="copied ? 'pi pi-check' : 'pi pi-share-alt'" />
        </button>
        <div class="view-toggles">
          <button
            class="view-toggle-btn"
            :class="{ active: groupBySections }"
            title="Gruppér efter bogstav"
            @click="groupBySections = !groupBySections"
          >
            <i class="pi pi-sort-alpha-down" />
          </button>
          <div class="view-mode-btns">
            <button
              class="view-toggle-btn"
              :class="{ active: !listView }"
              title="Gittervisning"
              @click="listView = false"
            >
              <i class="pi pi-th-large" />
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: listView }"
              title="Listevisning"
              @click="listView = true"
            >
              <i class="pi pi-list" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" style="padding: 6rem 0; text-align: center">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <div v-else-if="albums.length === 0" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-disc" /></div>
      <p class="empty-state-title">Din samling er tom</p>
      <NuxtLink to="/search">
        <Button icon="pi pi-search" label="Søg musik" style="margin-top: 1rem" />
      </NuxtLink>
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <p class="empty-state-title">Ingen matches for &quot;{{ search }}&quot;</p>
    </div>

    <template v-else>
      <!-- ════ GENRES VIEW ════ -->
      <template v-if="activeView === 'genres'">
        <div v-for="[letter, groups] in genreSections" :key="letter ?? 'all'" class="crate-section">
          <h3 v-if="letter" class="crate-section-label">{{ letter }}</h3>
          <!-- grid -->
          <div v-if="!listView" class="crate-grid">
            <NuxtLink
              v-for="group in groups"
              :key="group.slug"
              :to="`/genre/${group.slug}`"
              class="crate-item"
            >
              <div class="crate-stack">
                <div
                  v-for="(album, i) in group.albums.slice(0, 5).reverse()"
                  :key="album.id"
                  class="crate-record"
                  :style="{ '--i': group.albums.slice(0, 5).length - 1 - i }"
                >
                  <img
                    v-if="album.artworkUrl"
                    :src="album.artworkUrl"
                    :alt="album.title"
                    class="crate-record-img"
                  />
                  <div v-else class="crate-record-img crate-record-placeholder">
                    <i class="pi pi-disc" />
                  </div>
                </div>
              </div>
              <div class="crate-info">
                <p class="crate-genre">{{ group.genre }}</p>
                <p class="crate-count">
                  {{ group.albums.length }} {{ group.albums.length === 1 ? 'album' : 'albums' }}
                </p>
              </div>
            </NuxtLink>
          </div>
          <!-- list -->
          <div v-else class="collection-list">
            <NuxtLink
              v-for="group in groups"
              :key="group.slug"
              :to="`/genre/${group.slug}`"
              class="clist-row"
            >
              <div class="clist-art-wrap">
                <img
                  v-if="group.albums[0]?.artworkUrl"
                  :src="group.albums[0].artworkUrl"
                  :alt="group.genre"
                  class="clist-art"
                />
                <div v-else class="clist-art clist-art-placeholder"><i class="pi pi-tag" /></div>
              </div>
              <div class="clist-info">
                <span class="clist-title">{{ group.genre }}</span>
                <span class="clist-sub">
                  {{ group.albums.length }} {{ group.albums.length === 1 ? 'album' : 'albums' }}
                </span>
              </div>
              <i class="pi pi-chevron-right clist-chevron" />
            </NuxtLink>
          </div>
        </div>
      </template>

      <!-- ════ ALBUMS VIEW ════ -->
      <template v-else-if="activeView === 'albums'">
        <div
          v-for="[letter, albumList] in albumSections"
          :key="letter ?? 'all'"
          class="crate-section"
        >
          <h3 v-if="letter" class="crate-section-label">{{ letter }}</h3>
          <!-- grid -->
          <div v-if="!listView" class="crate-grid">
            <NuxtLink
              v-for="album in albumList"
              :key="album.id"
              :to="albumDetailHref(album)"
              class="crate-item"
            >
              <div class="crate-stack">
                <div class="crate-record" style="--i: 0">
                  <img
                    v-if="album.artworkUrl"
                    :src="album.artworkUrl"
                    :alt="album.title"
                    class="crate-record-img"
                  />
                  <div v-else class="crate-record-img crate-record-placeholder">
                    <i class="pi pi-disc" />
                  </div>
                  <SignatureOverlay v-if="album.signed" />
                </div>
              </div>
              <div class="crate-info">
                <p class="crate-genre">{{ album.title }}</p>
                <p class="crate-count">
                  {{ album.artist }}{{ album.year ? ' · ' + album.year : '' }}
                </p>
              </div>
            </NuxtLink>
          </div>
          <!-- list -->
          <div v-else class="collection-list">
            <NuxtLink
              v-for="album in albumList"
              :key="album.id"
              :to="albumDetailHref(album)"
              class="clist-row"
            >
              <div class="clist-art-wrap">
                <img
                  v-if="album.artworkUrl"
                  :src="album.artworkUrl"
                  :alt="album.title"
                  class="clist-art"
                />
                <div v-else class="clist-art clist-art-placeholder">
                  <i class="pi pi-disc" />
                </div>
                <SignatureOverlay v-if="album.signed" />
              </div>
              <div class="clist-info">
                <span class="clist-title">{{ album.title }}</span>
                <span class="clist-sub"
                  >{{ album.artist }}{{ album.year ? ' · ' + album.year : '' }} ·
                  {{ album.genre }}</span
                >
              </div>
              <div class="clist-actions" @click.stop>
                <Button
                  v-if="!album.itunesCollectionId"
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  aria-label="Rediger"
                  @click="openEdit(album)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  aria-label="Slet"
                  @click="confirmDelete = album"
                />
              </div>
              <i class="pi pi-chevron-right clist-chevron" />
            </NuxtLink>
          </div>
        </div>
      </template>

      <!-- ════ ARTISTS VIEW ════ -->
      <template v-else-if="activeView === 'artists'">
        <div
          v-for="[letter, artistList] in artistSections"
          :key="letter ?? 'all'"
          class="crate-section"
        >
          <h3 v-if="letter" class="crate-section-label">{{ letter }}</h3>
          <!-- grid -->
          <div v-if="!listView" class="artist-grid">
            <NuxtLink
              v-for="row in artistList"
              :key="row.artist"
              :to="`/collection/artist/${encodeURIComponent(row.artist)}`"
              class="artist-card"
            >
              <div class="artist-avatar">
                <img
                  v-if="row.artworks[0]"
                  :src="row.artworks[0]"
                  :alt="row.artist"
                  class="artist-avatar-img"
                />
                <span v-else class="artist-avatar-initial">{{
                  row.artist.charAt(0).toUpperCase()
                }}</span>
              </div>
              <p class="artist-card-name">{{ row.artist }}</p>
              <p class="artist-card-meta">
                {{ row.albumCount }} {{ row.albumCount === 1 ? 'album' : 'albums' }}
              </p>
            </NuxtLink>
          </div>
          <!-- list -->
          <div v-else class="collection-list">
            <NuxtLink
              v-for="row in artistList"
              :key="row.artist"
              :to="`/collection/artist/${encodeURIComponent(row.artist)}`"
              class="clist-row"
            >
              <div class="clist-art-wrap">
                <img
                  v-if="row.artworks[0]"
                  :src="row.artworks[0]"
                  :alt="row.artist"
                  class="clist-art clist-art-round"
                />
                <div v-else class="clist-art clist-art-placeholder clist-art-round">
                  <span class="clist-initial">{{ row.artist.charAt(0).toUpperCase() }}</span>
                </div>
              </div>
              <div class="clist-info">
                <span class="clist-title">{{ row.artist }}</span>
                <span class="clist-sub">
                  {{ row.albumCount }} {{ row.albumCount === 1 ? 'album' : 'albums' }} ·
                  {{ row.genres }}
                </span>
              </div>
              <i class="pi pi-chevron-right clist-chevron" />
            </NuxtLink>
          </div>
        </div>
      </template>
    </template>

    <!-- ── Edit Dialog ───────────────────────────────────── -->
    <Dialog
      v-model:visible="editDialogVisible"
      header="Rediger album"
      modal
      :style="{ width: '480px' }"
    >
      <div v-if="editForm" class="add-dialog-body">
        <div class="form-field">
          <label>Albumtitel</label>
          <InputText v-model="editForm.title" class="w-full" />
        </div>
        <div class="form-field">
          <label>Kunstner</label>
          <InputText v-model="editForm.artist" class="w-full" />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="editForm.genre" class="w-full" />
          </div>
          <div class="form-field form-field-year">
            <label>År</label>
            <InputNumber v-model="editForm.year" :use-grouping="false" class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label>
            Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span>
          </label>
          <Textarea v-model="editForm.notes" rows="2" class="w-full" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="editDialogVisible = false" />
        <Button label="Gem" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- ── Discogs Import Dialog ────────────────────────── -->
    <Dialog
      v-model:visible="importDialogVisible"
      :header="
        importStep === 'input'
          ? 'Importer fra Discogs'
          : `Fandt ${importCandidates.length} udgivelser`
      "
      modal
      :style="{ width: '600px', maxWidth: '95vw' }"
      :closable="!importSaving"
    >
      <!-- Step 1: username input -->
      <div v-if="importStep === 'input'" class="import-step-input">
        <p class="import-description">
          Indtast dit Discogs-brugernavn for at importere din samling. Kun offentlige samlinger kan
          importeres.
        </p>
        <div class="import-username-row">
          <InputText
            v-model="importUsername"
            placeholder="Discogs-brugernavn"
            class="flex-1"
            :disabled="importLoading"
            @keydown.enter="fetchDiscogsCollection"
          />
          <Button
            label="Hent"
            icon="pi pi-search"
            :loading="importLoading"
            :disabled="!importUsername.trim()"
            @click="fetchDiscogsCollection"
          />
        </div>
        <p v-if="importError" class="import-error">
          <i class="pi pi-exclamation-triangle" /> {{ importError }}
        </p>
      </div>

      <!-- Step 2: preview -->
      <div v-else class="import-step-preview">
        <div class="import-preview-summary">
          <span class="import-summary-new"
            >{{ importCandidates.filter((c) => !c.duplicate).length }} ny</span
          >
          <span
            v-if="
              importCandidates.filter((c) => !c.duplicate && c.matchConfidence !== 'exact').length >
              0
            "
            class="import-summary-review"
          >
            <i class="pi pi-exclamation-triangle" />
            {{
              importCandidates.filter((c) => !c.duplicate && c.matchConfidence !== 'exact').length
            }}
            kræver gennemsyn
          </span>
          <span class="import-summary-dup"
            >{{ importCandidates.filter((c) => c.duplicate).length }} allerede i samling</span
          >
          <button
            class="import-toggle-all"
            @click="
              importCandidates.forEach((c) => {
                if (!c.duplicate) c.selected = !c.selected
              })
            "
          >
            Vælg/fravælg alle
          </button>
        </div>
        <div class="import-preview-list">
          <label
            v-for="item in importCandidates"
            :key="item.discogsReleaseId"
            class="import-preview-item"
            :class="{
              'is-duplicate': item.duplicate,
              'is-deselected': !item.selected && !item.duplicate,
            }"
          >
            <input
              type="checkbox"
              :checked="item.selected"
              :disabled="item.duplicate"
              class="import-checkbox"
              @change="item.selected = ($event.target as HTMLInputElement).checked"
            />
            <img
              v-if="item.artworkUrl"
              :src="item.artworkUrl"
              :alt="item.title"
              class="import-preview-art"
            />
            <div v-else class="import-preview-art import-preview-art-placeholder">
              <i class="pi pi-disc" />
            </div>
            <div class="import-preview-info">
              <p class="import-preview-title">{{ item.title }}</p>
              <p class="import-preview-sub">
                {{ item.artist }} · {{ item.year }} · {{ item.genre }}
              </p>
              <p
                v-if="
                  item.matchConfidence === 'review' && (item.matchedTitle || item.matchedArtist)
                "
                class="import-preview-matched"
              >
                <i class="pi pi-info-circle" />
                Matchet som: <em>{{ item.matchedTitle }}</em>
                <template v-if="item.matchedArtist">
                  by <em>{{ item.matchedArtist }}</em></template
                >
              </p>
            </div>
            <span v-if="item.duplicate" class="import-dup-badge">Allerede tilføjet</span>
            <span
              v-else-if="item.matchConfidence === 'exact'"
              class="import-confidence-badge exact"
            >
              <i class="pi pi-check" /> Nøjagtig
            </span>
            <span
              v-else-if="item.matchConfidence === 'review'"
              class="import-confidence-badge review"
            >
              <i class="pi pi-exclamation-triangle" /> Gennemsyn
            </span>
            <span v-else class="import-confidence-badge no-match">
              <i class="pi pi-ban" /> Intet match
            </span>
            <button
              v-if="!item.duplicate && item.matchConfidence !== 'exact'"
              class="find-manually-btn"
              @click.stop="openManualSearch(item)"
            >
              <i class="pi pi-search" /> Find manuelt
            </button>
          </label>
        </div>
      </div>

      <template #footer>
        <template v-if="importStep === 'input'">
          <Button label="Annuller" text @click="importDialogVisible = false" />
        </template>
        <template v-else>
          <Button
            label="Tilbage"
            text
            icon="pi pi-arrow-left"
            @click="importStep = 'input'"
            :disabled="importSaving"
          />
          <Button
            :label="`Importer ${importSelectedCount} album${importSelectedCount !== 1 ? 's' : ''}`"
            icon="pi pi-download"
            :loading="importSaving"
            :disabled="importSelectedCount === 0"
            @click="doImport"
          />
        </template>
      </template>
    </Dialog>

    <!-- ── Manual Match Modal ───────────────────────────── -->
    <Dialog
      v-model:visible="manualModalVisible"
      modal
      :dismissable-mask="true"
      :style="{ width: '620px', maxWidth: '95vw' }"
      :pt="{ header: { style: 'padding-bottom: 0' } }"
    >
      <template #header>
        <div class="manual-modal-header">
          <div class="manual-modal-title">
            <span class="manual-modal-for">Finder match for</span>
            <strong class="manual-modal-item-name">
              {{ manualModalItem?.artist }} – {{ manualModalItem?.title }}
            </strong>
          </div>
          <div class="manual-search-breadcrumb">
            <span
              class="manual-breadcrumb-step"
              :class="{ active: manualStep === 'artist', done: manualStep === 'albums' }"
              >1 · Kunstner</span
            >
            <i class="pi pi-chevron-right manual-breadcrumb-sep" />
            <span class="manual-breadcrumb-step" :class="{ active: manualStep === 'albums' }"
              >2 · Album</span
            >
          </div>
        </div>
      </template>

      <div class="manual-modal-body">
        <!-- Step 1: find the artist -->
        <template v-if="manualStep === 'artist'">
          <div class="manual-search-fields">
            <InputText
              v-model="manualArtistQuery"
              placeholder="Kunstnernavn…"
              size="small"
              class="flex-1"
              @keydown.enter="searchArtists"
            />
            <Button
              icon="pi pi-search"
              label="Søg"
              size="small"
              :loading="manualSearchLoading"
              @click="searchArtists"
            />
          </div>
          <div v-if="manualSearchLoading" class="manual-search-spinner">
            <ProgressSpinner stroke-width="4" style="width: 32px; height: 32px" />
          </div>
          <div v-else-if="manualArtistResults.length === 0" class="manual-search-empty">
            Ingen kunstnere fundet
          </div>
          <div v-else class="manual-artist-list">
            <button
              v-for="artist in manualArtistResults"
              :key="artist.artistId"
              class="manual-artist-item"
              @click="selectArtist(artist)"
            >
              <div class="manual-artist-avatar">
                <img
                  v-if="artist.artworkUrl"
                  :src="artist.artworkUrl"
                  :alt="artist.artistName"
                  class="manual-artist-avatar-img"
                />
                <span v-else>{{ artist.artistName.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="manual-artist-info">
                <p class="manual-artist-name">{{ artist.artistName }}</p>
                <p class="manual-artist-genre">{{ artist.primaryGenreName ?? '—' }}</p>
              </div>
              <i class="pi pi-chevron-right manual-artist-chevron" />
            </button>
          </div>
        </template>

        <!-- Step 2: pick an album from their discography -->
        <template v-else>
          <div class="manual-discog-header">
            <button class="manual-back-btn" @click="manualStep = 'artist'">
              <i class="pi pi-arrow-left" /> Tilbage
            </button>
            <span class="manual-discog-artist">{{ manualSelectedArtist?.artistName }}</span>
          </div>
          <div v-if="manualSearchLoading" class="manual-search-spinner">
            <ProgressSpinner stroke-width="4" style="width: 32px; height: 32px" />
          </div>
          <div v-else-if="manualAlbums.length === 0" class="manual-search-empty">
            Ingen albums fundet
          </div>
          <div v-else class="manual-album-grid">
            <button
              v-for="album in manualAlbums"
              :key="album.collectionId"
              class="manual-album-tile"
              @click="manualModalItem && applyManualMatch(manualModalItem, album)"
            >
              <img
                :src="(album.artworkUrl100 ?? '').replace('100x100bb', '160x160bb')"
                :alt="album.collectionName"
                class="manual-album-art"
              />
              <div class="manual-album-info">
                <p class="manual-album-title">{{ album.collectionName }}</p>
                <p class="manual-album-year">
                  {{ album.releaseDate ? new Date(album.releaseDate).getFullYear() : '' }}
                </p>
              </div>
            </button>
          </div>
        </template>
      </div>
    </Dialog>

    <!-- ── Delete Dialog ─────────────────────────────────── -->
    <Dialog
      v-model:visible="showDeleteDialog"
      header="Slet album"
      modal
      :style="{ width: '380px' }"
    >
      <p style="margin: 0">
        Fjern <strong>{{ confirmDelete?.title }}</strong> fra din samling?
      </p>
      <template #footer>
        <Button label="Annuller" text @click="confirmDelete = null" />
        <Button
          label="Slet"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="doDelete"
        />
      </template>
    </Dialog>
  </div>
</template>
