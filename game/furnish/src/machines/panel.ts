import { type FurnitureProp, MACHINE_PROPS, type MachineProp } from '@gb/world'
import * as THREE from 'three'

/**
 * Where the glass is on each machine, and nowhere else.
 *
 * A machine is built once per language and shared, but what is on its screen
 * is that machine's own: the ledger of one shop, the mail of one flat, the
 * room one camera watches. So the picture is printed by the room, in the
 * room's own geometry, standing a hair off the glass the prop built. The two
 * meet on this table: the builder draws the panel from it and the print is
 * laid in `glassFrame`, so the picture cannot land beside the screen.
 *
 * A panel is a slab standing on a base, leaning back by `tilt` about the
 * bottom edge, with the glass inset by `bezel` all round.
 */
export interface Panel {
  /** The middle of the panel's bottom edge, in the prop's frame. */
  readonly x: number
  readonly y: number
  readonly z: number
  /** Radians the panel leans back, off the vertical. */
  readonly tilt: number
  readonly width: number
  /** Metres up the slab, along its own lean. */
  readonly height: number
  readonly thick: number
  readonly bezel: number
}

export const PANELS: Record<MachineProp, Panel> = {
  terminal: { x: 0, y: 0.14, z: 0.16, tilt: 0, width: 0.44, height: 0.31, thick: 0.03, bezel: 0.02 },
  laptop: { x: 0, y: 0.018, z: 0.1, tilt: (10 * Math.PI) / 180, width: 0.38, height: 0, thick: 0.012, bezel: 0.014 },
  tablet: { x: 0, y: 0.01, z: -0.03, tilt: (22 * Math.PI) / 180, width: 0.28, height: 0, thick: 0.01, bezel: 0.01 },
  monitor: { x: 0, y: 0.1, z: 0.03, tilt: 0, width: 0.58, height: 0.35, thick: 0.03, bezel: 0.02 },
}

/** Whether a prop carries a panel: the four screens `@gb/world` calls machines. */
export function isMachine(prop: FurnitureProp): prop is MachineProp {
  return (MACHINE_PROPS as readonly FurnitureProp[]).includes(prop)
}

/**
 * A leaning panel's height, drawn so its highest corner lands exactly on the
 * prop's declared height. The top front corner of a slab leaning back by
 * `tilt` stands at `y + height cos(tilt) + (thick / 2) sin(tilt)`; solving for
 * the height keeps a laptop lid or a tablet on the number the table declares,
 * to the micron, without fitting anything afterwards.
 */
export function panelHeight(panel: Panel, top: number): number {
  if (panel.height > 0) return panel.height
  return (top - panel.y - (panel.thick / 2) * Math.sin(panel.tilt)) / Math.cos(panel.tilt)
}

/** The panel's own frame: origin at the middle of its bottom edge, y up the lean, -z out of its face. */
export function panelFrame(panel: Panel): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(panel.x, panel.y, panel.z)
    .multiply(new THREE.Matrix4().makeRotationX(panel.tilt))
}

/** The glass rectangle inside the bezel, in the panel's frame. */
export function glassOf(panel: Panel, top: number): { width: number; height: number; y: number } {
  return { width: panel.width - 2 * panel.bezel, height: panelHeight(panel, top) - 2 * panel.bezel, y: panel.bezel }
}

/**
 * The frame a picture is printed in: origin at the middle of the glass's
 * bottom edge, on the face, x across the glass, y up it, -z towards whoever is
 * reading it.
 */
export function glassFrame(prop: MachineProp, top: number): THREE.Matrix4 {
  const panel = PANELS[prop]
  return panelFrame(panel).multiply(new THREE.Matrix4().makeTranslation(0, panel.bezel, -panel.thick / 2))
}
