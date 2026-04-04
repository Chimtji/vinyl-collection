<script setup lang="ts">
import type { GenreGroup } from '~/composables/useCollection'

defineProps<{
  group: GenreGroup
}>()
</script>

<template>
  <NuxtLink :to="`/genre/${group.slug}`" class="genre-card">
    <div class="genre-card-mosaic">
      <img
        v-for="(album, i) in group.albums.slice(0, 4)"
        :key="i"
        :src="album.artworkUrl"
        :alt="album.title"
        class="genre-mosaic-img"
        loading="lazy"
      />
      <div
        v-for="i in Math.max(0, 4 - Math.min(group.albums.length, 4))"
        :key="`ph-${i}`"
        class="genre-mosaic-placeholder"
      >
        <i class="pi pi-disc" />
      </div>
    </div>
    <div class="genre-card-body">
      <p class="genre-card-name">{{ group.genre }}</p>
      <p class="genre-card-count">
        {{ group.albums.length }} {{ group.albums.length === 1 ? 'album' : 'albums' }}
      </p>
    </div>
  </NuxtLink>
</template>
