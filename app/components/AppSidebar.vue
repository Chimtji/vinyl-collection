<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { albums, genres } = useCollection()
const { items: wishlistItems, fetchWishlist } = useWishlist()

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
  if (item.id === 'wishlist') return route.path.startsWith('/wishlist')
  return false
}

function openImport() {
  router.push('/collection?action=import')
}
</script>

<template>
  <aside class="app-sidebar">
    <!-- Logo -->
    <div class="app-sidebar-logo">
      <div class="app-logo-icon">
        <i class="pi pi-disc" />
      </div>
      <div>
        <p class="app-sidebar-logo-text">Vinyl<span>Collection</span></p>
        <p class="app-sidebar-logo-sub">
          {{ albums.length }} {{ albums.length === 1 ? 'album' : 'albums' }}
        </p>
      </div>
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
