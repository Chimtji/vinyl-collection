export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const album = readCollection().find((a) => a.id === id)
  if (!album) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }
  return album
})
