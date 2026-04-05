<script setup lang="ts">
import type { ItunesTrack } from '~/composables/useAppleMusic'

defineProps<{
  tracks: ItunesTrack[]
}>()

const { formatDuration } = useAppleMusic()
</script>

<template>
  <div class="track-list">
    <div class="track-list-header">
      <span style="text-align: center">#</span>
      <span>Titel</span>
      <span><i class="pi pi-clock" /></span>
    </div>
    <div v-for="track in tracks" :key="track.trackId" class="track-item">
      <span class="track-number">{{ track.trackNumber }}</span>
      <div class="track-info">
        <p class="track-name">{{ track.trackName }}</p>
        <p v-if="track.artistName !== tracks[0]?.artistName" class="track-artist">
          {{ track.artistName }}
        </p>
      </div>
      <span class="track-duration">{{ formatDuration(track.trackTimeMillis || 0) }}</span>
    </div>
  </div>
</template>
