import type { RoomUse } from '@gb/world'
import type { RoomPlan } from '../room-plan.ts'
import { cafeFloor, diningRoom, taproom } from './hospitality.ts'
import { bathroom, bedroom, guestRoom, kitchen, livingRoom } from './home.ts'
import { marketHall, shopFloor } from './retail.ts'
import { assembly, concourse, lobby, waitingRoom, ward } from './civic.ts'
import { entranceHall, storeRoom } from './service.ts'
import { openOffice, privateOffice, warehouseFloor, workshopFloor } from './work.ts'

/** What the town asks of its rooms beyond what the charter says. */
export interface RoomWants {
  /** The town's story calls for dancing, so a taproom gets a floor for it. */
  readonly dancing: boolean
}

/** Fills one room with what its use calls for: one routine per value of `ROOM_USES`, and nothing keyed on a kind of place. */
export function furnishRoom(plan: RoomPlan, use: RoomUse, wants: RoomWants): void {
  switch (use) {
    case 'entrance-hall':
      return entranceHall(plan)
    case 'waiting-room':
      return waitingRoom(plan)
    case 'lobby':
      return lobby(plan)
    case 'concourse':
      return concourse(plan)
    case 'taproom':
      return taproom(plan, wants)
    case 'cafe-floor':
      return cafeFloor(plan)
    case 'dining-room':
      return diningRoom(plan)
    case 'shop-floor':
      return shopFloor(plan)
    case 'market-hall':
      return marketHall(plan)
    case 'desk-floor':
      return openOffice(plan)
    case 'private-office':
      return privateOffice(plan)
    case 'bench-floor':
      return workshopFloor(plan)
    case 'ward':
      return ward(plan)
    case 'assembly':
      return assembly(plan)
    case 'living-room':
      return livingRoom(plan)
    case 'bedroom':
      return bedroom(plan)
    case 'guest-room':
      return guestRoom(plan)
    case 'kitchen':
      return kitchen(plan)
    case 'washroom':
      return bathroom(plan)
    case 'store':
      return storeRoom(plan)
    case 'bulk-store':
      return warehouseFloor(plan)
  }
}
