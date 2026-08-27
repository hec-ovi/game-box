import { Boot } from './boot/boot.ts'
import { IndexedShelf } from './boot/indexed-shelf.ts'
import { localHasShelf } from './boot/kept.ts'
import { Library } from './boot/library.ts'
import { Panel } from './boot/panel.ts'

const query = new URLSearchParams(location.search)
const base = query.get('sidecar')
const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
if (!query.toString() && localHasShelf()) {
  panel.face = 'home'
}

const boot = new Boot({
  mount: document.querySelector<HTMLDivElement>('#game')!,
  panel,
  library: new Library(new IndexedShelf()),
  sidecar: base ? { base } : {},
  // the providers live on the same service, so pointing the game at another
  // one points both at it
  providers: base ? { base } : {},
})

if (import.meta.env.DEV) {
  // so the dev console can ask the running game where it thinks it is
  ;(globalThis as Record<string, unknown>).boot = boot
}

await boot.start(query)

