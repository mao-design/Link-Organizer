import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'

const projectRoot = __dirname

export default defineConfig({
  root: 'src/renderer',
  plugins: [
    react(),
    electron([
      {
        entry: resolve(projectRoot, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/main'),
            sourcemap: false,
            minify: true,
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: resolve(projectRoot, 'src/preload/index.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/preload'),
            sourcemap: false,
            minify: true,
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ])
  ],
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: resolve(projectRoot, 'dist/renderer'),
    sourcemap: false
  }
})
