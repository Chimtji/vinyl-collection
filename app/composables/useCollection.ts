export interface CollectionAlbum {
  id: string
  title: string
  artist: string
  genre: string
  year: number
  artworkUrl: string
  notes?: string
  signed?: boolean
  vinylpladenUrl?: string
  itunesCollectionId?: number
  trackCount?: number
  discogsId?: number
  addedAt: string
}

export interface GenreGroup {
  genre: string
  slug: string
  albums: CollectionAlbum[]
}

export function genreToSlug(genre: string): string {
  return genre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function slugToGenre(collection: CollectionAlbum[], slug: string): string | undefined {
  return collection.find((a) => genreToSlug(a.genre) === slug)?.genre
}

export function useCollection() {
  const albums = useState<CollectionAlbum[]>('collection', () => [])
  const loading = ref(false)
  const { authHeaders } = useAuth()

  const genres = computed<GenreGroup[]>(() => {
    const map = new Map<string, CollectionAlbum[]>()
    for (const album of albums.value) {
      const key = album.genre || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(album)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([genre, list]) => ({
        genre,
        slug: genreToSlug(genre),
        albums: list,
      }))
  })

  async function fetchCollection(force = false) {
    if (!force && albums.value.length > 0) return albums.value
    loading.value = true
    try {
      const data = await $fetch<CollectionAlbum[]>('/api/collection', { headers: authHeaders() })
      albums.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function addAlbum(data: Omit<CollectionAlbum, 'id' | 'addedAt'>) {
    const album = await $fetch<CollectionAlbum>('/api/collection', {
      method: 'POST',
      body: data,
      headers: authHeaders(),
    })
    albums.value = [...albums.value, album]
    return album
  }

  async function updateAlbum(id: string, data: Partial<CollectionAlbum>) {
    const updated = await $fetch<CollectionAlbum>(`/api/collection/${id}`, {
      method: 'PUT',
      body: data,
      headers: authHeaders(),
    })
    albums.value = albums.value.map((a) => (a.id === id ? updated : a))
    return updated
  }

  async function deleteAlbum(id: string) {
    await $fetch(`/api/collection/${id}`, { method: 'DELETE', headers: authHeaders() })
    albums.value = albums.value.filter((a) => a.id !== id)
  }

  function getAlbumsByGenreSlug(slug: string): CollectionAlbum[] {
    return albums.value.filter((a) => genreToSlug(a.genre) === slug)
  }

  return {
    albums,
    genres,
    loading,
    fetchCollection,
    addAlbum,
    updateAlbum,
    deleteAlbum,
    getAlbumsByGenreSlug,
    genreToSlug,
    slugToGenre,
  }
}
