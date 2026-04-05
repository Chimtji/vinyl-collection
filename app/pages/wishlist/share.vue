<script setup lang="ts">
import type { WishlistItem } from '~/composables/useWishlist'

definePageMeta({ layout: 'share', ssr: false })
useSeoMeta({ title: 'Ønskeliste — Delt visning' })

const { getArtworkUrl } = useAppleMusic()

// ── Data ─────────────────────────────────────────────────
const items = ref<WishlistItem[]>([])
const loading = ref(true)

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const
const PRIORITY_LABELS = { high: 'Høj', medium: 'Medium', low: 'Lav' } as const

// ── Sort & group state ────────────────────────────────────
type SortField = 'priority' | 'title' | 'artist' | 'year' | 'addedAt'
type GroupField = 'none' | 'priority' | 'artist' | 'genre'

const sortBy = ref<SortField>('priority')
const sortDir = ref<'asc' | 'desc'>('asc')
const groupBy = ref<GroupField>('none')

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Prioritet', value: 'priority' },
  { label: 'Titel', value: 'title' },
  { label: 'Kunstner', value: 'artist' },
  { label: 'År', value: 'year' },
  { label: 'Tilføjet dato', value: 'addedAt' },
]

const GROUP_OPTIONS: { label: string; value: GroupField }[] = [
  { label: 'Ingen gruppering', value: 'none' },
  { label: 'Prioritet', value: 'priority' },
  { label: 'Kunstner', value: 'artist' },
  { label: 'Genre', value: 'genre' },
]

function compareItems(a: WishlistItem, b: WishlistItem): number {
  let cmp = 0
  if (sortBy.value === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  else if (sortBy.value === 'title') cmp = a.title.localeCompare(b.title)
  else if (sortBy.value === 'artist') cmp = a.artist.localeCompare(b.artist)
  else if (sortBy.value === 'year') cmp = (a.year ?? 0) - (b.year ?? 0)
  else if (sortBy.value === 'addedAt') cmp = a.addedAt.localeCompare(b.addedAt)
  return sortDir.value === 'asc' ? cmp : -cmp
}

const sorted = computed(() => [...items.value].sort(compareItems))

function groupKey(item: WishlistItem): string {
  if (groupBy.value === 'priority') return item.priority
  if (groupBy.value === 'artist') return item.artist
  if (groupBy.value === 'genre') return item.genre
  return ''
}

function groupLabel(key: string): string {
  if (groupBy.value === 'priority')
    return PRIORITY_LABELS[key as keyof typeof PRIORITY_LABELS] ?? key
  return key
}

interface Group {
  key: string
  label: string
  items: WishlistItem[]
}

const groups = computed((): Group[] => {
  if (groupBy.value === 'none') {
    return [{ key: '__all', label: '', items: sorted.value }]
  }
  const map = new Map<string, WishlistItem[]>()
  for (const item of sorted.value) {
    const k = groupKey(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  // Order priority groups canonically
  let keys = [...map.keys()]
  if (groupBy.value === 'priority') {
    const ord = ['high', 'medium', 'low']
    keys = keys.sort((a, b) => ord.indexOf(a) - ord.indexOf(b))
  } else {
    keys = keys.sort((a, b) => a.localeCompare(b))
  }
  return keys.map((k) => ({ key: k, label: groupLabel(k), items: map.get(k)! }))
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

// ── Vinylpladen URLs ──────────────────────────────────────
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

function vinylpladenUrl(item: WishlistItem) {
  return `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(item.artist)}/${toVinylpladenSlug(item.title)}-LP`
}

function vinylpladenFallbackUrl(item: WishlistItem): string | null {
  const stripped = stripEditionWords(item.title)
  if (stripped === item.title) return null
  return `https://vinylpladen.dk/vinyl/${toVinylpladenSlug(item.artist)}/${toVinylpladenSlug(stripped)}-LP`
}

// ── Prices ────────────────────────────────────────────────
interface PriceResult {
  id: string
  price: number | null
  inStock: boolean
  activeUrl?: string
}

const prices = ref<Record<string, PriceResult>>({})
const pricesLoading = ref(false)

async function fetchPrices(wishlistItems: WishlistItem[]) {
  if (wishlistItems.length === 0) return
  pricesLoading.value = true
  try {
    const payload = wishlistItems.map((item) => ({
      id: item.id,
      url: vinylpladenUrl(item),
      fallbackUrl: vinylpladenFallbackUrl(item),
    }))
    const results = await $fetch<PriceResult[]>('/api/vinylpladen/prices', {
      method: 'POST',
      body: payload,
    })
    const map: Record<string, PriceResult> = {}
    for (const r of results) {
      map[r.id] = r
    }
    prices.value = map
  } catch {
    // prices stay empty — non-fatal
  } finally {
    pricesLoading.value = false
  }
}

// ── Load ──────────────────────────────────────────────────
onMounted(async () => {
  try {
    const data = await $fetch<WishlistItem[]>('/api/wishlist')
    items.value = data
    await fetchPrices(data)
  } finally {
    loading.value = false
  }
})

function artworkSrc(item: WishlistItem) {
  return item.artworkUrl ? getArtworkUrl(item.artworkUrl, 300) : ''
}
</script>

<template>
  <div class="share-page">
    <!-- Single slim header -->
    <header class="share-header">
      <div class="share-header-inner">
        <!-- Left: brand + title -->
        <div class="share-header-left">
          <div
            class="app-logo-icon"
            style="width: 28px; height: 28px; font-size: 0.85rem; flex-shrink: 0"
          >
            <i class="pi pi-disc" />
          </div>
          <div class="share-header-title-group">
            <span class="share-header-title">Ønskeliste</span>
            <span v-if="!loading" class="share-header-count">{{ items.length }}</span>
          </div>
          <span class="share-view-badge">
            <i class="pi pi-eye" />
            Kun visning
          </span>
        </div>

        <!-- Right: controls -->
        <div v-if="!loading && items.length > 0" class="share-header-controls">
          <!-- Sort field -->
          <Select
            v-model="sortBy"
            :options="SORT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            style="width: 122px"
            title="Sort by"
          />
          <!-- Sort direction -->
          <button
            class="view-toggle-btn"
            :title="sortDir === 'asc' ? 'Stigende' : 'Faldende'"
            @click="toggleSortDir"
          >
            <i :class="sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" />
          </button>
          <!-- Divider -->
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
        </div>
      </div>
    </header>

    <div class="share-body">
      <!-- Loading -->
      <div v-if="loading" class="share-loading">
        <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
        <p style="color: var(--app-text-muted); margin: 1rem 0 0">Henter ønskeliste…</p>
      </div>

      <!-- Empty -->
      <div v-else-if="items.length === 0" class="share-empty">
        <i class="pi pi-heart" style="font-size: 2rem; color: var(--app-text-muted)" />
        <p>Denne ønskeliste er tom.</p>
      </div>

      <!-- List -->
      <template v-else>
        <div v-for="group in groups" :key="group.key">
          <!-- Group header -->
          <div v-if="groupBy !== 'none'" class="share-group-header">
            <span
              v-if="groupBy === 'priority'"
              class="wishlist-priority-pill"
              :class="`priority-badge--${group.key}`"
            >
              <span class="priority-dot" :class="`priority-dot--${group.key}`" />
              {{ group.label }}
            </span>
            <span v-else class="share-group-label">{{ group.label }}</span>
            <span class="share-group-count">{{ group.items.length }}</span>
          </div>

          <div class="share-list">
            <div v-for="item in group.items" :key="item.id" class="share-item">
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
                  <span class="wishlist-priority-pill" :class="`priority-badge--${item.priority}`">
                    <span class="priority-dot" :class="`priority-dot--${item.priority}`" />
                    {{ PRIORITY_LABELS[item.priority] }}
                  </span>
                </div>
                <p class="share-item-sub">
                  {{ item.artist }}{{ item.year ? ' · ' + item.year : '' }} · {{ item.genre }}
                </p>
                <p v-if="item.notes" class="share-item-notes">{{ item.notes }}</p>

                <!-- Vinylpladen row -->
                <div class="share-item-store-row">
                  <a
                    :href="prices[item.id]?.activeUrl ?? vinylpladenUrl(item)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="share-vinylpladen-link"
                  >
                    <i class="pi pi-shopping-cart" style="font-size: 0.75rem" />
                    Køb på Vinylpladen
                    <i class="pi pi-external-link" style="font-size: 0.65rem; opacity: 0.7" />
                  </a>

                  <!-- Price badge -->
                  <span
                    v-if="pricesLoading && !prices[item.id]"
                    class="share-price-badge share-price-loading"
                  >
                    <i class="pi pi-spin pi-spinner" style="font-size: 0.7rem" />
                  </span>
                  <template v-else-if="prices[item.id]">
                    <span
                      v-if="prices[item.id]?.price != null"
                      class="share-price-badge"
                      :class="prices[item.id]?.inStock ? 'share-price-instock' : 'share-price-oos'"
                    >
                      {{ prices[item.id]?.price }} DKK
                      <span v-if="!prices[item.id]?.inStock" style="opacity: 0.7"> · Udsolgt</span>
                    </span>
                    <span v-else class="share-price-badge share-price-na"
                      >Pris ikke tilgængelig</span
                    >
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Footer branding -->
    <footer class="share-footer">
      <i class="pi pi-disc" style="color: var(--gradient-primary)" />
      <span>VinylCollection</span>
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
  max-width: 780px;
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
  max-width: 780px;
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
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.share-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  box-shadow: var(--app-shadow);
  transition: box-shadow 0.15s ease;
}

/* ── Artwork ────────────────────────────────────────────── */
.share-item-art-wrap {
  flex-shrink: 0;
}
.share-item-art {
  width: 72px;
  height: 72px;
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
  font-size: 1.5rem;
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
  font-size: 0.97rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.share-item-sub {
  margin: 0 0 0.3rem;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}
.share-item-notes {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  color: var(--app-text-muted);
  font-style: italic;
  background: var(--app-bg-alt);
  border-left: 2px solid var(--app-border);
  padding: 0.25rem 0.5rem;
  border-radius: 0 4px 4px 0;
}

/* ── Store row ──────────────────────────────────────────── */
.share-item-store-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.share-vinylpladen-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--gradient-primary);
  text-decoration: none;
  border: 1px solid rgba(196, 85, 41, 0.3);
  background: rgba(196, 85, 41, 0.06);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  transition: background 0.15s;
}
.share-vinylpladen-link:hover {
  background: rgba(196, 85, 41, 0.13);
}

/* ── Price badge ────────────────────────────────────────── */
.share-price-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}
.share-price-instock {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.share-price-oos {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.25);
}
.share-price-na {
  background: var(--app-bg-alt);
  color: var(--app-text-muted);
  border: 1px solid var(--app-border);
}
.share-price-loading {
  background: var(--app-bg-alt);
  color: var(--app-text-muted);
  border: 1px solid var(--app-border);
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
