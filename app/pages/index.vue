<script setup lang="ts">
import type { ItunesArtist, ItunesAlbum, ItunesTrack } from '~/composables/useAppleMusic'

useSeoMeta({ title: 'Vinyl Collection — Discover Music' })

const router = useRouter()
const route = useRoute()
const { searchArtists, searchAll, formatDuration, formatReleaseYear } = useAppleMusic()

const searchQuery = ref((route.query.q as string) || '')
const activeTab = ref(0)
const loading = ref(false)
const hasSearched = ref(false)

const artists = ref<ItunesArtist[]>([])
const albums = ref<ItunesAlbum[]>([])
const songs = ref<ItunesTrack[]>([])

const tabs = computed(() => [
  { label: `Artists`, icon: 'pi pi-user', count: artists.value.length },
  { label: `Albums`, icon: 'pi pi-images', count: albums.value.length },
  { label: `Songs`, icon: 'pi pi-music', count: songs.value.length },
])

async function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return

  loading.value = true
  hasSearched.value = true

  await router.replace({ query: { q } })

  try {
    const [artistResults, allResults] = await Promise.all([
      searchArtists(q),
      searchAll(q),
    ])
    artists.value = artistResults
    albums.value = (allResults as ItunesAlbum[]).filter(
      (r) => (r as ItunesAlbum).wrapperType === 'collection',
    )
    songs.value = (allResults as ItunesTrack[]).filter(
      (r) => (r as ItunesTrack).wrapperType === 'track',
    )
    // Set to first tab with results
    if (artists.value.length > 0) activeTab.value = 0
    else if (albums.value.length > 0) activeTab.value = 1
    else activeTab.value = 2
  } finally {
    loading.value = false
  }
}

function goToArtist(artist: ItunesArtist) {
  router.push(`/artist/${artist.artistId}?name=${encodeURIComponent(artist.artistName)}`)
}

function goToAlbum(album: ItunesAlbum) {
  router.push(`/album/${album.collectionId}?name=${encodeURIComponent(album.collectionName)}&artist=${encodeURIComponent(album.artistName)}`)
}

// Auto-search if query param present
onMounted(() => {
  if (searchQuery.value) doSearch()
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero-section">
      <div class="hero-eyebrow">
        <i class="pi pi-music" />
        Apple Music · Discogs
      </div>
      <h1 class="hero-title">
        Explore the World of<br />
        <span class="gradient-text">Vinyl &amp; Music</span>
      </h1>
      <p class="hero-subtitle">
        Search millions of artists, albums, and songs. Discover vinyl records with direct Discogs links.
      </p>

      <div class="search-wrapper">
        <div class="search-input-group">
          <InputText
            v-model="searchQuery"
            placeholder="Search artists, albums, songs…"
            @keyup.enter="doSearch"
          />
          <Button
            icon="pi pi-search"
            label="Search"
            :loading="loading"
            @click="doSearch"
          />
        </div>
      </div>
    </section>

    <!-- Results -->
    <div v-if="loading" style="padding: 3rem 0; text-align: center">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
      <p style="color: var(--app-text-muted); margin-top: 1rem">Searching the universe…</p>
    </div>

    <template v-else-if="hasSearched">
      <!-- No results -->
      <div
        v-if="!artists.length && !albums.length && !songs.length"
        class="empty-state"
      >
        <div class="empty-state-icon"><i class="pi pi-search" /></div>
        <p class="empty-state-title">No results found</p>
        <p class="empty-state-text">Try a different artist or album name</p>
      </div>

      <div v-else>
        <Tabs v-model:value="activeTab" class="search-tabs">
          <TabList>
            <Tab v-for="(tab, i) in tabs" :key="i" :value="i">
              <i :class="tab.icon" style="margin-right: 0.4rem" />
              {{ tab.label }}
              <Tag v-if="tab.count" :value="tab.count" severity="secondary" style="margin-left: 0.5rem; font-size: 0.75rem" />
            </Tab>
          </TabList>

          <TabPanels>
            <!-- Artists Tab -->
            <TabPanel :value="0">
              <div style="padding-top: 1.5rem">
                <div v-if="artists.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-user" /></div>
                  <p class="empty-state-title">No artists found</p>
                  <p class="empty-state-text">Try the Albums or Songs tabs</p>
                </div>
                <div v-else style="display: flex; flex-direction: column; gap: 0.75rem">
                  <ArtistCard
                    v-for="artist in artists"
                    :key="artist.artistId"
                    :artist="artist"
                    @click="goToArtist"
                  />
                </div>
              </div>
            </TabPanel>

            <!-- Albums Tab -->
            <TabPanel :value="1">
              <div style="padding-top: 1.5rem">
                <div v-if="albums.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-images" /></div>
                  <p class="empty-state-title">No albums found</p>
                  <p class="empty-state-text">Try the Artists or Songs tabs</p>
                </div>
                <div v-else class="card-grid-lg">
                  <AlbumCard
                    v-for="album in albums"
                    :key="album.collectionId"
                    :album="album"
                    @click="goToAlbum"
                  />
                </div>
              </div>
            </TabPanel>

            <!-- Songs Tab -->
            <TabPanel :value="2">
              <div style="padding-top: 1.5rem">
                <div v-if="songs.length === 0" class="empty-state">
                  <div class="empty-state-icon"><i class="pi pi-music" /></div>
                  <p class="empty-state-title">No songs found</p>
                </div>
                <div v-else class="track-list">
                  <div class="track-list-header">
                    <span style="text-align: center">#</span>
                    <span>Title</span>
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
                        <span v-if="song.releaseDate"> · {{ formatReleaseYear(song.releaseDate) }}</span>
                      </p>
                    </div>
                    <span class="track-duration">{{ formatDuration(song.trackTimeMillis || 0) }}</span>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </template>

    <!-- Default state (no search yet) -->
    <div v-else class="empty-state" style="padding: 3rem 1rem">
      <div class="empty-state-icon"><i class="pi pi-vinyl" /></div>
      <p class="empty-state-title">Discover Your Sound</p>
      <p class="empty-state-text">Search for an artist to get started</p>
    </div>
  </div>
</template>
