<script setup lang="ts">
import { parseCredits } from '~/composables/useDiscogs'
import type { DiscogsRelease } from '~/composables/useDiscogs'

definePageMeta({ ssr: false })
useSeoMeta({ title: 'Produktionskreditter — Vinyl Collection' })

const { albums, fetchCollection, updateAlbum } = useCollection()
const { searchRelease, getRelease } = useDiscogs()

onMounted(async () => {
  await fetchCollection()
  // Restore previous progress from localStorage
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cache = JSON.parse(raw) as CreditsCache
      creditMap.value = cache.creditMap
      const cachedById = Object.fromEntries(cache.rows.map((r) => [r.id, r]))
      const list = albums.value.filter((a) => a.itunesCollectionId)
      rows.value = list.map((a) => ({
        id: a.id,
        title: a.title,
        artist: a.artist,
        savedDiscogsId: cachedById[a.id]?.savedDiscogsId ?? a.discogsId,
        status: (cachedById[a.id]?.status ?? { state: 'pending' }) as AlbumStatus,
      }))
      hasFetched.value = true
    }
  } catch {}
})

// ── Types ─────────────────────────────────────────────────

type AlbumStatus =
  | { state: 'pending' }
  | { state: 'loading' }
  | { state: 'ok'; discogsId: number; discogsTitle: string }
  | { state: 'no-match' }
  | { state: 'no-credits'; discogsId: number; discogsTitle: string }
  | { state: 'rate-limited' }
  | { state: 'error'; message: string }

interface AlbumRow {
  id: string
  title: string
  artist: string
  savedDiscogsId?: number
  status: AlbumStatus
}

interface CreditEntry {
  name: string
  albums: string[]
}

interface CreditMap {
  studios: CreditEntry[]
  producers: CreditEntry[]
  mixers: CreditEntry[]
  lacquerCutAt: CreditEntry[]
  lacquerCutBy: CreditEntry[]
}

// ── Credit aggregate ──────────────────────────────────────

const creditMap = ref<CreditMap>({
  studios: [],
  producers: [],
  mixers: [],
  lacquerCutAt: [],
  lacquerCutBy: [],
})

function addToMap(map: CreditMap, key: keyof CreditMap, names: string[], albumTitle: string) {
  for (const name of names) {
    const existing = map[key].find((e) => e.name === name)
    if (existing) {
      if (!existing.albums.includes(albumTitle)) existing.albums.push(albumTitle)
    } else {
      map[key].push({ name, albums: [albumTitle] })
    }
  }
}

function mergeCreditMap(credits: ReturnType<typeof parseCredits>, albumTitle: string) {
  addToMap(creditMap.value, 'studios', credits.studios, albumTitle)
  addToMap(creditMap.value, 'producers', credits.producers, albumTitle)
  addToMap(creditMap.value, 'mixers', credits.mixers, albumTitle)
  addToMap(creditMap.value, 'lacquerCutAt', credits.lacquerCutAt, albumTitle)
  addToMap(creditMap.value, 'lacquerCutBy', credits.lacquerCutBy, albumTitle)
}

function sortEntries(entries: CreditEntry[]) {
  return [...entries].sort((a, b) => b.albums.length - a.albums.length)
}

const studios = computed(() => sortEntries(creditMap.value.studios))
const producers = computed(() => sortEntries(creditMap.value.producers))
const mixers = computed(() => sortEntries(creditMap.value.mixers))
const lacquerCutAt = computed(() => sortEntries(creditMap.value.lacquerCutAt))
const lacquerCutBy = computed(() => sortEntries(creditMap.value.lacquerCutBy))

// ── Tabs ──────────────────────────────────────────────────

type TabKey = 'studios' | 'producers' | 'mixers' | 'lacquerCutAt' | 'lacquerCutBy'

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'studios', label: 'Studier', icon: 'pi pi-building' },
  { key: 'producers', label: 'Producere', icon: 'pi pi-sliders-h' },
  { key: 'mixers', label: 'Mixere', icon: 'pi pi-chart-bar' },
  { key: 'lacquerCutAt', label: 'Vinyl skåret ved', icon: 'pi pi-map-marker' },
  { key: 'lacquerCutBy', label: 'Vinyl skåret af', icon: 'pi pi-user' },
]

const activeTab = ref<TabKey>('studios')

const tabData = computed<Record<TabKey, CreditEntry[]>>(() => ({
  studios: studios.value,
  producers: producers.value,
  mixers: mixers.value,
  lacquerCutAt: lacquerCutAt.value,
  lacquerCutBy: lacquerCutBy.value,
}))

const activeData = computed(() => tabData.value[activeTab.value])

const hasAnyData = computed(
  () =>
    studios.value.length > 0 ||
    producers.value.length > 0 ||
    mixers.value.length > 0 ||
    lacquerCutAt.value.length > 0 ||
    lacquerCutBy.value.length > 0,
)

// Auto-switch to first tab with data
watch(hasAnyData, (val) => {
  if (!val) return
  const first = tabs.find((t) => tabData.value[t.key].length > 0)
  if (first) activeTab.value = first.key
})

// ── localStorage persistence ────────────────────────────

const CACHE_KEY = 'vc-credits-cache'

type TerminalStatus = Extract<AlbumStatus, { state: 'ok' | 'no-credits' | 'no-match' | 'error' }>

interface CreditsCache {
  creditMap: CreditMap
  rows: Array<{ id: string; status: TerminalStatus; savedDiscogsId?: number }>
}

function saveToCache() {
  const terminalRows = rows.value
    .filter((r) => ['ok', 'no-credits', 'no-match', 'error'].includes(r.status.state))
    .map((r) => ({
      id: r.id,
      status: r.status as TerminalStatus,
      savedDiscogsId: r.savedDiscogsId,
    }))
  const cache: CreditsCache = { creditMap: creditMap.value, rows: terminalRows }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {}
}

// ── Rate-limit-safe request helper ───────────────────────

let lastRequestAt = 0
async function rateLimitedDelay() {
  const minGap = 1200 // ms between any two Discogs requests
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < minGap) await new Promise((r) => setTimeout(r, minGap - elapsed))
  lastRequestAt = Date.now()
}

// ── Fetch rows & running state ────────────────────────────

const rows = ref<AlbumRow[]>([])
const aborted = ref(false)
const isRunning = ref(false)
const hasFetched = ref(false)

const pendingRows = computed(() =>
  rows.value.some((r) => ['pending', 'rate-limited', 'error'].includes(r.status.state)),
)
const countOk = computed(() => rows.value.filter((r) => r.status.state === 'ok').length)
const countNoCredits = computed(
  () => rows.value.filter((r) => r.status.state === 'no-credits').length,
)
const countNoMatch = computed(() => rows.value.filter((r) => r.status.state === 'no-match').length)
const countFailed = computed(
  () =>
    rows.value.filter((r) => r.status.state === 'error' || r.status.state === 'rate-limited')
      .length,
)
const currentlyLeft = computed(
  () =>
    rows.value.filter((r) => r.status.state === 'pending' || r.status.state === 'loading').length,
)

async function loadCredits(forceReload = false) {
  if (isRunning.value) return
  if (forceReload) {
    clearCache()
    creditMap.value = { studios: [], producers: [], mixers: [], lacquerCutAt: [], lacquerCutBy: [] }
    rows.value = []
  }
  aborted.value = false
  isRunning.value = true
  hasFetched.value = true

  const list = albums.value.filter((a) => a.itunesCollectionId)
  // Build rows, preserving any already-saved statuses from cache/previous run
  const existingById = Object.fromEntries(rows.value.map((r) => [r.id, r]))
  rows.value = list.map((a) => {
    const existing = existingById[a.id]
    return {
      id: a.id,
      title: a.title,
      artist: a.artist,
      savedDiscogsId: existing?.savedDiscogsId ?? a.discogsId,
      status: (existing?.status ?? { state: 'pending' }) as AlbumStatus,
    }
  })

  const retryCount: Record<number, number> = {}

  for (let i = 0; i < rows.value.length; i++) {
    if (aborted.value) break
    const row = rows.value[i]
    if (!row) continue
    // Skip rows that already have a terminal result
    if (['ok', 'no-credits', 'no-match', 'error'].includes(row.status.state)) continue
    row.status = { state: 'loading' }
    try {
      let resolvedId: number | undefined = row.savedDiscogsId
      if (!resolvedId) {
        await rateLimitedDelay()
        const release = await searchRelease(row.artist, row.title)
        if (!release?.id) {
          row.status = { state: 'no-match' }
          continue
        }
        resolvedId = release.id
        await updateAlbum(row.id, { discogsId: resolvedId }).catch(() => {})
        row.savedDiscogsId = resolvedId
      }
      await rateLimitedDelay()
      const full = await getRelease(resolvedId)
      if (!full) {
        row.status = { state: 'no-match' }
        continue
      }
      const credits = parseCredits(full)
      const hasCredits =
        credits.studios.length > 0 ||
        credits.producers.length > 0 ||
        credits.mixers.length > 0 ||
        credits.lacquerCutAt.length > 0 ||
        credits.lacquerCutBy.length > 0
      if (hasCredits) {
        mergeCreditMap(credits, row.title)
        row.status = { state: 'ok', discogsId: resolvedId, discogsTitle: full.title }
      } else {
        row.status = { state: 'no-credits', discogsId: resolvedId, discogsTitle: full.title }
      }
      retryCount[i] = 0
      saveToCache()
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 429) {
        retryCount[i] = (retryCount[i] ?? 0) + 1
        if (retryCount[i] > 4) {
          // Too many retries — give up on this album and move on
          row.status = { state: 'error', message: 'Rate limit: for mange forsøg' }
          retryCount[i] = 0
          continue
        }
        row.status = { state: 'rate-limited' }
        // Exponential back-off: 5s, 10s, 20s, 40s
        const waitMs = 5000 * Math.pow(2, retryCount[i] - 1)
        await new Promise((r) => setTimeout(r, waitMs))
        lastRequestAt = Date.now() // gap is already satisfied
        i--
        continue
      }
      row.status = { state: 'error', message: String(err) }
      saveToCache()
    }
  }
  isRunning.value = false
}

// ── Album status modal ────────────────────────────────────

const statusModalVisible = ref(false)
const statusFilter = ref<'all' | 'ok' | 'no-credits' | 'no-match' | 'error'>('all')

const filteredRows = computed(() => {
  if (statusFilter.value === 'all') return rows.value
  if (statusFilter.value === 'ok') return rows.value.filter((r) => r.status.state === 'ok')
  if (statusFilter.value === 'no-credits')
    return rows.value.filter((r) => r.status.state === 'no-credits')
  if (statusFilter.value === 'no-match')
    return rows.value.filter((r) => r.status.state === 'no-match')
  return rows.value.filter((r) => r.status.state === 'error' || r.status.state === 'rate-limited')
})

function openStatusModal(filter: typeof statusFilter.value = 'all') {
  statusFilter.value = filter
  statusModalVisible.value = true
}

// ── Resolve dialog ────────────────────────────────────────

const resolveDialog = ref(false)
const resolveRow = ref<AlbumRow | null>(null)
const resolveInput = ref('')
const resolveSearchQuery = ref('')
const resolveSearchResults = ref<DiscogsRelease[]>([])
const resolveSearchLoading = ref(false)
const resolveApplying = ref(false)

function openResolve(row: AlbumRow) {
  resolveRow.value = row
  resolveInput.value = ''
  resolveSearchQuery.value = `${row.artist} ${row.title}`
  resolveSearchResults.value = []
  resolveDialog.value = true
}

async function runResolveSearch() {
  if (!resolveRow.value) return
  resolveSearchLoading.value = true
  resolveSearchResults.value = []
  try {
    const q = resolveSearchQuery.value.trim()
    const spaceIdx = q.indexOf(' ')
    const artist = spaceIdx > 0 ? q.slice(0, spaceIdx) : q
    const albumTitle = spaceIdx > 0 ? q.slice(spaceIdx + 1) : ''
    const result = await $fetch<{ results: DiscogsRelease[] }>('/api/discogs/search', {
      query: { artist, album: albumTitle },
    })
    resolveSearchResults.value = result.results ?? []
  } catch {
    resolveSearchResults.value = []
  } finally {
    resolveSearchLoading.value = false
  }
}

function extractDiscogsId(input: string): number | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const match = trimmed.match(/\/release\/(\d+)/)
  return match ? Number(match[1]) : null
}

async function applyResolve(discogsId?: number) {
  const row = resolveRow.value
  if (!row) return
  const id = discogsId ?? extractDiscogsId(resolveInput.value)
  if (!id) return
  resolveApplying.value = true
  try {
    row.status = { state: 'loading' }
    const full = await getRelease(id)
    if (!full) {
      row.status = { state: 'error', message: 'Release ikke fundet' }
      return
    }
    const credits = parseCredits(full)
    const hasCredits =
      credits.studios.length > 0 ||
      credits.producers.length > 0 ||
      credits.mixers.length > 0 ||
      credits.lacquerCutAt.length > 0 ||
      credits.lacquerCutBy.length > 0
    if (hasCredits) {
      mergeCreditMap(credits, row.title)
      row.status = { state: 'ok', discogsId: id, discogsTitle: full.title }
    } else {
      row.status = { state: 'no-credits', discogsId: id, discogsTitle: full.title }
    }
    await updateAlbum(row.id, { discogsId: id }).catch(() => {})
    resolveDialog.value = false
  } catch {
    row.status = { state: 'error', message: 'Fejl ved hentning' }
  } finally {
    resolveApplying.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="cr-header">
      <div style="flex: 1; min-width: 0">
        <h1 class="collection-page-title">
          <i class="pi pi-id-card" style="color: var(--p-primary-500)" />
          Produktionskreditter
        </h1>
        <p class="cr-subtitle">
          Se mønstre på tværs af din samling \u2014 studier, producere, mixere og lakskæring.
        </p>
      </div>

      <div class="cr-header-right">
        <div v-if="hasFetched" class="cr-status-badges">
          <button
            class="cr-badge cr-badge--ok"
            title="Kreditter fundet"
            @click="openStatusModal('ok')"
          >
            <i class="pi pi-check-circle" /> {{ countOk }}
          </button>
          <button
            class="cr-badge cr-badge--warn"
            title="Ingen kreditter"
            @click="openStatusModal('no-credits')"
          >
            <i class="pi pi-minus-circle" /> {{ countNoCredits }}
          </button>
          <button
            class="cr-badge cr-badge--muted"
            title="Ikke matchet"
            @click="openStatusModal('no-match')"
          >
            <i class="pi pi-question-circle" /> {{ countNoMatch }}
          </button>
          <button
            v-if="countFailed > 0"
            class="cr-badge cr-badge--error"
            title="Fejl"
            @click="openStatusModal('error')"
          >
            <i class="pi pi-times-circle" /> {{ countFailed }}
          </button>
          <button
            class="cr-badge cr-badge--all"
            title="Vis alle albums"
            @click="openStatusModal('all')"
          >
            <i class="pi pi-list" /> {{ rows.length }}
          </button>
        </div>
        <Button
          :label="
            isRunning
              ? 'Henter\u2026'
              : !hasFetched
                ? 'Hent kreditter'
                : pendingRows
                  ? 'Fortsæt'
                  : 'Genindlæs'
          "
          :icon="isRunning ? undefined : 'pi pi-sparkles'"
          :loading="isRunning"
          :disabled="isRunning"
          @click="hasFetched && !pendingRows ? loadCredits(true) : loadCredits()"
        />
        <Button
          v-if="isRunning"
          label="Stop"
          severity="secondary"
          outlined
          size="small"
          @click="aborted = true"
        />
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="isRunning" class="cr-progress-wrap">
      <div class="cr-progress-track">
        <div
          class="cr-progress-fill"
          :style="{
            width:
              rows.length > 0 ? `${((rows.length - currentlyLeft) / rows.length) * 100}%` : '0%',
          }"
        />
      </div>
      <span class="cr-progress-label">{{ rows.length - currentlyLeft }} / {{ rows.length }}</span>
    </div>

    <!-- Empty / prompt state -->
    <div v-if="!hasFetched" class="cr-empty">
      <div class="cr-empty-icon"><i class="pi pi-id-card" /></div>
      <p class="cr-empty-title">Ingen data endnu</p>
      <p class="cr-empty-sub">
        Tryk på \u201cHent kreditter\u201d for at hente produktionsoplysninger for dine albums fra
        Discogs.
      </p>
      <Button label="Hent kreditter" icon="pi pi-sparkles" @click="loadCredits()" />
    </div>

    <!-- Main content -->
    <div v-else-if="hasAnyData">
      <div class="cr-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['cr-tab', activeTab === tab.key && 'cr-tab--active']"
          :disabled="tabData[tab.key].length === 0"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon" />
          {{ tab.label }}
          <span class="cr-tab-count">{{ tabData[tab.key].length }}</span>
        </button>
      </div>

      <div class="cr-list-card">
        <ul class="cr-entry-list">
          <li v-for="entry in activeData" :key="entry.name" class="cr-entry-row">
            <div class="cr-entry-bar-wrap">
              <div
                class="cr-entry-bar"
                :style="{
                  width: `${(entry.albums.length / (activeData[0]?.albums.length ?? 1)) * 100}%`,
                }"
              />
            </div>
            <div class="cr-entry-info">
              <span class="cr-entry-name">{{ entry.name }}</span>
              <span class="cr-entry-albums">{{ entry.albums.join(' \u00b7 ') }}</span>
            </div>
            <span class="cr-entry-count">{{ entry.albums.length }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div v-else-if="hasFetched && !isRunning" class="cr-empty">
      <div class="cr-empty-icon"><i class="pi pi-inbox" /></div>
      <p class="cr-empty-title">Ingen kreditter fundet</p>
      <p class="cr-empty-sub">
        Discogs mangler kreditter for de fundne albums. Brug statusvisningen til at løse albums
        manuelt.
      </p>
    </div>

    <!-- Status modal -->
    <Dialog
      v-model:visible="statusModalVisible"
      modal
      header="Album status"
      :style="{ width: '580px', maxWidth: '95vw' }"
    >
      <div class="cr-modal-tabs">
        <button
          :class="['cr-modal-tab', statusFilter === 'all' && 'cr-modal-tab--active']"
          @click="statusFilter = 'all'"
        >
          Alle <span class="cr-tab-count">{{ rows.length }}</span>
        </button>
        <button
          :class="['cr-modal-tab', statusFilter === 'ok' && 'cr-modal-tab--active']"
          @click="statusFilter = 'ok'"
        >
          OK <span class="cr-tab-count">{{ countOk }}</span>
        </button>
        <button
          :class="['cr-modal-tab', statusFilter === 'no-credits' && 'cr-modal-tab--active']"
          @click="statusFilter = 'no-credits'"
        >
          Ingen kreditter <span class="cr-tab-count">{{ countNoCredits }}</span>
        </button>
        <button
          :class="['cr-modal-tab', statusFilter === 'no-match' && 'cr-modal-tab--active']"
          @click="statusFilter = 'no-match'"
        >
          Ikke fundet <span class="cr-tab-count">{{ countNoMatch }}</span>
        </button>
        <button
          :class="['cr-modal-tab', statusFilter === 'error' && 'cr-modal-tab--active']"
          @click="statusFilter = 'error'"
        >
          Fejl <span class="cr-tab-count">{{ countFailed }}</span>
        </button>
      </div>
      <ul class="cr-modal-list">
        <li v-for="row in filteredRows" :key="row.id" class="cr-modal-row">
          <div class="cr-modal-album-info">
            <span class="cr-modal-title">{{ row.title }}</span>
            <span class="cr-modal-artist">{{ row.artist }}</span>
            <span
              v-if="row.status.state === 'ok' || row.status.state === 'no-credits'"
              class="cr-modal-discogs"
            >
              {{ (row.status as { discogsTitle: string }).discogsTitle }}
            </span>
            <span v-if="row.status.state === 'error'" class="cr-modal-error-msg">
              {{ (row.status as { message: string }).message }}
            </span>
          </div>
          <div class="cr-modal-actions">
            <i v-if="row.status.state === 'pending'" class="pi pi-clock cr-icon--muted" />
            <ProgressSpinner
              v-else-if="row.status.state === 'loading'"
              stroke-width="5"
              style="width: 14px; height: 14px"
            />
            <i v-else-if="row.status.state === 'ok'" class="pi pi-check-circle cr-icon--ok" />
            <i
              v-else-if="row.status.state === 'no-credits'"
              class="pi pi-minus-circle cr-icon--warn"
            />
            <i
              v-else-if="row.status.state === 'no-match'"
              class="pi pi-question-circle cr-icon--muted"
            />
            <i v-else-if="row.status.state === 'rate-limited'" class="pi pi-clock cr-icon--warn" />
            <i v-else-if="row.status.state === 'error'" class="pi pi-times-circle cr-icon--error" />
            <button
              v-if="['no-match', 'no-credits', 'error', 'rate-limited'].includes(row.status.state)"
              class="cr-resolve-btn"
              title="Løs manuelt"
              @click="openResolve(row)"
            >
              <i class="pi pi-wrench" />
            </button>
          </div>
        </li>
        <li v-if="filteredRows.length === 0" class="cr-modal-empty-row">
          Ingen albums i denne kategori
        </li>
      </ul>
      <template #footer>
        <Button label="Luk" text @click="statusModalVisible = false" />
      </template>
    </Dialog>

    <!-- Resolve dialog -->
    <Dialog
      v-model:visible="resolveDialog"
      modal
      header="Løs manuelt"
      :style="{ width: '520px', maxWidth: '95vw' }"
    >
      <div v-if="resolveRow" style="display: flex; flex-direction: column; gap: 1rem">
        <p style="margin: 0; font-size: 0.9rem; color: var(--app-text-muted)">
          <strong style="color: var(--app-text)">{{ resolveRow.title }}</strong> \u2014
          {{ resolveRow.artist }}
        </p>
        <div>
          <label class="cr-dialog-label">Indsæt Discogs URL eller release-ID</label>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem">
            <InputText
              v-model="resolveInput"
              placeholder="https://www.discogs.com/release/123456 eller 123456"
              style="flex: 1"
              @keydown.enter="applyResolve()"
            />
            <Button
              label="Anvend"
              :loading="resolveApplying"
              :disabled="!resolveInput.trim()"
              @click="applyResolve()"
            />
          </div>
        </div>
        <Divider
          ><span style="font-size: 0.78rem; color: var(--app-text-muted)">eller søg</span></Divider
        >
        <div>
          <label class="cr-dialog-label">Søg på Discogs</label>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem">
            <InputText
              v-model="resolveSearchQuery"
              placeholder="Kunstner album"
              style="flex: 1"
              @keydown.enter="runResolveSearch()"
            />
            <Button
              label="Søg"
              icon="pi pi-search"
              :loading="resolveSearchLoading"
              @click="runResolveSearch()"
            />
          </div>
        </div>
        <ul v-if="resolveSearchResults.length" class="cr-resolve-results">
          <li v-for="r in resolveSearchResults.slice(0, 8)" :key="r.id" class="cr-resolve-row">
            <img
              v-if="r.thumb"
              :src="`/api/proxy/image?url=${encodeURIComponent(r.thumb)}`"
              class="cr-resolve-thumb"
              alt=""
            />
            <div v-else class="cr-resolve-thumb cr-resolve-thumb--empty">
              <i class="pi pi-image" />
            </div>
            <div style="flex: 1; min-width: 0">
              <div
                style="
                  font-size: 0.88rem;
                  font-weight: 500;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                {{ r.title }}
              </div>
              <div style="font-size: 0.77rem; color: var(--app-text-muted)">
                {{ [r.year, r.country, r.label?.join(', ')].filter(Boolean).join(' \u00b7 ') }}
              </div>
            </div>
            <Button
              label="Vælg"
              size="small"
              outlined
              :loading="resolveApplying"
              @click="applyResolve(r.id)"
            />
          </li>
        </ul>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.cr-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.cr-subtitle {
  color: var(--app-text-muted);
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}
.cr-header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-left: auto;
}
.cr-status-badges {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}
.cr-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: opacity 0.15s;
}
.cr-badge:hover {
  opacity: 0.75;
}
.cr-badge--ok {
  background: rgba(34, 197, 94, 0.15);
  color: var(--p-green-500);
  border-color: rgba(34, 197, 94, 0.3);
}
.cr-badge--warn {
  background: rgba(234, 179, 8, 0.15);
  color: var(--p-yellow-500);
  border-color: rgba(234, 179, 8, 0.3);
}
.cr-badge--muted {
  background: rgba(148, 163, 184, 0.12);
  color: var(--app-text-muted);
  border-color: rgba(148, 163, 184, 0.25);
}
.cr-badge--error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--p-red-500);
  border-color: rgba(239, 68, 68, 0.3);
}
.cr-badge--all {
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-primary-400);
  border-color: rgba(99, 102, 241, 0.25);
}
.cr-progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.cr-progress-track {
  flex: 1;
  height: 5px;
  background: var(--app-border);
  border-radius: 99px;
  overflow: hidden;
}
.cr-progress-fill {
  height: 100%;
  background: var(--p-primary-500);
  border-radius: 99px;
  transition: width 0.3s;
}
.cr-progress-label {
  font-size: 0.8rem;
  color: var(--app-text-muted);
  white-space: nowrap;
}
.cr-empty {
  text-align: center;
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.cr-empty-icon {
  font-size: 2.5rem;
  color: var(--app-text-muted);
  margin-bottom: 0.5rem;
}
.cr-empty-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}
.cr-empty-sub {
  font-size: 0.88rem;
  color: var(--app-text-muted);
  max-width: 380px;
  margin: 0 0 0.75rem;
}
.cr-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--app-border);
  padding-bottom: 0.5rem;
}
.cr-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
  border-radius: 7px;
  color: var(--app-text-muted);
  transition:
    background 0.12s,
    color 0.12s;
}
.cr-tab:disabled {
  opacity: 0.35;
  cursor: default;
}
.cr-tab:not(:disabled):hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.cr-tab--active {
  background: var(--p-primary-500) !important;
  color: #fff !important;
}
.cr-tab-count {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 99px;
  padding: 0 6px;
  font-size: 0.72rem;
  line-height: 1.6;
}
.cr-tab--active .cr-tab-count {
  background: rgba(255, 255, 255, 0.22);
}

.cr-list-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 260px);
}
.cr-entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cr-entry-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--app-border);
  position: relative;
}
.cr-entry-row:last-child {
  border-bottom: none;
}
.cr-entry-bar-wrap {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.cr-entry-bar {
  height: 100%;
  background: rgba(99, 102, 241, 0.07);
  transition: width 0.4s;
}
.cr-entry-info {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.cr-entry-name {
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cr-entry-albums {
  font-size: 0.75rem;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cr-entry-count {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--p-primary-400);
  flex-shrink: 0;
  position: relative;
  min-width: 1.5rem;
  text-align: right;
}
.cr-modal-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--app-border);
}
.cr-modal-tab {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  color: var(--app-text-muted);
}
.cr-modal-tab:hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.cr-modal-tab--active {
  background: var(--p-primary-500);
  color: #fff;
}
.cr-modal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  max-height: 420px;
}
.cr-modal-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--app-border);
}
.cr-modal-row:last-child {
  border-bottom: none;
}
.cr-modal-album-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.cr-modal-title {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cr-modal-artist {
  font-size: 0.77rem;
  color: var(--app-text-muted);
}
.cr-modal-discogs {
  font-size: 0.72rem;
  color: var(--p-primary-400);
}
.cr-modal-error-msg {
  font-size: 0.72rem;
  color: var(--p-red-400);
}
.cr-modal-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}
.cr-modal-empty-row {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--app-text-muted);
}
.cr-icon--ok {
  color: var(--p-green-500);
}
.cr-icon--warn {
  color: var(--p-yellow-500);
}
.cr-icon--muted {
  color: var(--app-text-muted);
}
.cr-icon--error {
  color: var(--p-red-500);
}
.cr-resolve-btn {
  background: none;
  border: 1px solid var(--app-border);
  border-radius: 5px;
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  color: var(--app-text-muted);
  font-size: 0.8rem;
  line-height: 1;
}
.cr-resolve-btn:hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.cr-dialog-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--app-text-muted);
}
.cr-resolve-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 320px;
  overflow-y: auto;
}
.cr-resolve-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--app-border);
}
.cr-resolve-row:last-child {
  border-bottom: none;
}
.cr-resolve-thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.cr-resolve-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-hover);
  color: var(--app-text-muted);
}
</style>
