// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'

const VinylPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#FEF3C7',
      100: '#FDE68A',
      200: '#FCD34D',
      300: '#FBBF24',
      400: '#F59E0B',
      500: '#D97706',
      600: '#B45309',
      700: '#92400E',
      800: '#78350F',
      900: '#451A03',
      950: '#2C1000',
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
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
        },
      ],
    },
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
