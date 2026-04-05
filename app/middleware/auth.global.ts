/**
 * Synchronous route guard — never blocks navigation.
 *
 * While Identity is still initialising (ready = false) every navigation is
 * allowed through; the splash overlay in app.vue covers the page so the user
 * sees nothing. The netlify-identity plugin handles the post-init redirect to
 * /login or / once it knows the auth state.
 *
 * Once ready, normal auth rules apply for every subsequent navigation.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Bypass in local development — Netlify Identity requires a live site
  if (import.meta.dev) return

  // SSR guard (this app is SPA-only, but just in case)
  if (import.meta.server) return

  const { isLoggedIn, ready } = useAuth()

  // Identity hasn't finished initialising yet — let the navigation through.
  // The plugin will call router.replace once init fires.
  if (!ready.value) return

  if (to.path === '/login') {
    if (isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!isLoggedIn.value) return navigateTo('/login')
})
