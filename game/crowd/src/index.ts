/** @gb/crowd: pedestrians who walk the city. See CONTRACT.md. */
export { Crowd, type Companion, type CrowdDeps } from './crowd.ts'
export { CROWD_DEFAULTS, type CrowdOptions } from './options.ts'
export { SceneCast, type CastSpawner } from './scene-cast.ts'
export type {
  Cell,
  CrowdActor,
  CrowdCast,
  CrowdNav,
  Hazard,
  Hazards,
  Point,
  WalkerState,
  WalkerView,
} from './ports.ts'
