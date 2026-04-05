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

  // Fallback: unblock the app if Identity never fires 'init' at all
  // (e.g. network error, cold-start timeout). Treats the user as unauthenticated;
  // the middleware will then redirect to /login once ready resolves.
  const initTimeout = setTimeout(() => {
    console.warn('[netlify-identity] init timeout — unblocking as unauthenticated')
    if (!ready.value) {
      user.value = null
      ready.value = true
    }
  }, 8000)

  netlifyIdentity.on('error', (err) => {
    console.error('[netlify-identity] error:', err)
    clearTimeout(initTimeout)
    if (!ready.value) {
      user.value = null
      ready.value = true
    }
  })

  // The 'init' event fires once after the widget checks localStorage for a
  // stored session. Setting ready here unblocks the middleware promise so
  // navigation can complete and the correct page can render.
  netlifyIdentity.on('init', (u) => {
    clearTimeout(initTimeout)
    user.value = (u as AuthUser) ?? null
    ready.value = true
    // Close the widget overlay the widget auto-opens when a session exists
    if (u) {
      netlifyIdentity.close()
      runMigration()
    }
  })

  // After an explicit login the widget has already authenticated the user.
  // Update state and navigate to the app.
  netlifyIdentity.on('login', (u) => {
    user.value = u as AuthUser
    netlifyIdentity.close()
    runMigration()
    navigateTo('/')
  })

  netlifyIdentity.on('logout', () => {
    user.value = null
    navigateTo('/login')
  })

  netlifyIdentity.init({ logo: false })

  // Expose the widget on the window so `useAuth` helpers can call open/close/logout
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
