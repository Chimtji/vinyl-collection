<script setup lang="ts">
import type { ApiLogEntry, ApiLogSource } from '~/composables/useApiLogger'

const { logs, clearLogs, pendingCount, totalCount } = useApiLogger()

const open = ref(false)
const activeFilter = ref<ApiLogSource | 'All'>('All')
const expanded = ref<Set<number>>(new Set())
const activeTab = ref<'params' | 'response'>('response')

const SOURCE_COLORS: Record<ApiLogSource | 'Other', { bg: string; text: string; border: string }> =
  {
    iTunes: {
      bg: 'rgba(250, 128, 114, 0.15)',
      border: 'rgba(250, 128, 114, 0.4)',
      text: '#fca5a5',
    },
    Discogs: {
      bg: 'rgba(253, 224, 71, 0.12)',
      border: 'rgba(253, 224, 71, 0.35)',
      text: '#fde047',
    },
    Collection: {
      bg: 'rgba(134, 239, 172, 0.12)',
      border: 'rgba(134, 239, 172, 0.35)',
      text: '#86efac',
    },
    Other: {
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.3)',
      text: '#94a3b8',
    },
  }

const filters: (ApiLogSource | 'All')[] = ['All', 'iTunes', 'Discogs', 'Collection', 'Other']

const filteredLogs = computed(() =>
  activeFilter.value === 'All'
    ? logs.value
    : logs.value.filter((e) => e.source === activeFilter.value),
)

function toggleExpand(id: number) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
  // trigger reactivity
  expanded.value = new Set(expanded.value)
}

function shortUrl(url: string) {
  try {
    const u = new URL(url, 'http://localhost')
    return u.pathname
  } catch {
    return url
  }
}

function formatJson(val: unknown): string {
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

function formatParams(params: Record<string, unknown> | undefined): string {
  if (!params || Object.keys(params).length === 0) return '(none)'
  return formatJson(params)
}

function countBySource(source: ApiLogSource | 'All') {
  if (source === 'All') return totalCount.value
  return logs.value.filter((e) => e.source === source).length
}

function statusColor(entry: ApiLogEntry): string {
  if (entry.status === 'pending') return '#94a3b8'
  if (entry.status === 'success') return '#86efac'
  return '#f87171'
}

function statusIcon(entry: ApiLogEntry): string {
  if (entry.status === 'pending') return 'pi-spin pi-spinner'
  if (entry.status === 'success') return 'pi-check'
  return 'pi-times'
}
</script>

<template>
  <!-- Toggle Button -->
  <div class="devtools-fab" @click="open = !open">
    <i class="pi pi-code" />
    <span v-if="pendingCount > 0" class="devtools-fab-spinner" />
    <span v-else-if="totalCount > 0" class="devtools-fab-count">{{ totalCount }}</span>
  </div>

  <!-- Panel -->
  <Transition name="devtools-slide">
    <div v-if="open" class="devtools-panel">
      <!-- Header -->
      <div class="devtools-header">
        <div style="display: flex; align-items: center; gap: 0.6rem">
          <i class="pi pi-code" style="color: var(--p-primary-400)" />
          <span class="devtools-title">API Logs</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem">
          <Button
            text
            size="small"
            icon="pi pi-trash"
            label="Clear"
            style="font-size: 0.75rem; padding: 0.25rem 0.5rem; color: rgba(255, 255, 255, 0.4)"
            @click="clearLogs"
          />
          <Button
            text
            icon="pi pi-times"
            size="small"
            style="color: rgba(255, 255, 255, 0.4)"
            @click="open = false"
          />
        </div>
      </div>

      <!-- Filters -->
      <div class="devtools-filters">
        <button
          v-for="f in filters"
          :key="f"
          class="devtools-filter-btn"
          :class="{ active: activeFilter === f }"
          @click="activeFilter = f"
        >
          {{ f }}
          <span class="devtools-filter-count">{{ countBySource(f) }}</span>
        </button>
      </div>

      <!-- Log List -->
      <div class="devtools-list">
        <div v-if="filteredLogs.length === 0" class="devtools-empty">
          <i class="pi pi-inbox" style="font-size: 2rem; opacity: 0.3" />
          <p>No requests yet</p>
        </div>

        <div
          v-for="entry in filteredLogs"
          :key="entry.id"
          class="devtools-entry"
          :class="{ expanded: expanded.has(entry.id) }"
        >
          <!-- Entry Row -->
          <div class="devtools-entry-row" @click="toggleExpand(entry.id)">
            <!-- Source Badge -->
            <span
              class="devtools-source-badge"
              :style="{
                background: SOURCE_COLORS[entry.source].bg,
                border: `1px solid ${SOURCE_COLORS[entry.source].border}`,
                color: SOURCE_COLORS[entry.source].text,
              }"
              >{{ entry.source }}</span
            >

            <!-- URL -->
            <span class="devtools-url">{{ shortUrl(entry.url) }}</span>

            <!-- Right side: status + duration -->
            <span class="devtools-meta">
              <span v-if="entry.duration !== undefined" class="devtools-duration">
                {{ entry.duration }}ms
              </span>
              <i
                class="pi devtools-status-icon"
                :class="statusIcon(entry)"
                :style="{ color: statusColor(entry) }"
              />
              <i
                class="pi devtools-chevron"
                :class="expanded.has(entry.id) ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </span>
          </div>

          <!-- Expanded Detail -->
          <div v-if="expanded.has(entry.id)" class="devtools-detail">
            <!-- Tab bar -->
            <div class="devtools-detail-tabs">
              <button
                class="devtools-detail-tab"
                :class="{ active: activeTab === 'params' }"
                @click="activeTab = 'params'"
              >
                Params
              </button>
              <button
                class="devtools-detail-tab"
                :class="{ active: activeTab === 'response' }"
                @click="activeTab = 'response'"
              >
                {{ entry.status === 'error' ? 'Error' : 'Response' }}
              </button>
              <!-- Full URL chip -->
              <span class="devtools-full-url" :title="entry.url">{{ entry.url }}</span>
            </div>

            <pre v-if="activeTab === 'params'" class="devtools-json">{{
              formatParams(entry.params)
            }}</pre>

            <pre v-else-if="entry.status === 'error'" class="devtools-json devtools-json--error">{{
              formatJson(entry.error)
            }}</pre>

            <pre v-else-if="entry.status === 'pending'" class="devtools-json devtools-json--muted">
Waiting for response…</pre
            >

            <pre v-else class="devtools-json">{{ formatJson(entry.response) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── FAB ──────────────────────────────────────────────────── */
.devtools-fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(30, 30, 40, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
  user-select: none;
}
.devtools-fab:hover {
  border-color: var(--p-primary-400);
  color: var(--p-primary-400);
  transform: scale(1.08);
}
.devtools-fab-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--p-primary-500);
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}
.devtools-fab-spinner {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--p-primary-400);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Panel ────────────────────────────────────────────────── */
.devtools-panel {
  position: fixed;
  bottom: 5rem;
  right: 1.5rem;
  z-index: 9998;
  width: 540px;
  max-height: 72vh;
  border-radius: 1rem;
  background: rgba(14, 14, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Transition ───────────────────────────────────────────── */
.devtools-slide-enter-active,
.devtools-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.devtools-slide-enter-from,
.devtools-slide-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

/* ── Header ───────────────────────────────────────────────── */
.devtools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.devtools-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Filters ──────────────────────────────────────────────── */
.devtools-filters {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.devtools-filter-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  transition: all 0.15s ease;
}
.devtools-filter-btn:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
}
.devtools-filter-btn.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: white;
}
.devtools-filter-count {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.3rem;
  padding: 0 0.3rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.45);
  min-width: 14px;
  text-align: center;
}

/* ── List ─────────────────────────────────────────────────── */
.devtools-list {
  overflow-y: auto;
  flex: 1;
  padding: 0.25rem 0;
}
.devtools-list::-webkit-scrollbar {
  width: 4px;
}
.devtools-list::-webkit-scrollbar-track {
  background: transparent;
}
.devtools-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.devtools-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.8rem;
}

/* ── Entry ────────────────────────────────────────────────── */
.devtools-entry {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.devtools-entry:last-child {
  border-bottom: none;
}

.devtools-entry-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.1s ease;
}
.devtools-entry-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.devtools-source-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 0.3rem;
  white-space: nowrap;
}

.devtools-url {
  flex: 1;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
  font-family: 'SF Mono', 'Fira Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.devtools-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.devtools-duration {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
  min-width: 48px;
  text-align: right;
}
.devtools-status-icon {
  font-size: 0.7rem;
}
.devtools-chevron {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.25);
  transition: transform 0.15s ease;
}

/* ── Detail ───────────────────────────────────────────────── */
.devtools-detail {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.25);
}

.devtools-detail-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.devtools-detail-tab {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.4rem 0.7rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s ease;
}
.devtools-detail-tab:hover {
  color: rgba(255, 255, 255, 0.65);
}
.devtools-detail-tab.active {
  color: var(--p-primary-400);
  border-bottom-color: var(--p-primary-400);
}
.devtools-full-url {
  margin-left: auto;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.2);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  padding: 0 0.25rem;
  cursor: default;
}

.devtools-json {
  margin: 0;
  padding: 0.75rem;
  font-size: 0.7rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: rgba(255, 255, 255, 0.6);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 260px;
  overflow-y: auto;
  line-height: 1.5;
}
.devtools-json::-webkit-scrollbar {
  width: 3px;
}
.devtools-json::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}
.devtools-json--error {
  color: #f87171;
}
.devtools-json--muted {
  color: rgba(255, 255, 255, 0.25);
  font-style: italic;
}
</style>
