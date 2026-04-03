<script setup lang="ts">
import type { ItunesAlbum } from '~/composables/useAppleMusic'

const route = useRoute()
const router = useRouter()
const { getArtistAlbums } = useAppleMusic()

const artistId = computed(() => Number(route.params.id))
const artistName = computed(() => (route.query.name as string) || 'Artist')
const artistGenre = computed(() => (route.query.genre as string) || '')

useSeoMeta({ title: () => `${artistName.value} — Vinyl Collection` })

const { data: albums, status } = await useAsyncData(
  `artist-${artistId.value}`,
  () => getArtistAlbums(artistId.value),
)

const loading = computed(() => status.value === 'pending')

const sortedAlbums = computed(() =>
  [...(albums.value || [])].sort(
    (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime(),
  ),
)

function goToAlbum(album: ItunesAlbum) {
  router.push(
    `/album/${album.collectionId}?name=${encodeURIComponent(album.collectionName)}&artist=${encodeURIComponent(album.artistName)}`,
  )
}
</script>

<template>
  <div>
    <!-- Back button -->
    <div style="margin-bottom: 1.5rem">
      <Button
        text
        icon="pi pi-arrow-left"
        label="Back to search"
        @click="router.back()"
      />
    </div>

    <!-- Artist Hero -->
    <div class="artist-hero">
      <div class="artist-hero-avatar">
        {{ artistName.charAt(0).toUpperCase() }}
      </div>
      <div>
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem">
          <Badge value="Artist" severity="secondary" />
          <span v-if="artistGenre" style="color: rgba(255,255,255,0.5); font-size: 0.875rem">{{ artistGenre }}</span>
        </div>
        <h1 class="artist-hero-name">{{ artistName }}</h1>
        <p v-if="loading" style="color: rgba(255,255,255,0.5)">Loading discography…</p>
        <p v-else class="artist-hero-genre">
          {{ sortedAlbums.length }} album{{ sortedAlbums.length !== 1 ? 's' : '' }} in collection
        </p>
      </div>
    </div>

    <!-- Albums Grid -->
    <div v-if="loading" style="text-align: center; padding: 3rem">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <template v-else>
      <div v-if="sortedAlbums.length === 0" class="empty-state">
        <div class="empty-state-icon"><i class="pi pi-images" /></div>
        <p class="empty-state-title">No albums found</p>
        <p class="empty-state-text">This artist has no albums in the iTunes library</p>
      </div>

      <div v-else>
        <h2 class="section-title">
          <i class="pi pi-images" style="color: var(--p-primary-500)" />
          Discography
          <span class="title-count">{{ sortedAlbums.length }}</span>
        </h2>
        <div class="card-grid-lg">
          <AlbumCard
            v-for="album in sortedAlbums"
            :key="album.collectionId"
            :album="album"
            @click="goToAlbum"
          />
        </div>
      </div>
    </template>
  </div>
</template>
