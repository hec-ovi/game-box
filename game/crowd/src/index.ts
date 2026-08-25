/** @gb/crowd: pedestrians who walk the city. See CONTRACT.md. */
export { type Attention } from './attention.ts'
export { Crowd, type CrowdDeps } from './crowd.ts'
export { Leash } from './leash.ts'
export { CROWD_DEFAULTS, type CrowdOptions } from './options.ts'
export { STRANGERS } from './people.ts'
export { SceneCast, type CastSpawner } from './scene-cast.ts'
export type {
  Cell,
  Companion,
  CrowdActor,
  CrowdCast,
  CrowdGround,
  CrowdNav,
  CrowdPeople,
  Destination,
  Footprint,
  Hazard,
  Hazards,
  Point,
  WalkerState,
  WalkerView,
} from './ports.ts'
