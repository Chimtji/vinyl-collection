<script setup lang="ts">
const { ready } = useAuth()

const loadingPhrases = [
  'Shuffling through the records',
  'Dropping the needle',
  'Warming up the turntable',
  'Flipping through the crates',
  'Dusting off the vinyl',
  'Cueing up your collection',
]

const phrase = loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)]
</script>

<template>
  <!-- App always mounts so routing and middleware work normally -->
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Splash overlay sits on top until Identity init completes -->
  <Transition name="splash">
    <div v-if="!ready" class="splash-screen">
      <div class="splash-vinyl-outer">
        <div class="splash-vinyl-label">
          <i class="pi pi-disc" />
        </div>
      </div>
      <p class="splash-text">
        {{ phrase }}<span class="splash-dot">.</span><span class="splash-dot">.</span
        ><span class="splash-dot">.</span>
      </p>
    </div>
  </Transition>
</template>

<style>
/* ── Splash overlay ────────────────────────────────────────────────────────── */
.splash-screen {
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
  animation: vinyl-spin 2s linear infinite;
  position: relative;
  flex-shrink: 0;
}

/* Centre label */
.splash-vinyl-label {
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
  /* Counter-rotate so the label icon stays upright while disc spins */
  animation: vinyl-spin-reverse 2s linear infinite;
  position: relative;
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

@keyframes vinyl-spin-reverse {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

/* ── Loading text + animated dots ─────────────────────────────────────────── */
.splash-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--app-text-muted, #8c7b6b);
  letter-spacing: 0.01em;
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

/* ── Fade-out transition ───────────────────────────────────────────────────── */
.splash-leave-active {
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.splash-leave-to {
  opacity: 0;
}
</style>
