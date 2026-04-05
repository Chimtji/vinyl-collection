import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.itunesCollectionId || !body?.title || !body?.artist) {
    throw createError({
      statusCode: 400,
      message: 'itunesCollectionId, title and artist are required',
    })
  }

  const items = await readWishlist()

  if (items.some((i) => i.itunesCollectionId === body.itunesCollectionId)) {
    throw createError({ statusCode: 409, message: 'Already on wishlist' })
  }

  const item: WishlistItem = {
    id: randomUUID(),
    itunesCollectionId: Number(body.itunesCollectionId),
    title: String(body.title),
    artist: String(body.artist),
    genre: String(body.genre ?? 'Other'),
    year: Number(body.year ?? 0),
    artworkUrl: String(body.artworkUrl ?? ''),
    trackCount: body.trackCount ? Number(body.trackCount) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    priority: ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium',
    addedAt: new Date().toISOString(),
  }

  await writeWishlist([...items, item])
  return item
})
