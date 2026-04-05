export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  const collection = await readCollection(userId)
  const index = collection.findIndex((a) => a.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }

  collection[index] = { ...collection[index], ...body, id: id! }
  await writeCollection(userId, collection)

  return collection[index]
})
