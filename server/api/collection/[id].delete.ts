export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const collection = await readCollection()
  const index = collection.findIndex((a) => a.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }

  collection.splice(index, 1)
  await writeCollection(collection)

  return { success: true }
})
