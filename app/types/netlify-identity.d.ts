declare module 'netlify-identity-widget' {
  export interface NetlifyIdentityUser {
    id: string
    email: string
    user_metadata: {
      full_name?: string
      avatar_url?: string
      [key: string]: unknown
    }
    app_metadata: {
      roles?: string[]
      [key: string]: unknown
    }
    token?: {
      access_token: string
      expires_at: number
      refresh_token: string
      token_type: string
    }
    created_at: string
    updated_at: string
  }

  type EventName = 'init' | 'login' | 'logout' | 'error' | 'open' | 'close'

  export function init(opts?: { APIUrl?: string; logo?: boolean }): void
  export function on(event: 'init', cb: (user: NetlifyIdentityUser | null) => void): void
  export function on(event: 'login', cb: (user: NetlifyIdentityUser) => void): void
  export function on(event: 'logout', cb: () => void): void
  export function on(event: 'error', cb: (err: Error) => void): void
  export function on(event: 'open', cb: () => void): void
  export function on(event: 'close', cb: () => void): void
  export function off(event: EventName, cb?: Function): void
  export function currentUser(): NetlifyIdentityUser | null
  export function open(tab?: 'login' | 'signup'): void
  export function close(): void
  export function logout(): void
  export function refresh(force?: boolean): Promise<string>
  export function store: { user: NetlifyIdentityUser | null }
}
