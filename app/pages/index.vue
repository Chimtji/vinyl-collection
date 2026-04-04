<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ ssr: false })
useSeoMeta({ title: 'Dashboard — Vinyl Collection' })

const router = useRouter()
const { albums, genres, fetchCollection } = useCollection()
const { fetchWishlist } = useWishlist()
const { getArtworkUrl } = useAppleMusic()

onMounted(async () => {
  isDark.value = document.documentElement.classList.contains('dark-mode')

  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark-mode')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onUnmounted(() => observer.disconnect())

  await fetchCollection()
  fetchWishlist()
  loadValuationCache()
  await nextTick()
  buildCharts()
})

// ── Key stats ──────────────────────────────────────────────────────────────
const totalAlbums = computed(() => albums.value.length)
const totalArtists = computed(() => new Set(albums.value.map((a) => a.artist)).size)
const totalGenres = computed(() => genres.value.length)
const oldestYear = computed(() => {
  const years = albums.value.map((a) => a.year).filter((y) => y > 1900)
  return years.length ? Math.min(...years) : null
})

// ── Charts (Chart.js) ────────────────────────────────────────────────────
const CHART_COLORS = [
  '#7c3aed',
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#db2777',
]

const isDark = ref(true)

const labelColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'))
const gridColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'))

// ── Chart.js canvas refs & instances ─────────────────────────────────────
const radarCanvas = ref<HTMLCanvasElement | null>(null)
const decadeCanvas = ref<HTMLCanvasElement | null>(null)
const artistCanvas = ref<HTMLCanvasElement | null>(null)

let radarChart: import('chart.js/auto').default | null = null
let decadeChart: import('chart.js/auto').default | null = null
let artistChart: import('chart.js/auto').default | null = null

async function buildCharts() {
  if (!albums.value.length) return
  const { default: Chart } = await import('chart.js/auto')
  const lc = labelColor.value
  const gc = gridColor.value

  // ── Radar
  if (radarCanvas.value) {
    radarChart?.destroy()
    const gs = genres.value.slice(0, 8)
    radarChart = new Chart(radarCanvas.value, {
      type: 'radar',
      data: {
        labels: gs.map((g) => g.genre),
        datasets: [
          {
            data: gs.map((g) => g.albums.length),
            backgroundColor: 'rgba(124,58,237,0.2)',
            borderColor: '#7c3aed',
            borderWidth: 2,
            pointBackgroundColor: '#a78bfa',
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            grid: { color: gc },
            angleLines: { color: gc },
            ticks: { display: false, backdropColor: 'transparent', color: lc },
            pointLabels: { color: lc, font: { size: 11 } },
          },
        },
      },
    })
  }

  // ── Decade bar
  if (decadeCanvas.value) {
    decadeChart?.destroy()
    const map: Record<string, number> = {}
    for (const a of albums.value) {
      if (!a.year || a.year < 1900) continue
      const decade = `${Math.floor(a.year / 10) * 10}s`
      map[decade] = (map[decade] ?? 0) + 1
    }
    const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
    decadeChart = new Chart(decadeCanvas.value, {
      type: 'bar',
      data: {
        labels: sorted.map(([l]) => l),
        datasets: [
          {
            data: sorted.map(([, v]) => v),
            backgroundColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: lc } },
          y: { grid: { color: gc }, border: { color: gc }, ticks: { color: lc, stepSize: 1 } },
        },
      },
    })
  }

  // ── Top artists horizontal bar
  if (artistCanvas.value) {
    artistChart?.destroy()
    const map: Record<string, number> = {}
    for (const a of albums.value) map[a.artist] = (map[a.artist] ?? 0) + 1
    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    artistChart = new Chart(artistCanvas.value, {
      type: 'bar',
      data: {
        labels: sorted.map(([artist]) => artist),
        datasets: [
          {
            data: sorted.map(([, count]) => count),
            backgroundColor: '#7c3aed',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gc }, border: { color: gc }, ticks: { color: lc, stepSize: 1 } },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: lc } },
        },
      },
    })
  }
}

watch(
  () => albums.value.length,
  async (len) => {
    if (len > 0) await nextTick().then(buildCharts)
  },
)

watch(isDark, () => {
  if (albums.value.length > 0) buildCharts()
})

onUnmounted(() => {
  radarChart?.destroy()
  decadeChart?.destroy()
  artistChart?.destroy()
})

// ── Vinylpladen valuation ──────────────────────────────────────────────────
const CACHE_KEY = 'vinyl-valuation-v1'
const cachedAt = ref<number | null>(null)
const showPriceModal = ref(false)

const cacheAge = computed(() => {
  if (!cachedAt.value) return ''
  const mins = Math.floor((Date.now() - cachedAt.value) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
})

function saveValuationCache() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        results: priceResults.value,
        fetchedAt: Date.now(),
        albumIds: albums.value.map((a) => a.id).sort(),
      }),
    )
    cachedAt.value = Date.now()
  } catch {
    /* storage unavailable */
  }
}

function loadValuationCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const cache = JSON.parse(raw) as {
      results: PriceResult[]
      fetchedAt: number
      albumIds: string[]
    }
    const currentIds = albums.value
      .map((a) => a.id)
      .sort()
      .join(',')
    if ((cache.albumIds ?? []).sort().join(',') !== currentIds) return
    priceResults.value = cache.results
    valuationFetched.value = true
    cachedAt.value = cache.fetchedAt
  } catch {
    /* ignore */
  }
}

function toVinylpladenSlug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface PriceResult {
  id: string
  price: number | null
  inStock: boolean
}

const priceResults = ref<PriceResult[]>([])
const valuationLoading = ref(false)
const valuationFetched = ref(false)
const valuationProgress = ref(0)

const totalValue = computed(() => priceResults.value.reduce((s, r) => s + (r.price ?? 0), 0))
const pricedCount = computed(() => priceResults.value.filter((r) => r.price !== null).length)
const coveragePct = computed(() =>
  totalAlbums.value ? Math.round((pricedCount.value / totalAlbums.value) * 100) : 0,
)

const pricedAlbums = computed(
  () =>
    priceResults.value
      .filter((r) => r.price !== null)
      .map((r) => {
        const album = albums.value.find((a) => a.id === r.id)
        if (!album) return null
        return { ...album, price: r.price as number, inStock: r.inStock }
      })
      .filter(Boolean)
      .sort((a, b) => b!.price - a!.price) as (CollectionAlbum & {
      price: number
      inStock: boolean
    })[],
)

async function fetchValuation() {
  if (valuationLoading.value || !albums.value.length) return
  valuationLoading.value = true
  valuationProgress.value = 0
  priceResults.value = []

  const BATCH = 5
  const payload = albums.value.map((a) => ({
    id: a.id,
    url: `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(a.artist)}/${toVinylpladenSlug(a.title)}-LP`,
  }))

  for (let i = 0; i < payload.length; i += BATCH) {
    const results = await $fetch<PriceResult[]>('/api/vinylpladen/prices', {
      method: 'POST',
      body: payload.slice(i, i + BATCH),
    })
    priceResults.value.push(...results)
    valuationProgress.value = Math.min(100, Math.round(((i + BATCH) / payload.length) * 100))
  }

  valuationLoading.value = false
  valuationFetched.value = true
  saveValuationCache()
}

function openAlbumFromModal(id: string) {
  router.push(`/album/${id}`)
  showPriceModal.value = false
}

function artworkSrc(album: CollectionAlbum) {
  return album.artworkUrl ? getArtworkUrl(album.artworkUrl, 200) : ''
}

function fmtDKK(n: number) {
  return n.toLocaleString('da-DK') + ' DKK'
}
</script>

<template>
  <div class="dash-page">
    <!-- Page header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Collection Dashboard</h1>
        <p class="dash-subtitle">An overview of your vinyl collection</p>
      </div>
      <NuxtLink to="/search">
        <Button icon="pi pi-plus" label="Add Album" size="small" />
      </NuxtLink>
    </div>

    <!-- Stats row -->
    <div class="dash-stats-row">
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background: rgba(124, 58, 237, 0.15)">
          <i class="pi pi-th-large" style="color: #a78bfa" />
        </div>
        <div>
          <p class="dash-stat-val">{{ totalAlbums }}</p>
          <p class="dash-stat-label">Albums</p>
        </div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background: rgba(79, 70, 229, 0.15)">
          <i class="pi pi-user" style="color: #818cf8" />
        </div>
        <div>
          <p class="dash-stat-val">{{ totalArtists }}</p>
          <p class="dash-stat-label">Artists</p>
        </div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background: rgba(8, 145, 178, 0.15)">
          <i class="pi pi-tag" style="color: #22d3ee" />
        </div>
        <div>
          <p class="dash-stat-val">{{ totalGenres }}</p>
          <p class="dash-stat-label">Genres</p>
        </div>
      </div>
    </div>

    <!-- Charts: Genre radar · Decade · Top Artists -->
    <div v-if="totalAlbums > 0" class="dash-charts-3col">
      <div class="chart-card">
        <h3 class="chart-title"><i class="pi pi-chart-pie" /> Genre Breakdown</h3>
        <div class="chart-canvas-wrap">
          <canvas ref="radarCanvas" />
        </div>
      </div>

      <div class="chart-card">
        <h3 class="chart-title"><i class="pi pi-calendar" /> By Decade</h3>
        <div class="chart-canvas-wrap">
          <canvas ref="decadeCanvas" />
        </div>
        <p v-if="oldestYear" class="chart-footnote">Earliest release: {{ oldestYear }}</p>
      </div>

      <div class="chart-card">
        <h3 class="chart-title"><i class="pi pi-users" /> Top Artists</h3>
        <div class="chart-canvas-wrap">
          <canvas ref="artistCanvas" />
        </div>
      </div>
    </div>

    <!-- ── Valuation ──────────────────────────────────────── -->
    <div class="chart-card valuation-card">
      <div class="valuation-header">
        <div>
          <h3 class="chart-title" style="margin: 0">
            <i class="pi pi-euro" /> Collection Valuation
          </h3>
          <p class="valuation-explain">Prices from Vinylpladen.dk · new LP editions</p>
        </div>
        <Button
          v-if="!valuationFetched && !valuationLoading"
          label="Load Valuation"
          icon="pi pi-refresh"
          size="small"
          @click="fetchValuation"
        />
        <Button
          v-else-if="valuationFetched"
          icon="pi pi-refresh"
          size="small"
          text
          title="Refresh prices"
          @click="fetchValuation"
        />
      </div>

      <!-- Loading -->
      <div v-if="valuationLoading" class="valuation-loading">
        <ProgressBar :value="valuationProgress" style="height: 6px; margin-bottom: 0.75rem" />
        <p class="valuation-loading-text">
          Checking prices… {{ priceResults.length }} / {{ totalAlbums }}
        </p>
      </div>

      <!-- Results -->
      <template v-else-if="valuationFetched">
        <div class="valuation-summary">
          <div class="valuation-total-block">
            <p class="valuation-total-label">Estimated total value</p>
            <p class="valuation-total-val">{{ fmtDKK(totalValue) }}</p>
          </div>
          <div class="valuation-coverage-block">
            <p class="valuation-coverage-label">
              {{ pricedCount }} / {{ totalAlbums }} albums priced ({{ coveragePct }}%)
            </p>
            <ProgressBar :value="coveragePct" style="height: 8px; min-width: 160px" />
          </div>
          <div class="valuation-summary-actions">
            <Button
              v-if="pricedAlbums.length"
              label="View Prices"
              icon="pi pi-list"
              size="small"
              outlined
              @click="showPriceModal = true"
            />
            <p v-if="cachedAt" class="valuation-cache-age">Updated {{ cacheAge }}</p>
          </div>
        </div>
        <p v-if="pricedCount < totalAlbums" class="valuation-missing">
          {{ totalAlbums - pricedCount }} album{{ totalAlbums - pricedCount === 1 ? '' : 's' }} not
          found on Vinylpladen
        </p>
      </template>

      <!-- Idle -->
      <div v-else class="valuation-idle">
        <i class="pi pi-tag valuation-idle-icon" />
        <p>
          Click "Load Valuation" to estimate the total value of your collection using current
          Vinylpladen prices.
        </p>
      </div>
    </div>

    <!-- Price breakdown modal -->
    <Dialog
      v-model:visible="showPriceModal"
      modal
      header="Album Prices"
      :style="{ width: '620px', maxWidth: '95vw' }"
    >
      <div class="valuation-album-list">
        <div
          v-for="album in pricedAlbums"
          :key="album.id"
          class="valuation-album-row"
          role="button"
          @click="openAlbumFromModal(album.id)"
        >
          <img
            v-if="artworkSrc(album)"
            :src="artworkSrc(album)"
            :alt="album.title"
            class="valuation-album-art"
          />
          <div v-else class="valuation-album-art valuation-album-art--placeholder">
            <i class="pi pi-disc" />
          </div>
          <div class="valuation-album-info">
            <p class="valuation-album-title">{{ album.title }}</p>
            <p class="valuation-album-artist">{{ album.artist }}</p>
          </div>
          <div class="valuation-album-right">
            <span class="valuation-album-price">{{ fmtDKK(album.price) }}</span>
            <span
              class="valuation-stock-badge"
              :class="album.inStock ? 'valuation-stock--in' : 'valuation-stock--out'"
            >
              {{ album.inStock ? 'In stock' : 'Out of stock' }}
            </span>
          </div>
        </div>
      </div>
      <p v-if="pricedCount < totalAlbums" class="valuation-missing" style="padding: 0 0.25rem">
        {{ totalAlbums - pricedCount }} album{{ totalAlbums - pricedCount === 1 ? '' : 's' }} not
        found on Vinylpladen
      </p>
    </Dialog>
  </div>
</template>
