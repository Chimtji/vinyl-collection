export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { id, entity = 'album', limit = 50 } = query

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID is required' })
  }

  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(id))}&entity=${entity}&limit=${limit}`

  try {
    const data = await $fetch<Record<string, unknown>>(url)
    return data
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to reach iTunes API' })
  }
})
