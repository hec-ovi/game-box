import * as THREE from 'three'
import {
  FurnishDressing,
  PALETTES,
  SCREEN_SLOTS,
  screeningOf,
  surfaceChoices,
  type FurnishLibrary,
  type FurnishStyle,
} from '../../src/index.ts'
import { buildRoom } from './room.ts'

/**
 * Three televisions in one dark room, each on a different one of the town's
 * screenings.
 *
 * It answers the two questions a table of bytes cannot: does the glass read as
 * something playing rather than as a pattern, and are three of them in one room
 * plainly not showing the same thing at the same second. The room is the same
 * plain one the surfaces are looked at in, so the light on the floor in front
 * of each set is the probe doing its job and nothing else.
 */

/** How high the sets stand, so the glass is near eye level for a standing body. */
const STAND = 0.72

export function buildScreens(kit: FurnishLibrary, style: FurnishStyle, probe: boolean): THREE.Group {
  const root = buildRoom(new FurnishDressing(kit, undefined, style), style, probe)
  const plinth = new THREE.MeshStandardMaterial({
    name: 'preview:plinth',
    color: new THREE.Color().setHex(PALETTES[style].shell.colour, THREE.SRGBColorSpace),
    roughness: 0.6,
  })

  const slots = [0, 2, 3].filter((slot) => slot < SCREEN_SLOTS)
  slots.forEach((slot, at) => {
    const x = (at - (slots.length - 1) / 2) * 2.3
    const dressing = new FurnishDressing(kit, undefined, style, surfaceChoices(kit.seed, style, 'preview'), slot)
    const set = dressing.prop('tv')
    // a prop's front looks north and the camera stands to the south of it, the
    // way a body in a room does, so it is turned to face back down the room
    set.rotation.y = Math.PI
    set.position.set(x, STAND, -2.4)
    set.name = `tv:${slot}:station${screeningOf(kit.seed, slot).station}`
    root.add(set)

    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, STAND, 0.5), plinth)
    box.position.set(x, STAND / 2, -2.4)
    box.receiveShadow = true
    root.add(box)
  })
  return root
}
