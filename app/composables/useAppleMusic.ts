export interface ItunesArtist {
  wrapperType: string
  artistType: string
  artistName: string
  artistLinkUrl: string
  artistId: number
  amgArtistId?: number
  primaryGenreName?: string
  primaryGenreId?: number
}

export interface ItunesAlbum {
  wrapperType: string
  collectionType: string
  artistId: number
  collectionId: number
  amgArtistId?: number
  artistName: string
  collectionName: string
  collectionCensoredName: string
  artistViewUrl: string
  collectionViewUrl: string
  artworkUrl60: string
  artworkUrl100: string
  collectionPrice?: number
  collectionExplicitness: string
  trackCount: number
  copyright?: string
  country: string
  currency?: string
  releaseDate: string
  primaryGenreName: string
}

export interface ItunesTrack {
  wrapperType: string
  kind: string
  artistId: number
  collectionId: number
  trackId: number
  artistName: string
  collectionName: string
  trackName: string
  collectionCensoredName: string
  trackCensoredName: string
  artistViewUrl: string
  collectionViewUrl: string
  trackViewUrl: string
  previewUrl?: string
  artworkUrl30: string
  artworkUrl60: string
  artworkUrl100: string
  trackPrice?: number
  releaseDate: string
  collectionExplicitness: string
  trackExplicitness: string
  discCount: number
  discNumber: number
  trackCount: number
  trackNumber: number
  trackTimeMillis?: number
  country: string
  currency?: string
  primaryGenreName: string
  isStreamable?: boolean
}

export type ItunesResult = ItunesArtist | ItunesAlbum | ItunesTrack

export interface ItunesSearchResponse {
  resultCount: number
  results: ItunesResult[]
}

export function useAppleMusic() {
  async function searchArtists(term: string): Promise<ItunesArtist[]> {
    const data = await $fetch<ItunesSearchResponse>('/api/itunes/search', {
      query: { term, entity: 'musicArtist', limit: 20 },
    })
    const artists = (data.results || []).filter(
      (r): r is ItunesArtist => (r as ItunesArtist).wrapperType === 'artist',
    )
    return artists
  }

  async function searchAll(term: string): Promise<ItunesResult[]> {
    const [albumData, songData] = await Promise.all([
      $fetch<ItunesSearchResponse>('/api/itunes/search', {
        query: { term, entity: 'album', limit: 20 },
      }),
      $fetch<ItunesSearchResponse>('/api/itunes/search', {
        query: { term, entity: 'song', limit: 20 },
      }),
    ])
    const allResults = [...(albumData.results || []), ...(songData.results || [])]
    return allResults
  }

  async function getArtistAlbums(artistId: number): Promise<ItunesAlbum[]> {
    const data = await $fetch<ItunesSearchResponse>('/api/itunes/lookup', {
      query: { id: artistId, entity: 'album', limit: 50 },
    })
    return (data.results || []).filter(
      (r): r is ItunesAlbum => (r as ItunesAlbum).wrapperType === 'collection',
    )
  }

  async function getAlbumTracks(
    albumId: number,
  ): Promise<{ album: ItunesAlbum | null; tracks: ItunesTrack[] }> {
    const data = await $fetch<ItunesSearchResponse>('/api/itunes/lookup', {
      query: { id: albumId, entity: 'song', limit: 100 },
    })
    const results = data.results || []
    const album =
      (results.find((r) => (r as ItunesAlbum).wrapperType === 'collection') as ItunesAlbum) ?? null
    const tracks = results.filter(
      (r): r is ItunesTrack => (r as ItunesTrack).wrapperType === 'track',
    )
    return { album, tracks }
  }

  function getArtworkUrl(url: string, size = 300): string {
    if (!url) return ''
    return url.replace('100x100', `${size}x${size}`)
  }

  function formatDuration(ms: number): string {
    if (!ms) return '—'
    const totalSeconds = Math.round(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  function formatReleaseYear(dateStr: string): string {
    if (!dateStr) return ''
    const year = new Date(dateStr).getFullYear()
    return year && year > 0 ? year.toString() : ''
  }

  return {
    searchArtists,
    searchAll,
    getArtistAlbums,
    getAlbumTracks,
    getArtworkUrl,
    formatDuration,
    formatReleaseYear,
  }
}
