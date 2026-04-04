export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  try {
    const html = await $fetch<string>(url, {
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    })

    // Price is embedded as window.product = {...,"priceFrom":26900,...}
    // Value is in øre — divide by 100 to get DKK
    // The assignment is on a single line, so grab everything between = { and the closing }
    const match = html.match(/window\.product\s*=\s*(\{.+\})/)
    if (match) {
      const product = JSON.parse(match[1])
      const priceOere = product.priceFrom ?? product.priceTo ?? null
      if (priceOere != null) {
        const dkk = (priceOere / 100).toFixed(0)
        return { price: `${dkk} DKK` }
      }
    }

    return { price: null }
  } catch {
    return { price: null }
  }
})
