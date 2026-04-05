export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)
  setResponseHeaders(event, {
    'Cache-Control': 'no-store',
  })
  const id = getRouterParam(event, 'id')
  const album = (await readCollection(userId)).find((a) => a.id === id)
  if (!album) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }
  return album
})
