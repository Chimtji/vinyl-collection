import netlifyIdentity from 'netlify-identity-widget'
import type { AuthUser } from '~/composables/useAuth'

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
    user.value = (u as AuthUser) ?? null
    ready.value = true
    if (u) {
      netlifyIdentity.close()
      runMigration()
    }
  })

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

  // Safety fallback: if init never fires unblock the UI after 5 s.
  setTimeout(() => {
    if (!ready.value) ready.value = true
  }, 5000)

  ;(window as unknown as Record<string, unknown>).netlifyIdentity = netlifyIdentity
})
