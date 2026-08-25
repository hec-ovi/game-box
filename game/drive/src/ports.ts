import type { Npc } from '@gb/world'

/** A place on the ground, in metres. */
export interface Point {
  readonly x: number
  readonly z: number
}

/** A place in the world: metres, Y up. */
export interface Place extends Point {
  readonly y: number
}

/** Something long lying on the ground: where it is and which way it points. */
export interface Rolling extends Point {
  /** Radians around Y for a shape whose nose points down +Z. */
  readonly heading: number
}

/** Something rolling that also says how fast: metres per second along its heading, negative in reverse. */
export interface Moving extends Rolling {
  readonly speed: number
}

/** A round patch of road something takes up. */
export interface Blocking extends Point {
  readonly radius: number
}

/** Says whether a point in metres is inside something solid. */
export type DriveSolid = (x: number, z: number) => boolean

/** How high the ground is under a point, in metres. */
export type DriveGround = (x: number, z: number) => number

/**
 * The part of a scene object this box writes to: where the car is, which way it
 * points and how far it is leaning. A three.js `Object3D` is one of these, and
 * so is a plain object in a test.
 */
export interface DriveBody {
  position: { x: number; y: number; z: number }
  rotation: { y: number; z?: number }
}

/**
 * Where car objects come from and go back to. `@gb/traffic`'s `CarPack` is one
 * already, which is how the player's car is the same art, the same material and
 * the same pool as the traffic's.
 */
export interface DriveBodies {
  acquire(spawn: { readonly id: string; readonly model: string }): DriveBody
  release(body: DriveBody, spawn: { readonly id: string; readonly model: string }): void
}

/** A car as it stood on the road the moment it stopped being the traffic's. */
export interface CarHandover extends Rolling {
  readonly id: string
  readonly model: string
  /** Metres per second it was doing. */
  readonly speed: number
}

/**
 * The cars driving themselves around. This box only ever reads which ones are
 * near and asks for one of them; a `@gb/traffic` `Traffic` is one of these.
 */
export interface RoadTraffic {
  cars(): readonly (Rolling & { readonly id: string; readonly model: string })[]
  /** Take this one off the road for good, and say what it was. */
  handOver(carId: string): CarHandover | undefined
}

/** Where the player's eye sits while they are being carried, and how it is tilted. */
export interface Seat {
  readonly x: number
  readonly y: number
  readonly z: number
  /** Radians the vehicle turned since the last frame, so the view turns with it. */
  readonly turned: number
  /** Radians of lean, about the way the eye is looking. */
  readonly roll: number
}

/**
 * The player, from the driver's side: what the movement keys say, where they
 * are standing, and where to put them. `@gb/app`'s first person body is one.
 */
export interface Rider {
  /** Metres, on the ground. */
  readonly position: Point
  /** Which way they are looking: `@gb/app`'s heading, 0 looking north (-Z). */
  readonly heading: number
  /** `forward` is W minus S, `strafe` is D minus A. */
  readonly input: { readonly forward: number; readonly strafe: number; readonly running: boolean }
  /** Sit here and turn with the car. Nothing hands walking back. */
  ride(seat: Seat | undefined): void
  /** Stand here, facing this way: `@gb/app`'s heading, 0 looking north (-Z). */
  placeAt(x: number, z: number, facing: number): void
}

/** One body sitting in a seat. A `@gb/crowd` `CrowdActor` is one. */
export interface RiderBody {
  placeAt(x: number, y: number, z: number): void
  faceTo(heading: number): void
  play(clip: string): void
  release(): void
}

/**
 * Who is walking with the player, and how to take them out of the crowd and
 * put them back. `CrowdRiders` builds one over `@gb/crowd`.
 */
export interface Riders {
  /** The npc ids of everybody following the player on foot right now. */
  waiting(): readonly string[]
  /** Take them off the pavement and give me a body to seat. */
  pickUp(npcId: string): RiderBody | undefined
  /** Put them back on the pavement here, walking with the player again. */
  putDown(npcId: string, x: number, z: number): void
}

/** The crowd, as this box reads it. A `@gb/crowd` `Crowd` is one. */
export interface RiderCrowd {
  following(): readonly { readonly id: string }[]
  stopFollowing(npcId: string): void
  follow(who: { npc: Npc; at: Point }): void
  person(id: string): Npc | undefined
}

/** Where bodies come from. A `@gb/crowd` `SceneCast` is one. */
export interface RiderCast {
  spawn(npc: Npc): RiderBody
}

/** Which view is on: from behind the car, or from the driver's seat. */
export type DriveView = 'chase' | 'seat'

/**
 * Where a camera behind the car goes this frame. This box has no renderer in
 * it: it says where the view belongs and the game puts the camera there.
 */
export interface ChaseView {
  /** Where the camera sits. */
  readonly eye: Place
  /** What it points at: the car, at its roof line. */
  readonly at: Place
  /** How far back on the ground it ended up, which is less than it wanted when something is behind. */
  readonly distance: number
}

/** What the crosshair offers: getting into the car in front of you, or getting out. */
export interface DriveTarget {
  readonly kind: 'drive'
  readonly id: string
  readonly label: string
  readonly at: Point
}
