<script setup lang="ts">
import type { DiscogsRelease } from '~/composables/useDiscogs'

const route = useRoute()
const router = useRouter()
const { getAlbumTracks, getArtworkUrl, formatReleaseYear } = useAppleMusic()
const { searchRelease, getDiscogsUrl } = useDiscogs()

const albumId = computed(() => Number(route.params.id))
const albumNameParam = computed(() => (route.query.name as string) || '')
const artistParam = computed(() => (route.query.artist as string) || '')

useSeoMeta({ title: () => `${albumNameParam.value} — Vinyl Collection` })

// Load album data and tracks
const { data: albumData, status } = await useAsyncData(
  `album-${albumId.value}`,
  () => getAlbumTracks(albumId.value),
)

const loading = computed(() => status.value === 'pending')

const album = computed(() => albumData.value?.album)
const tracks = computed(() => albumData.value?.tracks || [])

const artworkUrl = computed(() =>
  album.value ? getArtworkUrl(album.value.artworkUrl100, 500) : '',
)
const releaseYear = computed(() =>
  album.value ? formatReleaseYear(album.value.releaseDate) : '',
)

// Load Discogs data after album is ready
const discogsRelease = ref<DiscogsRelease | null>(null)
const discogsLoading = ref(false)

watch(album, async (val) => {
  if (!val) return
  discogsLoading.value = true
  try {
    discogsRelease.value = await searchRelease(val.artistName, val.collectionName)
  } finally {
    discogsLoading.value = false
  }
}, { immediate: true })

const discogsUrl = computed(() =>
  discogsRelease.value ? getDiscogsUrl(discogsRelease.value) : null,
)

function openAppleMusic() {
  if (album.value?.collectionViewUrl) {
    window.open(album.value.collectionViewUrl, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div>
    <!-- Back -->
    <div style="margin-bottom: 1.5rem">
      <Button
        text
        icon="pi pi-arrow-left"
        label="Back"
        @click="router.back()"
      />
    </div>

    <!-- Loading state -->
    <div v-if="loading" style="text-align: center; padding: 4rem">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <template v-else>
      <!-- Album Hero -->
      <div class="album-hero">
        <!-- Artwork -->
        <div>
          <img
            v-if="artworkUrl"
            :src="artworkUrl"
            :alt="album?.collectionName"
            class="album-cover"
          />
          <div v-else class="album-cover-placeholder">
            <i class="pi pi-disc" />
          </div>
        </div>

        <!-- Meta -->
        <div class="album-meta">
          <div class="album-type-badge">
            <i class="pi pi-disc" />
            Album
          </div>

          <h1 class="album-title">{{ album?.collectionName || albumNameParam }}</h1>

          <NuxtLink
            v-if="album?.artistId"
            :to="`/artist/${album.artistId}?name=${encodeURIComponent(album.artistName)}`"
            class="album-artist-link"
          >
            {{ album?.artistName || artistParam }}
          </NuxtLink>
          <span v-else class="album-artist-link" style="cursor: default">
            {{ artistParam }}
          </span>

          <div class="album-stats">
            <span v-if="releaseYear" class="album-stat">
              <i class="pi pi-calendar" />
              {{ releaseYear }}
            </span>
            <span v-if="tracks.length" class="album-stat">
              <i class="pi pi-list" />
              {{ tracks.length }} tracks
            </span>
            <span v-if="album?.primaryGenreName" class="album-stat">
              <i class="pi pi-tag" />
              {{ album.primaryGenreName }}
            </span>
            <span v-if="album?.country" class="album-stat">
              <i class="pi pi-globe" />
              {{ album.country }}
            </span>
          </div>

          <div class="album-actions">
            <!-- Apple Music link -->
            <Button
              icon="pi pi-apple"
              label="Listen on Apple Music"
              size="small"
              :disabled="!album?.collectionViewUrl"
              @click="openAppleMusic"
            />

            <!-- Discogs link -->
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
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View on Discogs
              </a>
              <Tag v-else severity="secondary" value="Not on Discogs" />
            </div>
          </div>

          <!-- Discogs community stats -->
          <div v-if="discogsRelease?.community" style="margin-top: 1.25rem; display: flex; gap: 1.5rem">
            <div style="text-align: center">
              <p style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0">
                {{ discogsRelease.community.have.toLocaleString() }}
              </p>
              <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin: 0.15rem 0 0">Have</p>
            </div>
            <div style="text-align: center">
              <p style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0">
                {{ discogsRelease.community.want.toLocaleString() }}
              </p>
              <p style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin: 0.15rem 0 0">Want</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Track List -->
      <div v-if="tracks.length > 0">
        <h2 class="section-title">
          <i class="pi pi-list" style="color: var(--p-primary-500)" />
          Tracks
          <span class="title-count">{{ tracks.length }}</span>
        </h2>
        <TrackList :tracks="tracks" />
      </div>

      <div v-else class="empty-state">
        <div class="empty-state-icon"><i class="pi pi-music" /></div>
        <p class="empty-state-title">No tracks available</p>
      </div>
    </template>
  </div>
</template>
