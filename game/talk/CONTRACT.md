# @gb/talk contract

contractVersion: 0.6.0

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
| `open` | `{ conversation, changes, opening }` | walking up to someone is a `talked` event, so a step that already asked for it completes here |
| `opening` | `{ line, moves }` | what they say before the player has said anything, and the moves that were legal when they said it. Always a line, never a model call |
| `say` | a stream of `TalkEvent` | `said` pieces as they are spoken, `did` for the action taken, `changed` for every quest change it caused, `over` when it ends |
| `available()` | the action names legal right now | what the UI can promise before a word is said |
| `moves()` | every legal move as `{ key, action, label }` | `label` is what the player clicks, in their own words and with no id in it; `action` is its `ActionName`, so a caller can filter or group without reading the key; `key` names the move and what it is about, never its place in the list |
| `choose` | a stream of `TalkEvent` | the same shape `say` gives: the spoken line, `did`, `changed`, `over` |

## Talking to someone counts when it counts

A `talked` event fires when the conversation opens, and again after anything the NPC does. The second one is what makes a generated job playable: those quests open with "go and hear them out", and the step that says so is opened by the giver handing the job over, one moment after the greeting. Credited only on the way in, the objective would read as an errand to go and find the person the player is stood in front of. Credited again after the move, the objective the player sees is the first thing they still have to do.

## They speak first

Opening a conversation hands back the opening turn, so the panel has something in it the instant it appears. No model is asked for that line. One reply from the local model has been measured at 8 to 19 seconds in this project, and nineteen seconds of empty panel at the moment the player presses the key is worse than saying nothing, so the line is built from what the box already holds: the hour and the sky off the playthrough clock, the building they are in, the spot they keep in it, who else is in there with them, their trade, what the player's name in town is worth, and the one move on the menu worth mentioning. It costs under a hundredth of a millisecond, because it is string work over data already in memory.

The draw is seeded from the world's own seed and this person's id, so a world file shared between two machines greets the same way on both. The hour is in the seed as well, so somebody spoken to at dawn and again at dusk does not open with the same line twice.

The line goes into the transcript as their turn, so the model answers on top of what the player has already read. The moves that come with it are the ones `moves()` gives: the greeting nudges at the one worth mentioning ("that's my ledger you're carrying") and the button under it carries it out with no model call either. No greeting names a quest by its title, because the pitch keeps for the turn the player asks for it.

## One turn, two tracks

The voice goes first and only speaks. It is given the character, what they know and what is going on, and no tools, no ids and no decision to weigh up, so the first words come back fast and stream out as they arrive.

The action track then decides, once. Every move that was legal when the turn began is written out as a numbered menu in plain words, with "nothing but talk" as number 1, and the model answers with a single number at temperature 0. One turn is at most one action, and nothing is the usual answer: an answer that is not a number on the menu is nothing. A turn that comes back with no answer at all is not a decision to do nothing; the player's own words decide it instead.

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

`give_quest`, `take_delivery`, `hand_over`, `follow_player`, `stop_following`, `end_talk`. There are no others, and each is on the menu only while it is legal.

## With no sidecar

Not an error, and not a dead end. Both tracks fall back to the data the game already holds, and a job can be offered, agreed to, delivered and paid for with no model running anywhere. If only the action call fails, or comes back empty, the spoken line still streams and the player's words decide.

The player's words are read against the menu rather than against a keyword list. What was said is broken into phrases, longest first, so "maybe later" is a refusal and never a goodbye; then every move that is legal this turn is weighed against what was heard, and the best of them is taken if it is clear enough. Asking for the job and asking for the thing on the counter come apart the way they do in speech: "give me the job" takes the work, "give me the ledger" takes the ledger, and "give me a drink" gets an honest "you've lost me" because there is no drink on the menu. Two moves that fit equally well go to whichever is higher on the menu. Nothing below the bar acts at all, so the player is never handed something they did not ask for.

The spoken side is terse but never reads stored text out as it is stored: a fact the character knows is passed on inside a sentence somebody would say, and the same fact twice is not the same line twice.

## Errors (closed set)

- `unknown-npc`: nobody by that id lives here. No conversation is opened.

## Dependencies

- `@gb/kit`, `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/sidecar` contracts.

## Invariants

- An NPC can only do what the live state allows. The menu is built from that state, so offering a quest that is not theirs or taking an item the player is not carrying is not something they can pick, and every move is checked again before it is carried out.
- No id, and nothing else a clerk would say, reaches the spoken line: the voice track is never given one, and the stream is scrubbed on the way out in case the model invents one.
- Every action goes through the box that owns the state: quests through `@gb/quest`, inventory, money and companions through `@gb/play`. This box changes nothing itself.
- What an NPC knows of the world is what the world file says they know, plus what they could see from where they are standing and what the clock reads. The prompt says so and lists it; nothing else about the city is in their context.
- What the NPC is told about the situation is read off the same moves they may pick, so the two cannot drift apart.
- Clicking and typing are one conversation: a picked move goes into the transcript as the player's turn, so a typed turn after it answers with the click in mind.
- With no model reachable, the same words in the same state give the same conversation every time, down to the line.
- The reply streams, so speech can start before the sentence is finished.
- A conversation opens with a line and a menu, whatever the model is doing. Nothing about opening one reaches the sidecar.
- The same world file, the same person and the same hour give the same opening line on every machine.
- A turn the player cut short changes nothing: no quest moves, no item, no money, no companion.

## How to modify this blackbox safely

A new action is a name in `ACTIONS`, a rule in `legalMoves` for when it is offered and which ids it may carry, its wording in `prompts/moves.md` and `prompts/picks.md`, how the player would ask for it in `prompts/hearing.md`, how it is weighed in `listen.ts`, what it says in `prompts/offline.md`, how it is nudged at in `prompts/hook.md`, and a branch in `Performer`. A move that the decider keeps misreading can take a line in `prompts/rules.md`, which is added to the menu prompt only while that move is on it. The opening line is drawn pool by pool from `prompts/greeting.md`: the hour, the standing band, the spot they keep, the sky, the room. The rest of the wording lives in `prompts/npc.md`, `situation*.md`, `surroundings.md` and `standing.md`, and every prompt is bundled by `pnpm --filter @gb/talk run generate`. Run `pnpm --filter @gb/talk test`.
