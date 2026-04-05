/**
 * Synchronous auth guard. By the time this runs, the async plugin has already
 * resolved, so isLoggedIn is always accurate. No waiting needed.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.dev) return
  if (import.meta.server) return

  const { isLoggedIn } = useAuth()

  if (to.path === '/login') {
    if (isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!isLoggedIn.value) return navigateTo('/login')
})
