export interface WishlistItem {
  id: string
  itunesCollectionId: number
  title: string
  artist: string
  genre: string
  year: number
  artworkUrl: string
  trackCount?: number
  notes?: string
  priority: 'low' | 'medium' | 'high'
  addedAt: string
}

export function useWishlist() {
  const items = useState<WishlistItem[]>('wishlist', () => [])
  const loading = ref(false)

  async function fetchWishlist() {
    loading.value = true
    try {
      const data = await $fetch<WishlistItem[]>('/api/wishlist')
      items.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function addToWishlist(data: Omit<WishlistItem, 'id' | 'addedAt'>) {
    const item = await $fetch<WishlistItem>('/api/wishlist', {
      method: 'POST',
      body: data,
    })
    items.value = [...items.value, item]
    return item
  }

  async function updateWishlistItem(id: string, data: { notes?: string; priority?: string }) {
    const updated = await $fetch<WishlistItem>(`/api/wishlist/${id}`, {
      method: 'PUT',
      body: data,
    })
    items.value = items.value.map((i) => (i.id === id ? updated : i))
    return updated
  }

  async function removeFromWishlist(id: string) {
    await $fetch(`/api/wishlist/${id}`, { method: 'DELETE' })
    items.value = items.value.filter((i) => i.id !== id)
  }

  function isWishlisted(itunesCollectionId: number): boolean {
    return items.value.some((i) => i.itunesCollectionId === itunesCollectionId)
  }

  function getWishlistItem(itunesCollectionId: number): WishlistItem | undefined {
    return items.value.find((i) => i.itunesCollectionId === itunesCollectionId)
  }

  return {
    items,
    loading,
    fetchWishlist,
    addToWishlist,
    updateWishlistItem,
    removeFromWishlist,
    isWishlisted,
    getWishlistItem,
  }
}
