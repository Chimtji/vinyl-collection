<script setup lang="ts">
import type { ItunesArtist, ItunesAlbum, ItunesTrack } from '~/composables/useAppleMusic'
import type { CollectionAlbum } from '~/composables/useCollection'

useSeoMeta({ title: 'Søg musik — Vinylsamling' })

const router = useRouter()
const route = useRoute()
const { searchCombined, formatDuration, formatReleaseYear, getArtworkUrl } = useAppleMusic()
const { addAlbum, albums: collectionAlbums, fetchCollection } = useCollection()
const { addToWishlist, removeFromWishlist, isWishlisted, getWishlistItem, fetchWishlist } =
  useWishlist()
const wishlistPending = ref<number | null>(null)

const searchQuery = ref((route.query.q as string) || '')
const activeTab = ref(0)
const loading = ref(false)
const hasSearched = ref(false)

const artists = ref<ItunesArtist[]>([])
const albums = ref<ItunesAlbum[]>([])
const songs = ref<ItunesTrack[]>([])

const tabs = computed(() => [
  { label: `Kunstnere`, icon: 'pi pi-user', count: artists.value.length },
  { label: `Albums`, icon: 'pi pi-images', count: albums.value.length },
  { label: `Sange`, icon: 'pi pi-music', count: songs.value.length },
])

async function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return

  loading.value = true
  hasSearched.value = true

  await router.replace({ query: { q } })

  try {
    const results = await searchCombined(q)
    artists.value = results.artists
    albums.value = results.albums
    songs.value = results.songs
    if (artists.value.length > 0) activeTab.value = 0
    else if (albums.value.length > 0) activeTab.value = 1
    else activeTab.value = 2
  } catch (error) {
    console.error('[Search Error]', error)
  } finally {
    loading.value = false
  }
}

function goToArtist(artist: ItunesArtist) {
  router.push(`/artist/${artist.artistId}?name=${encodeURIComponent(artist.artistName)}`)
}

function goToAlbum(album: ItunesAlbum) {
  router.push(`/album/itunes/${album.collectionId}`)
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

onMounted(() => {
  if (searchQuery.value) doSearch()
  fetchCollection()
  fetchWishlist()
})

const quickGenres = [
  'Rock',
  'Jazz',
  'Hip-Hop',
  'Electronic',
  'Soul',
  'Pop',
  'Metal',
  'Classical',
  'R&B',
  'Folk',
]

function quickSearch(genre: string) {
  searchQuery.value = genre
  doSearch()
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero-section" :class="{ 'hero-section--compact': hasSearched || loading }">
      <!-- Floating vinyl decorations -->
      <div class="hero-vinyl hero-vinyl--1" aria-hidden="true" />
      <div class="hero-vinyl hero-vinyl--2" aria-hidden="true" />
      <div class="hero-vinyl hero-vinyl--3" aria-hidden="true" />

      <div class="hero-eyebrow">
        <i class="pi pi-music" />
        Apple Music · Discogs
      </div>
      <h1 class="hero-title">
        Udforsk verden af<br />
        <span class="gradient-text">Vinyl &amp; Musik</span>
      </h1>
      <p class="hero-subtitle">
        Søg i millioner af kunstnere, albums og sange. Tilføj dem direkte til din vinylsamling.
      </p>

      <div class="search-wrapper">
        <div class="search-input-group">
          <InputText
            v-model="searchQuery"
            placeholder="Søg kunstnere, albums, sange…"
            @keyup.enter="doSearch"
          />
          <Button icon="pi pi-search" label="Søg" :loading="loading" @click="doSearch" />
        </div>

        <!-- Quick-search genre chips — only shown before first search -->
        <div v-if="!hasSearched && !loading" class="search-genre-chips">
          <button
            v-for="genre in quickGenres"
            :key="genre"
            class="search-genre-chip"
            @click="quickSearch(genre)"
          >
            {{ genre }}
          </button>
        </div>
      </div>
    </section>

    <!-- Results -->
    <div v-if="loading" class="search-loading">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
      <p>Søger i universet…</p>
    </div>

    <template v-else-if="hasSearched">
      <div v-if="!artists.length && !albums.length && !songs.length" class="empty-state">
        <div class="empty-state-icon"><i class="pi pi-search" /></div>
        <p class="empty-state-title">Ingen resultater fundet</p>
        <p class="empty-state-text">Prøv et andet kunstner- eller albumnavn</p>
      </div>

      <div v-else>
        <Tabs v-model:value="activeTab" class="search-tabs">
          <TabList>
            <Tab v-for="(tab, i) in tabs" :key="i" :value="i">
              <i :class="tab.icon" style="margin-right: 0.4rem" />
              {{ tab.label }}
              <Tag
                v-if="tab.count"
                :value="tab.count"
                severity="secondary"
                style="margin-left: 0.5rem; font-size: 0.75rem"
              />
            </Tab>
          </TabList>

          <TabPanels>
            <!-- Artists Tab -->
            <TabPanel :value="0">
              <div style="padding-top: 1.5rem">
                <div v-if="artists.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-user" /></div>
                  <p class="empty-state-title">Ingen kunstnere fundet</p>
                  <p class="empty-state-text">Prøv fanerne Albums eller Sange</p>
                </div>
                <div v-else class="search-artist-grid">
                  <div
                    v-for="artist in artists"
                    :key="artist.artistId"
                    class="search-artist-card"
                    role="button"
                    tabindex="0"
                    @click="goToArtist(artist)"
                    @keyup.enter="goToArtist(artist)"
                  >
                    <div class="search-artist-avatar">
                      {{ artist.artistName.charAt(0).toUpperCase() }}
                    </div>
                    <div class="search-artist-info">
                      <p class="search-artist-name">{{ artist.artistName }}</p>
                      <p class="search-artist-genre">{{ artist.primaryGenreName || 'Musik' }}</p>
                    </div>
                    <i class="pi pi-arrow-right search-artist-arrow" />
                  </div>
                </div>
              </div>
            </TabPanel>

            <!-- Albums Tab -->
            <TabPanel :value="1">
              <div style="padding-top: 1.5rem">
                <div v-if="albums.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-images" /></div>
                  <p class="empty-state-title">Ingen albums fundet</p>
                  <p class="empty-state-text">Prøv fanerne Kunstnere eller Sange</p>
                </div>
                <div v-else class="crate-grid">
                  <div
                    v-for="album in albums"
                    :key="album.collectionId"
                    class="crate-item"
                    @click="goToAlbum(album)"
                  >
                    <div class="crate-stack">
                      <div class="crate-record" style="--i: 0">
                        <img
                          v-if="album.artworkUrl100"
                          :src="getArtworkUrl(album.artworkUrl100, 300)"
                          :alt="album.collectionName"
                          class="crate-record-img"
                        />
                        <div v-else class="crate-record-img crate-record-placeholder">
                          <i class="pi pi-disc" />
                        </div>

                        <!-- In-collection badge -->
                        <div
                          v-if="
                            collectionAlbums.some(
                              (a) => a.itunesCollectionId === album.collectionId,
                            )
                          "
                          class="search-crate-badge search-crate-badge--owned"
                          title="I din samling"
                        >
                          <i class="pi pi-check" />
                        </div>
                        <div
                          v-else-if="isWishlisted(album.collectionId)"
                          class="search-crate-badge search-crate-badge--wished"
                          title="På ønskeliste"
                        >
                          <i class="pi pi-heart-fill" />
                        </div>

                        <!-- Hover actions overlay -->
                        <div class="crate-item-actions" @click.stop>
                          <Button
                            v-if="
                              !collectionAlbums.some(
                                (a) => a.itunesCollectionId === album.collectionId,
                              )
                            "
                            :icon="
                              isWishlisted(album.collectionId) ? 'pi pi-heart-fill' : 'pi pi-heart'
                            "
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
                            v-if="
                              !collectionAlbums.some(
                                (a) => a.itunesCollectionId === album.collectionId,
                              )
                            "
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
                    </div>
                    <div class="crate-info">
                      <p class="crate-genre">{{ album.collectionName }}</p>
                      <p class="crate-count">
                        {{ album.artistName
                        }}<span v-if="album.releaseDate">
                          · {{ formatReleaseYear(album.releaseDate) }}</span
                        >
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            <!-- Songs Tab -->
            <TabPanel :value="2">
              <div style="padding-top: 1.5rem">
                <div v-if="songs.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-music" /></div>
                  <p class="empty-state-title">Ingen sange fundet</p>
                </div>
                <div v-else class="track-list">
                  <div class="track-list-header">
                    <span style="text-align: center">#</span>
                    <span>Titel</span>
                    <span><i class="pi pi-clock" /></span>
                  </div>
                  <div
                    v-for="(song, i) in songs"
                    :key="song.trackId"
                    class="track-item"
                    style="cursor: pointer"
                    role="button"
                    tabindex="0"
                    @click="goToAlbum(song as unknown as ItunesAlbum)"
                    @keyup.enter="goToAlbum(song as unknown as ItunesAlbum)"
                  >
                    <span class="track-number">{{ i + 1 }}</span>
                    <div class="track-info">
                      <p class="track-name">{{ song.trackName }}</p>
                      <p class="track-artist">
                        {{ song.artistName }}
                        <span v-if="song.collectionName"> · {{ song.collectionName }}</span>
                        <span v-if="song.releaseDate">
                          · {{ formatReleaseYear(song.releaseDate) }}</span
                        >
                      </p>
                    </div>
                    <span class="track-duration">{{
                      formatDuration(song.trackTimeMillis || 0)
                    }}</span>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </template>

    <!-- Pre-search idle state -->
    <div v-else class="search-idle">
      <div class="search-idle-stats">
        <div class="search-idle-stat">
          <span class="search-idle-stat-num">{{ collectionAlbums.length }}</span>
          <span class="search-idle-stat-label">i samling</span>
        </div>
        <div class="search-idle-divider" />
        <div class="search-idle-stat">
          <i class="pi pi-globe search-idle-stat-icon" />
          <span class="search-idle-stat-label">Millioner af albums tilgængelige</span>
        </div>
      </div>
      <p class="search-idle-hint">
        <i class="pi pi-arrow-up" style="font-size: 0.7rem; margin-right: 0.3rem" />Søg ovenfor
        eller vælg en genre for at komme i gang
      </p>
    </div>

    <!-- Add to Collection Dialog -->
    <Dialog
      v-model:visible="addDialogVisible"
      header="Tilføj til samling"
      modal
      :style="{ width: '480px' }"
    >
      <div class="add-dialog-body">
        <div class="add-dialog-preview" v-if="addForm.artworkUrl">
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
