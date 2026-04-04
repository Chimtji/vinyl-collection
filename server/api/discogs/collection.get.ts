interface DiscogsArtist {
  name: string
}

interface DiscogsBasic {
  id: number
  title: string
  year: number
  artists: DiscogsArtist[]
  genres: string[]
  styles: string[]
  cover_image: string
  thumb: string
}

interface DiscogsRelease {
  id: number
  basic_information: DiscogsBasic
}

interface DiscogsPage {
  pagination: { page: number; pages: number; per_page: number; items: number }
  releases: DiscogsRelease[]
}

interface ItunesResult {
  wrapperType: string
  collectionType?: string
  collectionId?: number
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
}

interface ItunesResponse {
  resultCount: number
  results: ItunesResult[]
}

export interface DiscogsImportAlbum {
  discogsReleaseId: number
  title: string
  artist: string
  genre: string
  year: number
  artworkUrl: string
  matchConfidence: 'exact' | 'review' | 'no-match'
  matchedTitle: string
  matchedArtist: string
  itunesCollectionId?: number
}

/** Strip Discogs numeric suffix e.g. "The Beatles (2)" → "The Beatles" */
function cleanArtistName(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, '').trim()
}

/** Normalise a string for comparison: lowercase, strip punctuation & common noise */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\b(the|a|an|remastered|deluxe|edition|version|ep|lp|vol\.?|volume)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Token-based Jaccard similarity between two strings (0–1) */
function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean))
  const tb = new Set(norm(b).split(' ').filter(Boolean))
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let intersect = 0
  for (const t of ta) if (tb.has(t)) intersect++
  return intersect / (ta.size + tb.size - intersect)
}

/** Words that signal a compilation/hits album */
const COMPILATION_RE =
  /\b(greatest hits|best of|collection|anthology|essential|the very best|singles|compilation|gold|platinum|remixed|remixes)\b/i

interface ItunesEnrichment {
  artworkUrl: string
  genre: string
  matchConfidence: 'exact' | 'review' | 'no-match'
  matchedTitle: string
  matchedArtist: string
  itunesCollectionId?: number
}

/**
 * Look up the best-matching iTunes album for an artist + title + year.
 * Returns high-res artwork (600×600) and the iTunes primary genre.
 * Falls back to empty strings if no confident match found.
 */
async function fetchItunesEnrich(
  artist: string,
  title: string,
  year: number,
): Promise<ItunesEnrichment> {
  try {
    const term = `${artist} ${title}`
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=25&media=music`
    const raw = await $fetch<string | ItunesResponse>(url)
    const data: ItunesResponse = typeof raw === 'string' ? JSON.parse(raw) : raw

    const sourceIsCompilation = COMPILATION_RE.test(title)

    let best: ItunesResult | null = null
    let bestScore = -1

    for (const r of data.results ?? []) {
      if (!r.artworkUrl100) continue
      if (r.wrapperType !== 'collection' && r.collectionType !== 'Album') continue

      const iTunesTitle = r.collectionName ?? ''
      const iTunesArtist = r.artistName ?? ''

      const titleScore = similarity(iTunesTitle, title)
      const artistScore = similarity(iTunesArtist, artist)

      // Hard gate 1: title must have meaningful overlap — prevents "Songs About Jane"
      // from matching "V" just because the artist score is high
      if (titleScore < 0.3) continue

      // Hard gate 2: artist must have some overlap (avoids wrong artist named Prince etc.)
      if (artistScore < 0.25) continue

      // Hard gate 3: don't match a studio album to a compilation or vice versa
      const resultIsCompilation = COMPILATION_RE.test(iTunesTitle)
      if (!sourceIsCompilation && resultIsCompilation) continue

      let score = titleScore * 0.65 + artistScore * 0.35

      // Year bonus — strongly rewards the right release, helps disambiguate reissues
      if (year > 0 && r.releaseDate) {
        const releaseYear = new Date(r.releaseDate).getFullYear()
        if (releaseYear === year) score += 0.2
        else if (Math.abs(releaseYear - year) === 1) score += 0.08
      }

      if (score > bestScore) {
        bestScore = score
        best = r
      }
    }

    if (best && bestScore >= 0.3 && best.artworkUrl100) {
      // Determine confidence tier
      const titleScore = similarity(best.collectionName ?? '', title)
      const artistScore = similarity(best.artistName ?? '', artist)
      let matchConfidence: 'exact' | 'review'
      if (titleScore >= 0.85 && artistScore >= 0.75) {
        matchConfidence = 'exact'
      } else {
        matchConfidence = 'review'
      }
      return {
        artworkUrl: best.artworkUrl100.replace('100x100bb', '600x600bb'),
        genre: best.primaryGenreName ?? '',
        matchConfidence,
        matchedTitle: best.collectionName ?? '',
        matchedArtist: best.artistName ?? '',
        itunesCollectionId: best.collectionId,
      }
    }
  } catch {
    // silently fall back
  }
  return {
    artworkUrl: '',
    genre: '',
    matchConfidence: 'no-match',
    matchedTitle: '',
    matchedArtist: '',
  }
}

/** Run an array of async tasks with at most `concurrency` running at once */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export default defineEventHandler(async (event) => {
  const { username } = getQuery(event)

  if (!username || typeof username !== 'string') {
    throw createError({ statusCode: 400, message: 'username is required' })
  }

  const headers: Record<string, string> = {
    'User-Agent': 'VinylCollection/1.0 +https://github.com/vinyl-collection',
    Accept: 'application/json',
  }
  const config = useRuntimeConfig()
  const token = (config.discogsToken as string) || ''
  if (token) {
    headers['Authorization'] = `Discogs token=${token}`
  }

  const allAlbums: DiscogsImportAlbum[] = []
  const MAX_PAGES = 10 // up to 1 000 releases (100 per page)

  let page = 1
  let totalPages = 1

  do {
    const url = `https://api.discogs.com/users/${encodeURIComponent(username)}/collection/folders/0/releases?page=${page}&per_page=100&sort=added&sort_order=desc`

    let data: DiscogsPage
    try {
      data = await $fetch<DiscogsPage>(url, { headers })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        throw createError({ statusCode: 404, message: `Discogs user "${username}" not found` })
      }
      if (status === 401 || status === 403) {
        throw createError({
          statusCode: 403,
          message: `Collection of "${username}" is private`,
        })
      }
      throw createError({ statusCode: 502, message: 'Failed to reach Discogs API' })
    }

    totalPages = data.pagination.pages

    for (const release of data.releases) {
      const b = release.basic_information
      const artist = b.artists?.map((a) => cleanArtistName(a.name)).join(', ') ?? 'Unknown'
      const genre = b.genres?.[0] ?? b.styles?.[0] ?? 'Other'

      allAlbums.push({
        discogsReleaseId: release.id,
        title: b.title ?? 'Unknown',
        artist,
        genre,
        year: b.year ?? 0,
        artworkUrl: b.cover_image || b.thumb || '', // temporary, enriched below
        matchConfidence: 'no-match',
        matchedTitle: '',
        matchedArtist: '',
      })
    }

    page++
  } while (page <= totalPages && page <= MAX_PAGES)

  // Enrich each album with iTunes artwork + genre (5 concurrent requests)
  const enrichments = await mapConcurrent(allAlbums, 5, (album) =>
    fetchItunesEnrich(album.artist, album.title, album.year),
  )

  for (let i = 0; i < allAlbums.length; i++) {
    const e = enrichments[i]!
    if (e.artworkUrl) allAlbums[i]!.artworkUrl = e.artworkUrl
    if (e.genre) allAlbums[i]!.genre = e.genre
    allAlbums[i]!.matchConfidence = e.matchConfidence
    allAlbums[i]!.matchedTitle = e.matchedTitle
    allAlbums[i]!.matchedArtist = e.matchedArtist
    if (e.itunesCollectionId) allAlbums[i]!.itunesCollectionId = e.itunesCollectionId
  }

  return allAlbums
})
