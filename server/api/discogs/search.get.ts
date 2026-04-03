export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { artist, album } = query

  if (!artist && !album) {
    throw createError({ statusCode: 400, message: 'Artist or album is required' })
  }

  const params = new URLSearchParams()
  if (artist) params.set('artist', String(artist))
  if (album) params.set('release_title', String(album))
  params.set('type', 'release')
  params.set('per_page', '5')

  const url = `https://api.discogs.com/database/search?${params.toString()}`

  const headers: Record<string, string> = {
    'User-Agent': 'VinylCollection/1.0 +https://github.com/vinyl-collection',
  }

  const token = process.env.DISCOGS_TOKEN
  if (token) {
    headers['Authorization'] = `Discogs token=${token}`
  }

  try {
    const data = await $fetch<Record<string, unknown>>(url, { headers })
    return data
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to reach Discogs API' })
  }
})
