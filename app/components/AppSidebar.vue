<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { albums, genres } = useCollection()
const { items: wishlistItems, fetchWishlist } = useWishlist()
const { user, isLoggedIn, logout } = useAuth()

const userInitials = computed(() => {
  const name = user.value?.user_metadata?.full_name ?? user.value?.email ?? '?'
  return name
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? '')
    .join('')
})
const displayName = computed(
  () => user.value?.user_metadata?.full_name ?? user.value?.email ?? 'Konto',
)

onMounted(() => {
  fetchWishlist()
})

type NavItem =
  | { type: 'link'; id: string; label: string; icon: string; to: string; badge?: () => number }
  | { type: 'section'; label: string }

const navItems: NavItem[] = [
  { type: 'link', id: 'dashboard', label: 'Overblik', icon: 'pi pi-home', to: '/' },
  { type: 'link', id: 'search', label: 'Søg', icon: 'pi pi-search', to: '/search' },
  { type: 'section', label: 'Samling' },
  {
    type: 'link',
    id: 'genres',
    label: 'Genrer',
    icon: 'pi pi-tag',
    to: '/collection?view=genres',
    badge: () => genres.value.length,
  },
  {
    type: 'link',
    id: 'albums',
    label: 'Albums',
    icon: 'pi pi-th-large',
    to: '/collection?view=albums',
    badge: () => albums.value.length,
  },
  {
    type: 'link',
    id: 'artists',
    label: 'Kunstnere',
    icon: 'pi pi-user',
    to: '/collection?view=artists',
    badge: () => new Set(albums.value.map((a) => a.artist)).size,
  },
  {
    type: 'link',
    id: 'collection-share',
    label: 'Del samling',
    icon: 'pi pi-share-alt',
    to: '/collection/share',
  },
  { type: 'section', label: 'Ønskeliste' },
  {
    type: 'link',
    id: 'wishlist',
    label: 'Ønskeliste',
    icon: 'pi pi-heart',
    to: '/wishlist',
    badge: () => wishlistItems.value.length,
  },
]

function isActive(item: Extract<NavItem, { type: 'link' }>) {
  if (item.id === 'dashboard') return route.path === '/'
  if (item.id === 'search') return route.path === '/search'
  if (item.id === 'genres')
    return route.path === '/collection' && (!route.query.view || route.query.view === 'genres')
  if (item.id === 'albums') return route.path === '/collection' && route.query.view === 'albums'
  if (item.id === 'artists') return route.path === '/collection' && route.query.view === 'artists'
  if (item.id === 'collection-share') return route.path === '/collection/share'
  if (item.id === 'wishlist') return route.path.startsWith('/wishlist')
  return false
}

function openImport() {
  router.push('/collection?action=import')
}
</script>

<template>
  <aside class="app-sidebar">
    <!-- Logo / User -->
    <div class="app-sidebar-logo">
      <NuxtLink
        to="/account"
        class="sidebar-logo-link"
        :class="{ active: route.path === '/account' }"
      >
        <div class="app-logo-icon sidebar-avatar">
          {{ userInitials }}
        </div>
        <div>
          <p class="app-sidebar-logo-text">{{ displayName }}</p>
          <p class="app-sidebar-logo-sub">
            {{ albums.length }} {{ albums.length === 1 ? 'album' : 'albums' }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- Nav -->
    <nav class="app-sidebar-nav">
      <template v-for="item in navItems" :key="item.type === 'link' ? item.id : item.label">
        <p v-if="item.type === 'section'" class="app-sidebar-section">{{ item.label }}</p>
        <NuxtLink v-else :to="item.to" class="sidebar-nav-item" :class="{ active: isActive(item) }">
          <i :class="item.icon" class="sidebar-nav-icon" />
          {{ item.label }}
          <span v-if="item.badge && item.badge() > 0" class="sidebar-nav-badge">{{
            item.badge()
          }}</span>
        </NuxtLink>
      </template>
    </nav>

    <!-- Footer actions -->
    <div class="app-sidebar-footer">
      <NuxtLink to="/search" style="display: block; width: 100%; margin-bottom: 0.5rem">
        <Button
          icon="pi pi-plus"
          label="Tilføj album"
          class="w-full"
          style="width: 100%"
          size="small"
        />
      </NuxtLink>
      <Button
        icon="pi pi-download"
        label="Importer fra Discogs"
        class="w-full"
        style="width: 100%"
        size="small"
        outlined
        @click="openImport"
      />
      <ClientOnly>
        <BarcodeScanner />
      </ClientOnly>
      <p class="app-sidebar-credit">Made with 🔥 by Chimtji</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-avatar {
  background: rgba(196, 85, 41, 0.12);
  color: #c45529;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  border-radius: 50%;
  flex-shrink: 0;
}

.dark-mode .sidebar-avatar {
  background: rgba(232, 132, 90, 0.15);
  color: #e8845a;
}

/* Override global padding — the link handles its own inset */
.app-sidebar-logo {
  padding: 0.5rem 0.75rem;
}

.sidebar-logo-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: inherit;
  transition:
    background-color 0.15s,
    color 0.15s;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.sidebar-logo-link:hover {
  background: var(--app-bg-alt);
}

.sidebar-logo-link.active {
  background: rgba(196, 85, 41, 0.1);
}

.dark-mode .sidebar-logo-link.active {
  background: rgba(232, 132, 90, 0.12);
}

.sidebar-logo-link.active .app-sidebar-logo-text {
  color: #c45529;
}

.dark-mode .sidebar-logo-link.active .app-sidebar-logo-text {
  color: #e8845a;
}
</style>
