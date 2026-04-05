<template>
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
