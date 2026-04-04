export default defineNuxtPlugin(() => {
  const { addEntry, updateEntry } = useApiLogger()

  const original = globalThis.$fetch

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patched = new Proxy(original, {
    apply(target: typeof $fetch, thisArg, args: Parameters<typeof $fetch>) {
      const [url, opts] = args
      const startTime = performance.now()
      const params = (opts as Record<string, unknown>)?.query as Record<string, unknown> | undefined

      const entryId = addEntry({
        url: String(url),
        params,
        status: 'pending',
        startTime,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (target as any).apply(thisArg, args).then(
        (data: unknown) => {
          updateEntry(entryId, {
            status: 'success',
            response: data,
            duration: Math.round(performance.now() - startTime),
          })
          return data
        },
        (err: unknown) => {
          const statusCode = (err as { statusCode?: number })?.statusCode
          updateEntry(entryId, {
            status: 'error',
            error: err,
            statusCode,
            duration: Math.round(performance.now() - startTime),
          })
          throw err
        },
      )
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).$fetch = patched
})
