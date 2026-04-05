import type { NetlifyIdentityUser } from 'netlify-identity-widget'

export type AuthUser = NetlifyIdentityUser

export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)
  const ready = useState<boolean>('auth:ready', () => false)

  const isLoggedIn = computed(() => !!user.value)

  /** The current bearer token. Always call this fresh — never cache. */
  function getToken(): string | null {
    return user.value?.token?.access_token ?? null
  }

  /** Authorization headers to attach to every $fetch call. */
  function authHeaders(): Record<string, string> {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  function login() {
    if (import.meta.client && window?.netlifyIdentity) {
      window.netlifyIdentity.open('login')
    }
  }

  function logout() {
    if (import.meta.client && window?.netlifyIdentity) {
      window.netlifyIdentity.logout()
    }
  }

  return {
    user,
    ready,
    isLoggedIn,
    getToken,
    authHeaders,
    login,
    logout,
  }
}
