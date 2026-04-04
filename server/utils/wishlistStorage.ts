import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'wishlist.json')

export function readWishlist(): WishlistItem[] {
  if (!existsSync(DATA_FILE)) return []
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as WishlistItem[]
  } catch {
    return []
  }
}

export function writeWishlist(items: WishlistItem[]): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8')
}
