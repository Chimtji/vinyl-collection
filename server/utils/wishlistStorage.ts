import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getStore } from '@netlify/blobs'

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

const STORE_NAME = 'vinyl-collection'

function onNetlify() {
  return process.env.NETLIFY === 'true' || !!process.env.NETLIFY_BLOBS_CONTEXT
}

function wishlistKey(userId: string) {
  return `users/${userId}/wishlist`
}

function localDataFile(userId: string) {
  const dir = join(process.cwd(), 'data', userId)
  return { dir, file: join(dir, 'wishlist.json') }
}

const LEGACY_DATA_FILE = join(process.cwd(), 'data', 'wishlist.json')

export async function readWishlist(userId: string): Promise<WishlistItem[]> {
  if (onNetlify()) {
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' })
      const data = await store.get(wishlistKey(userId), { type: 'json' })
      return (data as WishlistItem[]) ?? []
    } catch {
      return []
    }
  }
  const { dir, file } = localDataFile(userId)
  // Auto-migrate legacy flat file on first run
  if (!existsSync(file) && existsSync(LEGACY_DATA_FILE)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_DATA_FILE, 'utf-8')) as WishlistItem[]
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(legacy, null, 2), 'utf-8')
      return legacy
    } catch {
      return []
    }
  }
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as WishlistItem[]
  } catch {
    return []
  }
}

export async function writeWishlist(userId: string, items: WishlistItem[]): Promise<void> {
  if (onNetlify()) {
    const store = getStore(STORE_NAME)
    await store.set(wishlistKey(userId), JSON.stringify(items))
    return
  }
  if (process.env.NETLIFY === 'true') {
    // NETLIFY_BLOBS_CONTEXT was missing — surface a clear error rather than
    // attempting a write on the read-only Netlify filesystem
    throw new Error('Netlify Blobs context unavailable; cannot persist data')
  }
  const { dir, file } = localDataFile(userId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(items, null, 2), 'utf-8')
}
