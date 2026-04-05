async function scrape(url: string): Promise<{ price: number | null; inStock: boolean }> {
  try {
    const html = await $fetch<string>(url, {
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    })
    const match = html.match(/window\.product\s*=\s*(\{.+\})/)
    if (match) {
      const product = JSON.parse(match[1])
      const priceOere = product.priceFrom ?? product.priceTo ?? null
      return {
        price: priceOere != null ? Math.round(priceOere / 100) : null,
        inStock: Boolean(product.inStock),
      }
    }
    return { price: null, inStock: false }
  } catch {
    return { price: null, inStock: false }
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Array<{
    id: string
    url: string
    fallbackUrl?: string | null
  }>

  if (!Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'body must be an array' })
  }

  const results = await Promise.all(
    body.map(async ({ id, url, fallbackUrl }) => {
      const primary = await scrape(url)
      if (primary.price !== null) return { id, activeUrl: url, ...primary }
      if (fallbackUrl) {
        const fallback = await scrape(fallbackUrl)
        return { id, activeUrl: fallback.price !== null ? fallbackUrl : url, ...fallback }
      }
      return { id, activeUrl: url, ...primary }
    }),
  )

  return results
})
