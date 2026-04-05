import process from 'node:process'
import { getStore } from '@netlify/blobs'
import type { CollectionAlbum } from '../utils/collectionStorage'
import type { WishlistItem } from '../utils/wishlistStorage'

const STORE_NAME = 'vinyl-collection'

// Legacy keys used before per-user scoping was introduced
const LEGACY_COLLECTION_KEY = 'collection'
const LEGACY_WISHLIST_KEY = 'wishlist'

/**
 * POST /api/migrate
 *
 * One-time migration: reads the legacy flat blob keys and copies the data
 * into the requesting user's scoped keys — but only if the user has no
 * existing data yet (safe & idempotent).
 *
 * Returns a summary of what was migrated.
 */
export default defineEventHandler(async (event) => {
  const userId = requireUserId(event)

  // Migration only makes sense on Netlify where blobs are used
  const isNetlify = process.env.NETLIFY === 'true' || !!process.env.NETLIFY_BLOBS_CONTEXT
  if (!isNetlify) {
    return { migrated: false, reason: 'Not running on Netlify — nothing to migrate' }
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' })

  const userCollectionKey = `users/${userId}/collection`
  const userWishlistKey = `users/${userId}/wishlist`

  // Read legacy data and existing user data in parallel
  const [legacyCollection, legacyWishlist, existingCollection, existingWishlist] =
    await Promise.all([
      store.get(LEGACY_COLLECTION_KEY, { type: 'json' }).catch(() => null),
      store.get(LEGACY_WISHLIST_KEY, { type: 'json' }).catch(() => null),
      store.get(userCollectionKey, { type: 'json' }).catch(() => null),
      store.get(userWishlistKey, { type: 'json' }).catch(() => null),
    ])

  const result = {
    migrated: false,
    collection: { skipped: false, reason: '', count: 0 },
    wishlist: { skipped: false, reason: '', count: 0 },
  }

  // ── Collection ──────────────────────────────────────────────────────────────
  if (!legacyCollection || (legacyCollection as CollectionAlbum[]).length === 0) {
    result.collection.skipped = true
    result.collection.reason = 'No legacy collection data found'
  } else if (existingCollection && (existingCollection as CollectionAlbum[]).length > 0) {
    result.collection.skipped = true
    result.collection.reason = 'User already has collection data — not overwriting'
  } else {
    await store.set(userCollectionKey, JSON.stringify(legacyCollection))
    result.collection.count = (legacyCollection as CollectionAlbum[]).length
    result.migrated = true
  }

  // ── Wishlist ────────────────────────────────────────────────────────────────
  if (!legacyWishlist || (legacyWishlist as WishlistItem[]).length === 0) {
    result.wishlist.skipped = true
    result.wishlist.reason = 'No legacy wishlist data found'
  } else if (existingWishlist && (existingWishlist as WishlistItem[]).length > 0) {
    result.wishlist.skipped = true
    result.wishlist.reason = 'User already has wishlist data — not overwriting'
  } else {
    await store.set(userWishlistKey, JSON.stringify(legacyWishlist))
    result.wishlist.count = (legacyWishlist as WishlistItem[]).length
    result.migrated = true
  }

  return result
})
