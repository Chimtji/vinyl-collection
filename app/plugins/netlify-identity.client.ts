import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

const SESSION_KEY = 'nl_active_session'

export default defineNuxtPlugin(() => {
  const { user, ready, authHeaders } = useAuth()

  // ── Local development: use a mock user, skip the identity widget ──────
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

  netlifyIdentity.on('init', (u) => {
    if (u) {
      // A token was found in localStorage. Only trust it if this browser
      // session was established via an explicit login (sessionStorage flag).
      // If the flag is missing the browser was closed and reopened — clear
      // the stored token and show the login overlay fresh.
      if (!sessionStorage.getItem(SESSION_KEY)) {
        // Logout clears localStorage and fires the 'logout' handler below,
        // which opens the overlay.
        netlifyIdentity.logout()
        return
      }
      user.value = u as AuthUser
    }
    ready.value = true
  })

  netlifyIdentity.on('login', async (u) => {
    sessionStorage.setItem(SESSION_KEY, '1')
    user.value = u as AuthUser
    netlifyIdentity.close()
    await runMigration()
    navigateTo('/')
  })

  netlifyIdentity.on('logout', () => {
    sessionStorage.removeItem(SESSION_KEY)
    user.value = null
    ready.value = true
    netlifyIdentity.open('login')
  })

  netlifyIdentity.init({ logo: false })

  // Safety fallback: if init never fires unblock the UI after 5 s.
  setTimeout(() => {
    if (!ready.value) ready.value = true
  }, 5000)
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
