export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)
  const id = getRouterParam(event, 'id')

  const collection = await readCollection(userId)
  const index = collection.findIndex((a) => a.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }

  collection.splice(index, 1)
  await writeCollection(userId, collection)

  return { success: true }
})
