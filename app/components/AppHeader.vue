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

      <div style="display: flex; align-items: center; gap: 0.75rem">
        <NuxtLink to="/">
          <Button
            text
            rounded
            icon="pi pi-search"
            aria-label="Search"
            size="small"
            style="color: var(--app-text-muted)"
          />
        </NuxtLink>
        <Button
          text
          rounded
          :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          size="small"
          style="color: var(--app-text-muted)"
          @click="toggleDark"
        />
      </div>
    </div>
  </header>
</template>
