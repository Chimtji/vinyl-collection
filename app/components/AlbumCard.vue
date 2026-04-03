<script setup lang="ts">
import type { ItunesAlbum } from '~/composables/useAppleMusic'

const props = defineProps<{
  album: ItunesAlbum
}>()

const emit = defineEmits<{
  click: [album: ItunesAlbum]
}>()

const { getArtworkUrl, formatReleaseYear } = useAppleMusic()

const artworkUrl = computed(() => getArtworkUrl(props.album.artworkUrl100, 400))
const year = computed(() => formatReleaseYear(props.album.releaseDate))
</script>

<template>
  <div class="music-card" role="button" tabindex="0" @click="emit('click', album)" @keyup.enter="emit('click', album)">
    <img
      v-if="artworkUrl"
      :src="artworkUrl"
      :alt="album.collectionName"
      class="card-artwork"
      loading="lazy"
    />
    <div v-else class="card-artwork-placeholder">
      <i class="pi pi-disc" />
    </div>
    <div class="card-body">
      <p class="card-title">{{ album.collectionName }}</p>
      <p class="card-subtitle">{{ year }} · {{ album.trackCount }} tracks</p>
    </div>
  </div>
</template>
