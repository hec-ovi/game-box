# @gb/hud contract

contractVersion: 0.2.0

## Purpose

Everything the player reads over the 3D scene, and every window they open on top of it: what they are meant to be doing, what is in reach, what is being said to them, what they are carrying, what just happened, and how to get out of whatever they are in.

## Shape

The game pushes state, the hud draws it. There is one store behind the whole interface and one render pass over it, so objectives, the prompt, the purse, the conversation, the announcements, the journal and the controls window are the same mechanism with different surfaces. Nothing here reads the game: it renders what it is handed and reports what the player did through one callback.

```ts
import { Hud } from '@gb/hud'

const hud = new Hud(document.body, { onIntent: (intent) => { /* say, talk-closed, typing, journal, help */ } })
hud.show({ objectives: log.objectives(), money: player.money(), prompt: { key: 'E', text: target.label } })
hud.show({ controls: [{ keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' }] })
hud.show({ talk: { speaker: npc.name } })
hud.show({ talk: { replyChunk: token } })
hud.announce({ kind: 'quest-complete', title: quest.title, reward: { money: 40 } })
```

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `new Hud(mount, handlers)` | an element to draw in, [HudHandlers](src/types.ts) | the element is in a document; the hud appends one child to it and one key listener to its window |
| `hud.show(patch)` | [HudPatch](src/types.ts) | fields left out keep what is on screen; `prompt: null` clears, `talk: null` closes |
| `patch.objectives` | `@gb/quest` `Objective[]` | the open steps, in the order they should read |
| `patch.prompt` | `{ key, text }` | text without the key: "Go into The Copper Wheel" |
| `patch.money`, `patch.carrying` | a whole number, `Carried[]` | `quest: true` marks an item a live quest wants |
| `patch.talk` | [TalkPatch](src/types.ts) | a new `speaker` starts a fresh panel; `replyChunk` appends a piece of the reply |
| `patch.journal`, `patch.journalOpen` | `JournalQuest[]`, boolean | active quests with their steps and which are done |
| `patch.controls` | [ControlHint](src/types.ts)`[]` | the game's own keys for the controls window: `{ keys, text, group? }`, replaces the whole list |
| `patch.helpOpen` | boolean | opens or closes the controls window from the game side |
| `hud.announce(notice)` | [Notice](src/types.ts) | one of the seven kinds; `ms` overrides how long it stays |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `handlers.onIntent` | [HudIntent](src/types.ts) | `say` with the trimmed line, `talk-closed`, `typing` on every change of it, `journal` and `help` with the state they moved to |
| `hud.typing` | boolean | true while the player is writing, which is when the game must let its keys go |
| `hud.destroy()` | void | the interface leaves the page, the key listener goes, every timer is cleared |
| `HUD_KEYS` | `{ journal, help, close, send }` | the keys the interface claims, so the game can bind around them |
| `HUD_CSS` | string | the stylesheet, already installed in the document by the constructor; exported for apps that inline their css |

## Keys the interface owns

One listener, on the window in the capture phase, so it runs before anything the game bound anywhere.

- `Escape` closes the window in front of the player, one at a time: controls, then journal, then conversation. With nothing open it passes through to the game.
- `J` opens and closes the journal. `?`, `/` and `F1` open and close the controls window.
- `Enter` sends what is in the conversation box.
- `Tab` cycles inside an open journal or controls window and nowhere else.
- While the player is writing, every other key stops at the hud and the game hears nothing.
- A key the interface does not use passes straight through, and so does every key while another text field on the page has focus.

## Errors (closed set)

Thrown as `HudError` with a `code`:

- `hud-destroyed`: `show` or `announce` after `destroy`.
- `unknown-notice`: a notice kind this box does not draw.
- `no-conversation`: a talk patch that edits a reply while no conversation is open.

## Invariants

- The only way in is `show` and `announce`; the only way out is `onIntent`. The hud never reads the world, the playthrough or the renderer.
- Every window closes two ways: a button the player can see and click, and a key. The key is printed on the button.
- Opening and closing are transitions of 120 to 150 ms. A window is closed the moment it is asked to close: it stops taking clicks, leaves the accessible tree and lets the keyboard go, and only its pixels linger. The key that closes one window is free to open the next in the same breath.
- Nothing takes the keyboard except the conversation box while the player is writing in it, and it reports `typing: false` before it reports `talk-closed`, so the game has its keys back before it hears the conversation ended. `typing` is reported on change only, never twice in a row.
- Focus goes where the player is: a window that opens takes focus and hands it back to whatever had it when it closes. Nothing to hand back to means the page, which is where the game listens.
- The player can read the controls without leaving what they are doing: the buttons carry their keys, the conversation carries its own two, and the controls window lists everything the game declared.
- A streamed reply appends into the node already on screen: text is written only where it changed, so nothing rebuilds mid-sentence.
- A panel that has finished closing holds no text, so nothing reads a quest or a prompt the player cannot see.
- The conversation, the journal, the controls window, the scrim behind them and the corner buttons take the pointer; the rest of the interface lets clicks through to the scene.
- Announcements come in two sizes. A quest starting, finishing or failing is `major`: large, on the accent, 5.2 seconds. Everything else is `minor`: small, quiet, 2.6 seconds. Four at once is the most on screen; older ones go first.
- A money change of zero announces nothing, so a quest that pays in goods does not flash an empty line.
- Everything a mouse can do, the keyboard can do.
- Square corners: no `border-radius` in the stylesheet.
- `Objective.markerLabel` is for markers in the world, which belong to the scene, so this box ignores it.

## Dependencies

- `@gb/quest` contract (game/quest/CONTRACT.md): the `Objective` shape the objective list renders.
- The DOM. No renderer, no three.js, no game state.

## How to modify this blackbox safely

A new panel is a new surface in `src/surfaces/` plus its field on `HudPatch` and `HudState`; nothing else changes, because every surface is handed the whole state. A window gets its chrome, its transition and its focus manners from `HudWindow`, so a new one is a title, a body and a close intent. A new announcement is a kind on `Notice`, its wording and size in `src/phrase.ts` and its name in the kind set. A new key is a `KeyAction` in `src/keys.ts` and a case in the hud, with its label in `src/controls.ts` so it appears on screen wherever it applies. Wording lives in `phrase.ts` and `controls.ts`, look lives in `style.ts`, so neither needs a surface opened. Run `pnpm --filter @gb/hud test` in the same change.
