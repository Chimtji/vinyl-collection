import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title: string
    artist: string
    genre: string
    year: number
    artworkUrl: string
    notes?: string
    itunesCollectionId?: number
    trackCount?: number
  }>(event)

  if (!body.title || !body.artist || !body.genre) {
    throw createError({ statusCode: 400, message: 'title, artist and genre are required' })
  }

  const album = {
    ...body,
    id: randomUUID(),
    addedAt: new Date().toISOString(),
  }

  const userId = requireUserId(event)

  const collection = await readCollection(userId)
  collection.push(album)
  await writeCollection(userId, collection)

  return album
})
