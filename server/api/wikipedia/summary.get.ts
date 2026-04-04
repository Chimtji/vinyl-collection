interface WikiSearchResult {
  pageid: number
  title: string
  snippet: string
}

interface WikiSearchResponse {
  query: {
    search: WikiSearchResult[]
  }
}

interface WikiSummaryResponse {
  title: string
  extract: string
  content_urls?: {
    desktop?: { page?: string }
  }
}

export default defineEventHandler(async (event) => {
  const { artist, album } = getQuery(event)

  if (!artist || !album) {
    throw createError({ statusCode: 400, message: 'artist and album are required' })
  }

  const headers = {
    'User-Agent': 'VinylCollection/1.0 (https://github.com/vinyl-collection)',
  }

  try {
    // Step 1: search Wikipedia for the album page
    const query = `${artist} ${album} album`
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`
    const searchData = await $fetch<WikiSearchResponse>(searchUrl, { headers })

    const hit = searchData?.query?.search?.[0]
    if (!hit) return null

    // Step 2: fetch the page summary using the REST summary API
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`
    const summary = await $fetch<WikiSummaryResponse>(summaryUrl, { headers })

    if (!summary?.extract) return null

    return {
      title: summary.title,
      extract: summary.extract,
      url:
        summary.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
    }
  } catch {
    return null
  }
})
