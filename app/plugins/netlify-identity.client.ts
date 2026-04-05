import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

export default defineNuxtPlugin(() => {
  const { user, ready, authHeaders } = useAuth()

  // ── Local development ──────────────────────────────────────────────────────
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

  // Unblock the app immediately — user always starts on the login screen.
  // We do NOT restore cached sessions; an explicit login is always required.
  ready.value = true

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
  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
