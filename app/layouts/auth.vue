<template>
  <div class="auth-layout">
    <slot />
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  background: var(--app-bg);
  color: var(--app-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
