/**
 * Synchronous auth route guard.
 *
 * By the time any page component mounts, Identity has already resolved
 * (app.vue gates the entire layout behind v-if="ready"). This guard only
 * needs to check the already-known auth state — no async waiting required.
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
