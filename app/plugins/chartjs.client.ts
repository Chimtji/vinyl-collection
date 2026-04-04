// PrimeVue's Chart component uses `chart.js/auto` internally.
// We patch defaults on it synchronously so they're in place before any chart mounts.
export default defineNuxtPlugin(async () => {
  const { default: Chart } = await import('chart.js/auto')
  Chart.defaults.color = 'rgba(255,255,255,0.65)'
  Chart.defaults.borderColor = 'rgba(255,255,255,0.15)'
  Chart.defaults.font.family = 'inherit'
})
