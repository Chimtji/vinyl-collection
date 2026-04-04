export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const items = readWishlist()
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Wishlist item not found' })
  }
  const updated: WishlistItem = {
    ...items[index]!,
    notes: body.notes !== undefined ? String(body.notes) : items[index]!.notes,
    priority: ['low', 'medium', 'high'].includes(body.priority)
      ? body.priority
      : items[index]!.priority,
  }
  items[index] = updated
  writeWishlist(items)
  return updated
})
