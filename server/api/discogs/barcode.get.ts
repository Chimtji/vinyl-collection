export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { barcode } = query

  if (!barcode) {
    throw createError({ statusCode: 400, message: 'barcode is required' })
  }

  const params = new URLSearchParams()
  params.set('barcode', String(barcode))
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
