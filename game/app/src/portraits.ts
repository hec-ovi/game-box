import type { Cast } from '@gb/cast'
import type { Npc } from '@gb/world'
import * as THREE from 'three'
import type { Stage } from './stage.ts'

/** How wide a face comes out. Two device pixels on a 140 px panel, and no more than that is ever seen. */
const SIZE = 288

/**
 * How much is in shot, as a share of a head's own height.
 *
 * Well over one: a head cropped at the neck is a passport photograph, and what
 * reads as somebody standing in front of you is the head with the shoulders and
 * the tops of the arms under it. Three heads of frame is about that.
 */
const MARGIN = 3

/** A head, as a share of the whole body's height. */
const HEAD = 0.13

/**
 * How far below the head the shot is centred, in heads. The head is at the top
 * of what is in frame rather than the middle of it, because what is under it is
 * shoulders and what is over it is air.
 */
const DROP = 0.75

/** A narrow lens, so the camera stands well back and a portrait does not bend the nose out towards it. */
const LENS = 22

/** Where a face comes from, as whoever needs one sees it. */
export interface FaceSource {
  /** This person's face as an image source, or nothing where one cannot be drawn. */
  of(npc: Npc): Promise<string | undefined>
  /** One already drawn, without drawing anything. */
  drawn(npcId: string): string | undefined
}

/**
 * A face for each person, drawn from the body the game would draw them with.
 *
 * The person is spawned again into a scene of this box's own rather than
 * borrowed out of the city: the one standing in the street is mid-clip, lit by
 * whatever hour it is and facing wherever they were walking, and taking a
 * portrait off it would mean moving them out of the world for a frame. A second
 * copy costs one body build, once per person, and it comes out the same on every
 * machine: the first frame of the same clip under the same two lights.
 *
 * A face is kept once it is drawn: a conversation reopened is the same face
 * without a second build, and one that could not be drawn is remembered as
 * such, so a machine with no GPU behind it is not asked twice.
 */
export class Portraits implements FaceSource {
  #cast: Cast
  #stage: Stage
  #scene = new THREE.Scene()
  #camera = new THREE.PerspectiveCamera(LENS, 1, 0.01, 10)
  #drawn = new Map<string, string | undefined>()
  #drawing = new Map<string, Promise<string | undefined>>()

  constructor(input: { cast: Cast; stage: Stage }) {
    this.#cast = input.cast
    this.#stage = input.stage
    // A face has to read on a dark panel, so it is lit from the front and above
    // with a fill from below: the same two lights for everybody, so nobody is
    // in shadow because of the hour they happened to be talked to at.
    const key = new THREE.DirectionalLight(0xfff4e2, 3)
    key.position.set(-0.6, 1.2, -2)
    const fill = new THREE.DirectionalLight(0xbfd8ea, 1.1)
    fill.position.set(0.8, -0.4, -1.4)
    this.#scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.35))
  }

  /**
   * A face already drawn, without drawing one. The codex asks this way: it
   * lists people the player has talked to, so their face was drawn when they
   * spoke, and a panel of names must not start a render each time it opens.
   */
  drawn(npcId: string): string | undefined {
    return this.#drawn.get(npcId)
  }

  /** This person's face, drawn if it has not been drawn yet. Nothing at all where it cannot be drawn. */
  async of(npc: Npc): Promise<string | undefined> {
    const done = this.#drawn.get(npc.id)
    if (done !== undefined || this.#drawn.has(npc.id)) return done
    const already = this.#drawing.get(npc.id)
    if (already) return already
    const drawing = this.#draw(npc).finally(() => this.#drawing.delete(npc.id))
    this.#drawing.set(npc.id, drawing)
    return drawing
  }

  async #draw(npc: Npc): Promise<string | undefined> {
    let member
    try {
      member = this.#cast.spawn(npc)
    } catch (cause) {
      console.warn(`no portrait for ${npc.id}`, cause)
      this.#drawn.set(npc.id, undefined)
      return undefined
    }
    const body = member.object
    try {
      this.#scene.add(body)
      // a body spawns with its clip playing but its skeleton still in the bind
      // pose, which is arms straight out at shoulder height. One step of no time
      // writes the first frame of what they are doing, so they stand like a person
      this.#cast.update(0)
      body.updateMatrixWorld(true)
      this.#aim(body)
      const face = await this.#stage.snapshot(this.#scene, this.#camera, SIZE)
      this.#drawn.set(npc.id, face)
      return face
    } finally {
      // Taking the copy out of this scene is all there is to give back. It owns
      // its bones and its mixer, which cost no GPU; everything drawable under it
      // is the cast's, shared by every clone of that outfit, so disposing any of
      // it takes the buffers away from the people wearing it out in the city.
      this.#scene.remove(body)
    }
  }

  /**
   * Put the camera in front of the face. The head is the bone the rig calls
   * one; without it the top of the body is taken instead, which is the same
   * place on a person standing up.
   */
  #aim(body: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(body)
    const head = headBone(body)
    const at = new THREE.Vector3()
    if (head) head.getWorldPosition(at)
    else box.getCenter(at).setY(box.max.y - (box.max.y - box.min.y) * 0.07)
    // the head bone sits about at the ears, so the shot is raised a little to
    // where the face is, then dropped to put the shoulders in under it
    const height = (box.max.y - box.min.y) * HEAD
    at.y += height * 0.35 - height * DROP

    // far enough back that `MARGIN` heads of frame fit at the face's distance,
    // at a lens narrow enough not to bend the face. The lens is the whole angle
    // and the frame is the whole height, so both are halved to make the triangle.
    const away = (height * MARGIN) / (2 * Math.tan(((LENS / 2) * Math.PI) / 180))
    // A body spawns facing -Z, so the camera stands on -Z: in front of them.
    // Standing on +Z is standing behind them, which is a portrait of the back
    // of somebody's head.
    this.#camera.position.set(at.x, at.y, at.z - away)
    this.#camera.lookAt(at)
    this.#camera.updateProjectionMatrix()
  }
}

/** The head, as the canonical rig names it. */
function headBone(body: THREE.Object3D): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined
  body.traverse((child) => {
    if (!found && (child as THREE.Bone).isBone && /^head$/i.test(child.name)) found = child
  })
  return found
}
