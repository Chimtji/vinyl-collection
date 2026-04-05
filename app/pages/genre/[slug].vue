<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

definePageMeta({ ssr: false })

const route = useRoute()
const slug = route.params.slug as string

const { genres, loading, fetchCollection, updateAlbum, deleteAlbum, getAlbumsByGenreSlug } =
  useCollection()

onMounted(() => fetchCollection())

const genreAlbums = computed(() => getAlbumsByGenreSlug(slug))
const genreName = computed(() => genres.value.find((g) => g.slug === slug)?.genre ?? slug)

useSeoMeta({ title: computed(() => `${genreName.value} — Vinyl Collection`) })

// ── Display toggles ───────────────────────────────────────
const groupBySections = ref(false)
const listView = ref(false)
const search = ref('')

const filteredAlbums = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return genreAlbums.value
  return genreAlbums.value.filter(
    (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q),
  )
})

function byLetter<T>(items: T[], key: (item: T) => string): [string, T[]][] {
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
  [...filteredAlbums.value].sort((a, b) => a.title.localeCompare(b.title)),
)

type Sec<T> = [string | null, T[]]

const albumSections = computed<Sec<CollectionAlbum>[]>(() =>
  groupBySections.value
    ? byLetter(sortedAlbums.value, (a) => a.title)
    : [[null, sortedAlbums.value]],
)

function albumDetailHref(album: CollectionAlbum) {
  return `/album/${album.id}`
}

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
        <NuxtLink to="/collection?view=genres" class="genre-back-btn">
          <i class="pi pi-arrow-left" />
        </NuxtLink>
        <div>
          <h2 class="collection-main-title" style="margin: 0">{{ genreName }}</h2>
          <p style="font-size: 0.8rem; color: var(--app-text-muted); margin: 0.15rem 0 0">
            {{ genreAlbums.length }} {{ genreAlbums.length === 1 ? 'album' : 'albums' }}
          </p>
        </div>
      </div>
      <div class="collection-main-controls">
        <InputText
          v-model="search"
          placeholder="Filtrer…"
          size="small"
          class="collection-search-input"
        />
        <div class="view-toggles">
          <button
            class="view-toggle-btn"
            :class="{ active: groupBySections }"
            title="Gruppér efter bogstav"
            @click="groupBySections = !groupBySections"
          >
            <i class="pi pi-sort-alpha-down" />
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
    </div>

    <div v-if="loading" style="padding: 4rem 0; text-align: center">
      <ProgressSpinner stroke-width="3" style="width: 48px; height: 48px" />
    </div>

    <div v-else-if="genreAlbums.length === 0" class="empty-state">
      <div class="empty-state-icon"><i class="pi pi-disc" /></div>
      <p class="empty-state-title">Ingen albums i denne genre</p>
    </div>

    <div v-else-if="filteredAlbums.length === 0" class="empty-state">
      <p class="empty-state-title">Ingen matches for &quot;{{ search }}&quot;</p>
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
            :to="albumDetailHref(album)"
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
              <p class="crate-count">
                {{ album.artist }}{{ album.year ? ' · ' + album.year : '' }}
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- list -->
        <div v-else class="collection-list">
          <NuxtLink
            v-for="album in albumList"
            :key="album.id"
            :to="albumDetailHref(album)"
            class="clist-row"
          >
            <div class="clist-art-wrap">
              <img
                v-if="album.artworkUrl"
                :src="album.artworkUrl"
                :alt="album.title"
                class="clist-art"
              />
              <div v-else class="cist-art clist-art-placeholder">
                <i class="pi pi-disc" />
              </div>
            </div>
            <div class="clist-info">
              <span class="clist-title">{{ album.title }}</span>
              <span class="clist-sub"
                >{{ album.artist }}{{ album.year ? ' · ' + album.year : '' }}</span
              >
            </div>
            <div class="clist-actions" @click.stop>
              <Button
                v-if="!album.itunesCollectionId"
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                aria-label="Rediger"
                @click="openEdit(album)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                aria-label="Slet"
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
      header="Rediger album"
      modal
      :style="{ width: '480px' }"
    >
      <div v-if="editForm" class="add-dialog-body">
        <div class="form-field">
          <label>Albumtitel</label>
          <InputText v-model="editForm.title" class="w-full" />
        </div>
        <div class="form-field">
          <label>Kunstner</label>
          <InputText v-model="editForm.artist" class="w-full" />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="editForm.genre" class="w-full" />
          </div>
          <div class="form-field form-field-year">
            <label>År</label>
            <InputNumber v-model="editForm.year" :use-grouping="false" class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label
            >Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span></label
          >
          <Textarea v-model="editForm.notes" rows="2" class="w-full" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="editDialogVisible = false" />
        <Button label="Gem" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
      </template>
    </Dialog>

    <!-- Delete Confirm Dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      header="Slet album"
      modal
      :style="{ width: '380px' }"
    >
      <p style="margin: 0">
        Fjern <strong>{{ confirmDelete?.title }}</strong> fra din samling?
      </p>
      <template #footer>
        <Button label="Annuller" text @click="confirmDelete = null" />
        <Button
          label="Slet"
          icon="pi pi-trash"
          severity="danger"
          @click="doDelete(confirmDelete!)"
        />
      </template>
    </Dialog>
  </div>
</template>
