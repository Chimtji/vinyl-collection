<script setup lang="ts">
import type { CollectionAlbum } from '~/composables/useCollection'

const props = defineProps<{
  album: CollectionAlbum
}>()

const emit = defineEmits<{
  edit: [album: CollectionAlbum]
  delete: [album: CollectionAlbum]
}>()
</script>

<template>
  <div class="music-card collection-album-card">
    <img
      v-if="album.artworkUrl"
      :src="album.artworkUrl"
      :alt="album.title"
      class="card-artwork"
      loading="lazy"
    />
    <div v-else class="card-artwork-placeholder">
      <i class="pi pi-disc" />
    </div>
    <div class="card-body">
      <p class="card-title">{{ album.title }}</p>
      <p class="card-subtitle">{{ album.artist }}{{ album.year ? ' · ' + album.year : '' }}</p>
      <p v-if="album.notes" class="card-notes">{{ album.notes }}</p>
    </div>
    <div v-if="emit" class="card-actions">
      <Button
        text
        rounded
        size="small"
        icon="pi pi-pencil"
        aria-label="Rediger"
        @click.stop="emit('edit', album)"
      />
      <Button
        text
        rounded
        size="small"
        icon="pi pi-trash"
        severity="danger"
        aria-label="Slet"
        @click.stop="emit('delete', album)"
      />
    </div>
  </div>
</template>
