export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)
  const id = getRouterParam(event, 'id')
  const items = await readWishlist(userId)
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Wishlist item not found' })
  }
  await writeWishlist(
    userId,
    items.filter((i) => i.id !== id),
  )
  return { success: true }
})
