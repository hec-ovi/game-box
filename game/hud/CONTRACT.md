# @gb/hud contract

contractVersion: 0.1.0

## Purpose

Everything the player reads over the 3D scene: what they are meant to be doing, what is in reach, what is being said to them, what they are carrying, and what just happened.

## Shape

The game pushes state, the hud draws it. There is one store behind the whole interface and one render pass over it, so objectives, the prompt, the purse, the conversation, the announcements and the journal are the same mechanism with different surfaces. Nothing here reads the game: it renders what it is handed and reports what the player did through one callback.

```ts
import { Hud } from '@gb/hud'

const hud = new Hud(document.body, { onIntent: (intent) => { /* say, talk-closed, typing, journal */ } })
hud.show({ objectives: log.objectives(), money: player.money(), prompt: { key: 'E', text: target.label } })
hud.show({ talk: { speaker: npc.name } })
hud.show({ talk: { replyChunk: token } })
hud.announce({ kind: 'quest-complete', title: quest.title, reward: { money: 40 } })
```

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `new Hud(mount, handlers)` | an element to draw in, [HudHandlers](src/types.ts) | the element is in a document; the hud appends one child to it |
| `hud.show(patch)` | [HudPatch](src/types.ts) | fields left out keep what is on screen; `prompt: null` clears, `talk: null` closes |
| `patch.objectives` | `@gb/quest` `Objective[]` | the open steps, in the order they should read |
| `patch.prompt` | `{ key, text }` | text without the key: "Go into The Copper Wheel" |
| `patch.money`, `patch.carrying` | a whole number, `Carried[]` | `quest: true` marks an item a live quest wants |
| `patch.talk` | [TalkPatch](src/types.ts) | a new `speaker` starts a fresh panel; `replyChunk` appends a piece of the reply |
| `patch.journal`, `patch.journalOpen` | `JournalQuest[]`, boolean | active quests with their steps and which are done |
| `hud.announce(notice)` | [Notice](src/types.ts) | one of the seven kinds; `ms` overrides how long it stays |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `handlers.onIntent` | [HudIntent](src/types.ts) | `say` with the trimmed line, `talk-closed` on Escape, `typing` on focus and blur, `journal` with the state it moved to |
| `hud.typing` | boolean | true while the player is writing, which is when the game must let its keys go |
| `hud.destroy()` | void | the interface leaves the page and every notice timer is cleared |
| `HUD_CSS` | string | the stylesheet, already installed in the document by the constructor; exported for apps that inline their css |

## Errors (closed set)

Thrown as `HudError` with a `code`:

- `hud-destroyed`: `show` or `announce` after `destroy`.
- `unknown-notice`: a notice kind this box does not draw.
- `no-conversation`: a talk patch that edits a reply while no conversation is open.

## Invariants

- The only way in is `show` and `announce`; the only way out is `onIntent`. The hud never reads the world, the playthrough or the renderer.
- A streamed reply appends into the node already on screen: text is written only where it changed, so nothing rebuilds mid-sentence.
- A panel that is not on screen holds no text, so nothing reads a quest or a prompt the player cannot see.
- Keys typed in the conversation stop at the hud, so the game hears nothing while the player is writing.
- The conversation and the journal are the only things that take the pointer; the rest of the interface lets clicks through to the scene.
- Escape closes the conversation and the journal, and the hud closes them itself before reporting the intent, so a game that ignores intents still behaves.
- The interface is reachable with the keyboard alone: the conversation focuses its box when it opens, the journal focuses its close button, and both leave on Escape.
- A money change of zero announces nothing, so a quest that pays in goods does not flash an empty line.
- Square corners: no `border-radius` in the stylesheet.
- `Objective.markerLabel` is for markers in the world, which belong to the scene, so this box ignores it.

## Dependencies

- `@gb/quest` contract (game/quest/CONTRACT.md): the `Objective` shape the objective list renders.
- The DOM. No renderer, no three.js, no game state.

## How to modify this blackbox safely

A new panel is a new surface in `src/surfaces/` plus its field on `HudPatch` and `HudState`; nothing else changes, because every surface is handed the whole state. A new announcement is a kind on `Notice`, its wording in `src/phrase.ts` and its name in the kind set. Wording lives in `phrase.ts` and look lives in `style.ts`, so neither needs a surface opened. Run `pnpm --filter @gb/hud test` in the same change.
