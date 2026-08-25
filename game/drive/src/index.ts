/** @gb/drive: the car the player drives. See CONTRACT.md. */
export { Driving, nearestOn, type DrivingDeps } from './driving.ts'
export { CITY_CAR, Driver, type Handling } from './handling.ts'
export { CrowdRiders } from './riders.ts'
export { DRIVING_CLIP } from './cabin.ts'
export { DRIVER, EYE_HEIGHT, PASSENGERS } from './seats.ts'
export type {
  Blocking,
  CarHandover,
  DriveBodies,
  DriveBody,
  DriveGround,
  DriveSolid,
  DriveTarget,
  Point,
  Rider,
  RiderBody,
  RiderCast,
  RiderCrowd,
  Riders,
  RoadTraffic,
  Moving,
  Rolling,
  Seat,
} from './ports.ts'
