import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Inlines the built CSS bundle directly into index.html's <head> instead of
// leaving it as a separate <link rel="stylesheet">, so there's no extra
// network round-trip blocking initial render (PageSpeed flagged this
// ~16KB/330ms stylesheet as delaying LCP). Only applies during `vite
// build` — ctx.bundle is undefined in dev, where Vite already injects CSS
// per-module via HMR with no blocking request to begin with.
function inlineCss() {
  return {
    name: 'inline-css',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const cssChunks = Object.values(ctx.bundle).filter(
          (chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css')
        )
        let out = html
        for (const chunk of cssChunks) {
          const basename = escapeRegExp(chunk.fileName.split('/').pop())
          const linkRe = new RegExp(`<link[^>]*href="[^"]*${basename}"[^>]*>`)
          out = out.replace(linkRe, `<style>${chunk.source}</style>`)
        }
        return out
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), inlineCss()],
  // Public maps are fine: the source is already public on GitHub, and
  // browsers only fetch .map files when DevTools is open.
  build: {
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
