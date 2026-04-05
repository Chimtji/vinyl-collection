/**
 * Auth route guard.
 *
 * Waits for Netlify Identity to finish initialising before making any routing
 * decision. All concurrent guard invocations share a single promise so there
 * is no duplication of watchers or race conditions.
 *
 * NuxtPage is always mounted (no v-if on it), but because navigation does not
 * complete until this middleware resolves, page components never mount before
 * auth state is known — so API calls always have the correct auth headers.
 */

// Shared across all middleware invocations in this page session.
let readyPromise: Promise<void> | null = null

function waitForReady(ready: Ref<boolean>): Promise<void> {
  if (ready.value) return Promise.resolve()
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      const stop = watch(ready, (val) => {
        if (val) {
          stop()
          resolve()
        }
      })
    })
  }
  return readyPromise
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.dev) return
  if (import.meta.server) return

  const { isLoggedIn, ready } = useAuth()

  // Block until Identity has resolved its session check.
  await waitForReady(ready)

  if (to.path === '/login') {
    if (isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!isLoggedIn.value) return navigateTo('/login')
})
