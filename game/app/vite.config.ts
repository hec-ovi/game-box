import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // the built asset pack: the clip library and the bodies
  publicDir: resolve(import.meta.dirname, '../../assets/dist'),
  server: { port: 5180 },
  build: { target: 'es2023' },
})
