/**
 * Synchronous auth guard. By the time this runs, the async plugin has already
 * resolved, so isLoggedIn is always accurate. No waiting needed.
 *
 * There is no dedicated /login page — the Netlify Identity overlay handles
 * authentication entirely. If the user is not logged in we open the overlay
 * and abort the current navigation so no protected page is rendered.
 */
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.dev) return
  if (import.meta.server) return

  const { isLoggedIn, login } = useAuth()

  if (!isLoggedIn.value) {
    login()
    return abortNavigation()
  }
})
