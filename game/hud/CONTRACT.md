# @gb/hud contract

contractVersion: 0.13.0

## Purpose

Everything the player reads over the 3D scene, and what they open on top of it: what they are meant to be doing, which way it is, what the streets round them look like from above, what is in reach, the conversation they are in, what they are carrying and what it is worth, the places that are theirs, the counter they buy at, the machine they sit at, where things are and where a train goes, what they have found out, what they can set, what just happened, how a city is coming along while it is written, and how to get out of whatever they are in, which is asked before it is done.

## Shape

The game pushes state, the hud draws it. There is one store behind the whole interface and one render pass over it, so objectives, the prompt, the conversation, the announcements, the loader and the window are the same mechanism with different surfaces. Nothing here reads the game: it renders what it is handed and reports what the player did through one callback.

```ts
import { Hud } from '@gb/hud'

const hud = new Hud(document.body, { onIntent: (intent) => { /* say, choose, talk-closed, typing, window, track, abandon, decide, lock-time, skip-time, weather, minimap, fullscreen, exit, stay, buy, counter-closed, unlock, score, screen-closed, travel */ } })
hud.show({ objectives: log.objectives(), money: player.money(), prompt: { key: 'E', text: target.label } })
hud.show({ carrying: [{ id, name, value: 40 }], homes: [{ id, name, text, placed: [{ id, name, value }] }] })
hud.show({ counter: { seller: npc.name, offers: [{ id: item.id, name: item.name, price: item.value }] } })
hud.show({ screen: { machineId, title: 'Front desk terminal', locked: true, program: { kind: 'text', title: 'Ledger', lines } } })
hud.show({ screen: { machineId, title: 'Laptop', locked: false, program: { kind: 'snake', best: player.best(machineId) } } })
hud.show({ quests: log.journal(), trackedQuestId: 'q1' })
hud.show({ map: { width, height, plots, marks, stations, boarding }, settings: { hour, minute, locked, weather, weathers, minimap, fullscreen } })
hud.show({ minimap: { x, y, facing: body.yaw, radius: 40, plots, marks, doors: [{ id, name, x, y }] } })
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
| `hud.show(patch)` | [HudPatch](src/types.ts) | fields left out keep what is on screen; `null` clears the prompt, closes the conversation, the counter or the screen, shuts the window, stops following a quest, takes the survey, the compass or the loader away |
| `patch.objectives` | `@gb/quest` `Objective[]` | every open step of every live quest, in the order they should read; a step carrying a `choice` is tagged and points at the journal |
| `patch.trackedQuestId` | `string \| null` | the quest the objectives panel follows; unset means the first quest with an open step |
| `patch.prompt` | `{ key, text }` | text without the key: "Go into The Copper Wheel" |
| `patch.money`, `patch.carrying` | a whole number, [Carried](src/types.ts)`[]` | both read in the inventory, and the money at the counter too; `quest: true` marks an item a live quest wants, `value` is what it is worth in whole credits and is written on its row |
| `patch.homes` | [OwnedPlace](src/types.ts)`[]` | the places the player owns, replaced whole: `id`, `name`, a `text` line, and `placed`, the things they left there as `Carried[]` |
| `patch.counter` | [CounterView](src/types.ts) | a counter the player is standing at: the `seller`, and `offers` as `{ id, name, price }` in whole credits; pushed again after a sale, without the thing sold; `null` closes it |
| `patch.screen` | [ScreenView](src/types.ts) | the machine the player sits at: `machineId`, its `title`, `locked`, `refused` once a password was turned down, and `program`: `{ kind: 'text', title, lines }` for anything read (a ledger, the mail, what the cameras see), or `{ kind: 'snake' \| 'tetris', best }` with the playthrough's best score for that machine; `null` closes it |
| `patch.talk` | [TalkPatch](src/types.ts) | a new `speaker` starts a fresh panel; `turns` replaces the transcript; `reply`, `replyChunk` and `does` edit the speaker's current turn, opening one when the player spoke last; `does: null` takes the stage direction off that turn |
| `patch.talk.moves` | [TalkMove](src/types.ts)`[]` | what the player can do this turn, as `{ key, label }` in plain words. Replaces the menu; an empty list draws none |
| `patch.quests` | [QuestEntry](src/types.ts)`[]` | one page per quest for the quests tab: `@gb/quest`'s `JournalEntry[]` goes in as it comes, `kind` and `status` and all; `failReason` on a failed page, `timer: { remaining, total }` in game seconds on a timed one |
| `patch.map` | [MapView](src/types.ts) | the city in grid cells: `width`, `height`, one `plots` rect per building with an optional `label` (read on hover), `named: true` where the label is to be written on the plan, and `prominence` (`background`, `notable`, `landmark`, left out reads as background); `marks` for the player (`kind: 'you'`, `facing` in radians clockwise from north), each place to head for (`kind: 'goal'`), work waiting to be picked up (`kind: 'offer'`), both carrying `line` `main` or `side` (left out reads as side), and a place the player owns (`kind: 'home'`); `stations` where fast travel boards (`id`, `name`, `x`, `y`), and `boarding`, the id of the one the player stands at, while they do |
| `patch.minimap` | [MinimapView](src/types.ts) | the streets round the player for the corner view, in the map's own cells: where they stand (`x`, `y`), which way they face (`facing`, radians clockwise from north), the `radius` in cells the game windowed the city to, the `plots` inside it, the `marks` they are headed for (the map's own goals) and the `doors` they have walked through as `{ id, name, x, y }`; pushed as they walk; `null` takes it away |
| `patch.compass` | [CompassView](src/types.ts) | `facing` in radians clockwise from north, and the tracked `goal` when there is one: its `label`, `bearing` (same unit, the way to set off), `distance` in metres along the walk, `line`; pushed whenever the player turns or the guide resolves again; `null` takes the strip away |
| `patch.codex` | [CodexView](src/types.ts) | what the player has found out, replaced whole: `places` (`id`, `name`, a `text` line), `people` (`id`, `name`, `role`, `disposition` one of `hostile`, `cool`, `neutral`, `warm`, `friendly`, and every `facts` entry there is to learn, with `text` only on the ones learned; a fact's `id` is the game's handle, the index of the fact in the person's background as a string, and is never drawn), and `history` notes (`id`, `title`, `text`) |
| `patch.settings` | [SettingsView](src/types.ts) | the clock (`hour`, `minute`, `locked`), the sky (`weather`, and every `weathers` the game can show), and the view: `minimap` (left out reads as on) and `fullscreen` (left out reads as windowed); pushed again whenever any of it moves |
| `patch.controls` | [ControlHint](src/types.ts)`[]` | the game's own keys for the controls tab: `{ keys, text, group? }`, replaces the whole list |
| `patch.window` | `'quests' \| 'map' \| 'inventory' \| 'codex' \| 'settings' \| 'controls' \| null` | opens that face of the window, or shuts it |
| `patch.loading` | [LoaderView](src/types.ts) | a build under way: its `title` and its `stages`, each `{ id, label, state, done?, total? }` with `state` one of `waiting`, `running`, `done`; with no stages it is a veil with the title alone, for a ride between stations; `null` when the city is ready or the player has landed |
| `hud.announce(notice)` | [Notice](src/types.ts) | one of the nine kinds; `ms` overrides how long it stays |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `handlers.onIntent` | [HudIntent](src/types.ts) | `say` with the trimmed line, `choose` with the `key` of the move clicked, `talk-closed`, `typing` on every change of it, `window` with the face it moved to, `track` with the quest the player chose to follow, `abandon` with the quest they gave up, `decide` with the option they took, `lock-time` with whether the clock is to be held, `skip-time`, `weather` with the one picked, `minimap` with whether the corner view is to be drawn, `fullscreen` with whether the game is to fill the screen, `exit` and `stay`, the two answers to the question the interface asks before it hands the player back to the launcher, `buy` with the `itemId` of the offer clicked, `counter-closed`, `unlock` with the `machineId` and the `password` typed, `score` with the `machineId`, the `game` and the `score` when a game ends, `screen-closed` with the `machineId`, `travel` with the `stationId` picked |
| `hud.typing` | boolean | true while the conversation or a screen holds the keyboard, which is when the game must let its keys go |
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
| Minimap | `minimap`, `settings.minimap` | nothing |
| Notices | `hud.announce` | nothing |
| Bar | `window`, `hud.typing` | `window`, `exit` |
| Conversation | `talk` | `say`, `choose`, `typing`, `talk-closed` |
| Scrim | `window`, `counter`, `screen` | closes the one in front |
| Counter | `counter`, `money` | `buy`, `counter-closed` |
| Window | `window` | `window` |
| Screen | `screen` | `unlock`, `score`, `screen-closed`, `typing` |
| Confirm | the interface's own question | `exit`, `stay` |
| Loader | `loading` | nothing |

## Where things sit

The view is cut into regions that never cross, in pixels, in [src/style/layout.ts](src/style/layout.ts): the objectives corner top left (330 wide) with the minimap under it in the same column (230 square, above the foot), the band beside them across the top (196 tall) holding the compass strip (360 by 44, centred at the top of the band) with the notices column under it, the conversation down the right (380 wide, stopping above the foot), the bar along the foot (88 tall), and the room the window, the counter and the confirm share in what those leave. While a conversation is up the compass, the notices, the prompt and the room stop short of it. The corner column gives the minimap, the foot and the margins their pixels first and the objectives panel takes what is left, so however short the view is the two never meet. Each surface has a layer of its own, front to back: corner, minimap, compass, side, notices, bar, scrim, counter, window, screen, confirm, loader. Nothing shares a layer, so nothing is ever drawn through anything else.

The window is one frame, 1320 by 800, centred in its room and clamped by it on a small screen, and it is that shape whatever face is up: a face is handed the body and scrolls inside it, and nothing in the window sizes itself to what is on the face. It is as near the whole view as the regions allow, because a map and six pages of lists want the room. At that width a face that is a list of rows runs in columns 440 wide rather than one line across the frame, and falls back to one column when there is no room for two; the map and the quests take the whole width instead, because a plan and a quest page with its steps under it both want it. The counter is a second frame with the same chrome, 520 by 460, in the same room and behind the window, so a player can open their inventory over a counter and come back to it. The confirm is a third, 420 wide, in the same room and in front of both. A screen sits in the middle of the whole view, sized by its own grid of characters.

## The conversation

A panel of fixed width, up while a conversation is open and gone when it ends, holding the whole transcript: every turn so far, oldest first, the player's turns and the speaker's read apart. A speaker's turn has what they say and, when the turn had one, what they do, drawn apart as stage direction so narration never reads as dialogue. Long conversations scroll inside the panel; the panel never changes size for what arrives.

The conversation takes an answer two ways and treats them as the same thing. Typed words go out as `say`. The moves the game says are legal go on screen as buttons, and clicking one goes out as `choose` with that move's key, which the game hands straight back to whoever owns the rules. Both put the player's own line on the transcript, so a conversation reads the same afterwards however it was held.

The menu is only ever what is legal now. Nothing is drawn greyed out for later: a move the game stops sending is off the screen on the next push, and a turn with nothing on the menu shows no menu at all rather than a row of things that do nothing.

Answering quiets the menu. Between the player answering and the game publishing the next menu, the moves stay on screen to read and take no clicks, so a second answer cannot land on a turn that has already moved on. The game ends every turn by publishing a menu, even an empty one, which is what makes them live again.

## The window

One shell: a title head with the face's name and the way out, a tab strip under it with an icon and a key on every tab, and six faces behind them. Each face is handed the same state.

| Tab | Draws from | Emits |
|---|---|---|
| Quests | `quests`, `trackedQuestId` | `track`, `abandon`, `decide` |
| Map | `map`, `objectives`, `trackedQuestId`, `quests` | `travel` |
| Inventory | `money`, `carrying`, `homes` | nothing |
| Codex | `codex` | nothing |
| Settings | `settings` | `lock-time`, `skip-time`, `weather`, `minimap`, `fullscreen`, `exit` |
| Controls | `controls` | nothing |

The objectives panel shows the tracked quest and its open steps, a count as "2/5" where a step wants more than one, a tag on optional work, and one line for how many other quests are running. With nothing on it, it says which kind of nothing: a player who has never held a quest is pointed at somebody to talk to, one between jobs is told there is no step open. The journal reads the same two ways. The map draws the survey when the game has one, filling the frame, and lists the places to head for either way. The inventory holds the credits and everything in hand, quest items first, each with its value where it has one: money is a thing the player carries, so it is read there and in no corner. Under them, the places the player owns, each with its line and what they have put in it; a place with nothing in it says so, and so does a player with no place yet. The codex files what was found under Places, People and History. Settings shows the hour as a clock face beside a button that holds it and one that skips ahead, one button per weather with the current one pressed, under View a button for the minimap and one for full screen each reading what the game pushed back, and the way out; until the game has pushed the clock it offers the view and the way out and says the rest comes once the city is running. Controls lists the game's keys, then the interface's.

## The map

The plan fills the window's body edge to edge and is read by zooming into it. Plots are drawn in cells and scale with the zoom; the player's arrow, the goal marks and every name are drawn in pixels, so they are the same size at any zoom and a city of twenty blocks comes apart into readable names as the player zooms in. At first the whole city is framed to the plan's aspect. The wheel zooms about the pointer, a drag pans, and the four tools over the plan do the same with a key each printed on them: Zoom in `+`, Zoom out `-`, Fit `0`, You `Y` (centre on the player); the arrows pan while the map has focus. The view is held inside the city, and it survives the survey being pushed again, so a plan four times a second does not throw the player's zoom away. Twelve times the whole city is as far in as it goes.

A plot's `label` is read on hover; it is written on the plan only where `named` says so, which is the caller's list of places entered, quest targets and landmarks. `prominence` picks one of three fills (`--gb-plot`, `--gb-plot-notable`, `--gb-plot-landmark`), so a chapel and a jail are not two more grey rects. Work is a burning square with its name beside it: orange on the story, yellow on an errand, each over a soft square of its own colour that stands in for a glow. A job the player has taken wears a ring round the square as well, so what is on the board reads apart from what is waiting to be picked up. A place the player owns is an open house outline in lit cyan. The bearings along the foot list every goal mark, the story tagged `Main`, and clicking one swings the plan onto it; without a survey they list the tracked quest's open steps by `markerLabel` instead, and with nothing to head for they say so.

Stations are squares of ink on the plan, each with its name, and a list beside the bearings. Standing at one (`boarding` names it), that station wears `Here` and every other carries a Travel button that reports `travel` with its id; anywhere else the list only names them and says to walk up to an entrance. The ride is the game's: it closes the map, pushes a `loading` with the title alone as the veil, moves the player and takes the veil away. A city with no stations lists none.

## The counter

A counter the player is standing at, in a frame of its own with the seller's name on it: what they have to spend, then one row per thing on offer with its price and a Buy button. Clicking Buy reports `buy` with the offer's id and nothing else; the game pays, takes the thing, and pushes the counter and the money again, so the row goes on that push and never before. A thing that costs more than the player holds stays on the counter to read, its price warned and its button off, so they know what to come back for. A counter with nothing on it says so. Escape, the close button and `counter: null` close it.

## The screen

The machine the player sits at, drawn as text: one grid of 48 by 21 characters in the machine's own green, under the machine's name and the close button. Whatever runs on it draws into the same grid and the frame is the same size for all of them: the status line along the bottom says what the keys do.

Locked, the screen asks for the password. Every printable key goes into the line as a star, Backspace takes one off, Enter reports `unlock` with the line typed and clears it; the hud never knows the password. The game answers by pushing `locked: false`, which runs the program, or `refused: true`, which writes "Wrong password" under the prompt.

Open, the screen runs the `program` pushed. A `text` program is the title over its lines, wrapped to the grid, with the arrows scrolling what does not fit. A game program is `snake` or `tetris`, playable with the arrows (tetris turns on Up and drops on Space), the first key setting it going. Snake credits ten a bite and ends on a wall or its own tail; tetris scores 40, 100, 300 and 1200 for one to four rows at once and ends when a piece cannot spawn. When a game ends it reports `score` once, with the machine, the game and the score, and says so on the glass with Enter to play again. The best score is the playthrough's: pushed as `best`, drawn beside the live score, and written into the running game without starting it over, so pushing a new best after a `score` does not lose the board.

While a screen is up every key is the screen's and the game hears none: `typing` reads true, and false again before `screen-closed`. Escape, the close button and `screen: null` close it.

## The minimap

A square in the corner, above the bar, north up, on while the game pushes it. The player's arrow is at its centre and turns as they turn; the streets are the plots the game sent, windowed to a radius it chose, drawn in cells so a bigger radius shows more city rather than bigger buildings. Everything read on it is drawn in pixels: the arrow, the goals and the doorways are the same size whatever radius the game picked.

The goals are the map's own marks, wearing the map's own shapes, so a place on the plan and the same place in the corner are recognisably one place. A goal further out than the radius is held at the rim on its bearing and drawn quieter, so where to head is never off the panel. A doorway the player has walked through is an open ink square, which is how a place already found is told from a place still to reach. The corner pins goals only: it is a hundred metres of street, not a board of everything waiting in town.

It draws from what it is pushed and never from a second pass over the world, it takes no clicks, and `settings.minimap: false` takes it off the screen while the game goes on pushing it. `minimap: null` takes it away.

## The two lines of work

The story burns orange and an errand yellow, everywhere they are drawn: on the plan, in the corner, in the bearings list beside the plan and on the compass strip, the strip at its own size. Each mark carries a dark edge, so neither disappears over a lit plot or a black street, and the glow behind it is a second square rather than a filter, because both plans are drawn over a running scene. What separates work taken from work waiting is the ring, not the colour. The `line` is the game's: left out reads as an errand.

## The compass

A strip along the top of the play view answers "which way" without a key. The points of the compass slide along it as the player turns, with the way they face at the centre; the tracked goal's mark sits at its bearing, the plan's own square in the line's own colour, and pins to the nearer edge while the goal is behind the player. Under the strip: the goal's name and the distance ("140 m", "1.2 km"). The strip shows 120 degrees of arc across 360 pixels. The game pushes `facing` and whatever its guide resolved; the strip draws it and takes no clicks. Without a goal the points still turn; `compass: null` takes the strip away.

## The codex

Three headings, drawn only when they have rows: Places the player has walked into, each with its line; People they have met, each with how they stand towards the player as a tag (`Hostile` and `Cool` warned, `Warm` and `Friendly` in brass, `Neutral` quiet, each as a chip), what they do, a count "2 of 5 known" and every fact there is to learn of them, the learned ones in words and the rest as a locked line that says "Not learned yet"; and History, what they have been told of the city. A fact is never blank: a person with something still to find out shows it. The game keeps the record and decides what unlocks; the tab reads the push.

## The journal

A page is `@gb/quest`'s journal page as it stands: `hud.show({ quests: log.journal() })` with nothing in between. The title is read as `questTitle`, and as `title` for the shorter form the tab has always taken.

The story is listed first and wears a `Main` tag; errands follow in the order the game sent them. The corner panel wears the same tag while the player is following the story, and while they are following an errand with the story still open, its last line says so: "2 more quests, one is the main line". A page with no `kind` reads as an errand.

A page's `status` says how the quest stands; left out, it is under way. A finished page wears `Done`, a failed one wears `Failed` and its `failReason` under the title in words ("Ran out of time", "Somebody it needed is gone"), so a quest that ended is read and never simply missing. Only a live page carries Track and Give up: a finished one has nothing that would do anything.

A timed page shows the time left in game time ("1 h 12 min", "9 min", "45 s") and a bar for the share of the whole, written into the clock already there on every push of the journal. The timer runs on the game clock, so the hud keeps no clock of its own for it: the game pushes the journal on every clock tick and a held game holds the countdown. Twenty-four game seconds pass per real second, so "9 min" on the page is about 22 real seconds of play. Under a tenth of the whole, or ten game minutes, it is warned.

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

Every setting is an intent the game acts on, and the tab draws what the game pushes back: `lock-time` carries whether the clock is to be held, `skip-time` asks for the next time of day, `weather` names the one picked, `minimap` whether the corner view is drawn, `fullscreen` whether the game fills the screen. The button reads locked once `settings.locked` says so, not before, and the same for the other four. The clock and the sky wait for a running city; the view does not, so the minimap and full screen answer from the first push and read their defaults until the game says otherwise (the minimap on, the game in a window). Full screen is the browser's to do: the hud owns the button, the key and the intent, the game makes the call and pushes `settings.fullscreen` back.

## Asking before it is thrown away

One panel asks "you sure", in place, on its own layer in front of the window: what it is about, the question in a line, and Yes and No with their keys on them. Enter is yes, Escape is no, clicking past it is no, Tab stays on the two answers, and every other key stops there rather than moving a player who is deciding. Yes takes the focus ring, because the keyboard and the ring never give two different answers. It reports the answer and changes nothing itself.

Leaving is what it asks about today. `exit` from the Leave button, from its key and from the Settings tab all raise the question; only the yes goes out, as `exit`, and the no goes out as `stay`. So the game hears `exit` when the player has said they mean it, and hands them back to the launcher on that and nothing else. Another thing worth asking about is an entry in `ConfirmAsk` with its wording and the two intents it answers with.

## The loader

A city being written covers the view: its title and each stage of the build, the one under way marked, the finished ones ticked, a bar per stage filled from `done / total` by scaling where the stage can count and whole once it is `done`. Rows keep their node from push to push, so a bar fills rather than blinks. With no stages it is a veil, the title alone, which is what a ride between stations shows. `loading: null` takes it away.

## The look

The city is cyberpunk at night, so the ground is near black with a teal cast and the accent is the city's cyan; brass marks the main line of quests and nothing else. It is written to [docs/UI.md](../../docs/UI.md), one specification the hud and the front door both build from.

Everything is declared as custom properties on `.gb-hud` in [src/style/tokens.ts](src/style/tokens.ts), and nothing downstream writes a colour or a duration of its own: a colour is changed there and the whole interface follows.

| Token | For |
|---|---|
| `--gb-void`, `--gb-panel`, `--gb-solid`, `--gb-lift`, `--gb-well`, `--gb-scrim` | behind everything, a floating panel, a frame that owns the view, a raised thing, a sunken thing, the dim behind a frame |
| `--gb-edge`, `--gb-edge-lit`, `--gb-edge-accent` | a hairline at rest, under the pointer, on the thing that is chosen |
| `--gb-accent`, `--gb-accent-lit`, `--gb-accent-dim`, `--gb-accent-ink`, `--gb-accent-glow` | cyan: anything the player can act on, hovered, quiet, the text on a filled accent, its halo |
| `--gb-main`, `--gb-main-lit`, `--gb-main-dim`, `--gb-main-ink` | brass: the main line of quests, its mark, its chip and its bar |
| `--gb-ink`, `--gb-dim`, `--gb-faint` | text at three weights of attention |
| `--gb-good`, `--gb-warn`, `--gb-danger`, `--gb-off`, `--gb-off-ink` | done, attention without failure, a failure, and a thing out of reach |
| `--gb-glass`, `--gb-phosphor`, `--gb-phosphor-dim` | a machine's screen: the glass, the text on it, and its glow |
| `--gb-plot`, `--gb-plot-notable`, `--gb-plot-landmark` | the three fills a plot is drawn in |
| `--gb-frame` | the drop every frame wears, as a filter, because a chamfer clips a shadow away |
| `--gb-hatch` | the diagonal on a header or a major announcement |
| `--gb-display`, `--gb-body`, `--gb-mono` | condensed for labels, system sans for prose, monospace for numbers |
| `--gb-s1` to `--gb-s6` | 4, 8, 12, 16, 22, 32 px |
| `--gb-cut-frame`, `--gb-cut-panel`, `--gb-cut-row`, `--gb-cut-chip` | 14, 10, 6, 4 px of chamfer, by what wears it |
| `--gb-in`, `--gb-out` | arriving and leaving, on two curves and no others |
| `--gb-t-press`, `--gb-t-state`, `--gb-t-value`, `--gb-t-leave`, `--gb-t-enter`, `--gb-t-veil`, `--gb-stagger` | 90, 140, 200, 200, 320, 400 ms, and 24 ms per row |

Type stacks only, no font file: the box ships as one string with no assets, so a face would have to be inlined into every consumer's bundle. Eight steps, `t0` to `t7`, are declared in [src/style/type.ts](src/style/type.ts) and worn by class. Labels are condensed, upper case and tracked; every number is monospace with tabular figures at the size of the text it sits in, so a credit count or a clock does not shift what is beside it.

The panel language is in [src/style/shape.ts](src/style/shape.ts): the chamfer, the two-layer edge (a border cannot follow a `clip-path`, so the element is painted in the edge colour and a pseudo-element inset 1px in the ground), the corner ticks and the header. Lighting an edge is one property, `--gb-line`; the focus ring is that edge thickened to 2px, since an outline would be clipped away. The parts built on it are in [src/style/parts.ts](src/style/parts.ts): the chip, the key cap, the icon tile, the button, the field and the bar that fills.

One row does the work of the quest list, the inventory, the codex, the settings, the stations, the bearings, the controls and the counter: an icon tile, a title over a supporting line, what state it is in, what can be done about it, and the key that does the same thing. It is specified in [src/style/row.ts](src/style/row.ts) and built by [src/ui/row.ts](src/ui/row.ts). A row with nothing to do is not a button and does not answer the pointer.

Every picture is inline SVG on one 24 by 24 grid, one stroke weight, one colour inherited: [src/ui/icon.ts](src/ui/icon.ts) holds the whole set. No icon fonts, no image files, and the only filled one is a mark that stands for a place on the plan.

## Motion

Motion says a thing arrived, changed or left, and it never delays input: a click runs its handler on the same tick and the pixels catch up. The durations live in [src/motion.ts](src/motion.ts), which the stylesheet writes into its own tokens, so both follow one number.

Only `transform` and `opacity` move (colour changes with them where the spec asks), because this interface draws over a scene running every frame: nothing animates a size, a position, a filter, a shadow or a background, and there is no `backdrop-filter` anywhere.

| Kind | What it does |
|---|---|
| A frame: the window, the counter, the confirm | rises 12 px into place, settles 6 px out |
| A side panel: the conversation | in and out through its own edge |
| A corner panel: objectives, minimap, compass | drops in from above |
| A notice | in from the left edge and out the same way; the ones below slide up as it goes |
| A screen and the scrim | fade, because a machine the player sat down at does not fly |
| The loader | fades over 400 ms, the only 400 |
| A list of rows | each row rises in turn, 24 ms apart, capped at eight |
| A tab's content | slides in from the side the player moved towards |
| A bar | scales from its left edge, never widens |
| A number that changed | counts to its new value; under three units it snaps |
| A count that climbed | bumps once, on its own inline box |

Nothing loops: no pulse, no shimmer, no spinner that turns forever. Under `prefers-reduced-motion` every duration collapses to an instant and every stagger goes to zero.

## Keys the interface owns

One listener, on the window in the capture phase, so it runs before anything the game bound anywhere.

- `Escape` closes what is in front of the player, one at a time: the question, then the screen, then the window, then the counter, then the conversation. On a question it is the no. With nothing open it passes through to the game.
- `J` quests, `M` map, `I` inventory, `X` codex, `O` settings, `?` `/` and `F1` controls. The key of the face already up puts the window away; any other switches face without closing anything.
- `N` leaves: it raises the question, the same as the Leave button on the bar and the Exit game button in Settings, and the answer is what goes out.
- `F` asks for full screen, and asks to come back from it. The browser call is the game's.
- `Enter` sends what is in the conversation box, and answers yes to a question.
- `Tab` cycles inside whatever is in front of the player: the question, the open window, the counter, or failing those the conversation, where the ring is the box, then each move, then the way out. Left and right walk the tab strip while it has focus.
- While a screen is up every key but `Escape` is the screen's: the password line, the reader's arrows, a game's arrows, Space and Enter. Held keys repeat there and nowhere else.
- While the map has focus, `+` and `-` zoom, `0` fits the city, `Y` centres on the player and the arrows pan. They are printed on the map's tools and listed under Map in the controls tab.
- While the player is writing, and while a question is up, every other key stops at the hud and the game hears nothing.
- A key the interface does not use passes straight through, and so does every key while another text field on the page has focus.

## Errors (closed set)

Thrown as `HudError` with a `code`:

- `hud-destroyed`: `show` or `announce` after `destroy`.
- `unknown-notice`: a notice kind this box does not draw.
- `no-conversation`: a talk patch that edits a reply while no conversation is open.

## Invariants

- The only way in is `show` and `announce`; the only way out is `onIntent`. The hud never reads the world, the playthrough or the renderer.
- One window, one face, one frame. Opening a face closes the one before it, so there is one scrim, one focus trap and one way out whatever the player is reading, and the frame is the same size whichever face is up. The counter and the screen are frames of their own on layers of their own, so what is in front is never in doubt: the screen, then the window, then the counter.
- The regions in `layout.ts` are disjoint: the objectives corner, the minimap under it, the notices column, the conversation and the room the framed panels stand in never overlap, and each surface has a layer of its own.
- Every window closes two ways: a button the player can see and click, and a key. The key is printed on the button.
- A surface arrives in 320 ms and leaves in 200 ms, on `transform` and `opacity` alone. A window is closed the moment it is asked to close: it stops taking clicks, leaves the accessible tree and lets the keyboard go, and only its pixels linger. The key that closes one window is free to open the next in the same breath. Nothing waits on a transition: a click runs its handler on the same tick.
- Nothing takes the keyboard except the conversation, for as long as focus is anywhere inside it, and a screen, for as long as it is up. `typing: false` is reported before `talk-closed` and before `screen-closed`, so the game has its keys back before it hears the thing ended. Stepping off the box onto a move does not hand the walk keys back mid-sentence. `typing` is reported on change only, never twice in a row.
- Focus goes where the player is: a window that opens takes focus and hands it back to whatever had it when it closes. Nothing to hand back to means the page, which is where the game listens.
- The player can read the controls without leaving what they are doing: the buttons carry their keys, the conversation carries its own two, and the controls tab lists everything the game declared beside everything the interface owns.
- A streamed reply appends into the node already on screen: text is written only where it changed, so nothing above it moves and nothing rebuilds mid-sentence. The menu is rebuilt only when the moves themselves change, so it does not flicker under a reply arriving word by word.
- The transcript keeps every turn until the conversation ends or the game replaces it. What the speaker does is one line on the turn it belongs to: sending it again replaces it and `null` takes it away.
- A face the player is not looking at holds no text, and neither does a window that has finished closing.
- The corner panel never grows down the screen: it shows what is worth a glance, points at the window for the rest, and scrolls inside itself if what is left still does not fit.
- The conversation, the window, the scrim behind it, the loader and the buttons on the foot bar take the pointer; the rest of the interface, the band the bar sits on included, lets clicks through to the scene.
- Announcements come in two sizes. A quest starting, finishing or failing is `major`: large, hatched, 5.2 seconds. Everything else is `minor`: small, quiet, 2.6 seconds. Each carries a key line in the colour of its mood, so a finished quest, a fault and a wait never read as one thing. A `model-busy` notice is a wait, drawn quiet with its seconds counting down in accent, and stays for the whole wait; an `error` is a fault, drawn in danger, and stays as long as a finished quest would. The two never read as one. Four at once is the most on screen; older ones go first.
- A money change of zero announces nothing, so a quest that pays in goods does not flash an empty line.
- The counter sells nothing itself: `buy` names the offer and the game pays, takes and pushes the counter again. A price the player cannot meet is read, not hidden.
- The hud never holds a password: what is typed goes out as `unlock` and the game says whether the screen opens.
- A game reports its score once, when it ends, and draws the best it is pushed; a push of `best` never restarts a game.
- A screen is one grid of characters whatever runs on it, so the frame is the same size for a ledger, a lock and a game.
- A ride is the game's: `travel` names the station and the hud draws the veil it is pushed.
- Nothing the player cannot undo happens on one click. Leaving the game asks in place and hands the player back to the launcher on the yes alone; giving up a quest asks a second time, and leaving the button answers no.
- The story is never buried: the main line sits at the top of the journal, marked, and the corner panel says which of the two the player is on.
- A quest that ended is never simply gone: a failed page says it failed and why, a finished one says it is done, and neither offers a button that would do nothing.
- A quest page shows every step the engine kept, dropped branches included, in the order the quest was written. The journal never edits the story down to the part that happened.
- A question is drawn only where it can be answered: on the step whose `state` is `open`, and nowhere else. What is not answerable is not on screen, rather than on screen and inert.
- No option says where it leads. The hud draws the words the quest published and nothing it worked out about the far side.
- The hud decides nothing about the clock or the sky: a setting is reported and drawn as pushed back, so a button reads pressed only once the game says so.
- A quest's clock moves only when the journal is pushed, because it runs on the game clock; a wait's clock runs one real second at a time from the value announced. Both are written in place and never rebuild what is around them.
- What just changed says so: the reticle opens and goes accent while something is in reach, a step count bumps when it climbs, and a credit count runs to its new value instead of jumping.
- Everything a mouse can do, the keyboard can do.
- Square corners: no `border-radius` in the stylesheet. Corners are chamfered with `clip-path`, two opposite corners on the diagonal that faces the middle of the view.
- Asked for less movement, every duration collapses to an instant: nothing is removed from the screen and nothing changes place.
- `Objective.markerLabel` names a place, so the map reads it; putting a marker in the world belongs to the scene, not here.
- A place the player owns is never a gap: with nothing placed it says so, and a player with no place is told as much.
- On the plan, what is drawn in cells scales and what is drawn in pixels does not: a name, a mark and the player's arrow are the same size at every zoom, and the view never leaves the city.
- The story and an errand never wear the same mark, on the plan, on the minimap, in the bearings or on the compass, and they differ in shape and fill rather than in shade, so neither reads as the other at a glance or over a pale plot.
- The minimap draws what it is pushed, windowed by the game, and never a second pass over the world. A goal beyond the radius is at the rim, never off the panel.
- The hud decides nothing about the minimap or full screen either: both are reported and drawn as they are pushed back, and full screen is the game's call to the browser.
- The compass draws the numbers it is pushed and works out nothing about the route: the bearing and the distance are the game's.
- A locked fact is a line, never a gap: what is still to learn of a person is on their page.

## Dependencies

- `@gb/quest` contract (game/quest/CONTRACT.md): the `Objective` shape the objectives panel and the map read, the `JournalEntry` page the quests tab draws with its `QuestKind` and status, and the `Choice` on a step that asks a question.
- The DOM. No renderer, no three.js, no game state.

## How to modify this blackbox safely

A new kind of answer in the conversation is a case on `HudIntent` and a branch in the hud's `#dispatch`; anything the player picks goes out as an intent and comes back as a patch, because this box never decides what a move does. A new panel is a new surface in `src/surfaces/` plus its field on `HudPatch` and `HudState`, and its region and layer in `src/style/layout.ts`; nothing else changes, because every surface is handed the whole state. A framed panel in the room (the window, the counter) is built on `HudWindow` and gets the chrome, the transition and the focus manners free. A new thing worth asking "you sure" about is a value on `ConfirmAsk`, its wording in `phrase.ts` and its pair of intents in the hud's `ANSWERS`; the panel, the keys and the focus manners come with it. The map is six pieces under `src/map/`: the viewport (what is on show, in cells), the plan (the SVG), the minimap's own plan in `near.ts`, the gestures (wheel and drag), the tools over it and the two lists under it; a new thing on the plan is a node in the plan, drawn in pixels if it must stay readable at every zoom. The shapes both plans draw live in `src/map/marks.ts` and are painted by `src/style/marks.ts`, so a mark cannot come out one way on the plan and another in the corner. A new program on the screen is a `ScreenApp` in `src/screen/` (rows of text, a status line, a key) plus its kind on `ScreenProgram` and a branch where the surface builds one; the grid, the padding and the overlay helpers are in `src/screen/size.ts`. A new face of the window is an entry in `src/windows.ts` plus a `Tab` in `src/tabs/`, and it gets its chrome, its frame, its transition and its focus manners free. A new announcement is a kind on `Notice`, its wording, size and mood in `src/phrase.ts` and its name in the kind set. A new key is a `KeyAction` in `src/keys.ts` and a case in the hud, with its label in `src/controls.ts` so it appears on screen wherever it applies.

Wording lives in `phrase.ts` and `controls.ts`. The parts every surface is built from live in `src/ui/`: the icon set, the row, the button, the chip, the bar and the counting number; use them rather than laying out a row of your own. The look lives in `src/style/`, one file per concern, joined into one stylesheet at load in the order of the cascade: the tokens, then the type, the shapes, the row and the motion every surface shares, then one file per surface. Every rule is written under `.gb-hud`, so a surface rule and a shared rule carry the same weight and the later one wins. A new colour is a token or it is a bug; a new duration is a field on `MS` in `src/motion.ts`. Run `pnpm --filter @gb/hud test` in the same change.
