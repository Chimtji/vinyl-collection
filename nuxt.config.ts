// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'

const VinylPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#FEF2EC',
      100: '#FDE0D0',
      200: '#FAC0A0',
      300: '#F59870',
      400: '#EC7048',
      500: '#C45529',
      600: '#A8421E',
      700: '#8B3318',
      800: '#6B2612',
      900: '#45180B',
      950: '#2A0E06',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '{stone.50}',
          100: '{stone.100}',
          200: '{stone.200}',
          300: '{stone.300}',
          400: '{stone.400}',
          500: '{stone.500}',
          600: '{stone.600}',
          700: '{stone.700}',
          800: '{stone.800}',
          900: '{stone.900}',
          950: '{stone.950}',
        },
      },
    },
  },
})

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    discogsToken: process.env.DISCOGS_TOKEN ?? '',
  },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    preset: 'netlify',
  },
  modules: ['@nuxt/eslint', '@primevue/nuxt-module'],
  css: ['primeicons/primeicons.css', '~/assets/css/main.css'],
  primevue: {
    options: {
      ripple: true,
      theme: {
        preset: VinylPreset,
        options: {
          darkModeSelector: '.dark-mode',
          cssLayer: false,
        },
      },
    },
  },
})
