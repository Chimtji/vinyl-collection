import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

/**
 * Initialises the Netlify Identity widget on the client only.
 * Sets up login/logout event listeners and populates the `auth:user` state.
 */
export default defineNuxtPlugin(() => {
  const { user, ready, authHeaders } = useAuth()

  // ── Local development ───────────────────────────────────────────────────────
  // Netlify Identity requires a live Netlify site, so in dev mode we skip the
  // widget entirely and seed a stable fake user that matches the server's
  // DEV_USER_ID ('local-dev-user').
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

  /** Run the one-time legacy-data migration in the background. */
  async function runMigration() {
    try {
      await $fetch('/api/migrate', { method: 'POST', headers: authHeaders() })
    } catch {
      // Non-critical — migration failures must never break the app
    }
  }

  netlifyIdentity.on('init', (u) => {
    user.value = (u as AuthUser) ?? null
    ready.value = true
    // If the user was already logged in, run migration silently
    if (u) runMigration()
  })

  netlifyIdentity.on('login', (u) => {
    user.value = u as AuthUser
    netlifyIdentity.close()
    // Migrate legacy blob data to the user's scoped keys on every fresh login.
    // The endpoint is idempotent so calling it more than once is harmless.
    runMigration()
    // Navigate away from /login after a successful sign-in
    const router = useRouter()
    if (router.currentRoute.value.path === '/login') {
      router.push('/')
    }
  })

  netlifyIdentity.on('logout', () => {
    user.value = null
    navigateTo('/login')
  })

  netlifyIdentity.init({ logo: false })

  // Expose the widget on the window so `useAuth` helpers can call open/close/logout
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
