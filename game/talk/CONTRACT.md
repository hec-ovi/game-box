# @gb/talk contract

contractVersion: 0.10.0

## Purpose

Conversations with the people in the city: each person is their own session, speaks first off the game's own data, takes a turn as one call that says what they do and what they say, holds what the player told them, lets slip what the codex can earn, and picks what they do from the short list of things the quest script made legal this turn.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Conversation.open({ world, log, player, sidecar, npcId, sessions?, signal? })` | a `@gb/world` `World`, `@gb/quest` `QuestLog`, `@gb/play` `PlayerState`, `@gb/sidecar` `Sidecar`, this box's `Sessions`, and the player's own `AbortSignal` | the NPC is in the world |
| `new Sessions()` | nothing | one per playthrough; holds one transcript per person |
| `say(text)` | what the player said | |
| `choose(key)` | the `key` of a move read off `moves()` | none: a key that is not legal now is a no-op |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `open` | `{ conversation, changes, opening, learned }` | the person goes in the codex as met and `learned` lists the fact ids seeing them earned; walking up to someone is a `talked` event, so a step that already asked for it completes here; a step that names a subject waits to be asked |
| `opening` | `{ line, moves }` | what they say before the player has said anything, and the moves that were legal when they said it. Always a line, never a model call |
| `say` | a stream of `TalkEvent` | `turn` with `does` (what their body does, when it does anything) and `says` (the words); `learned` for a fact about themselves they let slip; `answered` when the reply was a yes or a no; `did` for the action taken; `changed` for every quest change it caused; `over` when it ends |
| `available()` | the action names legal right now | what the UI can promise before a word is said |
| `moves()` | every legal move as `{ key, action, label }` | `label` is what the player clicks, in their own words and with no id in it; `action` is its `ActionName`, so a caller can filter or group without reading the key; `key` names the move and what it is about, never its place in the list |
| `choose` | a stream of `TalkEvent` | the same shape `say` gives: the spoken `turn`, `learned`, `answered`, `did`, `changed`, `over` |
| `history()` | `Turn[]` | this person's transcript, oldest first, bounded: `{ role, content, does? }`, with `does` on a turn whose body did something, so a reopened transcript shows what they did as well as what they said |

## Every person is their own session

A conversation is built from the world and the playthrough as they stand the moment it opens, and reads them again on every turn: the building, the room, who is in it, what the player carries. Nothing is kept from one opening to the next except through `Sessions`, and nothing is shared between two people. Measured on 2026-08-25 with the sidecar up: two openings in two buildings sent two briefs, one naming Mara Cole behind the counter at The Anchor and one naming Dov Ferro at his desk at Ferro's Tools.

`Sessions` is one transcript per npc id, kept for as long as the playthrough runs. Hand the same one to every `open` and walking back up to somebody carries on where the two of them left off, with their own greeting on top; somebody else opened against the same `Sessions` hears none of it. A transcript keeps the last 16 turns, so a long acquaintance costs a few lines. Leave `sessions` out and the conversation starts from nothing.

What outlives the session is not the transcript but what the person holds of the player, through `@gb/play`: see "What a turn leaves behind".

## Talking to someone counts when it counts

A `talked` event fires when the conversation opens, and again after anything the NPC does. The second one is what makes a generated job playable: those quests open with "go and hear them out", and the step that says so is opened by the giver handing the job over, one moment after the greeting. Credited only on the way in, the objective would read as an errand to go and find the person the player is stood in front of. Credited again after the move, the objective the player sees is the first thing they still have to do.

A step that names a subject is a different promise. A `talk` step may carry a `topic`, and `@gb/quest` credits one only for a `talked` event carrying that same subject, so being stood in front of the person is not enough. The subject is a move of its own: `ask_about`, on the menu for as long as a step is waiting to hear it raised with this person, written the way the player would click it ("Ask about the missing shipment"). **The step is credited when that move is taken, and at no other time**: clicked, picked off the same menu by the action track, or asked for in words plain enough for the offline reader to be sure of. A conversation that wanders onto the subject credits nothing, however much either side says about it, because a reply is not a decision: guessing at one either takes work off the board the player never did or refuses work they did. Walking up to somebody credits the steps that name no subject, and only those.

## They speak first

Opening a conversation hands back the opening turn, so the panel has something in it the instant it appears. No model is asked for that line: a turn from the local model costs seconds, and seconds of empty panel at the moment the player presses the key is worse than saying nothing. The line is built from what the box already holds: the hour, what the player's name in town is worth, the person's own business, and the one move on the menu worth mentioning. It is string work over data in memory.

The middle beat is the person's own business. When the world file says why they are where they are (`life.reason` for somebody at their post, `life.errand` for somebody out walking) that sentence is the beat, said as it is written. Without one, the beat is drawn from the spot they keep (behind the counter, at the desk), from the `stand` pool for an indoor spot with no lines of its own, and from the `street` pool only for somebody with no station at all; now and then it is a nod at who else is in the room. The weather is never in it: the sky is the same for everybody in town at once, so a greeting that varied on it made every character sound like the same person.

The draw is seeded from the world's own seed and this person's id, so a world file shared between two machines greets the same way on both. The hour is in the seed as well, so somebody spoken to at dawn and again at dusk does not open with the same line twice.

The line goes into the transcript as their turn, so the model answers on top of what the player has already read. The moves that come with it are the ones `moves()` gives: the greeting nudges at the one worth mentioning ("that's my ledger you're carrying") and the button under it carries it out with no model call either. No greeting names a quest by its title, because the pitch keeps for the turn the player asks for it.

## One turn, two tracks

The voice goes first and is the person. It is given the character, the room and what is going on, and one call it has no choice about making: `take_turn`, whose fields are `does` (what their body does, in a few words, left out when they only speak), `says` (the words out loud), `reveals` (the number of a fact about themselves they let slip, offered only while there is one to let slip), `remembers` (what the player told them worth keeping) and `mood` (how the turn left them: warmer, cooler, same). `does` is first in the schema on purpose: llama writes the fields in schema order, so the body is settled before the words are written and the words follow it. The call is offered no menu and no ids. The turn arrives whole: 4.1 to 6.6 s per turn measured on 2026-08-25 against gemma-4-26b on a generated city, with a brief of about 1,100 tokens.

The action track then decides, once. Every move that was legal when the turn began is written out as a numbered menu in plain words, with "nothing but talk" as number 1, and the model answers by making a call it is given no choice about making, at temperature 0. The parameters of that call are the menu: one line number, checked against the number of lines before it gets back here. There is no text to parse and no answer off the list to interpret. One turn is at most one action, and nothing is the usual answer. A call that comes back any other way (prose instead of the call, a number the menu has not got, nothing running at all) has not answered it, and the player's own words decide the turn instead. Measured at 1.9 to 2.2 s, which is how late the nod lands after the words: the decision reads the reply, so the two calls cannot overlap.

Ids never appear in either track. The menu says "the job: The Ledger", not a quest id, and the number maps back to the id on this side of the boundary. Both `does` and `says` are scrubbed of anything id-shaped before they are published.

## What the character is told

One fixed labelled template, `prompts/npc.md`, filled from three places:

- **By the engine, every turn:** the building, the room and what stands in it (furniture, and the things lying on its surfaces that the player has not taken), what they are doing there (the anchor's `doing` phrase when the world file wrote one, else a line for the anchor's kind, from `prompts/surroundings.md`), the hour, the weather, who else is in the building and what each is doing, what the player is carrying, what the player's name in town is worth, how this person feels about them, what they remember of them, and what is between them read off the moves they may make and the targets the quest log resolved (they are told they are owed a ledger and what the job pays, never the objective line the HUD shows).
- **By the generator, once per person, in the world file:** `personality`, and every `Npc.life` field it wrote (`manner`, `history`, `interests`, `cares`, `avoids`, `reason`, `errand`), one labelled line each and none for a field it did not write; `knowledge`, plus the premise's `common` facts marked as what everybody in town knows; and the `background` facts whose stage the player has reached and has not earned yet, numbered.
- **Fixed in the template:** how to speak, as a short list of rules (the first clause answers what was actually said, a name put as a question is confirmed or corrected first, the length follows the question, the room and the sky are drawn on only when they bear on what was asked, the body goes in `does`), and three worked examples per turn, each a question with a reply of the right shape beside one of the wrong shape and why. The examples carry no name, place, price or sky, and a different three are drawn every turn, seeded off the world, the person and the turn count, so none can settle in as the answer.

The weather is one labelled line the model may draw on. It is not seeded into anything the character says.

Measured against the two exchanges the owner reported, on a generated city with the model up, 2026-08-25: "Mina Okoro? how are you" answered "That's me. I'm fine." with `does` "taps a rhythm on the desk with a heavy brass paperweight"; "do you need help?" answered "I've a job that needs doing, if you're looking for work. There's a crate over at Vane's Refractives that I need someone to fetch for me. Just take it without any fuss and I'll see you're looked after."

## What a turn leaves behind

Three things, all through `@gb/play`, all bounded there, and none of them shared with anyone else in town:

- **Memory.** `remembers` off the turn call is held with `remember(npcId, fact, 'told')`, at most three a turn; a fact the playthrough refuses (blank, over its length) is not held. Next turn the person reads them under "What you remember of them". With no model, nothing is held.
- **Disposition.** `mood` moves it one step with `warm` or `cool`; `same`, or no mood, leaves it. The person reads it as one line ("You like them well enough").
- **The codex.** A background fact's id is its position in `npc.background`, counted from 0, as a string, so whoever draws the codex finds it without a table. `met` facts are earned on opening and come back in `learned` on the open result. `talked` facts are offered to the turn call numbered, and `quest` facts join them once a job this person gave is complete; the call names the one it told with `reveals`, the box earns it with `unlock` and publishes `learned`. With no model, a fact about themselves is earned the moment the scripted hearsay says it. `told` facts are earned from somebody else, and nobody tells them yet.

## Yes, no, or neither

A turn publishes one thing beyond what the NPC did: whether their reply was a yes or a no. It comes as an `answered` event carrying `yes` or `no`, and on most turns it does not come at all, because most of what anybody says is neither. There is no third value to read and no default to misread: nothing published is nothing to show.

It is the character's answer and never the player's. A player who turns the work down and hears "suit yourself, the offer stands" has refused something; the character has not, so that turn publishes nothing.

One rule settles it on both tracks: **carrying something out is a yes**, whatever was said around it. A job handed over, a delivery taken, a thing passed across the counter, a subject answered, getting to their feet to walk with somebody, a goodbye returned: each is the NPC going along with what was put to them, so each publishes a yes, whether the action track picked the move, the player's own words did, or the player clicked it.

What is left is a reply that is only words, and each track reads that its own way. The forced action call reports it as one more parameter beside the line number, so the same call that decides what they did says how their reply came down. That parameter is the one the call may leave out, because an action is what a quest turns on and a missing answer must never cost one; left out, it reads as neither. With no model, the offline reader publishes a no for the one case it can be sure of: asked for something that is not on the menu, the character says so out loud ("you've lost me"), which is a refusal in anybody's words. Everything else it hears is neither.

The event arrives with the action rather than with the words, because one call decides both: it lands after the turn has been published and immediately before the `did` it belongs to.

## Clicking a move instead of typing

`moves()` is the same menu the decider is given, written from the player's side: "Take the job: The Ledger" where the decider reads "hand them the job". `choose(key)` builds that menu again from live state and matches the key against it. A move that has stopped being legal between the click and the menu it was drawn from does nothing at all, not something else, and the caller reads `moves()` again.

A picked move costs no model call: the line the NPC says is the one the quest data already holds, so the same key in the same state plays the same way every time.

## Cutting a turn short

`signal` is the player's way out, and it rides on every model call the conversation makes. Abort it and the turn stops where it is: a turn that already arrived stands, no action is decided, nothing is done, and no scripted line stands in for the reply the player did not wait for. Nothing comes back as an error, the stream just ends.

The signal belongs to the conversation, not to one turn, so once it has fired later turns say nothing either. Clicking a move still plays, because it asks nothing of a model.

## Actions (closed set)

`give_quest`, `ask_about`, `take_delivery`, `hand_over`, `follow_player`, `stop_following`, `end_talk`. There are no others, and each is on the menu only while it is legal. `ask_about` is legal while a step is waiting to hear its subject raised with this person, and carries that subject; with no model running it is answered out of what the world file says they know.

## With no sidecar

Not an error, and not a dead end. Both tracks fall back to the data the game already holds, and a job can be offered, agreed to, delivered and paid for with no model running anywhere. If only the action call fails, or comes back with nothing off the menu, the turn already published stands and the player's words decide.

The player's words are read against the menu rather than against a keyword list. What was said is broken into phrases, longest first, so "maybe later" is a refusal and never a goodbye; then every move that is legal this turn is weighed against what was heard, and the best of them is taken if it is clear enough. Asking for the job and asking for the thing on the counter come apart the way they do in speech: "give me the job" takes the work, "give me the ledger" takes the ledger, and "give me a drink" gets an honest "you've lost me" because there is no drink on the menu. Two moves that fit equally well go to whichever is higher on the menu. Nothing below the bar acts at all, so the player is never handed something they did not ask for.

The spoken side is terse but never reads stored text out as it is stored: a fact the character knows is passed on inside a sentence somebody would say, and the same fact twice is not the same line twice. What they know of the town comes first, then what they could let slip about themselves.

## Errors (closed set)

- `unknown-npc`: nobody by that id lives here. No conversation is opened. The only error handed back to a caller.
- `turn-unanswered`: the turn call came back with no turn: nothing running, a busy model, an engine that died mid-reply, a refusal, a timeout, prose instead of the call, or words that were blank. The box settles it instead of returning it: the game's own data speaks and the player's words decide, exactly as with no sidecar.
- `action-unanswered`: the forced action call came back with no line off the menu: nothing running, a busy model the sidecar stopped waiting on, an engine that died mid-reply (`broken`), a refusal, a timeout, prose instead of the call, or a number the menu has not got. The box settles it instead of returning it: the turn already published stands, and the player's own words decide the action and the answer exactly as they do with no sidecar. Never a silent "they did nothing", and never the first line of the menu by default.

## Dependencies

- `@gb/kit`, `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/sidecar` contracts.
- `zod`: the schemas both forced calls are made against.

## Invariants

- An NPC can only do what the live state allows. The menu is built from that state, so offering a quest that is not theirs or taking an item the player is not carrying is not something they can pick, and every move is checked again before it is carried out.
- No id, and nothing else a clerk would say, reaches the spoken turn: the voice track is never given one, and `does` and `says` are scrubbed on the way out in case the model invents one.
- Every action goes through the box that owns the state: quests through `@gb/quest`, inventory, money, companions, memory, disposition and the codex through `@gb/play`. This box changes nothing itself.
- Every action an NPC takes off a spoken turn is a call the model was forced to make against a schema built from this turn's menu. No action is ever read out of prose, and a call that fails is a failure, not a quiet no.
- A step that names a subject is credited by the move that raises it and by nothing else.
- A turn that carried something out publishes a yes, on every track. A turn that published nothing is a turn that was neither, never a turn nobody looked at.
- What is published is the character's answer. Nothing the player says is ever republished as theirs.
- What an NPC knows of the world is what the world file says they know and what the whole town knows, plus what they could see from where they are standing and what the clock reads. The prompt says so and lists it; nothing else about the city is in their context.
- What the NPC is told about the situation is read off the same moves they may pick, so the two cannot drift apart.
- A conversation holds nothing of any other person and nothing from before it opened except that person's own transcript, and rebuilds the place from the world on every turn.
- What a person remembers of the player is what `@gb/play` holds for that person: bounded there, held by them alone, and written only off a turn they took.
- A background fact is earned once, at or after its stage, and published as `learned` the turn it is earned, whichever track earned it.
- Clicking and typing are one conversation: a picked move goes into the transcript as the player's turn, so a typed turn after it answers with the click in mind.
- With no model reachable, the same words in the same state give the same conversation every time, down to the line.
- A conversation opens with a line and a menu, whatever the model is doing. Nothing about opening one reaches the sidecar.
- The same world file, the same person and the same hour give the same opening line on every machine.
- A turn the player cut short changes nothing: no quest moves, no item, no money, no companion.

## How to modify this blackbox safely

The turn call's name, wording and fields live in `prompts/turn-tool.md` and its schema in `speak.ts`; the template it answers against is `prompts/npc.md`, with the generator's lines in `prompts/life.md`, the engine's in `prompts/surroundings.md`, `standing.md`, `memory.md` and `brief.md`, and the worked examples in `prompts/examples.md` (add a numbered `ask`, `good`, `bad` triplet; keep names, places, prices and skies out of it). The forced action call's name, wording and parameter live in `prompts/decide-tool.md`; its schema is built from the menu in `decide.ts`. A new action is a name in `ACTIONS`, a rule in `legalMoves` for when it is offered and which ids it may carry, its wording in `prompts/moves.md` and `prompts/picks.md`, how the player would ask for it in `prompts/hearing.md`, how it is weighed in `listen.ts`, what it says in `prompts/offline.md`, how it is nudged at in `prompts/hook.md`, and a branch in `Performer`. A move that the decider keeps misreading can take a line in `prompts/rules.md`, which is added to the menu prompt only while that move is on it. What counts as a yes or a no is worded twice, in `prompts/decide.md` for the model and in `settle` in `script.ts` for the reader that stands in for it, and the rule they share (a move carried out is a yes) lives in `Conversation`, where both come out. The opening line is drawn pool by pool from `prompts/greeting.md`: the hour, the standing band, the person's own reason or the spot they keep, the company. Which facts a person may let slip and when is `background.ts`; what a turn leaves behind is `memory.ts`; the per-person transcript is `sessions.ts`. Every prompt is bundled by `pnpm --filter @gb/talk run generate`. Run `pnpm --filter @gb/talk test`.
