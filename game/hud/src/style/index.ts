import { BAR } from './bar.ts'
import { BASE } from './base.ts'
import { COMPASS } from './compass.ts'
import { COUNTER } from './counter.ts'
import { LOADER } from './loader.ts'
import { MAP } from './map.ts'
import { NOTICES } from './notices.ts'
import { PANELS } from './panels.ts'
import { SCREEN } from './screen.ts'
import { TABS } from './tabs.ts'
import { TALK } from './talk.ts'
import { TOKENS } from './tokens.ts'
import { WINDOW } from './window.ts'

/**
 * The whole look of the interface. It ships as one string because the box has
 * one public entry, so an app that bundles it cannot import a css file; it is
 * written in pieces so no one file holds more than one concern.
 */
export const HUD_CSS = [TOKENS, BASE, PANELS, COMPASS, BAR, NOTICES, WINDOW, COUNTER, TABS, MAP, TALK, SCREEN, LOADER].join('\n')

const STYLE_ID = 'gb-hud-style'

/** Puts the stylesheet in the document once, whatever number of huds ask. */
export function installStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = HUD_CSS
  doc.head.append(style)
}
