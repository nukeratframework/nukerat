import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin } from 'vite'
import { contentSecurityPolicy } from './electron/csp'

function injectContentSecurityPolicy(): Plugin {
  return {
    name: 'inject-content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const policy = contentSecurityPolicy(ctx.server !== undefined)
        const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`
        if (html.includes('Content-Security-Policy')) {
          return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, meta)
        }
        return html.replace('<head>', `<head>\n    ${meta}`)
      },
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rolldownOptions: {
        input: path.resolve(__dirname, 'electron/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rolldownOptions: {
        input: path.resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, '.'),
    base: './',
    build: {
      rolldownOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [injectContentSecurityPolicy(), react(), tailwindcss()],
  },
})
