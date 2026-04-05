<script setup lang="ts">
definePageMeta({ ssr: false })
useSeoMeta({ title: 'Konto — Vinylsamling' })

const { user, isLoggedIn, logout } = useAuth()
const { albums, genres, fetchCollection } = useCollection()
const { items: wishlistItems, fetchWishlist } = useWishlist()
const isDev = import.meta.dev

onMounted(async () => {
  await Promise.all([fetchCollection(), fetchWishlist()])
})

const displayName = computed(() => user.value?.user_metadata?.full_name ?? user.value?.email ?? '—')
const memberSince = computed(() => {
  if (!user.value?.created_at) return '—'
  return new Date(user.value.created_at).toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
const totalArtists = computed(() => new Set(albums.value.map((a) => a.artist)).size)
</script>

<template>
  <div class="account-page">
    <div class="account-header">
      <h1 class="account-title">Konto</h1>
    </div>

    <div v-if="isLoggedIn && user" class="account-grid">
      <!-- Profile card -->
      <section class="account-card">
        <div class="account-card-head">
          <div class="account-avatar">
            <i class="pi pi-user" />
          </div>
          <div>
            <p class="account-name">{{ displayName }}</p>
            <p class="account-email">{{ user.email }}</p>
            <span v-if="isDev" class="account-dev-badge">Lokal udviklertilstand</span>
          </div>
        </div>
        <dl class="account-meta">
          <div class="account-meta-row">
            <dt>Bruger-ID</dt>
            <dd class="account-id">{{ user.id }}</dd>
          </div>
          <div class="account-meta-row">
            <dt>Medlem siden</dt>
            <dd>{{ memberSince }}</dd>
          </div>
        </dl>
      </section>

      <!-- Collection stats -->
      <section class="account-card">
        <h2 class="account-card-title">Samling</h2>
        <div class="account-stats">
          <div class="account-stat">
            <span class="account-stat-value">{{ albums.length }}</span>
            <span class="account-stat-label">Albums</span>
          </div>
          <div class="account-stat">
            <span class="account-stat-value">{{ totalArtists }}</span>
            <span class="account-stat-label">Kunstnere</span>
          </div>
          <div class="account-stat">
            <span class="account-stat-value">{{ genres.length }}</span>
            <span class="account-stat-label">Genrer</span>
          </div>
          <div class="account-stat">
            <span class="account-stat-value">{{ wishlistItems.length }}</span>
            <span class="account-stat-label">Ønskeliste</span>
          </div>
        </div>
      </section>

      <!-- Sign out -->
      <div class="account-signout">
        <Button
          label="Log ud"
          icon="pi pi-sign-out"
          severity="danger"
          outlined
          :disabled="isDev"
          @click="logout"
        />
        <p v-if="isDev" class="account-dev-note">Log ud er deaktiveret i lokal udviklertilstand.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  padding: 2rem;
  max-width: 720px;
}

.account-header {
  margin-bottom: 1.75rem;
}

.account-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--app-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.account-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Card ── */
.account-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.875rem;
  padding: 1.5rem;
  box-shadow: var(--app-shadow);
}

.account-card-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--app-text-muted);
  margin: 0 0 1rem;
}

.account-card-desc {
  color: var(--app-text-muted);
  font-size: 0.875rem;
  margin: 0 0 1rem;
}

/* ── Profile head ── */
.account-card-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.account-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(196, 85, 41, 0.12);
  color: #c45529;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}

.dark-mode .account-avatar {
  background: rgba(232, 132, 90, 0.15);
  color: #e8845a;
}

.account-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--app-text);
  margin: 0 0 0.2rem;
}

.account-email {
  font-size: 0.825rem;
  color: var(--app-text-muted);
  margin: 0;
}

.account-dev-badge {
  display: inline-block;
  margin-top: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(196, 85, 41, 0.1);
  color: #c45529;
  border: 1px solid rgba(196, 85, 41, 0.25);
}

/* ── Meta: id, joined ── */
.account-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.account-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.825rem;
  gap: 1rem;
}

.account-meta-row dt {
  color: var(--app-text-muted);
  flex-shrink: 0;
}

.account-meta-row dd {
  margin: 0;
  color: var(--app-text);
  text-align: right;
}

.account-id {
  font-family: monospace;
  font-size: 0.75rem;
  opacity: 0.7;
  word-break: break-all;
}

/* ── Stats ── */
.account-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.account-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--app-bg-alt);
  border-radius: 0.625rem;
  padding: 0.875rem 0.5rem;
  gap: 0.25rem;
}

.account-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: -0.02em;
  line-height: 1;
}

.account-stat-label {
  font-size: 0.7rem;
  color: var(--app-text-muted);
  text-align: center;
}

.account-signout {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.account-dev-note {
  font-size: 0.75rem;
  color: var(--app-text-muted);
  margin: 0.75rem 0 0;
  font-style: italic;
}
</style>
