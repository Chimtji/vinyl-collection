<script setup lang="ts">
const { ready, isLoggedIn } = useAuth()
const router = useRouter()

const phrases = [
  'Shuffling through the records',
  'Dropping the needle',
  'Warming up the turntable',
  'Flipping through the crates',
  'Dusting off the vinyl',
  'Cueing up your collection',
]
const phrase = phrases[Math.floor(Math.random() * phrases.length)]

// Single routing decision made once Identity resolves.
// Plugin sets ready=true after on('init') — this watch fires immediately after.
// Middleware handles all subsequent navigations synchronously.
watch(
  ready,
  (isReady) => {
    if (!isReady) return
    const path = router.currentRoute.value.path
    if (isLoggedIn.value) {
      if (path === '/login') router.replace('/')
    } else {
      if (path !== '/login') router.replace('/login')
    }
  },
  { immediate: true },
)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <Transition name="splash">
    <div v-if="!ready" class="splash-overlay">
      <div class="splash-vinyl">
        <div class="splash-label"><i class="pi pi-disc" /></div>
      </div>
      <p class="splash-text">
        {{ phrase }}<span class="splash-dot">.</span><span class="splash-dot">.</span
        ><span class="splash-dot">.</span>
      </p>
    </div>
  </Transition>
</template>

<style>
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: var(--app-bg, #faf8f4);
}

.splash-vinyl {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: repeating-radial-gradient(
    circle at center,
    #1a1614 0px,
    #1a1614 4px,
    #2a2220 5px,
    #2a2220 6px
  );
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 3px #111,
    0 8px 32px rgba(0, 0, 0, 0.45);
  animation: vinyl-spin 2s linear infinite;
  flex-shrink: 0;
}

.splash-label {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #c45529;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.4rem;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
  animation: vinyl-spin-reverse 2s linear infinite;
}

.splash-label::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #111;
}

@keyframes vinyl-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes vinyl-spin-reverse {
  to {
    transform: rotate(-360deg);
  }
}

.splash-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--app-text-muted, #8c7b6b);
  margin: 0;
}

.splash-dot {
  animation: dot-blink 1.4s ease-in-out infinite;
  opacity: 0;
}
.splash-dot:nth-child(1) {
  animation-delay: 0s;
}
.splash-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.splash-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-blink {
  0%,
  80%,
  100% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
}

.splash-leave-active {
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.splash-leave-to {
  opacity: 0;
}
</style>
