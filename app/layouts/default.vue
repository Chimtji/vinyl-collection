<script setup lang="ts">
// const { ready, isLoggedIn, login } = useAuth()

// // As soon as auth state resolves and user is not logged in, open the overlay.
// watchEffect(() => {
//   if (ready.value && !isLoggedIn.value) {
//     login()
//   }
// })

onBeforeMount(() => {
  useAuth().logout()
})

onMounted(() => {
  useAuth().login()
})
</script>

<template>
  <!-- Spinner while the Identity widget is initialising or while the user
       is not yet logged in (overlay will be open on top). -->
  <!-- <div v-if="!ready || !isLoggedIn" class="auth-loading">
    <i class="pi pi-disc auth-loading-icon" />
  </div> -->

  <!-- Fully authenticated: render the normal app shell. -->
  <div class="app-layout">
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
