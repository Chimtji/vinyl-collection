export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  const collection = readCollection()
  const index = collection.findIndex((a) => a.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }

  collection.splice(index, 1)
  writeCollection(collection)

  return { success: true }
})
