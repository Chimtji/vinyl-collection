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

function onNetlify() {
  return process.env.NETLIFY === 'true' || !!process.env.NETLIFY_BLOBS_CONTEXT
}

function collectionKey(userId: string) {
  return `users/${userId}/collection`
}

function localDataFile(userId: string) {
  const dir = join(process.cwd(), 'data', userId)
  return { dir, file: join(dir, 'collection.json') }
}

const LEGACY_DATA_FILE = join(process.cwd(), 'data', 'collection.json')

export async function readCollection(userId: string): Promise<CollectionAlbum[]> {
  if (onNetlify()) {
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' })
      const data = await store.get(collectionKey(userId), { type: 'json' })
      return (data as CollectionAlbum[]) ?? []
    } catch {
      return []
    }
  }
  const { dir, file } = localDataFile(userId)
  // Auto-migrate legacy flat file on first run
  if (!existsSync(file) && existsSync(LEGACY_DATA_FILE)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_DATA_FILE, 'utf-8')) as CollectionAlbum[]
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(legacy, null, 2), 'utf-8')
      return legacy
    } catch {
      return []
    }
  }
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as CollectionAlbum[]
  } catch {
    return []
  }
}

export async function writeCollection(userId: string, albums: CollectionAlbum[]): Promise<void> {
  if (onNetlify()) {
    const store = getStore(STORE_NAME)
    await store.set(collectionKey(userId), JSON.stringify(albums))
    return
  }
  if (process.env.NETLIFY === 'true') {
    // NETLIFY_BLOBS_CONTEXT was missing — surface a clear error rather than
    // attempting a write on the read-only Netlify filesystem
    throw new Error('Netlify Blobs context unavailable; cannot persist data')
  }
  const { dir, file } = localDataFile(userId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(albums, null, 2), 'utf-8')
}
