<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Log ind — Vinylsamling' })

const { isLoggedIn, login } = useAuth()
const router = useRouter()

// If already authenticated, skip the login page
watchEffect(() => {
  if (isLoggedIn.value) router.replace('/')
})

onMounted(() => {
  // Only open the widget if not already authenticated.
  // If already logged in, watchEffect above will redirect before this matters.
  if (!isLoggedIn.value) {
    login()
  }
})
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <div class="app-logo-icon login-logo-icon">
          <i class="pi pi-disc" />
        </div>
        <h1 class="login-title">Vinyl<span>Collection</span></h1>
      </div>

      <p class="login-sub">Log ind for at se og administrere din private vinylsamling.</p>

      <Button
        label="Log ind / Opret konto"
        icon="pi pi-user"
        size="large"
        style="width: 100%"
        @click="login"
      />
    </div>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-lg);
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: center;
}

.login-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.login-logo-icon {
  width: 56px;
  height: 56px;
  font-size: 1.6rem;
}

.login-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--app-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.login-title span {
  color: #c45529;
}

.login-sub {
  color: var(--app-text-muted);
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.5;
}
</style>
