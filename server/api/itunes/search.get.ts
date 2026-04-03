export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { term, entity = 'musicArtist', limit = 25 } = query

  if (!term) {
    throw createError({ statusCode: 400, message: 'Search term is required' })
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(String(term))}&entity=${entity}&limit=${limit}&media=music`

  try {
    const data = await $fetch<Record<string, unknown>>(url)
    return data
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to reach iTunes API' })
  }
})
