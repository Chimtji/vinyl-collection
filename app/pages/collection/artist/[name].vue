<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ ssr: false })

const route = useRoute()
const router = useRouter()
const artistName = decodeURIComponent(route.params.name as string)

const { loading, fetchCollection, updateAlbum, deleteAlbum, albums } = useCollection()

onMounted(() => fetchCollection())

useSeoMeta({ title: computed(() => `${artistName} — Vinyl Collection`) })

const artistAlbums = computed(() => albums.value.filter((a) => a.artist === artistName))

// ── Display toggles ───────────────────────────────────────
const listView = ref(false)
const groupBySections = ref(false)
const search = ref('')

const filteredAlbums = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return artistAlbums.value
  return artistAlbums.value.filter((a) => a.title.toLowerCase().includes(q))
})

function byLetter<T>(items: T[], key: (item: T) => string): [string | null, T[]][] {
  const sections = new Map<string, T[]>()
  for (const item of items) {
    const name = key(item)
    const letter = /^[a-zA-Z]/.test(name) ? name[0]!.toUpperCase() : '#'
    if (!sections.has(letter)) sections.set(letter, [])
    sections.get(letter)!.push(item)
  }
  return Array.from(sections.entries()).sort((a, b) => {
    if (a[0] === '#') return 1
    if (b[0] === '#') return -1
    return a[0].localeCompare(b[0])
  })
}

const sortedAlbums = computed(() =>
  [...filteredAlbums.value].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
)

const albumSections = computed<[string | null, CollectionAlbum[]][]>(() =>
  groupBySections.value
    ? byLetter(sortedAlbums.value, (a) => a.title)
    : [[null, sortedAlbums.value]],
)

// ── Edit dialog ───────────────────────────────────────────
const editDialogVisible = ref(false)
const editSaving = ref(false)
const editForm = ref<CollectionAlbum | null>(null)

function openEdit(album: CollectionAlbum) {
  editForm.value = { ...album }
  editDialogVisible.value = true
}

async function saveEdit() {
  if (!editForm.value) return
  editSaving.value = true
  try {
    await updateAlbum(editForm.value.id, editForm.value)
    editDialogVisible.value = false
  } finally {
    editSaving.value = false
  }
}

// ── Delete dialog ─────────────────────────────────────────
const confirmDelete = ref<CollectionAlbum | null>(null)
const showDeleteDialog = computed({
  get: () => !!confirmDelete.value,
  set: (v) => {
    if (!v) confirmDelete.value = null
  },
})

async function doDelete(album: CollectionAlbum) {
  await deleteAlbum(album.id)
  confirmDelete.value = null
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="collection-main-header" style="margin-bottom: 2rem">
      <div style="display: flex; align-items: center; gap: 0.875rem">
        <NuxtLink to="/collection?view=artists" class="genre-back-btn">
          <i class="pi pi-arrow-left" />
        </NuxtLink>
        <div>
          <h2 class="collection-main-title" style="margin: 0">{{ artistName }}</h2>
          <p style="font-size: 0.8rem; color: var(--app-text-muted); margin: 0.15rem 0 0">
            {{ artistAlbums.length }} {{ artistAlbums.length === 1 ? 'album' : 'albums' }} in
            collection
          </p>
        </div>
      </div>
      <div class="collection-main-controls">
        <Button
          text
          size="small"
          icon="pi pi-external-link"
          label="Full discography"
          @click="router.push(`/artist/0?name=${encodeURIComponent(artistName)}`)"
        />
        <InputText
          v-model="search"
          placeholder="Filter…"
          size="small"
          class="collection-search-input"
        />
        <div class="view-toggles">
          <button
            class="view-toggle-btn"
            :class="{ active: groupBySections }"
            title="Group by letter"
            @click="groupBySections = !groupBySections"
          >
            <i class="pi pi-sort-alpha-down" />
          </button>
          <div class="view-mode-btns">
            <button
              class="view-toggle-btn"
              :class="{ active: !listView }"
              title="Grid view"
              @click="listView = false"
            >
              <i class="pi pi-th-large" />
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: listView }"
              title="List view"
              @click="listView = true"
            >
              <i class="pi pi-list" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" style="padding: 4rem 0; text-align: center">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <div v-else-if="artistAlbums.length === 0" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-disc" /></div>
      <p class="empty-state-title">No albums by this artist</p>
    </div>

    <div v-else-if="filteredAlbums.length === 0" class="empty-state">
      <p class="empty-state-title">No matches for "{{ search }}"</p>
    </div>

    <template v-else>
      <div
        v-for="[letter, albumList] in albumSections"
        :key="letter ?? 'all'"
        class="crate-section"
      >
        <h3 v-if="letter" class="crate-section-label">{{ letter }}</h3>

        <!-- grid -->
        <div v-if="!listView" class="crate-grid">
          <NuxtLink
            v-for="album in albumList"
            :key="album.id"
            :to="`/album/${album.id}`"
            class="crate-item"
          >
            <div class="crate-stack">
              <div class="crate-record" style="--i: 0">
                <img
                  v-if="album.artworkUrl"
                  :src="album.artworkUrl"
                  :alt="album.title"
                  class="crate-record-img"
                />
                <div v-else class="crate-record-img crate-record-placeholder">
                  <i class="pi pi-disc" />
                </div>
              </div>
            </div>
            <div class="crate-info">
              <p class="crate-genre">{{ album.title }}</p>
              <p class="crate-count">{{ album.year ?? '' }}</p>
            </div>
          </NuxtLink>
        </div>

        <!-- list -->
        <div v-else class="collection-list">
          <NuxtLink
            v-for="album in albumList"
            :key="album.id"
            :to="`/album/${album.id}`"
            class="clist-row"
          >
            <div class="clist-art-wrap">
              <img
                v-if="album.artworkUrl"
                :src="album.artworkUrl"
                :alt="album.title"
                class="clist-art"
              />
              <div v-else class="clist-art clist-art-placeholder">
                <i class="pi pi-disc" />
              </div>
            </div>
            <div class="clist-info">
              <span class="clist-title">{{ album.title }}</span>
              <span class="clist-sub"
                >{{ album.genre }}{{ album.year ? ' · ' + album.year : '' }}</span
              >
            </div>
            <div class="clist-actions" @click.stop>
              <Button
                v-if="!album.itunesCollectionId"
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                aria-label="Edit"
                @click="openEdit(album)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                aria-label="Delete"
                @click="confirmDelete = album"
              />
            </div>
            <i class="pi pi-chevron-right clist-chevron" />
          </NuxtLink>
        </div>
      </div>
    </template>

    <!-- Edit Dialog -->
    <Dialog
      v-model:visible="editDialogVisible"
      header="Edit Album"
      modal
      :style="{ width: '480px' }"
    >
      <div v-if="editForm" class="add-dialog-body">
        <div class="form-field">
          <label>Album Title</label>
          <InputText v-model="editForm.title" class="w-full" />
        </div>
        <div class="form-field">
          <label>Artist</label>
          <InputText v-model="editForm.artist" class="w-full" />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="editForm.genre" class="w-full" />
          </div>
          <div class="form-field form-field-year">
            <label>Year</label>
            <InputNumber v-model="editForm.year" :use-grouping="false" class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label
            >Notes
            <span style="color: var(--app-text-muted); font-weight: 400">(optional)</span></label
          >
          <Textarea v-model="editForm.notes" rows="2" class="w-full" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="editDialogVisible = false" />
        <Button label="Save" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- Delete Confirm Dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      header="Delete Album"
      modal
      :style="{ width: '380px' }"
    >
      <p style="margin: 0">
        Remove <strong>{{ confirmDelete?.title }}</strong> from your collection?
      </p>
      <template #footer>
        <Button label="Cancel" text @click="confirmDelete = null" />
        <Button
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          @click="doDelete(confirmDelete!)"
        />
      </template>
    </Dialog>
  </div>
</template>
