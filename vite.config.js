import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base './' keeps asset paths relative, so dist/ works from any URL or sub-path.
// viteSingleFile inlines the JS and CSS into index.html, so the site also works when opened
// straight from disk (file://), where browsers refuse to load module scripts and fetch().
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
})
