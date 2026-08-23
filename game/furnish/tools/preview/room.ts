import * as THREE from 'three'
import { PALETTES, type FurnishDressing, type FurnishStyle } from '../../src/index.ts'

/**
 * A plain room in this box's surfaces, with the lit channel a wall carries
 * running round the top of it.
 *
 * It is here to answer one question and no other: does a polished floor give
 * anything back? Before the probe it gave back the night sky, which is black,
 * and read as a hole. `?probe=0` takes the probe off the surfaces so the two
 * can be looked at side by side.
 */

const SIZE = { width: 8, depth: 6, height: 3.2 }
/** Where the lit channel under the wall rail runs. */
const CHANNEL = { y: 2.42, thick: 0.07, out: 0.06 }
const WALL_THICK = 0.1

export function buildRoom(dressing: FurnishDressing, style: FurnishStyle, probe: boolean): THREE.Group {
  const root = new THREE.Group()
  const floor = dressing.surface('floor')
  const wall = dressing.surface('wall')
  const ceiling = dressing.surface('ceiling')
  if (!probe) for (const material of [floor, wall, ceiling]) strip(material)

  root.add(slab(SIZE.width, WALL_THICK, SIZE.depth, 0, -WALL_THICK / 2, 0, floor))
  root.add(slab(SIZE.width, WALL_THICK, SIZE.depth, 0, SIZE.height + WALL_THICK / 2, 0, ceiling))
  for (const side of [-1, 1]) {
    root.add(
      slab(SIZE.width, SIZE.height, WALL_THICK, 0, SIZE.height / 2, (side * (SIZE.depth + WALL_THICK)) / 2, wall),
    )
    root.add(
      slab(WALL_THICK, SIZE.height, SIZE.depth, (side * (SIZE.width + WALL_THICK)) / 2, SIZE.height / 2, 0, wall),
    )
  }

  // the room's own light: the channel under the rail, emissive the way the bays
  // draw it, so what the probe says is in the room really is in the room
  const glow = PALETTES[style].glow
  const lit = new THREE.MeshBasicMaterial({
    name: 'preview:channel',
    color: new THREE.Color().setHex(glow.glow ?? 0xffffff, THREE.SRGBColorSpace).multiplyScalar(glow.glowStrength ?? 1),
    toneMapped: false,
  })
  for (const side of [-1, 1]) {
    root.add(
      band(SIZE.width - 0.2, CHANNEL.thick, CHANNEL.out, 0, CHANNEL.y, side * (SIZE.depth / 2 - CHANNEL.out / 2), lit),
    )
    root.add(
      band(CHANNEL.out, CHANNEL.thick, SIZE.depth - 0.2, side * (SIZE.width / 2 - CHANNEL.out / 2), CHANNEL.y, 0, lit),
    )
  }
  return root
}

function slab(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  return mesh
}

function band(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  return mesh
}

/** Takes the probe back off a surface, so the before can be looked at. */
function strip(material: THREE.Material): void {
  const node = material as THREE.Material & { envNode?: unknown }
  node.envNode = null
  material.needsUpdate = true
}
