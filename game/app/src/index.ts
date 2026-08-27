/** @gb/app: see CONTRACT.md. */
export { Boot, type Playing, type Show, type Start } from './boot/boot.ts'
export {
  BLOCKS,
  DEFAULTS,
  STYLE,
  briefFromQuery,
  briefToQuery,
  clampBlocks,
  freshSeed,
  sameBrief,
  tidy,
  type CityBrief,
} from './boot/brief.ts'
export { CityMaker, type City, type Made, type Progress } from './boot/city-maker.ts'
export { download, exportName } from './boot/export.ts'
export { IndexedShelf } from './boot/indexed-shelf.ts'
export { localSaves } from './boot/kept.ts'
export { Library, MemoryShelf, briefOf, keyOf, type Shelf, type Shelved } from './boot/library.ts'
export { type OnTheShelf } from './boot/library-view.ts'
export { Panel, type Opened, type PanelFace, type PanelHandlers } from './boot/panel.ts'
export { Game, type GameOptions } from './game.ts'
export { loadCars, loadDressing } from './pack.ts'
export { Session, type SaveStore } from './session.ts'
export { pick, type Target, type TargetKind } from './targets.ts'
