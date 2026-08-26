import type { Driving } from '@gb/drive'
import type { Hud } from '@gb/hud'
import type * as THREE from 'three'
import { controlsFor } from './controls.ts'

/** Which driving view is on, as `@gb/drive` publishes it. */
export type DrivingView = Driving['view']

/**
 * The camera while the player is driving. `@gb/drive` works out where a view
 * behind the car goes and hands over two points; the player stays in the seat
 * whichever view is on, so all that happens here is that the camera is put on
 * those points and the key swaps the two views.
 *
 * Only the camera moves. Where the player is, what the crosshair offers, how
 * far they can reach and where they are put down when they get out are all
 * still the seat's, which is why the view can sit nine metres back without
 * bringing every doorway on the street into range.
 */
export class Chase {
  #camera: THREE.PerspectiveCamera
  #driving: Driving
  #hud: Hud

  constructor(input: { camera: THREE.PerspectiveCamera; driving: Driving; hud: Hud }) {
    this.#camera = input.camera
    this.#driving = input.driving
    this.#hud = input.hud
  }

  /**
   * After the car has moved. Nothing to do on foot or with the seat view on:
   * the eye is where the seat put it, which is the path the game has always
   * taken.
   */
  follow(): void {
    const view = this.#driving.chase()
    if (!view) return
    // no roll and no look heading: the car leans and the player turns in their
    // seat, and a camera outside the car does neither
    this.#camera.position.set(view.eye.x, view.eye.y, view.eye.z)
    this.#camera.lookAt(view.at.x, view.at.y, view.at.z)
  }

  /** The view key: the other one, with the controls window told which is on now. */
  swap(): string | undefined {
    const view = this.#driving.switchView()
    this.#hud.show({ controls: controlsFor(view) })
    if (!this.#driving.aboard) return undefined
    return view === 'chase' ? 'Driving from behind the car.' : 'Driving from the seat.'
  }
}
