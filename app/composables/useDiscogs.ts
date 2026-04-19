export interface DiscogsArtistRef {
  name: string
  role: string
  anv?: string
  join?: string
  tracks?: string
  resource_url?: string
  id?: number
}

export interface DiscogsFullRelease {
  id: number
  title: string
  year?: number
  thumb?: string
  cover_image?: string
  resource_url: string
  uri: string
  artists?: DiscogsArtistRef[]
  extraartists?: DiscogsArtistRef[]
  labels?: { name: string; catno: string }[]
  formats?: { name: string; qty: string; descriptions?: string[] }[]
  country?: string
  notes?: string
  community?: { want: number; have: number }
  tracklist?: {
    position: string
    title: string
    duration: string
    extraartists?: DiscogsArtistRef[]
  }[]
  companies?: { name: string; entity_type_name: string }[]
}

export interface DiscogsCredits {
  studios: string[]
  producers: string[]
  mixers: string[]
  lacquerCutAt: string[]
  lacquerCutBy: string[]
}

export function parseCredits(release: DiscogsFullRelease): DiscogsCredits {
  const credits: DiscogsCredits = {
    studios: [],
    producers: [],
    mixers: [],
    lacquerCutAt: [],
    lacquerCutBy: [],
  }
  // 1. Parse extraartists (release-level + track-level)
  const all: DiscogsArtistRef[] = [
    ...(release.extraartists ?? []),
    ...(release.artists ?? []),
    ...(release.tracklist?.flatMap((t) => t.extraartists ?? []) ?? []),
  ]
  for (const person of all) {
    const role = (person.role ?? '').toLowerCase()
    const name = person.anv || person.name
    if (!name) continue
    if (role.includes('recorded at') || role.includes('recording location')) {
      if (!credits.studios.includes(name)) credits.studios.push(name)
    }
    if (role.includes('producer') || role.includes('produced by')) {
      if (!credits.producers.includes(name)) credits.producers.push(name)
    }
    if (role.includes('mixed by') || role.includes('mixer')) {
      if (!credits.mixers.includes(name)) credits.mixers.push(name)
    }
    if (
      role.includes('lacquer cut at') ||
      role.includes('cut at') ||
      role.includes('mastered at')
    ) {
      if (!credits.lacquerCutAt.includes(name)) credits.lacquerCutAt.push(name)
    }
    if (
      role.includes('lacquer cut by') ||
      role.includes('cut by') ||
      role.includes('mastered by')
    ) {
      if (!credits.lacquerCutBy.includes(name)) credits.lacquerCutBy.push(name)
    }
  }

  // 2. Parse companies (this is where Discogs most reliably stores studio/mastering info)
  for (const company of release.companies ?? []) {
    const type = (company.entity_type_name ?? '').toLowerCase()
    const name = company.name
    if (!name) continue
    if (type === 'recorded at' || type === 'recording location') {
      if (!credits.studios.includes(name)) credits.studios.push(name)
    }
    if (type === 'mixed at') {
      if (!credits.studios.includes(name)) credits.studios.push(name)
    }
    if (
      type === 'lacquer cut at' ||
      type === 'cut at' ||
      type === 'mastered at' ||
      type === 'remastered at'
    ) {
      if (!credits.lacquerCutAt.includes(name)) credits.lacquerCutAt.push(name)
    }
    if (
      type === 'lacquer cut by' ||
      type === 'cut by' ||
      type === 'mastered by' ||
      type === 'remastered by'
    ) {
      if (!credits.lacquerCutBy.includes(name)) credits.lacquerCutBy.push(name)
    }
  }

  return credits
}

export interface DiscogsRelease {
  id: number
  title: string
  year?: number
  thumb?: string
  cover_image?: string
  resource_url: string
  uri: string
  type: string
  country?: string
  format?: string[]
  label?: string[]
  genre?: string[]
  style?: string[]
  catno?: string
  barcode?: string[]
  community?: {
    want: number
    have: number
  }
}

export interface DiscogsSearchResponse {
  pagination: {
    page: number
    pages: number
    per_page: number
    items: number
    urls: Record<string, string>
  }
  results: DiscogsRelease[]
}

export function useDiscogs() {
  async function searchRelease(artist: string, album: string): Promise<DiscogsRelease | null> {
    try {
      const data = await $fetch<DiscogsSearchResponse>('/api/discogs/search', {
        query: { artist, album },
      })
      if (data.results && data.results.length > 0) {
        return data.results[0] ?? null
      }
      return null
    } catch (err: unknown) {
      // Surface rate-limit errors so callers can distinguish from "not found"
      const status = err as { response?: { status?: number }; statusCode?: number }
      if (status?.response?.status === 429 || status?.statusCode === 429) {
        throw err
      }
      return null
    }
  }

  async function getRelease(id: number): Promise<DiscogsFullRelease | null> {
    try {
      return await $fetch<DiscogsFullRelease>('/api/discogs/release', { query: { id } })
    } catch {
      return null
    }
  }

  function getDiscogsUrl(release: DiscogsRelease | DiscogsFullRelease): string {
    if (release.uri) {
      return `https://www.discogs.com${release.uri}`
    }
    return `https://www.discogs.com/release/${release.id}`
  }

  return {
    searchRelease,
    getRelease,
    getDiscogsUrl,
  }
}
