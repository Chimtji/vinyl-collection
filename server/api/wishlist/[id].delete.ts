export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const items = await readWishlist()
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Wishlist item not found' })
  }
  await writeWishlist(items.filter((i) => i.id !== id))
  return { success: true }
})
