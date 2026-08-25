import type { BuildingKind } from '@gb/world'
import type { RoomPlan } from '../room-plan.ts'
import type { RoomRole } from '../recipes.ts'
import { cafeFloor, diningRoom, taproom } from './hospitality.ts'
import { bathroom, bedroom, guestRoom, kitchen, livingRoom } from './home.ts'
import { marketHall, shopFloor } from './retail.ts'
import { concourse, lobby, nave, treatmentRoom, waitingRoom } from './civic.ts'
import { entranceHall, storeRoom } from './service.ts'
import { openOffice, privateOffice, warehouseFloor, workshopFloor } from './work.ts'

/** What the town asks of its rooms beyond what the building kind says. */
export interface RoomWants {
  /** The town's story calls for dancing, so a taproom gets a floor for it. */
  readonly dancing: boolean
}

/** Fills one room with what its building, its own kind and the town call for. */
export function furnishRoom(plan: RoomPlan, building: BuildingKind, role: RoomRole, wants: RoomWants): void {
  switch (plan.room.kind) {
    case 'bedroom':
      return building === 'hotel' ? guestRoom(plan) : bedroom(plan)
    case 'kitchen':
      return kitchen(plan)
    case 'bathroom':
      return bathroom(plan)
    case 'office':
      return privateOffice(plan)
    case 'storage':
    case 'backroom':
    case 'cellar':
      return building === 'warehouse' && role === 'main' ? warehouseFloor(plan) : storeRoom(plan)
    case 'hall':
      return hallRoom(plan, building)
    case 'main':
      return mainRoom(plan, building, wants)
  }
}

function hallRoom(plan: RoomPlan, building: BuildingKind): void {
  switch (building) {
    case 'station':
      return concourse(plan)
    case 'clinic':
    case 'office':
      return waitingRoom(plan)
    case 'hotel':
      return lobby(plan)
    default:
      return entranceHall(plan)
  }
}

function mainRoom(plan: RoomPlan, building: BuildingKind, wants: RoomWants): void {
  switch (building) {
    case 'bar':
      return taproom(plan, wants)
    case 'cafe':
      return cafeFloor(plan)
    case 'restaurant':
      return diningRoom(plan)
    case 'shop':
      return shopFloor(plan)
    case 'market':
      return marketHall(plan)
    case 'office':
      return openOffice(plan)
    case 'workshop':
      return workshopFloor(plan)
    case 'clinic':
      return treatmentRoom(plan)
    case 'chapel':
      return nave(plan)
    default:
      return livingRoom(plan)
  }
}
