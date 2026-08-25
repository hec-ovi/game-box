import type { AnchorKind, Npc } from '@gb/world'
import * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { clipForAnchor, CLIPS } from './clips.ts'
import { CastError } from './error.ts'
import { Hairdresser } from './hairdresser.ts'
import { chooseLook } from './look.ts'
import { Person, type CastMember } from './member.ts'
import { Props } from './props/props.ts'
import { chooseCharacter, parseWardrobe, type Wardrobe } from './wardrobe.ts'

/**
 * A body at `rotation.y = 0` faces -Z, the way a three.js camera looks at
 * heading 0. The Quaternius art faces the other way in its own files, so a
 * spawned person is the art held at half a turn inside the object the game
 * moves; the game turns the object and the person faces where they are going.
 */
const HALF_TURN = Math.PI

export interface CastSource {
  /** The shared clip library, `anims.glb`. */
  readonly anims: ArrayBuffer
  /** `wardrobe.json` from the pack, parsed but not checked. */
  readonly wardrobe: unknown
  /** Every character file the wardrobe names, keyed by its entry id. */
  readonly characters: Readonly<Record<string, ArrayBuffer>>
}

/**
 * The people. One clip library and one dressed character per outfit are loaded
 * once, then every NPC is a clone sharing that geometry with its own skeleton
 * and its own mixer. Nothing here decides who stands where: it makes a person,
 * dresses them for the part, and plays what they are doing.
 */
export class Cast {
  /** The world these people live in. Set it before the scene is built. */
  theme = ''

  #clips = new Map<string, THREE.AnimationClip>()
  #additive = new Map<string, THREE.AnimationClip>()
  #characters = new Map<string, THREE.Object3D>()
  #wardrobe: Wardrobe = { characters: [] }
  #people: Person[] = []
  #hair = new Hairdresser()
  #props = new Props()

  private constructor() {}

  static async load(source: CastSource): Promise<Cast> {
    const cast = new Cast()
    // the shipped assets are meshopt-compressed: 29 KB of decoder against
    // three quarters off the wire size
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

    const anims = await parse(loader, source.anims, 'the clip library')
    for (const clip of anims.animations) cast.#clips.set(clip.name, clip)
    // a library with nothing in it would leave everybody in the rest pose
    if (!cast.#clips.size) throw new CastError('unreadable-asset', 'the clip library', 'no clips in it')

    cast.#wardrobe = parseWardrobe(source.wardrobe)
    for (const entry of cast.#wardrobe.characters) {
      const buffer = source.characters[entry.id]
      if (!buffer) throw new CastError('missing-character', entry.file, 'the wardrobe names it, the pack has not got it')
      const character = await parse(loader, buffer, entry.file)
      cast.#characters.set(entry.id, character.scene)
    }
    return cast
  }

  /** The dressed characters this cast can spawn, by wardrobe id. */
  characters(): readonly string[] {
    return [...this.#characters.keys()]
  }

  clips(): readonly string[] {
    return [...this.#clips.keys()]
  }

  has(clip: string): boolean {
    return this.#clips.has(clip)
  }

  /** A person, dressed and barbered for their role, at the origin facing -Z, already doing something. */
  spawn(npc: Npc, doing: string = CLIPS.idle): CastMember {
    const entry = chooseCharacter(this.#wardrobe, npc, this.theme)
    const source = this.#characters.get(entry.id)
    if (!source) throw new CastError('missing-character', entry.id, 'nothing loaded under that name')

    const body = cloneSkinned(source)
    body.rotation.y = HALF_TURN
    this.#hair.dress(body, entry, chooseLook(entry, npc.id))

    const object = new THREE.Group()
    object.name = npc.id
    object.userData.npcId = npc.id
    object.userData.outfit = entry.id
    object.add(body)

    const person = new Person(npc, object, body, entry.id, this.#clips, this.#additive, this.#props)
    this.#people.push(person)
    // never the rest pose: a clip the library has not got would leave them T-posing
    person.play(this.#standing(doing), 0)
    return person
  }

  /** What somebody asked for, or the idle, or whatever the library does have. */
  #standing(doing: string): string {
    if (this.#clips.has(doing)) return doing
    if (this.#clips.has(CLIPS.idle)) return CLIPS.idle
    return this.#clips.keys().next().value!
  }

  /**
   * What somebody stationed on this kind of anchor is doing. Hand it the NPC's
   * id and a stance with more than one clip picks one off their id, so two
   * people propped on the same wall are not the same person twice.
   */
  static doingAt(anchorKind: AnchorKind, npcId?: string): string {
    return clipForAnchor(anchorKind, npcId)
  }

  update(seconds: number): void {
    for (const person of this.#people) person.update(seconds)
  }
}

async function parse(loader: GLTFLoader, buffer: ArrayBuffer, what: string) {
  return new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
    const fail = (cause: unknown) => reject(new CastError('unreadable-asset', what, String(cause)))
    // a truncated file throws out of parse instead of reaching the callback
    try {
      loader.parse(buffer, '', (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }), fail)
    } catch (cause) {
      fail(cause)
    }
  })
}
