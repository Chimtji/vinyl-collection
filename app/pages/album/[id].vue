<script setup lang="ts">
import type { DiscogsRelease } from '~/composables/useDiscogs'
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ ssr: false })

const route = useRoute()
const router = useRouter()
const { getAlbumTracks, getArtworkUrl, formatReleaseYear } = useAppleMusic()
const { searchRelease, getDiscogsUrl } = useDiscogs()
const { deleteAlbum } = useCollection()

const localId = route.params.id as string

// 1. Fetch the local album record first
const { data: localAlbum, error: localError } = await useFetch<CollectionAlbum>(
  `/api/collection/${localId}`,
)

useSeoMeta({
  title: () => `${localAlbum.value?.title ?? 'Album'} — Vinyl Collection`,
})

// 2. If we have an iTunes collection ID, fetch full metadata + tracks
const itunesId = computed(() => localAlbum.value?.itunesCollectionId ?? null)

const { data: itunesData, status: itunesStatus } = await useAsyncData(
  `itunes-${localId}`,
  () => (itunesId.value ? getAlbumTracks(itunesId.value) : Promise.resolve(null)),
  { watch: [itunesId] },
)

const itunesLoading = computed(() => itunesStatus.value === 'pending')
const itunesAlbum = computed(() => itunesData.value?.album ?? null)
const tracks = computed(() => itunesData.value?.tracks ?? [])

// Display values: prefer iTunes enriched data, fall back to local record
const displayTitle = computed(
  () => itunesAlbum.value?.collectionName ?? localAlbum.value?.title ?? '',
)
const displayArtist = computed(
  () => itunesAlbum.value?.artistName ?? localAlbum.value?.artist ?? '',
)
const displayYear = computed(() => {
  if (itunesAlbum.value) return formatReleaseYear(itunesAlbum.value.releaseDate)
  const y = localAlbum.value?.year
  return y && y !== 0 ? String(y) : ''
})
const displayGenre = computed(
  () => itunesAlbum.value?.primaryGenreName ?? localAlbum.value?.genre ?? '',
)
const displayArtistId = computed(() => itunesAlbum.value?.artistId ?? null)

const artworkUrl = computed(() => {
  if (itunesAlbum.value?.artworkUrl100) return getArtworkUrl(itunesAlbum.value.artworkUrl100, 500)
  if (localAlbum.value?.artworkUrl) return localAlbum.value.artworkUrl
  return ''
})

// 3. Load Discogs + Wikipedia in parallel
const discogsRelease = ref<DiscogsRelease | null>(null)
const discogsLoading = ref(false)
const wikiSummary = ref<{ title: string; extract: string; url: string } | null>(null)

onMounted(async () => {
  if (!localAlbum.value) return
  const artist = displayArtist.value || localAlbum.value.artist
  const title = displayTitle.value || localAlbum.value.title

  discogsLoading.value = true
  const [discogsResult, wikiResult] = await Promise.all([
    searchRelease(artist, title).catch(() => null),
    $fetch<{ title: string; extract: string; url: string } | null>(
      `/api/wikipedia/summary?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(title)}`,
    ).catch(() => null),
  ])
  discogsRelease.value = discogsResult
  wikiSummary.value = wikiResult
  discogsLoading.value = false
})

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
  const artist = displayArtist.value
  const title = displayTitle.value
  if (!artist || !title) return null
  return `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(artist)}/${toVinylpladenSlug(title)}-LP`
})

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
      } else {
        const strippedTitle = stripEditionWords(displayTitle.value)
        if (strippedTitle !== displayTitle.value) {
          const fallbackUrl = `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(displayArtist.value)}/${toVinylpladenSlug(strippedTitle)}-LP`
          const fallback = await $fetch<{ price: string | null }>(
            `/api/vinylpladen/price?url=${encodeURIComponent(fallbackUrl)}`,
          )
          vinylpladenPrice.value = fallback.price
          if (fallback.price !== null) vinylpladenActiveUrl.value = fallbackUrl
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

function openAppleMusic() {
  if (itunesAlbum.value?.collectionViewUrl) {
    window.open(itunesAlbum.value.collectionViewUrl, '_blank', 'noopener,noreferrer')
  }
}

const confirmRemove = ref(false)
const removing = ref(false)

async function removeFromCollection() {
  removing.value = true
  try {
    await deleteAlbum(localId)
    // Stay on the same album — switch to iTunes preview if available, otherwise go back
    if (itunesId.value) {
      router.replace(`/album/itunes/${itunesId.value}`)
    } else {
      router.back()
    }
  } finally {
    removing.value = false
    confirmRemove.value = false
  }
}
</script>

<template>
  <div>
    <!-- Back -->
    <div style="margin-bottom: 1.5rem">
      <Button text icon="pi pi-arrow-left" label="Tilbage" @click="router.back()" />
    </div>

    <!-- Album not found -->
    <div v-if="localError" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-exclamation-triangle" /></div>
      <p class="empty-state-title">Album ikke fundet</p>
    </div>

    <template v-else-if="localAlbum">
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
              Album
            </div>
            <button
              class="album-type-badge collection-action-badge"
              style="margin-bottom: 0"
              @click="confirmRemove = true"
            >
              <span class="cab-default"><i class="pi pi-check" /> I min samling</span>
              <span class="cab-hover"><i class="pi pi-minus-circle" /> Fjern</span>
            </button>
          </div>

          <h1 class="album-title">{{ displayTitle }}</h1>

          <NuxtLink
            v-if="displayArtistId"
            :to="`/artist/${displayArtistId}?name=${encodeURIComponent(displayArtist)}`"
            class="album-artist-link"
          >
            {{ displayArtist }}
          </NuxtLink>
          <span v-else class="album-artist-link" style="cursor: default">
            {{ displayArtist }}
          </span>

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
            <span v-if="itunesAlbum?.country" class="album-stat">
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
              :disabled="!itunesAlbum?.collectionViewUrl"
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

      <!-- iTunes loading -->
      <div v-if="itunesLoading" style="text-align: center; padding: 2rem">
        <ProgressSpinner stroke-width="3" style="width: 36px; height: 36px" />
      </div>

      <template v-else>
        <!-- Track List -->
        <div v-if="tracks.length > 0">
          <h2 class="section-title">
            <i class="pi pi-list" style="color: var(--p-primary-500)" />
            Spor
            <span class="title-count">{{ tracks.length }}</span>
          </h2>
          <TrackList :tracks="tracks" />
        </div>
        <div v-else-if="!itunesId" class="empty-state" style="padding: 2rem 0">
          <div class="empty-state-icon" style="font-size: 2rem"><i class="pi pi-music" /></div>
          <p class="empty-state-title">Ingen spor tilgængelige</p>
          <p class="empty-state-text" style="max-width: 320px">
            Dette album blev ikke matchet med iTunes. Søg for at linke sporinformation.
          </p>
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
    </template>

    <!-- Remove from collection confirm -->
    <Dialog
      v-model:visible="confirmRemove"
      header="Fjern fra samling"
      modal
      :style="{ width: '360px' }"
    >
      <p style="margin: 0">
        Fjern <strong>{{ displayTitle }}</strong> fra din samling?
      </p>
      <template #footer>
        <Button label="Annuller" text @click="confirmRemove = false" />
        <Button label="Fjern" severity="danger" :loading="removing" @click="removeFromCollection" />
      </template>
    </Dialog>
  </div>
</template>
