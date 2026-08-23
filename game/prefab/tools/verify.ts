import { MeshoptDecoder } from 'meshoptimizer'
import { heightOf, type Bucket } from '../src/bucket.ts'
import { PROUD } from '../src/fit.ts'
import { io } from './intake.ts'
import { NEONS } from './look.ts'

/** How far a model may sit off its own measurements once the pack has been quantized. */
const DRIFT = 0.001

/**
 * Reads the pack back the way the game will and measures every model again.
 *
 * The intake gates measure what the producer wrote; this measures what actually
 * ships, after welding, quantization and compression. It is the check that
 * keeps "a building is exactly as tall as its plot" a promise about the file in
 * the repository rather than about an intermediate nobody has.
 *
 * Only the walls are held to the plot's exact height, so it needs the pack's own
 * list of finishes to know which layers are lit trim.
 */
export async function verifyPack(mesh: Uint8Array, shapes: ReadonlyMap<string, Bucket>, finishes: readonly string[]): Promise<void> {
  await MeshoptDecoder.ready
  const doc = await io.readBinary(mesh)
  const lit = new Set(NEONS.map((neon) => finishes.indexOf(`neon:${neon}`)))
  const wrong: string[] = []

  for (const node of doc.getRoot().listNodes()) {
    const geometry = node.getMesh()
    const bucket = shapes.get(node.getName())
    if (!geometry || !bucket) continue

    const scale = node.getScale()
    const lift = node.getTranslation()
    const height = heightOf(bucket.storeys)
    let low = Infinity
    let walls = -Infinity
    let trim = -Infinity
    let wide = 0
    let deep = 0

    for (const prim of geometry.listPrimitives()) {
      const positions = prim.getAttribute('POSITION')!
      const layers = prim.getAttribute('_LAYER')!
      const point: number[] = []
      for (let i = 0; i < positions.getCount(); i++) {
        positions.getElement(i, point)
        const x = point[0]! * scale[0]! + lift[0]!
        const y = point[1]! * scale[1]! + lift[1]!
        const z = point[2]! * scale[2]! + lift[2]!
        low = Math.min(low, y)
        trim = Math.max(trim, y)
        if (!lit.has(layers.getScalar(i))) walls = Math.max(walls, y)
        wide = Math.max(wide, Math.abs(x))
        deep = Math.max(deep, Math.abs(z))
      }
    }

    if (Math.abs(low) > DRIFT || Math.abs(walls - height) > DRIFT) {
      wrong.push(`${node.getName()} stands ${low.toFixed(4)} to ${walls.toFixed(4)} m, not 0 to ${height}`)
    }
    if (trim > height + PROUD + DRIFT || wide > bucket.front / 2 + PROUD + DRIFT || deep > bucket.depth / 2 + PROUD + DRIFT) {
      wrong.push(`${node.getName()} reaches ${wide.toFixed(3)} by ${deep.toFixed(3)} by ${trim.toFixed(3)} m`)
    }
  }

  if (wrong.length) throw new Error(`the packed models drifted:\n  ${wrong.slice(0, 8).join('\n  ')}`)
}
