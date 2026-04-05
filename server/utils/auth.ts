import type { H3Event } from 'h3'
import process from 'node:process'

/**
 * Extracts and validates the Netlify Identity JWT from the Authorization header,
 * returning the user's unique ID (sub claim).
 *
 * In local development (not on Netlify) auth is bypassed and a fixed dev user
 * ID is returned so the app continues to work with `nuxt dev`.
 */
export function requireUserId(event: H3Event): string {
  // ── Local development bypass ──────────────────────────────────────────────
  // Netlify Identity only works when deployed. When running locally we fall
  // through to a stable dev user so the existing workflow is unaffected.
  const isNetlify = process.env.NETLIFY === 'true' || !!process.env.NETLIFY_BLOBS_CONTEXT
  if (!isNetlify) {
    return process.env.DEV_USER_ID ?? 'local-dev-user'
  }

  // ── Production: require a valid Bearer token ──────────────────────────────
  const authHeader = getHeader(event, 'authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const token = authHeader.slice(7)
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw createError({ statusCode: 401, message: 'Invalid token format' })
  }

  let payload: Record<string, unknown>
  try {
    // Base64url-decode the JWT payload (middle segment)
    const segment = parts[1] ?? ''
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    payload = JSON.parse(atob(padded))
  } catch {
    throw createError({ statusCode: 401, message: 'Malformed token' })
  }

  // Check expiration
  const exp = payload.exp as number | undefined
  if (exp && exp < Math.floor(Date.now() / 1000)) {
    throw createError({ statusCode: 401, message: 'Token expired' })
  }

  const sub = payload.sub as string | undefined
  if (!sub) {
    throw createError({ statusCode: 401, message: 'Token missing subject' })
  }

  return sub
}
