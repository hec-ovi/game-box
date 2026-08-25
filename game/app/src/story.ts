import { premiseLines } from '@gb/forge'
import type { CodexNote } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { World } from '@gb/world'

/** The heading a line with no heading of its own is drawn under: something said to the player in passing. */
const HEARD = 'Heard'

/**
 * The town's story, told to the player on the way in: what it lives on, what
 * happened to it, what is at stake, who is arguing, and what everybody knows.
 * `@gb/play` holds what the player was told as lines, each once, so telling
 * it on every visit costs nothing. A town founded without a story tells none.
 */
export function tellStory(world: World, player: PlayerState): void {
  const premise = world.premise()
  if (!premise) return
  for (const line of premiseLines(premise).split('\n')) player.told(line)
}

/**
 * What the player has been told of the city, as the codex draws it. A line
 * carries its heading before a colon, the way `@gb/forge` renders the story
 * ("Everybody knows: the freight comes through at night"), so a note has a
 * title without a table here; one with no heading is drawn as heard.
 */
export function storyNotes(player: PlayerState): CodexNote[] {
  return player.history().map((line, index) => {
    const colon = line.indexOf(': ')
    const id = String(index)
    return colon > 0 ? { id, title: line.slice(0, colon), text: line.slice(colon + 2) } : { id, title: HEARD, text: line }
  })
}
