export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const term = Array.isArray(query.term) ? query.term[0] : query.term
  const entity = Array.isArray(query.entity) ? query.entity[0] : query.entity || 'musicArtist'
  const limit = Array.isArray(query.limit) ? query.limit[0] : query.limit || '25'

  if (!term) {
    throw createError({ statusCode: 400, message: 'Search term is required' })
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(String(term))}&entity=${encodeURIComponent(String(entity))}&limit=${encodeURIComponent(String(limit))}&media=music`

  console.log('[iTunes API Request]', { term, entity, limit, url })

  try {
    const response = await $fetch<string>(url)
    const data = typeof response === 'string' ? JSON.parse(response) : response
    console.log('[iTunes API Raw Response]', JSON.stringify(data).substring(0, 200))
    console.log('[iTunes API Response]', {
      type: typeof data,
      resultCount: (data as any).resultCount,
      hasResults: !!(data as any).results?.length,
      resultsLength: (data as any).results?.length,
    })
    return data
  } catch (error) {
    console.error('[iTunes API Error]', error)
    throw createError({ statusCode: 502, message: 'Failed to reach iTunes API' })
  }
})
