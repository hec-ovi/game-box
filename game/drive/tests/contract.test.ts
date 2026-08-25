import { describe, expect, it } from 'vitest'
import { METRICS } from '@gb/world'
import {
  CHASE_VIEW,
  CITY_CAR,
  CrowdRiders,
  Driver,
  Driving,
  DRIVING_CLIP,
  DRIVER,
  EYE_HEIGHT,
  type DriveGround,
  type DriveSolid,
} from '../src/index.ts'
import {
  FakeBodies,
  FakeCrowd,
  FakeRider,
  FakeRiders,
  FakeTraffic,
  OPEN,
  wallAt,
  type FakeCar,
} from './harness.ts'

const STEP = 1 / 60

function aTaxi(over: Partial<FakeCar> = {}): FakeCar {
  return { id: 'car_1', model: 'Taxi', x: 0, z: 0, heading: 0, speed: 0, ...over }
}

/** Run a car for a while and say where it ended up. */
function drive(driver: Driver, seconds: number, throttle: number, steer: number) {
  let x = 0
  let z = 0
  for (let t = 0; t < seconds; t += STEP) {
    const move = driver.step(STEP, throttle, steer)
    x += move.x
    z += move.z
  }
  return { x, z }
}

describe('driving a car', () => {
  it('pulls away, holds a top speed and rolls to a stop when the keys are let go', () => {
    const driver = new Driver()
    drive(driver, 1, 1, 0)
    expect(driver.speed).toBeGreaterThan(3)
    expect(driver.speed).toBeLessThan(CITY_CAR.acceleration * 1.2)

    drive(driver, 20, 1, 0)
    expect(driver.speed).toBeCloseTo(CITY_CAR.topSpeed, 1)

    // the decay branch: nothing held brings it all the way to a stand, not to a crawl
    drive(driver, 20, 0, 0)
    expect(driver.speed).toBe(0)
  })

  it('goes forwards down +Z at heading zero, and backwards more slowly', () => {
    const forwards = new Driver()
    const went = drive(forwards, 2, 1, 0)
    expect(went.z).toBeGreaterThan(5)
    expect(Math.abs(went.x)).toBeLessThan(1e-9)

    const back = new Driver()
    drive(back, 20, -1, 0)
    expect(back.speed).toBeCloseTo(-CITY_CAR.reverseSpeed, 5)
  })

  it('turns with the distance it covers, so a parked car does not spin', () => {
    const parked = new Driver()
    drive(parked, 2, 0, 1)
    expect(parked.wheel).toBeCloseTo(CITY_CAR.wheelLock, 5)
    expect(parked.orientation).toBe(0)

    // the same key held, twice the speed: more turn in the same second, even
    // though the faster car is given less of the wheel to do it with
    const slow = turning(4)
    const fast = turning(8)
    expect(fast.wheel).toBeLessThan(slow.wheel)
    expect(fast.orientation / slow.orientation).toBeGreaterThan(1.3)
  })

  it('gives less lock the faster it goes, so speed cannot be spun on the spot', () => {
    const crawling = new Driver()
    crawling.aim(0, 1)
    expect(crawling.lock).toBeGreaterThan(CITY_CAR.wheelLock * 0.9)

    const flatOut = new Driver()
    flatOut.aim(0, CITY_CAR.topSpeed)
    expect(flatOut.lock).toBeCloseTo(CITY_CAR.wheelLock * CITY_CAR.lockAtSpeed, 5)

    // and a wheel already round unwinds as the car picks up speed
    const away = new Driver()
    away.wheel = CITY_CAR.wheelLock
    drive(away, 4, 1, 1)
    // one frame behind the room, which is the room the speed it had last frame allowed
    expect(away.wheel).toBeCloseTo(away.lock, 2)
  })

  it('comes round inside a junction at a crawl, and takes a lane at speed', () => {
    // a junction between two six metre roadways is the tightest turn in town
    expect(radiusAt(3)).toBeLessThan(7)
    expect(radiusAt(3)).toBeGreaterThan(4)
    // flat out the same key is a lane change, not a handbrake turn
    expect(radiusAt(CITY_CAR.topSpeed)).toBeGreaterThan(20)
    // and above walking pace the sideways pull levels off, the way a tyre's does
    const pull = (speed: number) => speed ** 2 / radiusAt(speed)
    expect(pull(CITY_CAR.topSpeed) / pull(10)).toBeLessThan(1.5)
    expect(pull(CITY_CAR.topSpeed) / pull(10)).toBeGreaterThan(0.7)
  })

  it('leans into a corner and stands up on the straight', () => {
    const driver = new Driver()
    driver.aim(0, 15)
    driver.wheel = CITY_CAR.wheelLock
    driver.step(STEP, 1, 1)
    expect(driver.roll).toBeGreaterThan(0.01)
    driver.wheel = 0
    driver.step(STEP, 1, 0)
    expect(driver.roll).toBe(0)
  })
})

/** A car held at one speed with the wheel hard over for half a second. */
function turning(speed: number) {
  const driver = new Driver()
  driver.aim(0, speed)
  driver.wheel = CITY_CAR.wheelLock
  for (let t = 0; t < 0.5; t += STEP) driver.step(STEP, 0, 1)
  return driver
}

/** The radius of the circle a car held at this speed on full lock drives round. */
function radiusAt(speed: number): number {
  const driver = new Driver()
  driver.aim(0, speed)
  let turned = 0
  let travelled = 0
  while (turned < Math.PI / 2 && travelled < 400) {
    const was = driver.orientation
    driver.speed = speed
    const move = driver.step(STEP, 0, 1)
    driver.speed = speed
    turned += driver.orientation - was
    travelled += Math.hypot(move.x, move.z)
  }
  return travelled / (Math.PI / 2)
}

describe('getting in and out', () => {
  function standing(at: { x: number; z: number }, cars: FakeCar[]) {
    const rider = new FakeRider()
    rider.x = at.x
    rider.z = at.z
    const traffic = new FakeTraffic(cars)
    const bodies = new FakeBodies()
    const driving = new Driving({ rider, traffic, bodies, solid: OPEN })
    return { rider, traffic, bodies, driving }
  }

  it('offers the car you are standing beside, by name, and nothing further off', () => {
    const near = standing({ x: 1.6, z: 0 }, [aTaxi()])
    expect(near.driving.target()).toMatchObject({ kind: 'drive', id: 'car_1', label: 'Get in the taxi' })

    const far = standing({ x: 9, z: 0 }, [aTaxi()])
    expect(far.driving.target()).toBeUndefined()
  })

  it('reaches for the bodywork rather than the middle, so a long car is reachable end on', () => {
    // three metres down the road from the middle is past `interactRange`, but
    // it is under a metre from the nose
    const endOn = standing({ x: 0, z: 3 }, [aTaxi()])
    expect(endOn.driving.target()?.id).toBe('car_1')
    expect(METRICS.player.interactRange).toBeLessThan(3)
  })

  it('takes the car off the road, seats the player and hands it back on the way out', () => {
    const { rider, traffic, bodies, driving } = standing({ x: 1.6, z: 0 }, [aTaxi()])

    driving.act()
    expect(driving.aboard).toBe(true)
    expect(traffic.handedOver).toEqual(['car_1'])
    expect(traffic.cars()).toHaveLength(0)
    expect(bodies.live.size).toBe(1)

    // sitting behind the wheel: to the left of the middle and a head above the road
    expect(rider.seat?.x).toBeCloseTo(DRIVER.side, 5)
    expect(rider.seat?.z).toBeCloseTo(DRIVER.along, 5)
    expect(rider.seat?.y).toBeCloseTo(EYE_HEIGHT, 5)

    expect(driving.target()).toMatchObject({ label: 'Get out' })

    driving.act()
    expect(driving.aboard).toBe(false)
    expect(rider.seat).toBeUndefined()
    // standing beside the car, not inside it
    expect(Math.abs(rider.x)).toBeGreaterThan(METRICS.vehicle.carWidth / 2)
    expect(rider.facing).toBeCloseTo(Math.PI, 5)
    // and it is still there to get back into
    expect(driving.target()).toMatchObject({ label: 'Get in the taxi' })
  })

  it('turns the view to the windscreen when the player gets in', () => {
    const { rider, driving } = standing({ x: 1.6, z: 0 }, [aTaxi()])
    // looking the other way entirely as they open the door
    rider.heading = 0
    driving.act()
    // they are looking the way the car's nose points, whichever turn of the
    // circle that heading lands on
    expect(-Math.sin(rider.heading)).toBeCloseTo(Math.sin(0), 5)
    expect(-Math.cos(rider.heading)).toBeCloseTo(Math.cos(0), 5)
  })

  it('gets out on the far side when the driver door is against a wall', () => {
    const rider = new FakeRider()
    rider.x = 0
    rider.z = 0
    const traffic = new FakeTraffic([aTaxi()])
    // the car faces +Z, so its left hand door opens onto +X: put a wall there
    const solid = (x: number) => x > 1
    const driving = new Driving({ rider, traffic, solid })
    driving.act()
    driving.act()
    expect(rider.x).toBeLessThan(-1)
  })

  it('drives the car the player is holding and leaves it where they stopped', () => {
    const { rider, driving } = standing({ x: 1.6, z: 0 }, [aTaxi()])
    driving.act()
    rider.press({ forward: 1 })
    for (let t = 0; t < 2; t += STEP) driving.update(STEP)

    expect(driving.car!.z).toBeGreaterThan(4)
    expect(driving.car!.speed).toBeGreaterThan(3)
    driving.act()
    const parked = driving.car!.z
    for (let t = 0; t < 2; t += STEP) driving.update(STEP)
    expect(driving.car!.z).toBe(parked)
    expect(driving.car!.speed).toBe(0)
  })

  it('will not drive through a building', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const traffic = new FakeTraffic([aTaxi()])
    const driving = new Driving({ rider, traffic, solid: wallAt(10) })
    driving.act()
    rider.press({ forward: 1 })
    for (let t = 0; t < 10; t += STEP) driving.update(STEP)

    // the nose stops at the wall, and the car is still on this side of it
    expect(driving.car!.z).toBeLessThan(10 - METRICS.vehicle.carLength / 2)
    expect(driving.car!.z).toBeGreaterThan(4)
  })

  it('never comes to rest with a corner inside a wall', () => {
    // running down a wall two thirds of a car's width away, wheel turned into it
    const wall = 1.2
    const rider = new FakeRider()
    rider.x = -1.6
    const traffic = new FakeTraffic([aTaxi()])
    const driving = new Driving({ rider, traffic, solid: (x) => x >= wall })
    driving.act()
    rider.press({ forward: 1, strafe: -1 })
    for (let t = 0; t < 3; t += STEP) driving.update(STEP)

    const car = driving.car!
    const half = METRICS.vehicle
    const corner =
      Math.abs(Math.cos(car.heading)) * (half.carWidth / 2) + Math.abs(Math.sin(car.heading)) * (half.carLength / 2)
    expect(car.x + corner).toBeLessThanOrEqual(wall)
    // and it did drive somewhere rather than being held at the start line
    expect(car.z).toBeGreaterThan(2)
  })

  it('backs out of somewhere it should never have been', () => {
    // parked, and then the ground under its back half turns solid
    let wall: (x: number, z: number) => boolean = () => false
    const rider = new FakeRider()
    rider.x = 1.6
    const driving = new Driving({ rider, traffic: new FakeTraffic([aTaxi()]), solid: (x, z) => wall(x, z) })
    driving.act()
    wall = (_x, z) => z <= -1

    rider.press({ forward: 1 })
    for (let t = 0; t < 3; t += STEP) driving.update(STEP)
    // it drives out rather than being held there for good
    expect(driving.car!.z).toBeGreaterThan(3)
  })

  it('has nothing to offer with no traffic to take a car from, until it turns up', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const driving = new Driving({ rider, solid: OPEN })
    expect(driving.target()).toBeUndefined()
    driving.act()
    expect(driving.aboard).toBe(false)

    // the art loads a moment after the city is on screen
    const bodies = new FakeBodies()
    driving.open(new FakeTraffic([aTaxi()]), bodies)
    expect(driving.target()).toMatchObject({ label: 'Get in the taxi' })
    driving.act()
    expect(driving.aboard).toBe(true)
    expect(bodies.live.size).toBe(1)
  })

  it('offers nothing while the player is inside a building', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const driving = new Driving({ rider, traffic: new FakeTraffic([aTaxi()]), solid: OPEN, outdoors: () => false })
    expect(driving.target()).toBeUndefined()
  })
})

describe('what the rest of the city sees', () => {
  it('is solid to walk into when it is standing empty, and not while you are in it', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const driving = new Driving({ rider, traffic: new FakeTraffic([aTaxi()]), solid: OPEN })
    expect(driving.rolling()).toHaveLength(0)

    driving.act()
    expect(driving.rolling()).toHaveLength(0)
    driving.act()
    expect(driving.rolling()).toHaveLength(1)
    expect(driving.rolling()[0]!.heading).toBe(0)
  })

  it('is a run of patches down the road that a driver behind can brake for', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const driving = new Driving({ rider, traffic: new FakeTraffic([aTaxi()]), solid: OPEN })
    driving.act()

    const patches = driving.inTheRoad()
    expect(patches.length).toBeGreaterThan(1)
    const nose = Math.max(...patches.map((patch) => patch.z + patch.radius))
    const tail = Math.min(...patches.map((patch) => patch.z - patch.radius))
    expect(nose).toBeCloseTo(METRICS.vehicle.carLength / 2, 5)
    expect(tail).toBeCloseTo(-METRICS.vehicle.carLength / 2, 5)
    // and none of them spills into the far lane
    for (const patch of patches) expect(patch.radius).toBeLessThanOrEqual(METRICS.vehicle.carWidth / 2)
  })

  it('reports nothing at all when the player has no car', () => {
    const driving = new Driving({ rider: new FakeRider(), solid: OPEN })
    expect(driving.rolling()).toEqual([])
    expect(driving.inTheRoad()).toEqual([])
  })
})

describe('the companions ride with you', () => {
  function withCompanions(following: string[]) {
    const rider = new FakeRider()
    rider.x = 1.6
    const riders = new FakeRiders(following)
    const traffic = new FakeTraffic([aTaxi()])
    const driving = new Driving({ rider, traffic, riders, solid: OPEN })
    return { rider, riders, driving }
  }

  it('takes them out of the crowd, seats them in the car and drives them along', () => {
    const { rider, riders, driving } = withCompanions(['npc_1', 'npc_2'])
    driving.act()

    expect(driving.passengers()).toEqual(['npc_1', 'npc_2'])
    expect(riders.waiting()).toEqual([])
    const first = riders.bodies.get('npc_1')!
    expect(first.clip).toBe(DRIVING_CLIP)
    // in the car, not on top of the driver
    expect(Math.hypot(first.x - rider.x, first.z - rider.z)).toBeLessThan(2)
    expect(Math.hypot(first.x - rider.x, first.z - rider.z)).toBeGreaterThan(0.1)

    rider.press({ forward: 1 })
    for (let t = 0; t < 2; t += STEP) driving.update(STEP)
    expect(first.z).toBeGreaterThan(3)
    expect(Math.abs(first.z - driving.car!.z)).toBeLessThan(2)
  })

  it('puts them back on the pavement beside the car, one door each', () => {
    const { riders, driving } = withCompanions(['npc_1', 'npc_2'])
    driving.act()
    driving.act()

    expect(driving.passengers()).toEqual([])
    expect(riders.bodies.get('npc_1')!.released).toBe(true)
    expect(riders.waiting().toSorted()).toEqual(['npc_1', 'npc_2'])
    expect(riders.putBack).toHaveLength(2)
    const [first, second] = riders.putBack
    expect(Math.hypot(first!.x - second!.x, first!.z - second!.z)).toBeGreaterThan(0.8)
    for (const spot of riders.putBack) {
      expect(Math.hypot(spot.x - driving.car!.x, spot.z - driving.car!.z)).toBeLessThan(4)
    }
  })

  it('seats as many as there are seats and leaves the rest walking', () => {
    const { riders, driving } = withCompanions(['a', 'b', 'c', 'd', 'e'])
    driving.act()
    expect(driving.passengers()).toHaveLength(3)
    expect(riders.waiting()).toEqual(['d', 'e'])
  })

  it('drives alone when nobody is following', () => {
    const { driving } = withCompanions([])
    driving.act()
    expect(driving.passengers()).toEqual([])
  })

  it('reads the crowd through CrowdRiders: out of it to ride, back into it to walk', () => {
    const crowd = new FakeCrowd(['npc_1'])
    const riders = new CrowdRiders({ crowd, cast: crowd })

    expect(riders.waiting()).toEqual(['npc_1'])
    expect(riders.pickUp('npc_1')).toBeDefined()
    // out of the crowd, so they are not walking the pavement and sitting at once
    expect(riders.waiting()).toEqual([])
    expect(crowd.spawned).toEqual(['npc_1'])

    riders.putDown('npc_1', 4, 5)
    expect(riders.waiting()).toEqual(['npc_1'])
    expect(crowd.resumed).toEqual([{ npcId: 'npc_1', x: 4, z: 5 }])

    expect(riders.pickUp('nobody')).toBeUndefined()
  })
})

describe('the view from behind the car', () => {
  /** Standing beside a taxi at the origin, nose down +Z, and getting in. */
  function driving(over: { ground?: DriveGround; walls?: DriveSolid } = {}) {
    const rider = new FakeRider()
    rider.x = 1.6
    const drive = new Driving({
      rider,
      traffic: new FakeTraffic([aTaxi()]),
      solid: OPEN,
      ...(over.ground ? { ground: over.ground } : {}),
      ...(over.walls ? { walls: over.walls } : {}),
    })
    drive.act()
    return { rider, drive }
  }

  function run(drive: Driving, seconds: number) {
    for (let t = 0; t < seconds; t += STEP) drive.update(STEP)
  }

  /** Which way the view is trailing the car from, in the car's own convention. */
  function trail(drive: Driving): number {
    const view = drive.chase()!
    return Math.atan2(drive.car!.x - view.eye.x, drive.car!.z - view.eye.z)
  }

  /** How far the trail is behind where the car is pointing now, radians. */
  function lag(drive: Driving): number {
    const behind = trail(drive) - drive.car!.heading
    return Math.abs(behind - Math.PI * 2 * Math.round(behind / (Math.PI * 2)))
  }

  it('sits behind and above the car and looks at it, standing still', () => {
    const { drive } = driving()
    run(drive, 1)

    const view = drive.chase()!
    // the nose points down +Z, so the view is back down -Z, square behind it
    expect(view.eye.z).toBeCloseTo(-CHASE_VIEW.back, 5)
    expect(view.eye.x).toBeCloseTo(0, 5)
    expect(view.eye.y).toBeCloseTo(CHASE_VIEW.height, 5)
    expect(view.distance).toBeCloseTo(CHASE_VIEW.back, 5)
    // and it looks at the car, not off down the street
    expect(view.at.x).toBeCloseTo(0, 5)
    expect(view.at.z).toBeCloseTo(0, 5)
    expect(view.at.y).toBeCloseTo(CHASE_VIEW.aim, 5)
  })

  it('eases round a corner rather than whipping the tail across', () => {
    const { rider, drive } = driving()
    rider.press({ forward: 1 })
    run(drive, 1)
    expect(lag(drive)).toBeLessThan(0.01)

    // half a second of hard lock: the view is still coming round
    rider.press({ forward: 1, strafe: 1 })
    run(drive, 0.5)
    expect(drive.car!.heading).not.toBeCloseTo(0, 2)
    expect(lag(drive)).toBeGreaterThan(0.1)

    // and it catches up once the car is straight again
    rider.press({ forward: 1 })
    run(drive, 3)
    expect(lag(drive)).toBeLessThan(0.01)
  })

  it('pulls back as the speed comes up and settles in again at a stand', () => {
    const { rider, drive } = driving()
    rider.press({ forward: 1 })
    run(drive, 10)
    expect(drive.car!.speed).toBeCloseTo(CITY_CAR.topSpeed, 1)
    expect(drive.chase()!.distance).toBeCloseTo(CHASE_VIEW.back + CHASE_VIEW.stretch, 1)

    rider.press({})
    run(drive, 20)
    expect(drive.car!.speed).toBe(0)
    expect(drive.chase()!.distance).toBeCloseTo(CHASE_VIEW.back, 2)
  })

  it('keeps the car in frame up a slope, and stays out of the road down one', () => {
    const rise: DriveGround = (_x, z) => Math.max(0, z) * 0.15
    const up = driving({ ground: rise })
    up.rider.press({ forward: 1 })
    for (let t = 0; t < 6; t += STEP) {
      up.drive.update(STEP)
      const view = up.drive.chase()!
      expect(view.eye.y).toBeGreaterThanOrEqual(rise(view.eye.x, view.eye.z) + CHASE_VIEW.clearance - 1e-9)
    }
    // the view climbed with the car and is still aimed at its roof line,
    // trailing the ground by no more than the settle time allows
    const climbed = up.drive.chase()!
    const under = rise(up.drive.car!.x, up.drive.car!.z)
    expect(climbed.eye.y).toBeGreaterThan(CHASE_VIEW.height + 1)
    expect(climbed.at.y).toBeLessThanOrEqual(under + CHASE_VIEW.aim)
    expect(climbed.at.y).toBeGreaterThan(under + CHASE_VIEW.aim - 0.6)

    // the same slope the other way: the view is on the crest behind, above the road
    const fall: DriveGround = (_x, z) => -Math.max(0, z) * 0.15
    const down = driving({ ground: fall })
    down.rider.press({ forward: 1 })
    for (let t = 0; t < 6; t += STEP) {
      down.drive.update(STEP)
      const view = down.drive.chase()!
      expect(view.eye.y).toBeGreaterThanOrEqual(fall(view.eye.x, view.eye.z) + CHASE_VIEW.clearance - 1e-9)
    }
    // held up by the crest it is standing on, looking down at the car below
    expect(down.drive.chase()!.eye.y).toBeGreaterThan(down.drive.chase()!.at.y)
  })

  it('pulls in rather than sitting inside the building behind it', () => {
    const wall: DriveSolid = (_x, z) => z <= -5
    const { drive } = driving({ walls: wall })
    run(drive, 1)

    const view = drive.chase()!
    expect(view.distance).toBeLessThan(CHASE_VIEW.back)
    expect(view.distance).toBeGreaterThanOrEqual(CHASE_VIEW.closest)
    expect(wall(view.eye.x, view.eye.z)).toBe(false)

    // backed right up to it, the view is at the nearest it goes and no nearer
    const tight = driving({ walls: (_x, z) => z <= -2 })
    run(tight.drive, 1)
    expect(tight.drive.chase()!.distance).toBeCloseTo(CHASE_VIEW.closest, 5)
  })

  it('holds the settled distance in reverse and stays behind the nose', () => {
    const { rider, drive } = driving()
    rider.press({ forward: -1 })
    run(drive, 3)

    expect(drive.car!.speed).toBeCloseTo(-CITY_CAR.reverseSpeed, 1)
    expect(drive.chase()!.distance).toBeCloseTo(CHASE_VIEW.back, 2)
    // the car is backing towards the view, which has not swung round to lead it
    expect(drive.chase()!.eye.z).toBeLessThan(drive.car!.z)
    expect(lag(drive)).toBeLessThan(0.01)
  })

  it('keeps the seat view for whoever asks for it back', () => {
    const { rider, drive } = driving()
    expect(drive.view).toBe('chase')
    run(drive, 1)
    expect(drive.chase()).toBeDefined()
    // the player is in the seat either way: only the camera moves
    expect(rider.seat).toBeDefined()

    expect(drive.switchView()).toBe('seat')
    run(drive, 1)
    expect(drive.chase()).toBeUndefined()
    expect(rider.seat?.y).toBeCloseTo(EYE_HEIGHT, 5)

    expect(drive.switchView()).toBe('chase')
    expect(drive.chase()!.distance).toBeCloseTo(CHASE_VIEW.back, 5)
  })

  it('has no view to place while the player is on foot', () => {
    const rider = new FakeRider()
    rider.x = 1.6
    const drive = new Driving({ rider, traffic: new FakeTraffic([aTaxi()]), solid: OPEN })
    expect(drive.chase()).toBeUndefined()

    drive.act()
    expect(drive.chase()).toBeDefined()
    drive.act()
    expect(drive.chase()).toBeUndefined()
  })
})
