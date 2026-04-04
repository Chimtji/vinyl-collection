export type ApiLogStatus = 'pending' | 'success' | 'error'

export type ApiLogSource = 'iTunes' | 'Discogs' | 'Collection' | 'Other'

export interface ApiLogEntry {
  id: number
  url: string
  params?: Record<string, unknown>
  status: ApiLogStatus
  statusCode?: number
  response?: unknown
  error?: unknown
  duration?: number
  startTime: number
  source: ApiLogSource
}

function detectSource(url: string): ApiLogSource {
  if (url.includes('/api/itunes')) return 'iTunes'
  if (url.includes('/api/discogs')) return 'Discogs'
  if (url.includes('/api/collection')) return 'Collection'
  return 'Other'
}

const logs = ref<ApiLogEntry[]>([])
let _idCounter = 0

export function useApiLogger() {
  function addEntry(entry: Omit<ApiLogEntry, 'id' | 'source'>): number {
    const id = ++_idCounter
    logs.value.unshift({
      ...entry,
      id,
      source: detectSource(entry.url),
    })
    // Keep max 100 entries
    if (logs.value.length > 100) logs.value.splice(100)
    return id
  }

  function updateEntry(id: number, patch: Partial<ApiLogEntry>) {
    const idx = logs.value.findIndex((e) => e.id === id)
    if (idx !== -1) {
      logs.value[idx] = { ...logs.value[idx]!, ...patch }
    }
  }

  function clearLogs() {
    logs.value = []
  }

  const pendingCount = computed(() => logs.value.filter((e) => e.status === 'pending').length)
  const totalCount = computed(() => logs.value.length)

  return { logs, addEntry, updateEntry, clearLogs, pendingCount, totalCount }
}
