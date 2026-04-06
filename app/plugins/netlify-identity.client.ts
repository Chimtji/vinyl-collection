import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

/**
 * Synchronous plugin — the app renders immediately. Auth state is resolved
 * via the `ready` flag in useAuth():
 *  - While ready=false  → layout shows a loading spinner
 *  - When ready + not logged in → layout opens the Identity overlay
 *  - When ready + logged in     → layout shows the app normally
 *
 * The `init` event fires very quickly from netlify-identity-widget (reads from
 * localStorage synchronously, only does a background token refresh network
 * call). Setting ready there unblocks the layout almost immediately.
 */
export default defineNuxtPlugin(() => {
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

  // ── init: fires almost instantly (reads localStorage, no blocking network) ─
  netlifyIdentity.on('init', (u) => {
    user.value = (u as AuthUser) ?? null
    ready.value = true
    if (u) {
      netlifyIdentity.close()
      // Run migration as a background task — no need to await here because
      // the user was already logged in and the collection will load fresh.
      runMigration()
    }
  })

  // ── login: await migration so collection data exists before the page loads ─
  netlifyIdentity.on('login', async (u) => {
    user.value = u as AuthUser
    netlifyIdentity.close()
    await runMigration()
    navigateTo('/')
  })

  netlifyIdentity.on('logout', () => {
    user.value = null
    netlifyIdentity.open('login')
  })

  netlifyIdentity.init({ logo: false })
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
