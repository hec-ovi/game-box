# @gb/talk contract

contractVersion: 0.8.0

## Purpose

Conversations with the people in the city: they speak first off the game's own data, one track writes what they say next, and another picks what they do from the short list of things the quest script made legal this turn.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Conversation.open({ world, log, player, sidecar, npcId, signal? })` | a `@gb/world` `World`, `@gb/quest` `QuestLog`, `@gb/play` `PlayerState`, `@gb/sidecar` `Sidecar`, and the player's own `AbortSignal` | the NPC is in the world |
| `say(text)` | what the player said | |
| `choose(key)` | the `key` of a move read off `moves()` | none: a key that is not legal now is a no-op |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `open` | `{ conversation, changes, opening }` | walking up to someone is a `talked` event, so a step that already asked for it completes here; a step that names a subject waits to be asked |
| `opening` | `{ line, moves }` | what they say before the player has said anything, and the moves that were legal when they said it. Always a line, never a model call |
| `say` | a stream of `TalkEvent` | `said` pieces as they are spoken, `answered` when the reply was a yes or a no, `did` for the action taken, `changed` for every quest change it caused, `over` when it ends |
| `available()` | the action names legal right now | what the UI can promise before a word is said |
| `moves()` | every legal move as `{ key, action, label }` | `label` is what the player clicks, in their own words and with no id in it; `action` is its `ActionName`, so a caller can filter or group without reading the key; `key` names the move and what it is about, never its place in the list |
| `choose` | a stream of `TalkEvent` | the same shape `say` gives: the spoken line, `answered`, `did`, `changed`, `over` |

## Talking to someone counts when it counts

A `talked` event fires when the conversation opens, and again after anything the NPC does. The second one is what makes a generated job playable: those quests open with "go and hear them out", and the step that says so is opened by the giver handing the job over, one moment after the greeting. Credited only on the way in, the objective would read as an errand to go and find the person the player is stood in front of. Credited again after the move, the objective the player sees is the first thing they still have to do.

A step that names a subject is a different promise. A `talk` step may carry a `topic`, and `@gb/quest` credits one only for a `talked` event carrying that same subject, so being stood in front of the person is not enough. The subject is a move of its own: `ask_about`, on the menu for as long as a step is waiting to hear it raised with this person, written the way the player would click it ("Ask about the missing shipment"). **The step is credited when that move is taken, and at no other time**: clicked, picked off the same menu by the action track, or asked for in words plain enough for the offline reader to be sure of. A conversation that wanders onto the subject credits nothing, however much either side says about it, because a reply is not a decision: guessing at one either takes work off the board the player never did or refuses work they did. Walking up to somebody credits the steps that name no subject, and only those.

## They speak first

Opening a conversation hands back the opening turn, so the panel has something in it the instant it appears. No model is asked for that line. One reply from the local model has been measured at 8 to 19 seconds in this project, and nineteen seconds of empty panel at the moment the player presses the key is worse than saying nothing, so the line is built from what the box already holds: the hour and the sky off the playthrough clock, the building they are in, the spot they keep in it, who else is in there with them, their trade, what the player's name in town is worth, and the one move on the menu worth mentioning. It costs under a hundredth of a millisecond, because it is string work over data already in memory.

The draw is seeded from the world's own seed and this person's id, so a world file shared between two machines greets the same way on both. The hour is in the seed as well, so somebody spoken to at dawn and again at dusk does not open with the same line twice.

The line goes into the transcript as their turn, so the model answers on top of what the player has already read. The moves that come with it are the ones `moves()` gives: the greeting nudges at the one worth mentioning ("that's my ledger you're carrying") and the button under it carries it out with no model call either. No greeting names a quest by its title, because the pitch keeps for the turn the player asks for it.

## Yes, no, or neither

A turn publishes one thing beyond what the NPC did: whether their reply was a yes or a no. It comes as an `answered` event carrying `yes` or `no`, and on most turns it does not come at all, because most of what anybody says is neither. There is no third value to read and no default to misread: nothing published is nothing to show.

It is the character's answer and never the player's. A player who turns the work down and hears "suit yourself, the offer stands" has refused something; the character has not, so that turn publishes nothing.

One rule settles it on both tracks: **carrying something out is a yes**, whatever was said around it. A job handed over, a delivery taken, a thing passed across the counter, a subject answered, getting to their feet to walk with somebody, a goodbye returned: each is the NPC going along with what was put to them, so each publishes a yes, whether the action track picked the move, the player's own words did, or the player clicked it.

What is left is a reply that is only words, and each track reads that its own way. The forced action call reports it as one more parameter beside the line number, so the same call that decides what they did says how their reply came down. That parameter is the one the call may leave out, because an action is what a quest turns on and a missing answer must never cost one; left out, it reads as neither. With no model, the offline reader publishes a no for the one case it can be sure of: asked for something that is not on the menu, the character says so out loud ("you've lost me"), which is a refusal in anybody's words. Everything else it hears is neither.

The event arrives with the action rather than with the first words, because one call decides both: it lands after the reply has been spoken and immediately before the `did` it belongs to.

## One turn, two tracks

The voice goes first and only speaks. It is given the character, what they know and what is going on, and no tools, no ids and no decision to weigh up, so the first words come back fast and stream out as they arrive.

The action track then decides, once. Every move that was legal when the turn began is written out as a numbered menu in plain words, with "nothing but talk" as number 1, and the model answers by making a call it is given no choice about making, at temperature 0. The parameters of that call are the menu: one line number, checked against the number of lines before it gets back here. There is no text to parse and no answer off the list to interpret. One turn is at most one action, and nothing is the usual answer. A call that comes back any other way (prose instead of the call, a number the menu has not got, nothing running at all) has not answered it, and the player's own words decide the turn instead.

Ids never appear in either track. The menu says "the job: The Ledger", not a quest id, and the number maps back to the id on this side of the boundary.

## Clicking a move instead of typing

`moves()` is the same menu the decider is given, written from the player's side: "Take the job: The Ledger" where the decider reads "hand them the job". `choose(key)` builds that menu again from live state and matches the key against it. A move that has stopped being legal between the click and the menu it was drawn from does nothing at all, not something else, and the caller reads `moves()` again.

A picked move costs no model call: the line the NPC says is the one the quest data already holds, so the same key in the same state plays the same way every time.

## Cutting a turn short

`signal` is the player's way out, and it rides on every model call the conversation makes. Abort it and the turn stops where it is: the words that already arrived stand, no action is decided, nothing is done, and no scripted line stands in for the reply the player did not wait for. Nothing comes back as an error, the stream just ends.

The signal belongs to the conversation, not to one turn, so once it has fired later turns say nothing either. Clicking a move still plays, because it asks nothing of a model.

## What the character is told

The voice track is handed a person, not a row of data: their name, trade and personality, the building they are in, the city and what kind of place it is, what they are doing at the spot they keep, who else is in the building with them, the hour and the weather off the playthrough clock, what the player's name in town is worth, and the facts the world file says they know. That is enough to answer out of a particular room at a particular hour instead of answering like any shopkeeper anywhere.

What they want from the player is read off the moves they may make and the targets the quest log resolved, put in their own terms: they are told they are owed a ledger and what the job pays, never handed the line of screen text that says so. A step's objective text is a label for the player's HUD, so it is never given to a character to read out.

## Actions (closed set)

`give_quest`, `ask_about`, `take_delivery`, `hand_over`, `follow_player`, `stop_following`, `end_talk`. There are no others, and each is on the menu only while it is legal. `ask_about` is legal while a step is waiting to hear its subject raised with this person, and carries that subject; with no model running it is answered out of what the world file says they know.

## With no sidecar

Not an error, and not a dead end. Both tracks fall back to the data the game already holds, and a job can be offered, agreed to, delivered and paid for with no model running anywhere. If only the action call fails, or comes back with nothing off the menu, the spoken line still streams and the player's words decide.

The player's words are read against the menu rather than against a keyword list. What was said is broken into phrases, longest first, so "maybe later" is a refusal and never a goodbye; then every move that is legal this turn is weighed against what was heard, and the best of them is taken if it is clear enough. Asking for the job and asking for the thing on the counter come apart the way they do in speech: "give me the job" takes the work, "give me the ledger" takes the ledger, and "give me a drink" gets an honest "you've lost me" because there is no drink on the menu. Two moves that fit equally well go to whichever is higher on the menu. Nothing below the bar acts at all, so the player is never handed something they did not ask for.

The spoken side is terse but never reads stored text out as it is stored: a fact the character knows is passed on inside a sentence somebody would say, and the same fact twice is not the same line twice.

## Errors (closed set)

- `unknown-npc`: nobody by that id lives here. No conversation is opened. The only error handed back to a caller.
- `action-unanswered`: the forced action call came back with no line off the menu: nothing running, a refusal, a timeout, prose instead of the call, or a number the menu has not got. The box settles it instead of returning it: the words already spoken stand, and the player's own words decide the action and the answer exactly as they do with no sidecar. Never a silent "they did nothing", and never the first line of the menu by default.

## Dependencies

- `@gb/kit`, `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/sidecar` contracts.
- `zod`: the schema the action call is forced against.

## Invariants

- An NPC can only do what the live state allows. The menu is built from that state, so offering a quest that is not theirs or taking an item the player is not carrying is not something they can pick, and every move is checked again before it is carried out.
- No id, and nothing else a clerk would say, reaches the spoken line: the voice track is never given one, and the stream is scrubbed on the way out in case the model invents one.
- Every action goes through the box that owns the state: quests through `@gb/quest`, inventory, money and companions through `@gb/play`. This box changes nothing itself.
- Every action an NPC takes off a spoken turn is a call the model was forced to make against a schema built from this turn's menu. No action is ever read out of prose, and a call that fails is a failure, not a quiet no.
- A step that names a subject is credited by the move that raises it and by nothing else.
- A turn that carried something out publishes a yes, on every track. A turn that published nothing is a turn that was neither, never a turn nobody looked at.
- What is published is the character's answer. Nothing the player says is ever republished as theirs.
- What an NPC knows of the world is what the world file says they know, plus what they could see from where they are standing and what the clock reads. The prompt says so and lists it; nothing else about the city is in their context.
- What the NPC is told about the situation is read off the same moves they may pick, so the two cannot drift apart.
- Clicking and typing are one conversation: a picked move goes into the transcript as the player's turn, so a typed turn after it answers with the click in mind.
- With no model reachable, the same words in the same state give the same conversation every time, down to the line.
- The reply streams, so speech can start before the sentence is finished.
- A conversation opens with a line and a menu, whatever the model is doing. Nothing about opening one reaches the sidecar.
- The same world file, the same person and the same hour give the same opening line on every machine.
- A turn the player cut short changes nothing: no quest moves, no item, no money, no companion.

## How to modify this blackbox safely

The forced call's name, wording and parameter live in `prompts/decide-tool.md`; its schema is built from the menu in `decide.ts`. A new action is a name in `ACTIONS`, a rule in `legalMoves` for when it is offered and which ids it may carry, its wording in `prompts/moves.md` and `prompts/picks.md`, how the player would ask for it in `prompts/hearing.md`, how it is weighed in `listen.ts`, what it says in `prompts/offline.md`, how it is nudged at in `prompts/hook.md`, and a branch in `Performer`. A move that the decider keeps misreading can take a line in `prompts/rules.md`, which is added to the menu prompt only while that move is on it. What counts as a yes or a no is worded twice, in `prompts/decide.md` for the model and in `settle` in `script.ts` for the reader that stands in for it, and the rule they share (a move carried out is a yes) lives in `Conversation`, where both come out. The opening line is drawn pool by pool from `prompts/greeting.md`: the hour, the standing band, the spot they keep, the sky, the room. The rest of the wording lives in `prompts/npc.md`, `situation*.md`, `surroundings.md` and `standing.md`, and every prompt is bundled by `pnpm --filter @gb/talk run generate`. Run `pnpm --filter @gb/talk test`.
