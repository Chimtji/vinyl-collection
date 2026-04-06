<script setup lang="ts">
const { ready, isLoggedIn, login } = useAuth()

// Once auth state is resolved and user is not logged in, open the overlay.
// Using watchEffect means it also re-triggers if the user logs out.
watchEffect(() => {
  if (ready.value && !isLoggedIn.value) {
    login()
  }
})
</script>

<template>
  <!-- While the Identity widget resolves auth from localStorage, show a
       minimal full-screen loader so there is never a blank white flash. -->
  <div v-if="!ready" class="auth-loading">
    <div class="auth-loading-spinner">
      <i class="pi pi-disc auth-loading-icon" />
    </div>
  </div>

  <!-- Auth resolved but not logged in: keep the loader visible while the
       Netlify Identity overlay is open (it is opened in the watchEffect). -->
  <div v-else-if="!isLoggedIn" class="auth-loading">
    <div class="auth-loading-spinner">
      <i class="pi pi-disc auth-loading-icon" />
    </div>
  </div>

  <!-- Fully authenticated: render the normal app shell. -->
  <div v-else class="app-layout">
    <NuxtRouteAnnouncer />
    <AppSidebar />
    <main class="app-content">
      <div class="app-content-inner">
        <slot />
      </div>
    </main>
    <ApiDevTools />
  </div>
</template>

<style scoped>
.auth-loading {
  min-height: 100vh;
  background: var(--app-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.auth-loading-icon {
  font-size: 3rem;
  color: var(--p-primary-500);
  animation: spin 1.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
