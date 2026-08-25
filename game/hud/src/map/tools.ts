import { el, keyButton } from '../dom.ts'
import { MAP_KEYS, MAP_TOOLS } from '../phrase.ts'

/** What the four tools do. Each is also a key while the map has focus. */
export type MapTool = 'in' | 'out' | 'fit' | 'you'

/** The key each tool answers to, as `KeyboardEvent.key` reads it. `=` is the unshifted `+`. */
const KEYED: Record<string, MapTool> = { '+': 'in', '=': 'in', '-': 'out', '0': 'fit', y: 'you' }

/** The four buttons over the plan, each with its key printed on it. */
export class MapTools {
  readonly node = el('div', 'gb-map-tools')

  constructor(run: (tool: MapTool) => void) {
    this.node.setAttribute('role', 'group')
    this.node.setAttribute('aria-label', 'Map tools')
    for (const tool of ['in', 'out', 'fit', 'you'] as const) {
      const label = MAP_TOOLS[tool]
      const button = keyButton('gb-map-tool', label, MAP_KEYS[tool], `${label} (${MAP_KEYS[tool]})`)
      button.addEventListener('click', () => run(tool))
      this.node.append(button)
    }
  }

  /** The tool a key stands for, or nothing. */
  static toolFor(key: string): MapTool | undefined {
    return KEYED[key.length === 1 ? key.toLowerCase() : key]
  }
}
