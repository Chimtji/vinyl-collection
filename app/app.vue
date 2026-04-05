<script setup lang="ts">
const { ready } = useAuth()

const loadingPhrases = [
  'Shuffling through the records…',
  'Dropping the needle…',
  'Warming up the turntable…',
  'Flipping through the crates…',
  'Dusting off the vinyl…',
  'Cueing up your collection…',
]

const phrase = loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)]
</script>

<template>
  <Transition name="splash" mode="out-in">
    <div v-if="!ready" class="splash-screen">
      <div class="splash-vinyl">
        <div class="splash-vinyl-outer">
          <div class="splash-vinyl-label">
            <i class="pi pi-disc" />
          </div>
        </div>
      </div>
      <p class="splash-text">{{ phrase }}</p>
    </div>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </Transition>
</template>

<style>
/* ── Splash screen ─────────────────────────────────────────────────────────── */
.splash-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: var(--app-bg);
}

/* Outer vinyl disc */
.splash-vinyl-outer {
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
  animation: vinyl-spin 2.4s linear infinite;
  position: relative;
}

/* Centre label */
.splash-vinyl-label {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #c45529;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.4rem;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
}

/* Spinhole dot */
.splash-vinyl-label::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #111;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}

@keyframes vinyl-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.splash-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--app-text-muted);
  letter-spacing: 0.01em;
  margin: 0;
}

/* Fade out transition */
.splash-enter-active,
.splash-leave-active {
  transition: opacity 0.35s ease;
}

.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}
</style>
