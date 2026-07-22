import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const firebaseFeature = ['analytics', 'auth', 'firestore', 'functions', 'storage']
            .find((feature) => id.includes(`/node_modules/@firebase/${feature}/`))
          if (firebaseFeature) {
            return `firebase-${firebaseFeature}`
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase-core'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts'
          }
        },
      },
    },
  },
})
