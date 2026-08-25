# @gb/hud contract

contractVersion: 0.10.0

## Purpose

Everything the player reads over the 3D scene, and the one window they open on top of it: what they are meant to be doing, which way it is, what is in reach, the conversation they are in, what they are carrying, where things are, what they have found out, what they can set, what just happened, how a city is coming along while it is written, and how to get out of whatever they are in.

## Shape

The game pushes state, the hud draws it. There is one store behind the whole interface and one render pass over it, so objectives, the prompt, the conversation, the announcements, the loader and the window are the same mechanism with different surfaces. Nothing here reads the game: it renders what it is handed and reports what the player did through one callback.

```ts
import { Hud } from '@gb/hud'

const hud = new Hud(document.body, { onIntent: (intent) => { /* say, choose, talk-closed, typing, window, track, abandon, decide, lock-time, skip-time, weather, exit */ } })
hud.show({ objectives: log.objectives(), money: player.money(), prompt: { key: 'E', text: target.label } })
hud.show({ quests: log.journal(), trackedQuestId: 'q1' })
hud.show({ map: { width, height, plots, marks }, settings: { hour, minute, locked, weather, weathers } })
hud.show({ compass: { facing: body.yaw, goal: { label, bearing, distance, line: 'main' } } })
hud.show({ codex: { places, people: [{ id, name, role, disposition, facts: [{ id, text }, { id }] }], history } })
hud.show({ controls: [{ keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' }] })
hud.show({ talk: { speaker: npc.name, moves: conversation.moves() } })
hud.show({ talk: { replyChunk: token } })
hud.show({ loading: { title: 'Writing Gullhaven', stages } })
hud.announce({ kind: 'quest-complete', title: quest.title, reward: { money: 40 } })
```

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `new Hud(mount, handlers)` | an element to draw in, [HudHandlers](src/types.ts) | the element is in a document; the hud appends one child to it and one key listener to its window |
| `hud.show(patch)` | [HudPatch](src/types.ts) | fields left out keep what is on screen; `null` clears the prompt, closes the conversation, shuts the window, stops following a quest, takes the survey, the compass or the loader away |
| `patch.objectives` | `@gb/quest` `Objective[]` | every open step of every live quest, in the order they should read; a step carrying a `choice` is tagged and points at the journal |
| `patch.trackedQuestId` | `string \| null` | the quest the objectives panel follows; unset means the first quest with an open step |
| `patch.prompt` | `{ key, text }` | text without the key: "Go into The Copper Wheel" |
| `patch.money`, `patch.carrying` | a whole number, `Carried[]` | both read in the inventory; `quest: true` marks an item a live quest wants |
| `patch.talk` | [TalkPatch](src/types.ts) | a new `speaker` starts a fresh panel; `turns` replaces the transcript; `reply`, `replyChunk` and `does` edit the speaker's current turn, opening one when the player spoke last; `does: null` takes the stage direction off that turn; `acted` is the older name for `does` |
| `patch.talk.moves` | [TalkMove](src/types.ts)`[]` | what the player can do this turn, as `{ key, label }` in plain words. Replaces the menu; an empty list draws none |
| `patch.quests` | [QuestEntry](src/types.ts)`[]` | one page per quest for the quests tab: `@gb/quest`'s `JournalEntry[]` goes in as it comes, `kind` and `status` and all; `failReason` on a failed page, `timer: { remaining, total }` in game seconds on a timed one |
| `patch.map` | [MapView](src/types.ts) | the city in grid cells: `width`, `height`, one `plots` rect per building with an optional `label` (read on hover), `named: true` where the label is to be written on the plan, and `prominence` (`background`, `notable`, `landmark`, left out reads as background); `marks` for the player (`kind: 'you'`, `facing` in radians clockwise from north) and each place to head for (`kind: 'goal'`, `line` `main` or `side`, left out reads as side) |
| `patch.compass` | [CompassView](src/types.ts) | `facing` in radians clockwise from north, and the tracked `goal` when there is one: its `label`, `bearing` (same unit, the way to set off), `distance` in metres along the walk, `line`; pushed whenever the player turns or the guide resolves again; `null` takes the strip away |
| `patch.codex` | [CodexView](src/types.ts) | what the player has found out, replaced whole: `places` (`id`, `name`, a `text` line), `people` (`id`, `name`, `role`, `disposition` one of `hostile`, `cool`, `neutral`, `warm`, `friendly`, and every `facts` entry there is to learn, with `text` only on the ones learned), and `history` notes (`id`, `title`, `text`) |
| `patch.settings` | [SettingsView](src/types.ts) | the clock (`hour`, `minute`, `locked`) and the sky (`weather`, and every `weathers` the game can show); pushed again whenever any of it moves |
| `patch.controls` | [ControlHint](src/types.ts)`[]` | the game's own keys for the controls tab: `{ keys, text, group? }`, replaces the whole list |
| `patch.window` | `'quests' \| 'map' \| 'inventory' \| 'codex' \| 'settings' \| 'controls' \| null` | opens that face of the window, or shuts it |
| `patch.loading` | [LoaderView](src/types.ts) | a build under way: its `title` and its `stages`, each `{ id, label, state, done?, total? }` with `state` one of `waiting`, `running`, `done`; `null` when the city is ready |
| `hud.announce(notice)` | [Notice](src/types.ts) | one of the nine kinds; `ms` overrides how long it stays |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `handlers.onIntent` | [HudIntent](src/types.ts) | `say` with the trimmed line, `choose` with the `key` of the move clicked, `talk-closed`, `typing` on every change of it, `window` with the face it moved to, `track` with the quest the player chose to follow, `abandon` with the quest they gave up, `decide` with the option they took, `lock-time` with whether the clock is to be held, `skip-time`, `weather` with the one picked, `exit` |
| `hud.typing` | boolean | true while the conversation holds the keyboard, which is when the game must let its keys go |
| `hud.destroy()` | void | the interface leaves the page, the key listener goes, every timer is cleared |
| `HUD_KEYS` | `{ quests, map, inventory, codex, settings, controls, leave, close, send, pick }` | the keys the interface claims, so the game can bind around them |
| `HUD_CSS` | string | the stylesheet, already installed in the document by the constructor; exported for apps that inline their css |

## Surfaces

Every surface is handed the whole state on every change and decides for itself what that means on screen. Nothing else is drawn.

| Surface | Draws from | Emits |
|---|---|---|
| Objectives | `objectives`, `trackedQuestId` | nothing |
| Prompt | `prompt` | nothing |
| Compass | `compass` | nothing |
| Notices | `hud.announce` | nothing |
| Bar | `window`, `hud.typing` | `window`, `exit` |
| Conversation | `talk` | `say`, `choose`, `typing`, `talk-closed` |
| Scrim | `window` | `window: null` |
| Window | `window` | `window` |
| Loader | `loading` | nothing |

## Where things sit

The screen is cut into regions that never cross, in pixels, in [src/style/layout.ts](src/style/layout.ts): the objectives corner top left (330 wide), the band beside it across the top (196 tall) holding the compass strip (360 by 44, centred at the top of the band) with the notices column under it, the conversation down the right (380 wide, stopping above the foot), the bar along the foot (88 tall), and the window in the room those leave. While a conversation is up the compass, the notices, the prompt and the window's room stop short of it. Each surface has a layer of its own, front to back: corner, compass, side, notices, bar, scrim, window, loader. Nothing shares a layer, so nothing is ever drawn through anything else.

The window is one frame, 760 by 600, centred in its room and clamped by it on a small screen, and it is that shape whatever face is up: a face is handed the body and scrolls inside it, and nothing in the window sizes itself to what is on the face.

## The conversation

A panel of fixed width, up while a conversation is open and gone when it ends, holding the whole transcript: every turn so far, oldest first, the player's turns and the speaker's read apart. A speaker's turn has what they say and, when the turn had one, what they do, drawn apart as stage direction so narration never reads as dialogue. Long conversations scroll inside the panel; the panel never changes size for what arrives.

The conversation takes an answer two ways and treats them as the same thing. Typed words go out as `say`. The moves the game says are legal go on screen as buttons, and clicking one goes out as `choose` with that move's key, which the game hands straight back to whoever owns the rules. Both put the player's own line on the transcript, so a conversation reads the same afterwards however it was held.

The menu is only ever what is legal now. Nothing is drawn greyed out for later: a move the game stops sending is off the screen on the next push, and a turn with nothing on the menu shows no menu at all rather than a row of things that do nothing.

Answering quiets the menu. Between the player answering and the game publishing the next menu, the moves stay on screen to read and take no clicks, so a second answer cannot land on a turn that has already moved on. The game ends every turn by publishing a menu, even an empty one, which is what makes them live again.

## The window

One shell with six faces behind a tab strip. Each face is handed the same state.

| Tab | Draws from | Emits |
|---|---|---|
| Quests | `quests`, `trackedQuestId` | `track`, `abandon`, `decide` |
| Map | `map`, `objectives`, `trackedQuestId`, `quests` | nothing |
| Inventory | `money`, `carrying` | nothing |
| Codex | `codex` | nothing |
| Settings | `settings` | `lock-time`, `skip-time`, `weather`, `exit` |
| Controls | `controls` | nothing |

The objectives panel shows the tracked quest and its open steps, a count as "2/5" where a step wants more than one, a tag on optional work, and one line for how many other quests are running. With nothing on it, it says which kind of nothing: a player who has never held a quest is pointed at somebody to talk to, one between jobs is told there is no step open. The journal reads the same two ways. The map draws the survey when the game has one, filling the frame, and lists the places to head for either way. The inventory holds the coin count and everything in hand, quest items first: money is a thing the player carries, so it is read there and in no corner. The codex files what was found under Places, People and History. Settings shows the hour as a clock face beside a button that holds it and one that skips ahead, one button per weather with the current one pressed, and the way out; until the game has pushed the clock it offers the way out and says the rest comes once the city is running. Controls lists the game's keys, then the interface's.

## The map

The plan fills the window's body edge to edge and is read by zooming into it. Plots are drawn in cells and scale with the zoom; the player's arrow, the goal marks and every name are drawn in pixels, so they are the same size at any zoom and a city of twenty blocks comes apart into readable names as the player zooms in. At first the whole city is framed to the plan's aspect. The wheel zooms about the pointer, a drag pans, and the four tools over the plan do the same with a key each printed on them: Zoom in `+`, Zoom out `-`, Fit `0`, You `Y` (centre on the player); the arrows pan while the map has focus. The view is held inside the city, and it survives the survey being pushed again, so a plan four times a second does not throw the player's zoom away. Twelve times the whole city is as far in as it goes.

A plot's `label` is read on hover; it is written on the plan only where `named` says so, which is the caller's list of places entered, quest targets and landmarks. `prominence` picks one of three fills (`--gb-plot`, `--gb-plot-notable`, `--gb-plot-landmark`), so a chapel and a jail are not two more grey rects. A goal on the story is a brass diamond, an errand a dot, each with its name beside it. The bearings along the foot list every goal mark, the story tagged `Main`, and clicking one swings the plan onto it; without a survey they list the tracked quest's open steps by `markerLabel` instead, and with nothing to head for they say so.

## The compass

A strip along the top of the play view answers "which way" without a key. The points of the compass slide along it as the player turns, with the way they face at the centre; the tracked goal's mark sits at its bearing, a diamond for the story and a dot for an errand, and pins to the nearer edge while the goal is behind the player. Under the strip: the goal's name and the distance ("140 m", "1.2 km"). The strip shows 120 degrees of arc across 360 pixels. The game pushes `facing` and whatever its guide resolved; the strip draws it and takes no clicks. Without a goal the points still turn; `compass: null` takes the strip away.

## The codex

Three headings, drawn only when they have rows: Places the player has walked into, each with its line; People they have met, each with how they stand towards the player as a tag (`Hostile` and `Cool` warned, `Warm` and `Friendly` in brass, `Neutral` quiet), what they do, a count "2 of 5 known" and every fact there is to learn of them, the learned ones in words and the rest as a locked line that says "Not learned yet"; and History, what they have been told of the city. A fact is never blank: a person with something still to find out shows it. The game keeps the record and decides what unlocks; the tab reads the push.

## The journal

A page is `@gb/quest`'s journal page as it stands: `hud.show({ quests: log.journal() })` with nothing in between. The title is read as `questTitle`, and as `title` for the shorter form the tab has always taken.

The story is listed first and wears a `Main` tag; errands follow in the order the game sent them. The corner panel wears the same tag while the player is following the story, and while they are following an errand with the story still open, its last line says so: "2 more quests, one is the main line". A page with no `kind` reads as an errand.

A page's `status` says how the quest stands; left out, it is under way. A finished page wears `Done`, a failed one wears `Failed` and its `failReason` under the title in words ("Ran out of time", "Somebody it needed is gone"), so a quest that ended is read and never simply missing. Only a live page carries Track and Give up: a finished one has nothing that would do anything.

A timed page shows the time left in game time ("1 h 12 min", "9 min", "45 s") and a bar for the share of the whole, written into the clock already there on every push of the journal. The timer runs on the game clock, so the hud keeps no clock of its own for it: a held game holds the countdown. Under a tenth of the whole, or ten game minutes, it is warned.

A step reads four ways, the same four the engine keeps.

| `state` | On screen |
|---|---|
| `open` | full weight, with a pointer: the step the player is on |
| `upcoming` | quiet: work the flow has not reached |
| `done` | faint and struck through |
| `dropped` | faint, tagged "Not taken": a branch the quest went past |

A quest that splits keeps both sides on the page. The road not taken is what says the choice was real, so a dropped step stays where it was written rather than leaving a gap. Nothing dropped can open again, so it never reads as work.

The game says which with `state`; a step carrying `done: true` alone is done, and one carrying neither is open.

## Answering a decision

A `choice` step is the one a player finishes by answering, so the journal asks it: the quest's `prompt` as the question, one button per option, in the order the quest wrote them. Clicking one reports

```ts
{ kind: 'decide', questId, stepId, optionId }
```

which is `@gb/quest`'s `chose` event with the same field names, so routing it is `log.handle({ kind: 'chose', ...intent })`. It is its own intent rather than the conversation's `choose`, because a decision in the journal is not a turn in a conversation and the two must not be read as one.

A button says what the player would do and nothing about where it leads: the far side of a choice is theirs to find by taking it. Only the step the flow is standing on is drawn with a question, so a decision already made or not yet reached has nothing to click at all, and a stale panel cannot answer for the player. A choice that has been answered reads like any other finished step, and whatever the other roads led to reads as `dropped`.

The corner panel takes no clicks, so a step with a question there is tagged "Decide" with the journal key beside it.

Giving a quest up sits beside Track and asks twice. The first click turns the button into the question, the second reports `abandon` and the button goes back to how it was. Looking away answers no. The hud takes nothing off the board itself: the quest stays on screen until the game pushes the list without it.

## Settings and the way out

Every setting is an intent the game acts on, and the tab draws what the game pushes back: `lock-time` carries whether the clock is to be held, `skip-time` asks for the next time of day, `weather` names the one picked. The button reads locked once `settings.locked` says so, not before. `exit` comes from the Settings tab, from the Leave button on the bar and from its key, and the game decides what leaving means.

## The loader

A city being written covers the view: its title and each stage of the build, the one under way in brass, the finished ones ticked, a bar per stage filled from `done / total` where the stage can count and whole once it is `done`. Rows keep their node from push to push, so a bar fills rather than blinks. `loading: null` takes it away.

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

Type stacks only, no font file: the box ships as one string with no assets, so a face would have to be inlined into every consumer's bundle. Labels are condensed, upper case and tracked; numbers are monospace with tabular figures so a coin count or a clock does not jitter as it changes.

## Keys the interface owns

One listener, on the window in the capture phase, so it runs before anything the game bound anywhere.

- `Escape` closes what is in front of the player, one at a time: the window, then the conversation. With nothing open it passes through to the game.
- `J` quests, `M` map, `I` inventory, `X` codex, `O` settings, `?` `/` and `F1` controls. The key of the face already up puts the window away; any other switches face without closing anything.
- `N` leaves: it reports `exit`, the same as the Leave button on the bar and the Exit game button in Settings.
- `Enter` sends what is in the conversation box.
- `Tab` cycles inside whatever is in front of the player: the open window, or failing that the conversation, where the ring is the box, then each move, then the way out. Left and right walk the tab strip while it has focus.
- While the map has focus, `+` and `-` zoom, `0` fits the city, `Y` centres on the player and the arrows pan. They are printed on the map's tools and listed under Map in the controls tab.
- While the player is writing, every other key stops at the hud and the game hears nothing.
- A key the interface does not use passes straight through, and so does every key while another text field on the page has focus.

## Errors (closed set)

Thrown as `HudError` with a `code`:

- `hud-destroyed`: `show` or `announce` after `destroy`.
- `unknown-notice`: a notice kind this box does not draw.
- `no-conversation`: a talk patch that edits a reply while no conversation is open.

## Invariants

- The only way in is `show` and `announce`; the only way out is `onIntent`. The hud never reads the world, the playthrough or the renderer.
- One window, one face, one frame. Opening a face closes the one before it, so there is one scrim, one focus trap and one way out whatever the player is reading, and the frame is the same size whichever face is up.
- The regions in `layout.ts` are disjoint: the objectives corner, the notices column, the conversation and the window never overlap, and each surface has a layer of its own.
- Every window closes two ways: a button the player can see and click, and a key. The key is printed on the button.
- Opening and closing are transitions of 120 to 150 ms. A window is closed the moment it is asked to close: it stops taking clicks, leaves the accessible tree and lets the keyboard go, and only its pixels linger. The key that closes one window is free to open the next in the same breath.
- Nothing takes the keyboard except the conversation, for as long as focus is anywhere inside it, and it reports `typing: false` before it reports `talk-closed`, so the game has its keys back before it hears the conversation ended. Stepping off the box onto a move does not hand the walk keys back mid-sentence. `typing` is reported on change only, never twice in a row.
- Focus goes where the player is: a window that opens takes focus and hands it back to whatever had it when it closes. Nothing to hand back to means the page, which is where the game listens.
- The player can read the controls without leaving what they are doing: the buttons carry their keys, the conversation carries its own two, and the controls tab lists everything the game declared beside everything the interface owns.
- A streamed reply appends into the node already on screen: text is written only where it changed, so nothing above it moves and nothing rebuilds mid-sentence. The menu is rebuilt only when the moves themselves change, so it does not flicker under a reply arriving word by word.
- The transcript keeps every turn until the conversation ends or the game replaces it. What the speaker does is one line on the turn it belongs to: sending it again replaces it and `null` takes it away.
- A face the player is not looking at holds no text, and neither does a window that has finished closing.
- The corner panel never grows down the screen: it shows what is worth a glance, points at the window for the rest, and scrolls inside itself if what is left still does not fit.
- The conversation, the window, the scrim behind it, the loader and the bar take the pointer; the rest of the interface lets clicks through to the scene.
- Announcements come in two sizes. A quest starting, finishing or failing is `major`: large, on the accent, 5.2 seconds. Everything else is `minor`: small, quiet, 2.6 seconds. A `model-busy` notice is a wait, drawn quiet with its seconds counting down in brass, and stays for the whole wait; an `error` is a fault, drawn warned, and stays as long as a finished quest would. The two never read as one. Four at once is the most on screen; older ones go first.
- A money change of zero announces nothing, so a quest that pays in goods does not flash an empty line.
- Nothing the player cannot undo happens on one click. Giving up a quest asks a second time, and leaving the button answers no.
- The story is never buried: the main line sits at the top of the journal, marked, and the corner panel says which of the two the player is on.
- A quest that ended is never simply gone: a failed page says it failed and why, a finished one says it is done, and neither offers a button that would do nothing.
- A quest page shows every step the engine kept, dropped branches included, in the order the quest was written. The journal never edits the story down to the part that happened.
- A question is drawn only where it can be answered: on the step whose `state` is `open`, and nowhere else. What is not answerable is not on screen, rather than on screen and inert.
- No option says where it leads. The hud draws the words the quest published and nothing it worked out about the far side.
- The hud decides nothing about the clock or the sky: a setting is reported and drawn as pushed back, so a button reads pressed only once the game says so.
- A quest's clock moves only when the journal is pushed, because it runs on the game clock; a wait's clock runs one real second at a time from the value announced. Both are written in place and never rebuild what is around them.
- What just changed says so: the reticle opens and goes brass while something is in reach, and a step count flashes when it climbs.
- Everything a mouse can do, the keyboard can do.
- Square corners: no `border-radius` in the stylesheet.
- `Objective.markerLabel` names a place, so the map reads it; putting a marker in the world belongs to the scene, not here.
- On the plan, what is drawn in cells scales and what is drawn in pixels does not: a name, a mark and the player's arrow are the same size at every zoom, and the view never leaves the city.
- The story and an errand never wear the same mark, on the plan, in the bearings or on the compass.
- The compass draws the numbers it is pushed and works out nothing about the route: the bearing and the distance are the game's.
- A locked fact is a line, never a gap: what is still to learn of a person is on their page.

## Dependencies

- `@gb/quest` contract (game/quest/CONTRACT.md): the `Objective` shape the objectives panel and the map read, the `JournalEntry` page the quests tab draws with its `QuestKind` and status, and the `Choice` on a step that asks a question.
- The DOM. No renderer, no three.js, no game state.

## How to modify this blackbox safely

A new kind of answer in the conversation is a case on `HudIntent` and a branch in the hud's `#dispatch`; anything the player picks goes out as an intent and comes back as a patch, because this box never decides what a move does. A new panel is a new surface in `src/surfaces/` plus its field on `HudPatch` and `HudState`, and its region and layer in `src/style/layout.ts`; nothing else changes, because every surface is handed the whole state. The map is four pieces under `src/map/`: the viewport (what is on show, in cells), the plan (the SVG), the gestures (wheel and drag) and the tools and legend over it; a new thing on the plan is a node in the plan, drawn in pixels if it must stay readable at every zoom. A new face of the window is an entry in `src/windows.ts` plus a `Tab` in `src/tabs/`, and it gets its chrome, its frame, its transition and its focus manners free. A new announcement is a kind on `Notice`, its wording, size and mood in `src/phrase.ts` and its name in the kind set. A new key is a `KeyAction` in `src/keys.ts` and a case in the hud, with its label in `src/controls.ts` so it appears on screen wherever it applies. Wording lives in `phrase.ts` and `controls.ts`; the look lives in `src/style/`, one file per concern, joined into one stylesheet at load. Run `pnpm --filter @gb/hud test` in the same change.
