import process from 'node:process'

/**
 * Public endpoint — no authentication required.
 * The owner's user ID is passed as the `userId` query parameter,
 * which is embedded in the share URL when the owner copies their link.
 * Locally falls back to DEV_USER_ID / 'local-dev-user'.
 */
export default defineEventHandler(async (event) => {
  const { userId } = getQuery(event)
  const resolvedId =
    (typeof userId === 'string' && userId) || process.env.DEV_USER_ID || 'local-dev-user'

  return readCollection(resolvedId)
})
