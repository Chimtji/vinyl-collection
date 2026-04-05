<script setup lang="ts">
const isDark = ref(false)

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
