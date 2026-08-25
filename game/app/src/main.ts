/**
 * Boot. The panel in `index.html` is already on screen; this gives it something
 * to do. A city comes from `?bundle=`, from `?seed=` and `?theme=`, from the
 * landing screen the player picks it off, or from whatever they type into the
 * form.
 */
import { Boot } from './boot/boot.ts'
import { IndexedShelf } from './boot/indexed-shelf.ts'
import { Library } from './boot/library.ts'
import { Panel } from './boot/panel.ts'

const query = new URLSearchParams(location.search)
const base = query.get('sidecar')
const boot = new Boot({
  mount: document.querySelector<HTMLDivElement>('#game')!,
  panel: new Panel(document.querySelector<HTMLElement>('#boot')!),
  library: new Library(new IndexedShelf()),
  sidecar: base ? { base } : {},
})

if (import.meta.env.DEV) {
  // so the dev console can ask the running game where it thinks it is
  ;(globalThis as Record<string, unknown>).boot = boot
}

await boot.start(query)
