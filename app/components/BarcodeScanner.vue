<script setup lang="ts">
import type { ItunesAlbum } from '~/composables/useAppleMusic'
import type { DiscogsSearchResponse } from '~/composables/useDiscogs'

const { getArtworkUrl } = useAppleMusic()
const { addAlbum } = useCollection()
const { addToWishlist, removeFromWishlist, isWishlisted, getWishlistItem, fetchWishlist } =
  useWishlist()

const router = useRouter()

const dialogVisible = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)

type ScanState = 'scanning' | 'looking-up' | 'found' | 'not-found' | 'error' | 'no-camera'
const scanState = ref<ScanState>('scanning')
const statusMessage = ref('')
const scannedBarcode = ref('')
const discogsTitle = ref('')
const matchedAlbum = ref<ItunesAlbum | null>(null)
const wishlistPending = ref(false)

// Manual search
const manualQuery = ref('')
const manualResults = ref<ItunesAlbum[]>([])
const manualLoading = ref(false)
const manualSearched = ref(false)

async function doManualSearch() {
  const q = manualQuery.value.trim()
  if (!q) return
  manualLoading.value = true
  manualSearched.value = true
  try {
    const data = await $fetch<{ resultCount: number; results: ItunesAlbum[] }>(
      '/api/itunes/search',
      {
        query: { term: q, entity: 'album', limit: 10 },
      },
    )
    manualResults.value = (data.results || []).filter(
      (r) => (r as ItunesAlbum).wrapperType === 'collection',
    )
  } catch {
    manualResults.value = []
  } finally {
    manualLoading.value = false
  }
}

function selectManualAlbum(album: ItunesAlbum) {
  matchedAlbum.value = album
  scanState.value = 'found'
}

// Add to collection dialog
const addDialogVisible = ref(false)
const addSaving = ref(false)
const addForm = ref({
  title: '',
  artist: '',
  genre: '',
  year: new Date().getFullYear(),
  artworkUrl: '',
  notes: '',
  itunesCollectionId: undefined as number | undefined,
  trackCount: undefined as number | undefined,
})

// ZXing reader instance (lazily loaded, client-only)
let codeReader: import('@zxing/browser').BrowserMultiFormatReader | null = null
let stopScanning: (() => void) | null = null

async function startCamera() {
  if (!videoRef.value) return

  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    codeReader = new BrowserMultiFormatReader()

    const controls = await codeReader.decodeFromVideoDevice(
      undefined,
      videoRef.value,
      (result, _err, controls) => {
        if (result) {
          controls.stop()
          stopScanning = null
          handleBarcode(result.getText())
        }
      },
    )
    stopScanning = () => controls.stop()
  } catch (err: unknown) {
    const isDenied =
      err instanceof Error && (err.name === 'NotAllowedError' || err.message.includes('permission'))
    scanState.value = 'no-camera'
    statusMessage.value = isDenied
      ? 'Kameratilladelse blev afvist. Tillad kamera i browserindstillingerne.'
      : 'Kamera ikke tilgængeligt på denne enhed.'
  }
}

function stopCamera() {
  if (stopScanning) {
    stopScanning()
    stopScanning = null
  }
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject as MediaStream
    stream.getTracks().forEach((t) => t.stop())
    videoRef.value.srcObject = null
  }
}

async function handleBarcode(barcode: string) {
  scannedBarcode.value = barcode
  scanState.value = 'looking-up'
  statusMessage.value = `Stregkode fundet: ${barcode} — søger…`

  try {
    // 1. Look up barcode on Discogs
    const discogsData = await $fetch<DiscogsSearchResponse>('/api/discogs/barcode', {
      query: { barcode },
    })

    if (!discogsData.results || discogsData.results.length === 0) {
      scanState.value = 'not-found'
      statusMessage.value = 'Ingen resultater fundet for denne stregkode.'
      return
    }

    // Discogs title format is typically "Artist - Album Title"
    const release = discogsData.results[0]!
    const rawTitle = release.title || ''
    const dashIdx = rawTitle.indexOf(' - ')
    const artist = dashIdx !== -1 ? rawTitle.slice(0, dashIdx).trim() : ''
    const albumTitle = dashIdx !== -1 ? rawTitle.slice(dashIdx + 3).trim() : rawTitle.trim()

    statusMessage.value = `Fandt "${rawTitle}" — matcher med iTunes…`

    // 2. Search iTunes for the album
    const searchTerm = artist ? `${artist} ${albumTitle}` : albumTitle
    const itunesData = await $fetch<{ resultCount: number; results: ItunesAlbum[] }>(
      '/api/itunes/search',
      { query: { term: searchTerm, entity: 'album', limit: 5 } },
    )

    const albums = (itunesData.results || []).filter(
      (r) => (r as ItunesAlbum).wrapperType === 'collection',
    )

    if (albums.length === 0) {
      discogsTitle.value = rawTitle
      manualQuery.value = albumTitle ? `${artist} ${albumTitle}`.trim() : rawTitle
      manualResults.value = []
      manualSearched.value = false
      scanState.value = 'not-found'
      statusMessage.value = `Fandt "${rawTitle}" på Discogs, men ingen iTunes-match.`
      return
    }

    matchedAlbum.value = albums[0]!
    scanState.value = 'found'
  } catch {
    scanState.value = 'error'
    statusMessage.value = 'Noget gik galt. Prøv igen.'
  }
}

function openDialog() {
  matchedAlbum.value = null
  scannedBarcode.value = ''
  scanState.value = 'scanning'
  statusMessage.value = ''
  dialogVisible.value = true
  fetchWishlist()
  // Start camera after the dialog has rendered the video element
  nextTick(() => startCamera())
}

function closeDialog() {
  stopCamera()
  dialogVisible.value = false
}

function scanAgain() {
  matchedAlbum.value = null
  scannedBarcode.value = ''
  discogsTitle.value = ''
  manualQuery.value = ''
  manualResults.value = []
  manualSearched.value = false
  scanState.value = 'scanning'
  statusMessage.value = ''
  nextTick(() => startCamera())
}

function goToAlbum() {
  if (!matchedAlbum.value) return
  closeDialog()
  router.push(`/album/itunes/${matchedAlbum.value.collectionId}`)
}

async function toggleWishlist() {
  if (!matchedAlbum.value) return
  wishlistPending.value = true
  try {
    const existing = getWishlistItem(matchedAlbum.value.collectionId)
    if (existing) {
      await removeFromWishlist(existing.id)
    } else {
      await addToWishlist({
        itunesCollectionId: matchedAlbum.value.collectionId,
        title: matchedAlbum.value.collectionName,
        artist: matchedAlbum.value.artistName,
        genre: matchedAlbum.value.primaryGenreName || 'Other',
        year: matchedAlbum.value.releaseDate
          ? new Date(matchedAlbum.value.releaseDate).getFullYear()
          : 0,
        artworkUrl: getArtworkUrl(matchedAlbum.value.artworkUrl100, 500),
        trackCount: matchedAlbum.value.trackCount,
        priority: 'medium',
      })
    }
  } finally {
    wishlistPending.value = false
  }
}

function openAddDialog() {
  if (!matchedAlbum.value) return
  const album = matchedAlbum.value
  addForm.value = {
    title: album.collectionName,
    artist: album.artistName,
    genre: album.primaryGenreName || '',
    year: album.releaseDate ? new Date(album.releaseDate).getFullYear() : new Date().getFullYear(),
    artworkUrl: getArtworkUrl(album.artworkUrl100, 600),
    notes: '',
    itunesCollectionId: album.collectionId,
    trackCount: album.trackCount,
  }
  addDialogVisible.value = true
}

async function saveToCollection() {
  addSaving.value = true
  try {
    await addAlbum({ ...addForm.value })
    addDialogVisible.value = false
    closeDialog()
  } catch (error) {
    console.error('[Barcode Add Error]', error)
  } finally {
    addSaving.value = false
  }
}

onUnmounted(() => stopCamera())
</script>

<template>
  <div>
    <!-- Trigger button — placed in sidebar footer slot -->
    <Button
      icon="pi pi-barcode"
      label="Scan stregkode"
      class="w-full"
      style="width: 100%"
      size="small"
      outlined
      @click="openDialog"
    />

    <!-- Scanner dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      header="Scan stregkode"
      modal
      :style="{ width: '420px' }"
      :closable="true"
      @hide="stopCamera"
    >
      <div class="barcode-scanner-body">
        <!-- Camera viewfinder -->
        <div v-if="scanState === 'scanning'" class="barcode-viewfinder">
          <video ref="videoRef" class="barcode-video" autoplay muted playsinline />
          <div class="barcode-reticle">
            <div class="barcode-reticle-line" />
          </div>
          <p class="barcode-hint">Hold stregkoden inden for rammen</p>
        </div>

        <!-- No camera -->
        <div v-else-if="scanState === 'no-camera'" class="barcode-status barcode-status--error">
          <i class="pi pi-video-slash" style="font-size: 2.5rem; margin-bottom: 0.75rem" />
          <p>{{ statusMessage }}</p>
        </div>

        <!-- Looking up -->
        <div v-else-if="scanState === 'looking-up'" class="barcode-status">
          <ProgressSpinner
            stroke-width="3"
            style="width: 48px; height: 48px; margin-bottom: 1rem"
          />
          <p class="barcode-status-msg">{{ statusMessage }}</p>
        </div>

        <!-- Not found → manual search -->
        <div v-else-if="scanState === 'not-found'" class="barcode-manual">
          <div class="barcode-manual-header">
            <i class="pi pi-exclamation-circle" style="color: var(--p-yellow-400)" />
            <span
              >Ingen automatisk iTunes-match for <strong>{{ discogsTitle }}</strong></span
            >
          </div>

          <p class="barcode-manual-label">Søg manuelt på iTunes:</p>
          <div class="barcode-manual-input-row">
            <InputText
              v-model="manualQuery"
              placeholder="Kunstner album…"
              class="barcode-manual-input"
              @keyup.enter="doManualSearch"
            />
            <Button
              icon="pi pi-search"
              size="small"
              :loading="manualLoading"
              @click="doManualSearch"
            />
          </div>

          <div v-if="manualLoading" class="barcode-manual-spinner">
            <ProgressSpinner stroke-width="3" style="width: 36px; height: 36px" />
          </div>

          <div
            v-else-if="manualSearched && manualResults.length === 0"
            class="barcode-manual-empty"
          >
            Ingen resultater — prøv et andet søgeord
          </div>

          <div v-else-if="manualResults.length > 0" class="barcode-manual-results">
            <div
              v-for="album in manualResults"
              :key="album.collectionId"
              class="barcode-manual-result-item"
              @click="selectManualAlbum(album)"
            >
              <img
                :src="getArtworkUrl(album.artworkUrl100, 80)"
                :alt="album.collectionName"
                class="barcode-manual-result-art"
              />
              <div class="barcode-manual-result-info">
                <p class="barcode-manual-result-title">{{ album.collectionName }}</p>
                <p class="barcode-manual-result-sub">
                  {{ album.artistName
                  }}<span v-if="album.releaseDate">
                    · {{ new Date(album.releaseDate).getFullYear() }}</span
                  >
                </p>
              </div>
              <i class="pi pi-chevron-right" style="color: var(--app-text-muted); flex-shrink: 0" />
            </div>
          </div>

          <Button
            label="Scan igen"
            icon="pi pi-refresh"
            text
            size="small"
            style="margin-top: 0.5rem; align-self: flex-start"
            @click="scanAgain"
          />
        </div>

        <!-- Error -->
        <div v-else-if="scanState === 'error'" class="barcode-status barcode-status--error">
          <i
            class="pi pi-times-circle"
            style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--p-red-400)"
          />
          <p>{{ statusMessage }}</p>
          <Button
            label="Prøv igen"
            icon="pi pi-refresh"
            text
            size="small"
            style="margin-top: 0.75rem"
            @click="scanAgain"
          />
        </div>

        <!-- Found -->
        <div v-else-if="scanState === 'found' && matchedAlbum" class="barcode-result">
          <div class="barcode-result-art-wrap">
            <img
              :src="getArtworkUrl(matchedAlbum.artworkUrl100, 400)"
              :alt="matchedAlbum.collectionName"
              class="barcode-result-art"
            />
          </div>
          <div class="barcode-result-info">
            <p class="barcode-result-title">{{ matchedAlbum.collectionName }}</p>
            <p class="barcode-result-artist">{{ matchedAlbum.artistName }}</p>
            <p class="barcode-result-meta">
              <span v-if="matchedAlbum.releaseDate">
                {{ new Date(matchedAlbum.releaseDate).getFullYear() }} ·
              </span>
              {{ matchedAlbum.primaryGenreName }}
            </p>
          </div>

          <div class="barcode-result-actions">
            <Button
              :icon="isWishlisted(matchedAlbum.collectionId) ? 'pi pi-heart-fill' : 'pi pi-heart'"
              :label="isWishlisted(matchedAlbum.collectionId) ? 'På ønskeliste' : 'Ønskeliste'"
              size="small"
              outlined
              :loading="wishlistPending"
              :class="{ 'btn-wishlisted': isWishlisted(matchedAlbum.collectionId) }"
              @click="toggleWishlist"
            />
            <Button
              icon="pi pi-plus"
              label="Tilføj til samling"
              size="small"
              @click="openAddDialog"
            />
            <Button
              icon="pi pi-external-link"
              label="Se album"
              size="small"
              text
              @click="goToAlbum"
            />
          </div>

          <Button
            label="Scan endnu et album"
            icon="pi pi-refresh"
            text
            size="small"
            style="margin-top: 0.25rem; align-self: center"
            @click="scanAgain"
          />
        </div>
      </div>
    </Dialog>

    <!-- Add to Collection Dialog -->
    <Dialog
      v-model:visible="addDialogVisible"
      header="Tilføj til samling"
      modal
      :style="{ width: '480px' }"
    >
      <div class="add-dialog-body">
        <div v-if="addForm.artworkUrl" class="add-dialog-preview">
          <img :src="addForm.artworkUrl" :alt="addForm.title" class="add-dialog-artwork" />
          <div>
            <p class="add-dialog-album-title">{{ addForm.title }}</p>
            <p class="add-dialog-album-artist">{{ addForm.artist }}</p>
          </div>
        </div>
        <div class="form-field">
          <label>Albumtitel</label>
          <InputText v-model="addForm.title" class="w-full" />
        </div>
        <div class="form-field">
          <label>Kunstner</label>
          <InputText v-model="addForm.artist" class="w-full" />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Genre</label>
            <InputText v-model="addForm.genre" class="w-full" />
          </div>
          <div class="form-field form-field-year">
            <label>År</label>
            <InputNumber v-model="addForm.year" :use-grouping="false" class="w-full" />
          </div>
        </div>
        <div class="form-field">
          <label
            >Notater
            <span style="color: var(--app-text-muted); font-weight: 400">(valgfrit)</span>
          </label>
          <Textarea v-model="addForm.notes" rows="2" class="w-full" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Annuller" text @click="addDialogVisible = false" />
        <Button
          label="Tilføj til samling"
          icon="pi pi-plus"
          :loading="addSaving"
          @click="saveToCollection"
        />
      </template>
    </Dialog>
  </div>
</template>
