import { BAR } from './bar.ts'
import { BASE } from './base.ts'
import { COMPASS } from './compass.ts'
import { CONFIRM_CSS } from './confirm.ts'
import { COUNTER } from './counter.ts'
import { FACES } from './faces.ts'
import { LOADER } from './loader.ts'
import { MAP } from './map.ts'
import { MARKS } from './marks.ts'
import { MINIMAP_CSS } from './minimap.ts'
import { MOTION } from './motion.ts'
import { NOTICES } from './notices.ts'
import { PANELS } from './panels.ts'
import { PARTS } from './parts.ts'
import { QUESTS } from './quests.ts'
import { ROW } from './row.ts'
import { SCREEN } from './screen.ts'
import { SHAPE } from './shape.ts'
import { TALK } from './talk.ts'
import { TOKENS } from './tokens.ts'
import { TYPE } from './type.ts'
import { WINDOW } from './window.ts'

/**
 * The whole look of the interface. It ships as one string because the box has
 * one public entry, so an app that bundles it cannot import a css file; it is
 * written in pieces so no one file holds more than one concern.
 *
 * The order is the cascade: the tokens, then the type, the panel language, the
 * parts, the row and the motion every surface shares, then one piece per
 * surface.
 */
export const HUD_CSS = [
  TOKENS,
  BASE,
  TYPE,
  SHAPE,
  PARTS,
  ROW,
  MOTION,
  MARKS,
  PANELS,
  MINIMAP_CSS,
  COMPASS,
  BAR,
  NOTICES,
  WINDOW,
  COUNTER,
  CONFIRM_CSS,
  QUESTS,
  FACES,
  MAP,
  TALK,
  SCREEN,
  LOADER,
].join('\n')

const STYLE_ID = 'gb-hud-style'

/** Puts the stylesheet in the document once, whatever number of huds ask. */
export function installStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = HUD_CSS
  doc.head.append(style)
}
