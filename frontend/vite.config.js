import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // THIS IS THE CRITICAL FIX
    // It forces all libraries to use the same copy of React
    dedupe: ['react', 'react-dom'], 
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split code into smaller pieces to fix the size warning
          vendor: ['react', 'react-dom', 'react-router-dom'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts', 'react-force-graph-2d']
        }
      }
    }
  }
})