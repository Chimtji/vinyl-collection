export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { id } = query

  if (!id) {
    throw createError({ statusCode: 400, message: 'Release ID is required' })
  }

  const cacheKey = `release:${id}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://api.discogs.com/releases/${id}`

  try {
    const data = await $fetch<Record<string, unknown>>(url, { headers: discogsHeaders() })
    setCached(cacheKey, data)
    return data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 429) {
      throw createError({
        statusCode: 429,
        message: 'Discogs rate limit reached — please wait a moment',
      })
    }
    throw createError({ statusCode: 502, message: 'Failed to reach Discogs API' })
  }
})
