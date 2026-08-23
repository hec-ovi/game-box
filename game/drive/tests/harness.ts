import type { Npc } from '@gb/world'
import type {
  CarHandover,
  DriveBodies,
  DriveBody,
  DriveSolid,
  Rider,
  RiderBody,
  Riders,
  RoadTraffic,
  Rolling,
  Seat,
} from '../src/index.ts'

/** A car on the road, for the traffic to hand over. */
export interface FakeCar extends Rolling {
  id: string
  model: string
  speed: number
}

export class FakeTraffic implements RoadTraffic {
  readonly on: FakeCar[]
  readonly handedOver: string[] = []

  constructor(cars: FakeCar[]) {
    this.on = cars
  }

  cars(): readonly FakeCar[] {
    return this.on
  }

  handOver(carId: string): CarHandover | undefined {
    const index = this.on.findIndex((car) => car.id === carId)
    if (index < 0) return undefined
    const [car] = this.on.splice(index, 1)
    this.handedOver.push(carId)
    return { id: car!.id, model: car!.model, x: car!.x, z: car!.z, heading: car!.heading, speed: car!.speed }
  }
}

/** The player: where they stand, what they are pressing, where they were put. */
export class FakeRider implements Rider {
  x = 0
  z = 0
  facing = 0
  heading = 0
  input = { forward: 0, strafe: 0, running: false }
  seat: Seat | undefined
  /** Every seat and every stand, in order, so a test can see the handover. */
  readonly log: string[] = []

  get position(): { x: number; z: number } {
    return { x: this.x, z: this.z }
  }

  ride(seat: Seat | undefined): void {
    this.seat = seat
    if (!seat) {
      this.log.push('walking')
      return
    }
    this.x = seat.x
    this.z = seat.z
    this.heading += seat.turned
    this.log.push('riding')
  }

  placeAt(x: number, z: number, facing: number): void {
    this.x = x
    this.z = z
    this.facing = facing
    this.heading = facing
    this.log.push(`stand ${x.toFixed(2)},${z.toFixed(2)}`)
  }

  press(keys: Partial<{ forward: number; strafe: number }>): void {
    this.input = { forward: 0, strafe: 0, running: false, ...keys }
  }
}

/** One companion body, recording where it was put and what it played. */
export class FakeBody implements RiderBody {
  x = 0
  y = 0
  z = 0
  heading = 0
  clip = ''
  released = false

  placeAt(x: number, y: number, z: number): void {
    this.x = x
    this.y = y
    this.z = z
  }

  faceTo(heading: number): void {
    this.heading = heading
  }

  play(clip: string): void {
    this.clip = clip
  }

  release(): void {
    this.released = true
  }
}

/** The companions, as `Driving` reads them. */
export class FakeRiders implements Riders {
  following: string[]
  readonly bodies = new Map<string, FakeBody>()
  readonly putBack: { npcId: string; x: number; z: number }[] = []

  constructor(following: string[]) {
    this.following = following
  }

  waiting(): readonly string[] {
    return this.following
  }

  pickUp(npcId: string): RiderBody | undefined {
    if (!this.following.includes(npcId)) return undefined
    this.following = this.following.filter((id) => id !== npcId)
    const body = new FakeBody()
    this.bodies.set(npcId, body)
    return body
  }

  putDown(npcId: string, x: number, z: number): void {
    this.following.push(npcId)
    this.putBack.push({ npcId, x, z })
  }
}

/** Scene objects, pooled the way `CarPack` pools them. */
export class FakeBodies implements DriveBodies {
  readonly live = new Map<string, DriveBody>()
  readonly freed: string[] = []

  acquire(spawn: { id: string; model: string }): DriveBody {
    const body: DriveBody = { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0, z: 0 } }
    this.live.set(spawn.id, body)
    return body
  }

  release(_body: DriveBody, spawn: { id: string; model: string }): void {
    this.live.delete(spawn.id)
    this.freed.push(spawn.id)
  }
}

/** Nothing is solid. */
export const OPEN: DriveSolid = () => false

/** A wall running along z, everything past it solid. */
export function wallAt(z: number): DriveSolid {
  return (_x, at) => at >= z
}

export function someone(id: string, name = id): Npc {
  return { id, name, role: 'resident' } as unknown as Npc
}

/** A crowd, as `CrowdRiders` reads one. `@gb/crowd`'s `Crowd` answers the same. */
export class FakeCrowd {
  readonly walking: string[]
  readonly spawned: string[] = []
  readonly resumed: { npcId: string; x: number; z: number }[] = []

  constructor(walking: string[]) {
    this.walking = [...walking]
  }

  following(): readonly { readonly id: string }[] {
    return this.walking.map((id) => ({ id }))
  }

  stopFollowing(npcId: string): void {
    const at = this.walking.indexOf(npcId)
    if (at >= 0) this.walking.splice(at, 1)
  }

  follow(who: { npc: Npc; at: { x: number; z: number } }): void {
    this.walking.push(who.npc.id)
    this.resumed.push({ npcId: who.npc.id, x: who.at.x, z: who.at.z })
  }

  person(id: string): Npc | undefined {
    return this.walking.includes(id) || this.spawned.includes(id) ? someone(id) : undefined
  }

  spawn(npc: Npc): FakeBody {
    this.spawned.push(npc.id)
    return new FakeBody()
  }
}
