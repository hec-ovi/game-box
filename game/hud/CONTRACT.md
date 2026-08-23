# @gb/hud contract

contractVersion: 0.4.0

## Purpose

Everything the player reads over the 3D scene, and the one window they open on top of it: what they are meant to be doing, what is in reach, what is being said to them, what they are carrying, where things are, what just happened, and how to get out of whatever they are in.

## Shape

The game pushes state, the hud draws it. There is one store behind the whole interface and one render pass over it, so objectives, the prompt, the purse, the conversation, the announcements and the window are the same mechanism with different surfaces. Nothing here reads the game: it renders what it is handed and reports what the player did through one callback.

```ts
import { Hud } from '@gb/hud'

const hud = new Hud(document.body, { onIntent: (intent) => { /* say, talk-closed, typing, window, track */ } })
hud.show({ objectives: log.objectives(), money: player.money(), prompt: { key: 'E', text: target.label } })
hud.show({ quests: log.active(), trackedQuestId: 'q1' })
hud.show({ map: { width, height, plots, marks } })
hud.show({ controls: [{ keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' }] })
hud.show({ talk: { speaker: npc.name, moves: conversation.moves() } })
hud.show({ talk: { replyChunk: token } })
hud.announce({ kind: 'quest-complete', title: quest.title, reward: { money: 40 } })
```

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `new Hud(mount, handlers)` | an element to draw in, [HudHandlers](src/types.ts) | the element is in a document; the hud appends one child to it and one key listener to its window |
| `hud.show(patch)` | [HudPatch](src/types.ts) | fields left out keep what is on screen; `null` clears the prompt, closes the conversation, shuts the window or stops following a quest |
| `patch.objectives` | `@gb/quest` `Objective[]` | every open step of every live quest, in the order they should read |
| `patch.trackedQuestId` | `string \| null` | the quest the objectives panel follows; unset means the first quest with an open step |
| `patch.prompt` | `{ key, text }` | text without the key: "Go into The Copper Wheel" |
| `patch.money`, `patch.carrying` | a whole number, `Carried[]` | `quest: true` marks an item a live quest wants |
| `patch.talk` | [TalkPatch](src/types.ts) | a new `speaker` starts a fresh panel; `replyChunk` appends a piece of the reply |
| `patch.talk.moves` | [TalkMove](src/types.ts)`[]` | what the player can do this turn, as `{ key, label }` in plain words. Replaces the menu; an empty list draws none |
| `patch.quests` | [QuestEntry](src/types.ts)`[]` | active quests with their steps and which are done, for the quests tab |
| `patch.map` | [MapView](src/types.ts) | the city in grid cells: size, plot rects, and marks for the player and the places to head for |
| `patch.controls` | [ControlHint](src/types.ts)`[]` | the game's own keys for the controls tab: `{ keys, text, group? }`, replaces the whole list |
| `patch.window` | `'quests' \| 'map' \| 'items' \| 'controls' \| null` | opens that face of the window, or shuts it |
| `hud.announce(notice)` | [Notice](src/types.ts) | one of the seven kinds; `ms` overrides how long it stays |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `handlers.onIntent` | [HudIntent](src/types.ts) | `say` with the trimmed line, `choose` with the `key` of the move clicked, `talk-closed`, `typing` on every change of it, `window` with the face it moved to, `track` with the quest the player chose to follow |
| `hud.typing` | boolean | true while the conversation holds the keyboard, which is when the game must let its keys go |
| `hud.destroy()` | void | the interface leaves the page, the key listener goes, every timer is cleared |
| `HUD_KEYS` | `{ quests, map, items, controls, close, send, pick }` | the keys the interface claims, so the game can bind around them |
| `HUD_CSS` | string | the stylesheet, already installed in the document by the constructor; exported for apps that inline their css |

## Surfaces

Every surface is handed the whole state on every change and decides for itself what that means on screen. Nothing else is drawn.

| Surface | Draws from | Emits |
|---|---|---|
| Objectives | `objectives`, `trackedQuestId` | nothing |
| Purse | `money`, `carrying` | nothing |
| Prompt | `prompt` | nothing |
| Notices | `hud.announce` | nothing |
| Bar | `window`, `hud.typing` | `window` |
| Conversation | `talk` | `say`, `choose`, `typing`, `talk-closed` |
| Scrim | `window` | `window: null` |
| Window | `window` | `window` |

## Saying it and clicking it

The conversation takes an answer two ways and treats them as the same thing. Typed words go out as `say`. The moves the game says are legal go on screen as buttons, and clicking one goes out as `choose` with that move's key, which the game hands straight back to whoever owns the rules. Both put the player's own line above the reply, so a conversation reads the same afterwards however it was held.

The menu is only ever what is legal now. Nothing is drawn greyed out for later: a move the game stops sending is off the screen on the next push, and a turn with nothing on the menu shows no menu at all rather than a row of things that do nothing.

Answering quiets the menu. Between the player answering and the game publishing the next menu, the moves stay on screen to read and take no clicks, so a second answer cannot land on a turn that has already moved on. The game ends every turn by publishing a menu, even an empty one, which is what makes them live again.

The window is one shell with four faces behind a tab strip. Each face is handed the same state.

| Tab | Draws from | Emits |
|---|---|---|
| Quests | `quests`, `trackedQuestId` | `track` |
| Map | `map`, `objectives`, `trackedQuestId` | nothing |
| Items | `money`, `carrying` | nothing |
| Controls | `controls` | nothing |

The objectives panel shows the tracked quest and its open steps, a count as "2/5" where a step wants more than one, a tag on optional work, and one line for how many other quests are running. The purse shows the coin count and the first four things in hand, quest items first, and one line for the rest. The map draws the survey when the game has one and lists the places the tracked quest points at either way. Items lists everything in hand with quest items first. Controls lists the game's keys, then the interface's.

## The look

One palette, three type stacks, one spacing step and one motion curve, all declared as custom properties on `.gb-hud` in [src/style/tokens.ts](src/style/tokens.ts). Nothing downstream writes a colour or a duration of its own.

| Token | For |
|---|---|
| `--gb-ink`, `--gb-dim`, `--gb-faint` | text at three weights of attention |
| `--gb-panel`, `--gb-solid`, `--gb-lift`, `--gb-well` | a floating panel, the window, a raised control, a sunken field |
| `--gb-edge`, `--gb-edge-lit` | hairlines, quiet and lit |
| `--gb-accent`, `--gb-accent-deep`, `--gb-accent-ink` | brass: anything the player can act on, and the text that sits on it |
| `--gb-warn` | a failure or coin going out |
| `--gb-frame` | the shadow every panel wears: black hairline outside, pale hairline inside, then the drop |
| `--gb-hatch` | the diagonal texture on a head or a major announcement |
| `--gb-display`, `--gb-body`, `--gb-mono` | condensed for labels, system sans for prose, monospace for numbers |
| `--gb-s1` to `--gb-s6` | 4, 8, 12, 16, 22, 32 px |
| `--gb-t`, `--gb-ease` | 140 ms on the one curve |

Type stacks only, no font file: the box ships as one string with no assets, so a face would have to be inlined into every consumer's bundle. Labels are condensed, upper case and tracked; numbers are monospace with tabular figures so a coin count does not jitter as it changes.

## Keys the interface owns

One listener, on the window in the capture phase, so it runs before anything the game bound anywhere.

- `Escape` closes what is in front of the player, one at a time: the window, then the conversation. With nothing open it passes through to the game.
- `J` quests, `M` map, `I` items, `?` `/` and `F1` controls. The key of the face already up puts the window away; any other switches face without closing anything.
- `Enter` sends what is in the conversation box.
- `Tab` cycles inside whatever is in front of the player: the open window, or failing that the conversation, where the ring is the box, then each move, then the way out. Left and right walk the tab strip while it has focus.
- While the player is writing, every other key stops at the hud and the game hears nothing.
- A key the interface does not use passes straight through, and so does every key while another text field on the page has focus.

## Errors (closed set)

Thrown as `HudError` with a `code`:

- `hud-destroyed`: `show` or `announce` after `destroy`.
- `unknown-notice`: a notice kind this box does not draw.
- `no-conversation`: a talk patch that edits a reply while no conversation is open.

## Invariants

- The only way in is `show` and `announce`; the only way out is `onIntent`. The hud never reads the world, the playthrough or the renderer.
- One window, one face. Opening a face closes the one before it, so there is one scrim, one focus trap and one way out whatever the player is reading.
- Every window closes two ways: a button the player can see and click, and a key. The key is printed on the button.
- Opening and closing are transitions of 120 to 150 ms. A window is closed the moment it is asked to close: it stops taking clicks, leaves the accessible tree and lets the keyboard go, and only its pixels linger. The key that closes one window is free to open the next in the same breath.
- Nothing takes the keyboard except the conversation, for as long as focus is anywhere inside it, and it reports `typing: false` before it reports `talk-closed`, so the game has its keys back before it hears the conversation ended. Stepping off the box onto a move does not hand the walk keys back mid-sentence. `typing` is reported on change only, never twice in a row.
- Focus goes where the player is: a window that opens takes focus and hands it back to whatever had it when it closes. Nothing to hand back to means the page, which is where the game listens.
- The player can read the controls without leaving what they are doing: the buttons carry their keys, the conversation carries its own two, and the controls tab lists everything the game declared.
- A streamed reply appends into the node already on screen: text is written only where it changed, so nothing rebuilds mid-sentence. The menu is rebuilt only when the moves themselves change, so it does not flicker under a reply arriving word by word.
- A face the player is not looking at holds no text, and neither does a window that has finished closing.
- The corner panels never grow down the screen: each shows what is worth a glance, points at the window for the rest, and scrolls inside itself if what is left still does not fit.
- The conversation, the window, the scrim behind it and the bar take the pointer; the rest of the interface lets clicks through to the scene.
- Announcements come in two sizes. A quest starting, finishing or failing is `major`: large, on the accent, 5.2 seconds. Everything else is `minor`: small, quiet, 2.6 seconds. Four at once is the most on screen; older ones go first.
- A money change of zero announces nothing, so a quest that pays in goods does not flash an empty line.
- What just changed says so: the reticle opens and goes brass while something is in reach, a coin count flashes the way it moved, and a step count flashes when it climbs.
- Everything a mouse can do, the keyboard can do.
- Square corners: no `border-radius` in the stylesheet.
- `Objective.markerLabel` names a place, so the map reads it; putting a marker in the world belongs to the scene, not here.

## Dependencies

- `@gb/quest` contract (game/quest/CONTRACT.md): the `Objective` shape the objectives panel and the map read.
- The DOM. No renderer, no three.js, no game state.

## How to modify this blackbox safely

A new kind of answer in the conversation is a case on `HudIntent` and a branch in the hud's `#dispatch`; anything the player picks goes out as an intent and comes back as a patch, because this box never decides what a move does. A new panel is a new surface in `src/surfaces/` plus its field on `HudPatch` and `HudState`; nothing else changes, because every surface is handed the whole state. A new face of the window is an entry in `src/windows.ts` plus a `Tab` in `src/tabs/`, and it gets its chrome, its transition and its focus manners free. A new announcement is a kind on `Notice`, its wording and size in `src/phrase.ts` and its name in the kind set. A new key is a `KeyAction` in `src/keys.ts` and a case in the hud, with its label in `src/controls.ts` so it appears on screen wherever it applies. Wording lives in `phrase.ts` and `controls.ts`; the look lives in `src/style/`, one file per concern, joined into one stylesheet at load. Run `pnpm --filter @gb/hud test` in the same change.
