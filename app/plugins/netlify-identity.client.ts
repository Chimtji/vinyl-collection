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
   * Route based on the resolved auth state. Always safe to call multiple times —
   * later calls with a real user override an earlier timeout-driven null result.
   */
  function routeAfterAuth(u: AuthUser | null) {
    const router = useRouter()
    const currentPath = router.currentRoute.value.path
    if (u) {
      netlifyIdentity.close()
      runMigration()
      // Send to home if stuck on the login page
      if (currentPath === '/login') {
        router.replace('/')
      }
    } else {
      // Not authenticated — make sure we are on the login page
      if (currentPath !== '/login') {
        router.replace('/login')
      }
    }
  }

  // Fallback: unblock the splash if Identity never fires 'init' (e.g. network
  // issues). We assume unauthenticated so the login page shows. If init later
  // fires with a real user we handle it in the on('init') listener below.
  const initTimeout = setTimeout(() => {
    console.warn('[netlify-identity] init timeout — unblocking as unauthenticated')
    if (!ready.value) {
      ready.value = true
      routeAfterAuth(null)
    }
  }, 8000)

  netlifyIdentity.on('error', (err) => {
    console.error('[netlify-identity] error:', err)
    clearTimeout(initTimeout)
    if (!ready.value) {
      ready.value = true
      routeAfterAuth(null)
    }
  })

  netlifyIdentity.on('init', (u) => {
    clearTimeout(initTimeout)
    const resolvedUser = (u as AuthUser) ?? null

    // Always update the user — init may fire after the timeout already
    // set ready=true with null. We must still honour a valid session.
    user.value = resolvedUser

    if (!ready.value) {
      // Normal path: init fired before the timeout
      ready.value = true
    }

    // Always route: if the timeout redirected to /login but the user IS
    // authenticated, we need to send them home.
    routeAfterAuth(resolvedUser)
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
