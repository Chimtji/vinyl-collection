import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getStore } from '@netlify/blobs'

export interface CollectionAlbum {
  id: string
  title: string
  artist: string
  genre: string
  year: number
  artworkUrl: string
  notes?: string
  itunesCollectionId?: number
  trackCount?: number
  addedAt: string
}

const STORE_NAME = 'vinyl-collection'
const COLLECTION_KEY = 'collection'

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'collection.json')

function onNetlify() {
  return process.env.NETLIFY === 'true' || !!process.env.NETLIFY_BLOBS_CONTEXT
}

export async function readCollection(): Promise<CollectionAlbum[]> {
  if (onNetlify()) {
    try {
      const store = getStore(STORE_NAME)
      const data = await store.get(COLLECTION_KEY, { type: 'json' })
      return (data as CollectionAlbum[]) ?? []
    } catch {
      return []
    }
  }
  if (!existsSync(DATA_FILE)) return []
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as CollectionAlbum[]
  } catch {
    return []
  }
}

export async function writeCollection(albums: CollectionAlbum[]): Promise<void> {
  if (onNetlify()) {
    const store = getStore(STORE_NAME)
    await store.set(COLLECTION_KEY, JSON.stringify(albums))
    return
  }
  if (process.env.NETLIFY === 'true') {
    // NETLIFY_BLOBS_CONTEXT was missing — surface a clear error rather than
    // attempting a write on the read-only Netlify filesystem
    throw new Error('Netlify Blobs context unavailable; cannot persist data')
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2), 'utf-8')
}
