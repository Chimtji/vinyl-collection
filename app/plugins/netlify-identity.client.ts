import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

/**
 * Async plugin — Nuxt holds the entire app startup (including the first
 * navigation and middleware run) until this promise resolves. That means
 * auth state is always known before any page component ever mounts.
 */
export default defineNuxtPlugin(async () => {
  const { user, ready, authHeaders } = useAuth()

  // ── Local development ─────────────────────────────────────────────
  if (import.meta.dev) {
    user.value = {
      id: 'local-dev-user',
      email: 'dev@local',
      user_metadata: { full_name: 'Dev User' },
      app_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as AuthUser
    ready.value = true
    return
  }

  async function runMigration() {
    try {
      await $fetch('/api/migrate', { method: 'POST', headers: authHeaders() })
    } catch {
      // non-critical
    }
  }

  // Wait for Identity to check localStorage / refresh the stored token.
  // This promise resolves as soon as on('init') fires (or after 8 s as a
  // safety fallback). Nuxt will not run middleware or render any page until it
  // resolves, so isLoggedIn is always accurate on the very first navigation.
  await new Promise<void>((resolve) => {
    netlifyIdentity.on('init', (u) => {
      user.value = (u as AuthUser) ?? null
      if (u) {
        netlifyIdentity.close()
        runMigration()
      }
      resolve()
    })

    netlifyIdentity.init({ logo: false })

    // Safety fallback: if init never fires, unblock as unauthenticated.
    setTimeout(resolve, 8000)
  })

  ready.value = true

  // ── Post-init event handlers ────────────────────────────────────────
  netlifyIdentity.on('login', (u) => {
    user.value = u as AuthUser
    netlifyIdentity.close()
    runMigration()
    navigateTo('/')
  })

  netlifyIdentity.on('logout', () => {
    user.value = null
    netlifyIdentity.open('login')
  })
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
