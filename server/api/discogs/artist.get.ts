export default defineEventHandler(async (event) => {
  const { name } = getQuery(event)

  if (!name || typeof name !== 'string') {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const params = new URLSearchParams({ q: name, type: 'artist', per_page: '12' })
  const url = `https://api.discogs.com/database/search?${params.toString()}`

  const headers: Record<string, string> = {
    'User-Agent': 'VinylCollection/1.0 +https://github.com/vinyl-collection',
    Accept: 'application/json',
  }

  const config = useRuntimeConfig()
  const token = (config.discogsToken as string) || ''
  if (token) headers['Authorization'] = `Discogs token=${token}`

  try {
    const data = await $fetch<{
      results: Array<{ id: number; title: string; cover_image?: string; thumb?: string }>
    }>(url, { headers })

    // Return a trimmed name→image map to keep the response small
    return (data.results ?? []).map((r) => {
      const raw = r.cover_image || r.thumb || null
      // Filter out Discogs "no picture" placeholder images
      const image =
        raw && !raw.includes('nopicture') && !raw.includes('spacer')
          ? `/api/proxy/image?url=${encodeURIComponent(raw)}`
          : null
      return { id: r.id, name: r.title, image }
    })
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to reach Discogs API' })
  }
})
