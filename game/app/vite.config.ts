import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // the built asset pack: the clip library and the bodies
  publicDir: resolve(import.meta.dirname, '../../assets/dist'),
  server: {
    port: 5180,
    host: true,
    // A bind mount delivers no inotify events, so a container has to poll to
    // see an edit. On the machine itself inotify works, and polling the whole
    // workspace would spin a core beside the game.
    ...(process.env['GAME_BOX_POLL'] ? { watch: { usePolling: true, interval: 300 } } : {}),
    hmr: { clientPort: 5180 },
  },
  build: { target: 'es2023' },
})
