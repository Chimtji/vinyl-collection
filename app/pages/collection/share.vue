<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ layout: 'share', ssr: false })

const { user } = useAuth()
const { getArtworkUrl } = useAppleMusic()

const ownerName = computed(() => {
  const full = user.value?.user_metadata?.full_name ?? user.value?.email ?? ''
  // Use part before @ for email addresses
  return full.includes('@') ? full.split('@')[0]! : full
})

const pageTitle = computed(() =>
  ownerName.value ? `${ownerName.value}s samling` : 'Samling — Delt visning',
)

useSeoMeta({ title: pageTitle })

// ── Data ─────────────────────────────────────────────────
const albums = ref<CollectionAlbum[]>([])
const loading = ref(true)

// ── Sort & group state ────────────────────────────────────
type SortField = 'title' | 'artist' | 'year' | 'genre' | 'addedAt'
type GroupField = 'none' | 'genre' | 'artist' | 'decade'

const sortBy = ref<SortField>('title')
const sortDir = ref<'asc' | 'desc'>('asc')
const groupBy = ref<GroupField>('none')

// ── View: grid vs list ────────────────────────────────────
const gridView = ref(false)

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Titel', value: 'title' },
  { label: 'Kunstner', value: 'artist' },
  { label: 'År', value: 'year' },
  { label: 'Genre', value: 'genre' },
  { label: 'Tilføjet', value: 'addedAt' },
]

const GROUP_OPTIONS: { label: string; value: GroupField }[] = [
  { label: 'Ingen gruppering', value: 'none' },
  { label: 'Genre', value: 'genre' },
  { label: 'Kunstner', value: 'artist' },
  { label: 'Årti', value: 'decade' },
]

function compareAlbums(a: CollectionAlbum, b: CollectionAlbum): number {
  let cmp = 0
  if (sortBy.value === 'title') cmp = a.title.localeCompare(b.title)
  else if (sortBy.value === 'artist') cmp = a.artist.localeCompare(b.artist)
  else if (sortBy.value === 'year') cmp = (a.year ?? 0) - (b.year ?? 0)
  else if (sortBy.value === 'genre') cmp = a.genre.localeCompare(b.genre)
  else if (sortBy.value === 'addedAt') cmp = a.addedAt.localeCompare(b.addedAt)
  return sortDir.value === 'asc' ? cmp : -cmp
}

const sorted = computed(() => [...albums.value].sort(compareAlbums))

function decadeLabel(year: number | undefined): string {
  if (!year || year < 1900) return 'Ukendt'
  return `${Math.floor(year / 10) * 10}erne`
}

function groupKey(item: CollectionAlbum): string {
  if (groupBy.value === 'genre') return item.genre || 'Ukendt'
  if (groupBy.value === 'artist') return item.artist
  if (groupBy.value === 'decade') return decadeLabel(item.year)
  return ''
}

interface Group {
  key: string
  label: string
  items: CollectionAlbum[]
}

const groups = computed((): Group[] => {
  if (groupBy.value === 'none') {
    return [{ key: '__all', label: '', items: sorted.value }]
  }
  const map = new Map<string, CollectionAlbum[]>()
  for (const item of sorted.value) {
    const k = groupKey(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  let keys = [...map.keys()]
  if (groupBy.value === 'decade') {
    keys = keys.sort((a, b) => {
      const na = parseInt(a) || 0
      const nb = parseInt(b) || 0
      return na - nb
    })
  } else {
    keys = keys.sort((a, b) => a.localeCompare(b))
  }
  return keys.map((k) => ({ key: k, label: k, items: map.get(k)! }))
})

function toggleSortDir() {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

const groupByIdx = computed({
  get: () => GROUP_OPTIONS.findIndex((o) => o.value === groupBy.value),
  set: (i) => {
    groupBy.value = GROUP_OPTIONS[i]?.value ?? 'none'
  },
})

// ── Derived stats ─────────────────────────────────────────
const totalAlbums = computed(() => albums.value.length)
const totalArtists = computed(() => new Set(albums.value.map((a) => a.artist)).size)
const totalGenres = computed(() => new Set(albums.value.map((a) => a.genre)).size)
const oldestYear = computed(() => {
  const years = albums.value.map((a) => a.year).filter((y) => y && y > 1900)
  return years.length ? Math.min(...years) : null
})

// ── Shelf size ────────────────────────────────────────────
const shelfMeters = computed(() => ((totalAlbums.value * 5.26) / 1000).toFixed(2))

// ── Charts ────────────────────────────────────────────────
const CHART_COLORS = [
  '#C45529',
  '#E8845A',
  '#D4AC6E',
  '#7A9E8A',
  '#5C7A9E',
  '#E8C07A',
  '#9E5C7A',
  '#8B7355',
]
const isDark = ref(true)
const labelColor = computed(() => (isDark.value ? 'rgba(245,239,230,0.75)' : 'rgba(26,22,20,0.65)'))
const gridColor = computed(() => (isDark.value ? 'rgba(220,180,140,0.12)' : 'rgba(60,40,20,0.10)'))

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

  // Genre radar
  const genreMap = new Map<string, number>()
  for (const a of albums.value) {
    genreMap.set(a.genre, (genreMap.get(a.genre) ?? 0) + 1)
  }
  const topGenres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (radarCanvas.value) {
    radarChart?.destroy()
    radarChart = new Chart(radarCanvas.value, {
      type: 'radar',
      data: {
        labels: topGenres.map(([g]) => g),
        datasets: [
          {
            data: topGenres.map(([, n]) => n),
            backgroundColor: 'rgba(196,85,41,0.15)',
            borderColor: '#C45529',
            borderWidth: 2,
            pointBackgroundColor: '#E8845A',
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

  // Decade bar
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
            backgroundColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]!),
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

  // Top artists
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
            backgroundColor: '#C45529',
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

onUnmounted(() => {
  radarChart?.destroy()
  decadeChart?.destroy()
  artistChart?.destroy()
})

// ── Load ──────────────────────────────────────────────────
onMounted(async () => {
  isDark.value = document.documentElement.classList.contains('dark-mode')
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark-mode')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onUnmounted(() => observer.disconnect())

  try {
    const data = await $fetch<CollectionAlbum[]>('/api/collection')
    albums.value = data
    await nextTick()
    buildCharts()
  } finally {
    loading.value = false
  }
})

watch(isDark, () => {
  if (albums.value.length > 0) buildCharts()
})

function artworkSrc(album: CollectionAlbum) {
  return album.artworkUrl ? getArtworkUrl(album.artworkUrl, 300) : ''
}

function albumHref(album: CollectionAlbum) {
  return album.itunesCollectionId ? `/album/itunes/${album.itunesCollectionId}` : null
}
</script>

<template>
  <div class="share-page">
    <!-- Header -->
    <header class="share-header">
      <div class="share-header-inner">
        <div class="share-header-left">
          <div
            class="app-logo-icon"
            style="width: 28px; height: 28px; font-size: 0.85rem; flex-shrink: 0"
          >
            <i class="pi pi-disc" />
          </div>
          <div class="share-header-title-group">
            <span class="share-header-title">{{
              ownerName ? `${ownerName}s samling` : 'Vinylsamling'
            }}</span>
            <span v-if="!loading" class="share-header-count">{{ albums.length }}</span>
          </div>
          <span class="share-view-badge">
            <i class="pi pi-eye" />
            Kun visning
          </span>
        </div>

        <div v-if="!loading && albums.length > 0" class="share-header-controls">
          <!-- Sort field -->
          <Select
            v-model="sortBy"
            :options="SORT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            style="width: 122px"
            title="Sortér efter"
          />
          <!-- Sort direction -->
          <button
            class="view-toggle-btn"
            :title="sortDir === 'asc' ? 'Stigende' : 'Faldende'"
            @click="toggleSortDir"
          >
            <i :class="sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" />
          </button>
          <span class="share-ctrl-divider" />
          <!-- Group by -->
          <button
            class="view-toggle-btn"
            title="Gruppér efter"
            :class="{ active: groupBy !== 'none' }"
            @click="groupByIdx = (groupByIdx + 1) % GROUP_OPTIONS.length"
          >
            <i class="pi pi-list" />
          </button>
          <span v-if="groupBy !== 'none'" class="share-group-chip">
            {{ GROUP_OPTIONS.find((o) => o.value === groupBy)?.label }}
          </span>
          <span class="share-ctrl-divider" />
          <!-- View toggle: list / grid -->
          <button
            class="view-toggle-btn"
            :class="{ active: !gridView }"
            title="Listevisning"
            @click="gridView = false"
          >
            <i class="pi pi-list" />
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: gridView }"
            title="Gittervisning"
            @click="gridView = true"
          >
            <i class="pi pi-th-large" />
          </button>
        </div>
      </div>
    </header>

    <div class="share-body">
      <!-- Loading -->
      <div v-if="loading" class="share-loading">
        <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
        <p style="color: var(--app-text-muted); margin: 1rem 0 0">Henter samling…</p>
      </div>

      <!-- Empty -->
      <div v-else-if="albums.length === 0" class="share-empty">
        <i class="pi pi-disc" style="font-size: 2rem; color: var(--app-text-muted)" />
        <p>Denne samling er tom.</p>
      </div>

      <template v-else>
        <!-- Stats row -->
        <div class="sc-stats-row">
          <div class="sc-stat-card">
            <div class="sc-stat-icon" style="background: rgba(196, 85, 41, 0.12)">
              <i class="pi pi-th-large" style="color: #c45529" />
            </div>
            <div>
              <p class="sc-stat-val">{{ albums.length }}</p>
              <p class="sc-stat-label">Albums</p>
            </div>
          </div>
          <div class="sc-stat-card">
            <div class="sc-stat-icon" style="background: rgba(196, 85, 41, 0.08)">
              <i class="pi pi-user" style="color: #e8845a" />
            </div>
            <div>
              <p class="sc-stat-val">{{ totalArtists }}</p>
              <p class="sc-stat-label">Kunstnere</p>
            </div>
          </div>
          <div class="sc-stat-card">
            <div class="sc-stat-icon" style="background: rgba(122, 158, 138, 0.12)">
              <i class="pi pi-tag" style="color: #7a9e8a" />
            </div>
            <div>
              <p class="sc-stat-val">{{ totalGenres }}</p>
              <p class="sc-stat-label">Genrer</p>
            </div>
          </div>
          <div v-if="oldestYear" class="sc-stat-card">
            <div class="sc-stat-icon" style="background: rgba(92, 122, 158, 0.12)">
              <i class="pi pi-calendar" style="color: #5c7a9e" />
            </div>
            <div>
              <p class="sc-stat-val">{{ oldestYear }}</p>
              <p class="sc-stat-label">Tidligste år</p>
            </div>
          </div>
          <div class="sc-stat-card">
            <div class="sc-stat-icon" style="background: rgba(212, 172, 110, 0.12)">
              <i class="pi pi-align-justify" style="color: #d4ac6e" />
            </div>
            <div>
              <p class="sc-stat-val">{{ shelfMeters }} m</p>
              <p class="sc-stat-label">Længde</p>
            </div>
          </div>
        </div>

        <!-- Charts -->
        <div class="sc-charts-row">
          <div class="sc-chart-card">
            <h3 class="sc-chart-title"><i class="pi pi-chart-pie" /> Genreoversigt</h3>
            <div class="sc-chart-wrap">
              <canvas ref="radarCanvas" />
            </div>
          </div>
          <div class="sc-chart-card">
            <h3 class="sc-chart-title"><i class="pi pi-calendar" /> Efter årti</h3>
            <div class="sc-chart-wrap">
              <canvas ref="decadeCanvas" />
            </div>
          </div>
          <div class="sc-chart-card">
            <h3 class="sc-chart-title"><i class="pi pi-users" /> Top kunstnere</h3>
            <div class="sc-chart-wrap">
              <canvas ref="artistCanvas" />
            </div>
          </div>
        </div>

        <!-- Album list / grid -->
        <div class="sc-section-heading">
          <i class="pi pi-disc" />
          <span>Albums</span>
        </div>

        <div v-for="group in groups" :key="group.key">
          <!-- Group header -->
          <div v-if="groupBy !== 'none'" class="share-group-header">
            <span class="share-group-label">{{ group.label }}</span>
            <span class="share-group-count">{{ group.items.length }}</span>
          </div>

          <!-- Grid view -->
          <div v-if="gridView" class="sc-grid">
            <component
              :is="albumHref(item) ? 'a' : 'div'"
              v-for="item in group.items"
              :key="item.id"
              :href="albumHref(item) ?? undefined"
              :target="albumHref(item) ? '_blank' : undefined"
              :rel="albumHref(item) ? 'noopener noreferrer' : undefined"
              class="sc-grid-item"
              :class="{ 'sc-grid-item--link': !!albumHref(item) }"
            >
              <div class="sc-grid-art-wrap">
                <img
                  v-if="artworkSrc(item)"
                  :src="artworkSrc(item)"
                  :alt="item.title"
                  class="sc-grid-art"
                />
                <div v-else class="sc-grid-art sc-grid-art-placeholder">
                  <i class="pi pi-disc" />
                </div>
              </div>
              <div class="sc-grid-info">
                <p class="sc-grid-title">{{ item.title }}</p>
                <p class="sc-grid-sub">{{ item.artist }}{{ item.year ? ' · ' + item.year : '' }}</p>
              </div>
            </component>
          </div>

          <!-- List view -->
          <div v-else class="share-list">
            <component
              :is="albumHref(item) ? 'a' : 'div'"
              v-for="item in group.items"
              :key="item.id"
              :href="albumHref(item) ?? undefined"
              :target="albumHref(item) ? '_blank' : undefined"
              :rel="albumHref(item) ? 'noopener noreferrer' : undefined"
              class="share-item"
              :class="{ 'share-item--link': !!albumHref(item) }"
            >
              <!-- Artwork -->
              <div class="share-item-art-wrap">
                <img
                  v-if="artworkSrc(item)"
                  :src="artworkSrc(item)"
                  :alt="item.title"
                  class="share-item-art"
                />
                <div v-else class="share-item-art share-item-art-placeholder">
                  <i class="pi pi-disc" />
                </div>
              </div>

              <!-- Info -->
              <div class="share-item-info">
                <div class="share-item-top">
                  <span class="share-item-title">{{ item.title }}</span>
                  <span v-if="item.signed" class="sc-signed-badge">
                    <i class="pi pi-pencil" style="font-size: 0.65rem" />
                    Signeret
                  </span>
                </div>
                <p class="share-item-sub">
                  {{ item.artist }}{{ item.year ? ' · ' + item.year : '' }} · {{ item.genre }}
                </p>
                <p v-if="item.notes" class="share-item-notes">{{ item.notes }}</p>
              </div>

              <i v-if="albumHref(item)" class="pi pi-external-link sc-item-ext-icon" />
            </component>
          </div>
        </div>
      </template>
    </div>

    <!-- Footer branding -->
    <footer class="share-footer">
      <span>Made with 🔥 by Chimtji</span>
    </footer>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────── */
.share-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────── */
.share-header {
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  position: sticky;
  top: 0;
  z-index: 20;
}
.share-header-inner {
  max-width: 1060px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.share-header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}
.share-header-title-group {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.share-header-title {
  font-size: 0.97rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.share-header-count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--app-text-muted);
}
.share-view-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--app-text-muted);
  background: var(--app-bg-alt);
  border: 1px solid var(--app-border);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.share-header-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}
.share-ctrl-divider {
  width: 1px;
  height: 18px;
  background: var(--app-border);
  display: inline-block;
  margin: 0 0.1rem;
}
.share-group-chip {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--gradient-primary);
  background: rgba(196, 85, 41, 0.08);
  border: 1px solid rgba(196, 85, 41, 0.25);
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  white-space: nowrap;
}

/* ── Body ───────────────────────────────────────────────── */
.share-body {
  max-width: 1060px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 2rem;
  flex: 1;
  width: 100%;
}

/* ── States ─────────────────────────────────────────────── */
.share-loading,
.share-empty {
  text-align: center;
  padding: 4rem 0;
  color: var(--app-text-muted);
}

/* ── Stats row ──────────────────────────────────────────── */
.sc-stats-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.sc-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 0.8rem 1.1rem;
  box-shadow: var(--app-shadow);
  flex: 1;
  min-width: 120px;
}
.sc-stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}
.sc-stat-val {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
  margin: 0;
  letter-spacing: -0.02em;
}
.sc-stat-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0.15rem 0 0;
}

/* ── Charts ─────────────────────────────────────────────── */
.sc-charts-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.75rem;
}
@media (max-width: 700px) {
  .sc-charts-row {
    grid-template-columns: 1fr;
  }
}
.sc-chart-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 1rem 1.1rem 1.1rem;
  box-shadow: var(--app-shadow);
  min-width: 0;
}
.sc-chart-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--app-text-muted);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.sc-chart-wrap {
  height: 200px;
  position: relative;
  width: 100%;
}
.sc-chart-wrap canvas {
  max-width: 100%;
}
.sc-charts-row > .sc-chart-card:last-child .sc-chart-wrap {
  height: 240px;
}

/* ── Section heading ────────────────────────────────────── */
.sc-section-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--app-text-muted);
  margin-bottom: 0.75rem;
}

/* ── Group headers ──────────────────────────────────────── */
.share-group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0 0.4rem;
  margin-top: 0.25rem;
}
.share-group-header:first-child {
  padding-top: 0;
  margin-top: 0;
}
.share-group-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--app-text);
}
.share-group-count {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--app-text-muted);
  background: var(--app-bg-alt);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
}

/* ── List ───────────────────────────────────────────────── */
.share-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.65rem;
  margin-bottom: 0.25rem;
}
@media (max-width: 600px) {
  .share-list {
    grid-template-columns: 1fr;
  }
}

.share-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  box-shadow: var(--app-shadow);
  text-decoration: none;
  color: inherit;
  min-width: 0;
}
.share-item--link {
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}
.share-item--link:hover {
  border-color: rgba(196, 85, 41, 0.4);
  box-shadow: 0 2px 12px rgba(196, 85, 41, 0.1);
}

/* ── Artwork ────────────────────────────────────────────── */
.share-item-art-wrap {
  flex-shrink: 0;
}
.share-item-art {
  width: 88px;
  height: 88px;
  border-radius: 6px;
  object-fit: cover;
  display: block;
  border: 1px solid var(--app-border);
}
.share-item-art-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg-alt);
  color: var(--app-text-muted);
  font-size: 1.8rem;
}

/* ── Info ───────────────────────────────────────────────── */
.share-item-info {
  flex: 1;
  min-width: 0;
}
.share-item-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.2rem;
}
.share-item-title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.share-item-sub {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}
.share-item-notes {
  margin: 0;
  font-size: 0.78rem;
  color: var(--app-text-muted);
  font-style: italic;
  background: var(--app-bg-alt);
  border-left: 2px solid var(--app-border);
  padding: 0.2rem 0.5rem;
  border-radius: 0 4px 4px 0;
}
.sc-signed-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: rgba(92, 122, 158, 0.12);
  color: #5c7a9e;
  border: 1px solid rgba(92, 122, 158, 0.3);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}
.sc-item-ext-icon {
  font-size: 0.7rem;
  color: var(--app-text-muted);
  flex-shrink: 0;
  align-self: center;
  margin-left: auto;
}

/* ── Grid view ──────────────────────────────────────────── */
.sc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.sc-grid-item {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--app-shadow);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.sc-grid-item--link {
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}
.sc-grid-item--link:hover {
  border-color: rgba(196, 85, 41, 0.4);
  box-shadow: 0 2px 12px rgba(196, 85, 41, 0.1);
}
.sc-grid-art-wrap {
  aspect-ratio: 1;
  overflow: hidden;
}
.sc-grid-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sc-grid-art-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg-alt);
  color: var(--app-text-muted);
  font-size: 2rem;
}
.sc-grid-info {
  padding: 0.55rem 0.65rem 0.65rem;
}
.sc-grid-title {
  font-size: 0.8rem;
  font-weight: 700;
  margin: 0 0 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-grid-sub {
  font-size: 0.72rem;
  color: var(--app-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Footer ─────────────────────────────────────────────── */
.share-footer {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.78rem;
  color: var(--app-text-muted);
  border-top: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
</style>
