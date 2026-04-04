export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  // Only proxy Discogs CDN images
  if (!url.startsWith('https://i.discogs.com/') && !url.startsWith('https://st.discogs.com/')) {
    throw createError({ statusCode: 403, message: 'Only Discogs CDN URLs are allowed' })
  }

  try {
    const response = await $fetch.raw(url, {
      headers: {
        'User-Agent': 'VinylCollection/1.0 +https://github.com/vinyl-collection',
        Referer: 'https://www.discogs.com/',
      },
      responseType: 'arrayBuffer',
    })

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    setResponseHeader(event, 'content-type', contentType)
    setResponseHeader(event, 'cache-control', 'public, max-age=86400')

    return response._data
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to fetch image' })
  }
})
