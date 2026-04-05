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

  /**
   * Called once we know the auth state (either from init, error, or timeout).
   * Sets ready and routes accordingly.
   */
  function handleAuthResolved(u: AuthUser | null) {
    if (ready.value) return // already resolved — ignore duplicate calls
    user.value = u
    ready.value = true

    const router = useRouter()
    const currentPath = router.currentRoute.value.path

    if (u) {
      netlifyIdentity.close()
      runMigration()
      if (currentPath === '/login') {
        router.replace('/')
      }
    } else {
      if (currentPath !== '/login') {
        router.replace('/login')
      }
    }
  }

  // Fallback: if the Identity widget never fires 'init' (network timeout, etc.)
  // unblock the app after 6 s and send the user to /login.
  const initTimeout = setTimeout(() => {
    console.warn('[netlify-identity] init timeout — proceeding unauthenticated')
    handleAuthResolved(null)
  }, 6000)

  netlifyIdentity.on('error', (err) => {
    console.error('[netlify-identity] error:', err)
    clearTimeout(initTimeout)
    handleAuthResolved(null)
  })

  netlifyIdentity.on('init', (u) => {
    clearTimeout(initTimeout)
    handleAuthResolved((u as AuthUser) ?? null)
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
