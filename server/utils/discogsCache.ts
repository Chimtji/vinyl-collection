// In-memory cache for Discogs API responses — prevents re-fetching the same
// data and avoids hitting the 60 req/min rate limit.
// TTL: 1 hour (3 600 000 ms)

const TTL = 60 * 60 * 1_000

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function getCached(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCached(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL })
}

export function discogsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'VinylCollection/1.0 +https://github.com/vinyl-collection',
  }
  const token = process.env.DISCOGS_TOKEN
  if (token) headers['Authorization'] = `Discogs token=${token}`
  return headers
}
