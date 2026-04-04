import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'collection.json')

export function readCollection(): CollectionAlbum[] {
  if (!existsSync(DATA_FILE)) return []
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as CollectionAlbum[]
  } catch {
    return []
  }
}

export function writeCollection(albums: CollectionAlbum[]): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2), 'utf-8')
}
