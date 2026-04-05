/**
 * Synchronous auth route guard.
 *
 * While Identity is initialising (ready=false) all navigations are allowed
 * through — the splash overlay in app.vue covers the page. Once ready, the
 * normal logged-in/logged-out rules apply for every navigation.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.dev) return
  if (import.meta.server) return

  const { isLoggedIn, ready } = useAuth()

  // Not yet initialised — splash is covering the screen, let it through.
  if (!ready.value) return

  if (to.path === '/login') {
    if (isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!isLoggedIn.value) return navigateTo('/login')
})
