export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)
  setResponseHeaders(event, {
    'Cache-Control': 'no-store',
  })
  return readWishlist(userId)
})
