/**
 * Boot. The panel in `index.html` is already on screen; this gives it something
 * to do. A city comes from `?bundle=`, from `?seed=` and `?theme=`, from the
 * one the player was last in, or from whatever they type into the panel.
 */
import { Sidecar } from '@gb/sidecar'
import { Boot } from './boot/boot.ts'
import { Panel } from './boot/panel.ts'

const query = new URLSearchParams(location.search)
const base = query.get('sidecar')
const boot = new Boot({
  mount: document.querySelector<HTMLDivElement>('#game')!,
  panel: new Panel(document.querySelector<HTMLElement>('#boot')!),
  sidecar: new Sidecar(base ? { base } : {}),
})

if (import.meta.env.DEV) {
  // so the dev console can ask the running game where it thinks it is
  ;(globalThis as Record<string, unknown>).boot = boot
}

await boot.start(query)
