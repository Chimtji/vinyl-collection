<script setup lang="ts">
import type { DiscogsRelease } from '~/composables/useDiscogs'

definePageMeta({ ssr: false })

const route = useRoute()
const router = useRouter()
const { getAlbumTracks, getArtworkUrl, formatReleaseYear } = useAppleMusic()
const { searchRelease, getDiscogsUrl } = useDiscogs()
const { addAlbum, albums, fetchCollection } = useCollection()
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

const displayTitle = computed(() => itunesAlbum.value?.collectionName ?? '')
const displayArtist = computed(() => itunesAlbum.value?.artistName ?? '')
const displayYear = computed(() =>
  itunesAlbum.value ? formatReleaseYear(itunesAlbum.value.releaseDate) : '',
)
const displayGenre = computed(() => itunesAlbum.value?.primaryGenreName ?? '')
const displayArtistId = computed(() => itunesAlbum.value?.artistId ?? null)
const artworkUrl = computed(() =>
  itunesAlbum.value?.artworkUrl100 ? getArtworkUrl(itunesAlbum.value.artworkUrl100, 500) : '',
)

// Load Discogs + Wikipedia in parallel after album loads
const discogsRelease = ref<DiscogsRelease | null>(null)
const discogsLoading = ref(false)
const wikiSummary = ref<{ title: string; extract: string; url: string } | null>(null)

watch(
  itunesAlbum,
  async (album) => {
    if (!album) return
    discogsLoading.value = true
    const [discogsResult, wikiResult] = await Promise.all([
      searchRelease(album.artistName, album.collectionName).catch(() => null),
      $fetch<{ title: string; extract: string; url: string } | null>(
        `/api/wikipedia/summary?artist=${encodeURIComponent(album.artistName)}&album=${encodeURIComponent(album.collectionName)}`,
      ).catch(() => null),
    ])
    discogsRelease.value = discogsResult
    wikiSummary.value = wikiResult
    discogsLoading.value = false
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

const vinylpladenUrl = computed(() => {
  const artist = displayArtist.value
  const title = displayTitle.value
  if (!artist || !title) return null
  return `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(artist)}/${toVinylpladenSlug(title)}-LP`
})

const vinylpladenPrice = ref<string | null>(null)
const vinylpladenPriceLoading = ref(false)

watch(
  vinylpladenUrl,
  async (url) => {
    if (!url) return
    vinylpladenPrice.value = null
    vinylpladenPriceLoading.value = true
    try {
      const result = await $fetch<{ price: string | null }>(
        `/api/vinylpladen/price?url=${encodeURIComponent(url)}`,
      )
      vinylpladenPrice.value = result.price
    } catch {
      vinylpladenPrice.value = null
    } finally {
      vinylpladenPriceLoading.value = false
    }
  },
  { immediate: true },
)

function openAppleMusic() {
  if (itunesAlbum.value?.collectionViewUrl) {
    window.open(itunesAlbum.value.collectionViewUrl, '_blank', 'noopener,noreferrer')
  }
}

onMounted(() => fetchCollection())
onMounted(() => fetchWishlist())

const inCollection = computed(
  () => albums.value.find((a) => a.itunesCollectionId === itunesId) ?? null,
)

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
    const newAlbum = await addAlbum({
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
    router.push(`/album/${newAlbum.id}`)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div>
    <!-- Back -->
    <div style="margin-bottom: 1.5rem">
      <Button text icon="pi pi-arrow-left" label="Back" @click="router.back()" />
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align: center; padding: 4rem">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <!-- Not found -->
    <div v-else-if="!itunesAlbum" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-exclamation-triangle" /></div>
      <p class="empty-state-title">Album not found</p>
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
              {{ wishlisted ? 'Wishlisted' : 'Add to wishlist' }}
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
              {{ adding ? 'Adding…' : 'Add to collection' }}
            </button>
            <NuxtLink
              v-else
              :to="`/album/${inCollection.id}`"
              style="text-decoration: none; margin-bottom: 0"
            >
              <button class="album-type-badge collection-action-badge" style="margin-bottom: 0">
                <span class="cab-default"><i class="pi pi-check" /> In my collection</span>
                <span class="cab-hover"><i class="pi pi-arrow-right" /> Go to album</span>
              </button>
            </NuxtLink>
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
              {{ tracks.length }} tracks
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
              :href="vinylpladenUrl"
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
                Not on Discogs
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
                Have
              </p>
            </div>
            <div style="text-align: center">
              <p style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0">
                {{ discogsRelease.community.want.toLocaleString() }}
              </p>
              <p style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin: 0.15rem 0 0">
                Want
              </p>
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

      <!-- Wikipedia summary -->
      <div v-if="wikiSummary" class="album-wiki">
        <h2 class="section-title">
          <i class="pi pi-book" style="color: var(--p-primary-500)" />
          About
        </h2>
        <p class="album-wiki-text">{{ wikiSummary.extract }}</p>
        <a
          :href="wikiSummary.url"
          target="_blank"
          rel="noopener noreferrer"
          class="album-wiki-link"
        >
          Read more on Wikipedia
          <i class="pi pi-external-link" style="font-size: 0.7rem" />
        </a>
      </div>
    </template>
  </div>
</template>
