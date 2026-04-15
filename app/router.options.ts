import type { RouterConfig } from '@nuxt/schema'

export default {
  scrollBehavior(to, _from, savedPosition) {
    // Restores position when using browser back/forward
    if (savedPosition) return savedPosition
    // Always start at top for new navigations (including album pages)
    return { top: 0 }
  },
} satisfies RouterConfig
