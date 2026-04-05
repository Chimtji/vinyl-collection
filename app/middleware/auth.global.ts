/**
 * Synchronous auth route guard.
 * The plugin sets ready=true immediately so user always starts logged out.
 * This guard only needs to check isLoggedIn — no async waiting required.
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
