interface ItunesSearchResponse {
  resultCount: number
  results: unknown[]
}

// Simple in-memory cache: term → { data, expiresAt }
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const term = String(Array.isArray(query.term) ? query.term[0] : (query.term ?? ''))

  if (!term) {
    throw createError({ statusCode: 400, message: 'Search term is required' })
  }

  const cacheKey = term.toLowerCase().trim()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const base = `https://itunes.apple.com/search?media=music&limit=20`
  const encoded = encodeURIComponent(term)

  function parse(raw: unknown): ItunesSearchResponse {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return data as ItunesSearchResponse
  }

  try {
    const [artistRaw, albumRaw, songRaw] = await Promise.all([
      $fetch<unknown>(`${base}&entity=musicArtist&term=${encoded}`),
      $fetch<unknown>(`${base}&entity=album&term=${encoded}`),
      $fetch<unknown>(`${base}&entity=song&term=${encoded}`),
    ])

    const artistData = parse(artistRaw)
    const albumData = parse(albumRaw)
    const songData = parse(songRaw)

    const result = {
      artists: artistData?.results ?? [],
      albums: albumData?.results ?? [],
      songs: songData?.results ?? [],
    }

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })

    // Evict old entries to prevent unbounded growth
    if (cache.size > 200) {
      const now = Date.now()
      for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key)
      }
    }

    return result
  } catch (error) {
    console.error('[iTunes search-all Error]', error)
    throw createError({ statusCode: 502, message: 'Failed to reach iTunes API' })
  }
})
