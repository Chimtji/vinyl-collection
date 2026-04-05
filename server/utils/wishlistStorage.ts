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
const WISHLIST_KEY = 'wishlist'

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'wishlist.json')

function onNetlify() {
  return process.env.NETLIFY === 'true'
}

export async function readWishlist(): Promise<WishlistItem[]> {
  if (onNetlify()) {
    try {
      const store = getStore(STORE_NAME)
      const data = await store.get(WISHLIST_KEY, { type: 'json' })
      return (data as WishlistItem[]) ?? []
    } catch {
      return []
    }
  }
  if (!existsSync(DATA_FILE)) return []
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as WishlistItem[]
  } catch {
    return []
  }
}

export async function writeWishlist(items: WishlistItem[]): Promise<void> {
  if (onNetlify()) {
    const store = getStore(STORE_NAME)
    await store.set(WISHLIST_KEY, JSON.stringify(items))
    return
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8')
}
