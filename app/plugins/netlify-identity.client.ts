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

  // Safety valve: if on('init') never fires (network issue) unblock after 8 s.
  const initTimeout = setTimeout(() => {
    if (!ready.value) {
      user.value = null
      ready.value = true
    }
  }, 8000)

  // on('init') fires once the widget has checked localStorage for a stored
  // session. We ONLY set state here — app.vue's watch(ready) handles routing.
  netlifyIdentity.on('init', (u) => {
    clearTimeout(initTimeout)
    user.value = (u as AuthUser) ?? null
    if (u) {
      netlifyIdentity.close()
      runMigration()
    }
    ready.value = true // this triggers the watch in app.vue
  })

  // Explicit widget login — navigate to home after state is set.
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
