/**
 * Protects all routes except /login by requiring a valid Netlify Identity session.
 *
 * In local development (import.meta.dev) auth is skipped so `nuxt dev` keeps
 * working out of the box without a live Netlify site.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Never redirect away from the login page itself
  if (to.path === '/login') return

  // Bypass in local development — Netlify Identity requires a live site
  if (import.meta.dev) return

  // SSR guard (this app is SPA-only, but just in case)
  if (import.meta.server) return

  const { isLoggedIn, ready } = useAuth()

  // Wait for the Netlify Identity widget to finish initialising.
  // The widget fires the 'init' callback asynchronously after checking the
  // stored session, so we must not check isLoggedIn until it's done.
  if (!ready.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(ready, (val) => {
        if (val) {
          stop()
          resolve()
        }
      })
      // Fallback: don't block navigation forever if init never fires
      setTimeout(() => {
        stop()
        resolve()
      }, 4000)
    })
  }

  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
