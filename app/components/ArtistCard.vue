<script setup lang="ts">
import type { ItunesArtist } from '~/composables/useAppleMusic'

defineProps<{
  artist: ItunesArtist
}>()

const emit = defineEmits<{
  click: [artist: ItunesArtist]
}>()
</script>

<template>
  <div
    class="artist-card"
    role="button"
    tabindex="0"
    @click="emit('click', artist)"
    @keyup.enter="emit('click', artist)"
  >
    <div class="artist-avatar">
      {{ artist.artistName.charAt(0).toUpperCase() }}
    </div>
    <div class="artist-info">
      <p class="artist-name">{{ artist.artistName }}</p>
      <p class="artist-genre">{{ artist.primaryGenreName || 'Musik' }}</p>
    </div>
    <i class="pi pi-chevron-right" style="color: var(--app-text-muted); font-size: 0.875rem" />
  </div>
</template>
