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
    } catch {
      return null
    }
  }

  function getDiscogsUrl(release: DiscogsRelease): string {
    if (release.uri) {
      return `https://www.discogs.com${release.uri}`
    }
    return `https://www.discogs.com/release/${release.id}`
  }

  return {
    searchRelease,
    getDiscogsUrl,
  }
}
