<script setup lang="ts">
import type { WishlistItem } from '~/composables/useWishlist'

definePageMeta({ ssr: false })
useSeoMeta({ title: 'Ønskeliste — Vinylsamling' })

const router = useRouter()
const { items, loading, fetchWishlist, removeFromWishlist, updateWishlistItem, addToWishlist } =
  useWishlist()
const { addAlbum } = useCollection()
const { getArtworkUrl } = useAppleMusic()

onMounted(() => fetchWishlist())

// ── Filters & sort ────────────────────────────────────────
const search = ref('')
const priorityFilter = ref<'all' | 'high' | 'medium' | 'low'>('all')
const sortBy = ref<'addedAt' | 'title' | 'artist' | 'year'>('addedAt')
const sortDir = ref<'desc' | 'asc'>('desc')
const listView = ref(false)

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'Høj', medium: 'Medium', low: 'Lav' }

const filtered = computed(() => {
  let result = items.value

  if (priorityFilter.value !== 'all') {
    result = result.filter((i) => i.priority === priorityFilter.value)
  }

  const q = search.value.toLowerCase()
  if (q) {
    result = result.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.artist.toLowerCase().includes(q) ||
        i.genre.toLowerCase().includes(q),
    )
  }

  return [...result].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'addedAt') cmp = a.addedAt.localeCompare(b.addedAt)
    else if (sortBy.value === 'title') cmp = a.title.localeCompare(b.title)
    else if (sortBy.value === 'artist') cmp = a.artist.localeCompare(b.artist)
    else if (sortBy.value === 'year') cmp = (a.year ?? 0) - (b.year ?? 0)
    return sortDir.value === 'desc' ? -cmp : cmp
  })
})

const countByPriority = computed(() => ({
  all: items.value.length,
  high: items.value.filter((i) => i.priority === 'high').length,
  medium: items.value.filter((i) => i.priority === 'medium').length,
  low: items.value.filter((i) => i.priority === 'low').length,
}))

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortBy.value = field
    sortDir.value = field === 'addedAt' ? 'desc' : 'asc'
  }
}

// ── Remove ────────────────────────────────────────────────
const confirmDelete = ref<WishlistItem | null>(null)
const deleting = ref(false)

async function doRemove() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await removeFromWishlist(confirmDelete.value.id)
    confirmDelete.value = null
  } finally {
    deleting.value = false
  }
}

// ── Edit (notes + priority) ───────────────────────────────
const editItem = ref<WishlistItem | null>(null)
const editForm = ref({ notes: '', priority: 'medium' as WishlistItem['priority'] })
const editSaving = ref(false)

function openEdit(item: WishlistItem) {
  editItem.value = item
  editForm.value = { notes: item.notes ?? '', priority: item.priority }
}

async function saveEdit() {
  if (!editItem.value) return
  editSaving.value = true
  try {
    await updateWishlistItem(editItem.value.id, editForm.value)
    editItem.value = null
  } finally {
    editSaving.value = false
  }
}

// ── Share link ───────────────────────────────────────────
const { user } = useAuth()
const shareCopied = ref(false)
let shareCopiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyShareLink() {
  const userId = user.value?.id ?? ''
  const url = `${window.location.origin}/wishlist/share${userId ? `?userId=${userId}` : ''}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const el = document.createElement('input')
    el.value = url
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  shareCopied.value = true
  if (shareCopiedTimer) clearTimeout(shareCopiedTimer)
  shareCopiedTimer = setTimeout(() => {
    shareCopied.value = false
  }, 2500)
}

// ── Move to collection ────────────────────────────────────
const movingId = ref<string | null>(null)

async function moveToCollection(item: WishlistItem) {
  movingId.value = item.id
  try {
    await addAlbum({
      title: item.title,
      artist: item.artist,
      genre: item.genre,
      year: item.year,
      artworkUrl: item.artworkUrl,
      itunesCollectionId: item.itunesCollectionId,
      trackCount: item.trackCount,
    })
    await removeFromWishlist(item.id)
    router.push(`/album/itunes/${item.itunesCollectionId}`)
  } finally {
    movingId.value = null
  }
}

function artworkSrc(item: WishlistItem) {
  return item.artworkUrl ? getArtworkUrl(item.artworkUrl, 300) : ''
}
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="collection-main-header" style="margin-bottom: 1.5rem">
      <div>
        <h2 class="collection-main-title" style="margin: 0">Ønskeliste</h2>
        <p style="font-size: 0.8rem; color: var(--app-text-muted); margin: 0.15rem 0 0">
          {{ items.length }} {{ items.length === 1 ? 'album' : 'albums' }} du ønsker
        </p>
      </div>
      <div class="collection-main-controls">
        <Button
          :icon="shareCopied ? 'pi pi-check' : 'pi pi-share-alt'"
          :label="shareCopied ? 'Kopieret!' : 'Del'"
          size="small"
          :severity="shareCopied ? 'success' : 'secondary'"
          outlined
          @click="copyShareLink"
        />
        <InputText
          v-model="search"
          placeholder="Filtrer…"
          size="small"
          class="collection-search-input"
        />
        <!-- Sort -->
        <Select
          v-model="sortBy"
          :options="[
            { label: 'Tilføjet dato', value: 'addedAt' },
            { label: 'Titel', value: 'title' },
            { label: 'Kunstner', value: 'artist' },
            { label: 'År', value: 'year' },
          ]"
          option-label="label"
          option-value="value"
          size="small"
          style="width: 130px"
        />
        <button
          class="view-toggle-btn"
          :title="sortDir === 'desc' ? 'Faldende' : 'Stigende'"
          @click="sortDir = sortDir === 'desc' ? 'asc' : 'desc'"
        >
          <i :class="sortDir === 'desc' ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up-alt'" />
        </button>
        <div class="view-mode-btns">
          <button
            class="view-toggle-btn"
            :class="{ active: !listView }"
            title="Gittervisning"
            @click="listView = false"
          >
            <i class="pi pi-th-large" />
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: listView }"
            title="Listevisning"
            @click="listView = true"
          >
            <i class="pi pi-list" />
          </button>
        </div>
      </div>
    </div>

    <!-- Priority filter tabs -->
    <div class="wishlist-priority-tabs">
      <button
        v-for="p in ['all', 'high', 'medium', 'low'] as const"
        :key="p"
        class="wishlist-priority-tab"
        :class="{ active: priorityFilter === p, [`priority-${p}`]: p !== 'all' }"
        @click="priorityFilter = p"
      >
        <span v-if="p !== 'all'" class="priority-dot" :class="`priority-dot--${p}`" />
        {{ p === 'all' ? 'Alle' : PRIORITY_LABELS[p] }}
        <span class="wishlist-tab-count">{{ countByPriority[p] }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="padding: 4rem 0; text-align: center">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-heart" /></div>
      <p class="empty-state-title">Din ønskeliste er tom</p>
      <p class="empty-state-text">Søg efter albums og tilføj dem til din ønskeliste</p>
      <NuxtLink to="/search">
        <Button icon="pi pi-search" label="Søg albums" size="small" style="margin-top: 1rem" />
      </NuxtLink>
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <p class="empty-state-title">Ingen matches</p>
    </div>

    <!-- Grid view -->
    <template v-else-if="!listView">
      <div class="crate-grid">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="crate-item"
          @click="router.push(`/album/itunes/${item.itunesCollectionId}`)"
        >
          <div class="crate-stack">
            <div class="crate-record" style="--i: 0">
              <img
                v-if="artworkSrc(item)"
                :src="artworkSrc(item)"
                :alt="item.title"
                class="crate-record-img"
              />
              <div v-else class="crate-record-img crate-record-placeholder">
                <i class="pi pi-disc" />
              </div>
              <!-- Priority badge -->
              <div class="wishlist-crate-priority" :class="`priority-badge--${item.priority}`">
                {{ PRIORITY_LABELS[item.priority] }}
              </div>
            </div>
            <!-- Hover actions overlay -->
            <div class="crate-item-actions" @click.stop>
              <Button
                icon="pi pi-plus"
                size="small"
                rounded
                title="Tilføj til samling"
                :loading="movingId === item.id"
                @click="moveToCollection(item)"
              />
              <Button
                icon="pi pi-pencil"
                size="small"
                rounded
                title="Rediger noter / prioritet"
                @click="openEdit(item)"
              />
              <Button
                icon="pi pi-trash"
                size="small"
                rounded
                severity="danger"
                title="Fjern fra ønskeliste"
                @click="confirmDelete = item"
              />
            </div>
          </div>
          <div class="crate-info">
            <p class="crate-genre">{{ item.title }}</p>
            <p class="crate-count">{{ item.artist }}{{ item.year ? ' · ' + item.year : '' }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- List view -->
    <template v-else>
      <div class="collection-list">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="clist-row"
          style="cursor: pointer"
          @click="router.push(`/album/itunes/${item.itunesCollectionId}`)"
        >
          <div class="clist-art-wrap">
            <img
              v-if="artworkSrc(item)"
              :src="artworkSrc(item)"
              :alt="item.title"
              class="clist-art"
            />
            <div v-else class="clist-art clist-art-placeholder">
              <i class="pi pi-disc" />
            </div>
          </div>
          <div class="clist-info">
            <span class="clist-title">{{ item.title }}</span>
            <span class="clist-sub">
              {{ item.artist }}{{ item.year ? ' · ' + item.year : '' }} · {{ item.genre }}
            </span>
            <span v-if="item.notes" class="clist-notes">{{ item.notes }}</span>
          </div>
          <span class="wishlist-priority-pill" :class="`priority-badge--${item.priority}`">
            {{ PRIORITY_LABELS[item.priority] }}
          </span>
          <div class="clist-actions" @click.stop>
            <Button
              icon="pi pi-plus"
              text
              rounded
              size="small"
              title="Tilføj til samling"
              :loading="movingId === item.id"
              @click="moveToCollection(item)"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              title="Rediger"
              @click="openEdit(item)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              title="Fjern"
              @click="confirmDelete = item"
            />
          </div>
          <i class="pi pi-chevron-right clist-chevron" />
        </div>
      </div>
    </template>

    <!-- Edit dialog -->
    <Dialog
      :visible="!!editItem"
      header="Rediger ønskelistepunkt"
      modal
      :style="{ width: '420px' }"
      @update:visible="
        (v) => {
          if (!v) editItem = null
        }
      "
    >
      <div v-if="editItem" class="add-dialog-body">
        <div class="form-field">
          <label>Prioritet</label>
          <div class="wishlist-priority-select">
            <button
              v-for="p in ['high', 'medium', 'low'] as const"
              :key="p"
              class="wishlist-priority-opt"
              :class="{ active: editForm.priority === p, [`priority-opt--${p}`]: true }"
              @click="editForm.priority = p"
            >
              <span class="priority-dot" :class="`priority-dot--${p}`" />
              {{ PRIORITY_LABELS[p] }}
            </button>
          </div>
        </div>
        <div class="form-field">
          <label
            >Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span></label
          >
          <Textarea
            v-model="editForm.notes"
            rows="2"
            class="w-full"
            auto-resize
            placeholder="Hvorfor vil du have dette?"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="editItem = null" />
        <Button label="Gem" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- Remove confirm dialog -->
    <Dialog
      :visible="!!confirmDelete"
      header="Fjern fra ønskeliste"
      modal
      :style="{ width: '380px' }"
      @update:visible="
        (v) => {
          if (!v) confirmDelete = null
        }
      "
    >
      <p style="margin: 0">
        Fjern <strong>{{ confirmDelete?.title }}</strong> fra din ønskeliste?
      </p>
      <template #footer>
        <Button label="Annuller" text @click="confirmDelete = null" />
        <Button
          label="Fjern"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="doRemove"
        />
      </template>
    </Dialog>
  </div>
</template>
