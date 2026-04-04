export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  const collection = readCollection()
  const index = collection.findIndex((a) => a.id === id)

  if (index === -1) {
    throw createError({ statusCode: 404, message: 'Album not found' })
  }

  collection[index] = { ...collection[index], ...body, id: id! }
  writeCollection(collection)

  return collection[index]
})
