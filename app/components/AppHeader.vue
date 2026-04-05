<script setup lang="ts">
const isDark = ref(false)
const router = useRouter()
const route = useRoute()
const headerSearchQuery = ref('')

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark-mode')
})

function toggleDark() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark-mode')
  } else {
    document.documentElement.classList.remove('dark-mode')
  }
}

function doHeaderSearch() {
  const q = headerSearchQuery.value.trim()
  if (!q) return
  router.push({ path: '/search', query: { q } })
  headerSearchQuery.value = ''
}

// Keep the search bar pre-filled when already on /search
watch(
  () => route.query.q,
  (q) => {
    if (route.path === '/search') headerSearchQuery.value = (q as string) || ''
    else headerSearchQuery.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <header class="app-header">
    <div class="app-container">
      <NuxtLink to="/" class="app-logo">
        <div class="app-logo-icon">
          <i class="pi pi-disc" />
        </div>
        <span class="app-logo-text">Vinyl<span>Collection</span></span>
      </NuxtLink>

      <nav style="display: flex; align-items: center; gap: 0.5rem">
        <NuxtLink to="/" class="header-nav-link">Samling</NuxtLink>
        <NuxtLink to="/search" class="header-nav-link">Søg</NuxtLink>
        <NuxtLink to="/collection" class="header-nav-link">Administrer</NuxtLink>
      </nav>
      <div style="display: flex; align-items: center; gap: 0.5rem">
        <div class="header-search">
          <InputText
            v-model="headerSearchQuery"
            placeholder="Søg musik…"
            class="header-search-input"
            @keyup.enter="doHeaderSearch"
          />
          <Button
            icon="pi pi-search"
            text
            rounded
            size="small"
            aria-label="Søg"
            class="header-search-btn"
            @click="doHeaderSearch"
          />
        </div>
        <Button
          text
          rounded
          :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
          :aria-label="isDark ? 'Skift til lys tilstand' : 'Skift til mørk tilstand'"
          size="small"
          style="color: var(--app-text-muted)"
          @click="toggleDark"
        />
      </div>
    </div>
  </header>
</template>
