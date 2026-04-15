import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

const SESSION_KEY = 'nl_active_session'

export default defineNuxtPlugin(() => {
  const { user, ready, authHeaders } = useAuth()
  const { fetchCollection } = useCollection()
  const { fetchWishlist } = useWishlist()

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
    if (u && !sessionStorage.getItem(SESSION_KEY)) {
      // Stale token found in localStorage but no active session (browser was
      // closed/reopened). Wipe it locally and show the login overlay fresh —
      // no network logout call needed, just kill the stored credential.
      localStorage.removeItem('gotrue.user')
      user.value = null
      ready.value = true
      netlifyIdentity.open('login')
      return
    }
    user.value = (u as AuthUser) ?? null
    ready.value = true
  })

  netlifyIdentity.on('login', async (u) => {
    sessionStorage.setItem(SESSION_KEY, '1')
    user.value = u as AuthUser
    netlifyIdentity.close()
    await Promise.all([fetchCollection(), fetchWishlist()])
  })

  netlifyIdentity.on('logout', () => {
    sessionStorage.removeItem(SESSION_KEY)
    user.value = null
    netlifyIdentity.open('login')
  })

  netlifyIdentity.init({ logo: false })

  // Safety fallback: if init never fires unblock the UI after 5 s.
  setTimeout(() => {
    if (!ready.value) ready.value = true
  }, 5000)
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
