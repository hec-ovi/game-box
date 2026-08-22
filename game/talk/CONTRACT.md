# @gb/talk contract

contractVersion: 0.2.0

## Purpose

Conversations with the people in the city: one track writes what they say, another picks what they do from the short list of things the quest script made legal this turn.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Conversation.open({ world, log, player, sidecar, npcId })` | a `@gb/world` `World`, `@gb/quest` `QuestLog`, `@gb/play` `PlayerState`, `@gb/sidecar` `Sidecar` | the NPC is in the world |
| `say(text)` | what the player said | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `open` | `{ conversation, changes }` | walking up to someone is a `talked` event, so a step that asked for it completes here |
| `say` | a stream of `TalkEvent` | `said` pieces as they are spoken, `did` for the action taken, `changed` for every quest change it caused, `over` when it ends |
| `available()` | the action names legal right now | what the UI can promise before a word is said |

## One turn, two tracks

The voice goes first and only speaks. It is given the character, what they know and what is going on, and no tools, no ids and no decision to weigh up, so the first words come back fast and stream out as they arrive.

The action track then decides, once. Every move that was legal when the turn began is written out as a numbered menu in plain words, with "nothing but talk" as number 1, and the model answers with a single number at temperature 0. One turn is at most one action, and nothing is the usual answer: an answer that is not a number on the menu is nothing.

Ids never appear in either track. The menu says "the job: The Ledger", not a quest id, and the number maps back to the id on this side of the boundary.

## Actions (closed set)

`give_quest`, `take_delivery`, `hand_over`, `follow_player`, `stop_following`, `end_talk`. There are no others, and each is on the menu only while it is legal.

## With no sidecar

Not an error, and not a dead end. Both tracks fall back to the data the game already holds: the NPC speaks from their own knowledge and from the giver's script (title, summary, first objective), and the player's own words pick the move. A job can be offered, agreed to, delivered and paid for with no model running anywhere. If only the action call fails, the spoken line still streams and the player's words decide.

## Errors (closed set)

- `unknown-npc`: nobody by that id lives here. No conversation is opened.

## Dependencies

- `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/sidecar` contracts.

## Invariants

- An NPC can only do what the live state allows. The menu is built from that state, so offering a quest that is not theirs or taking an item the player is not carrying is not something they can pick, and every move is checked again before it is carried out.
- No id, and nothing else a clerk would say, reaches the spoken line: the voice track is never given one, and the stream is scrubbed on the way out in case the model invents one.
- Every action goes through the box that owns the state: quests through `@gb/quest`, inventory, money and companions through `@gb/play`. This box changes nothing itself.
- What an NPC knows is what the world file says they know. The prompt says so and lists it; nothing else about the world is in their context.
- What the NPC is told about the situation is read off the same moves they may pick, so the two cannot drift apart.
- The reply streams, so speech can start before the sentence is finished.

## How to modify this blackbox safely

A new action is a name in `ACTIONS`, a rule in `legalMoves` for when it is offered and which ids it may carry, its wording in `prompts/moves.md`, and a branch in `Performer`. A move that the decider keeps misreading can take a line in `prompts/rules.md`, which is added to the menu prompt only while that move is on it. Prompts and spoken fallback lines live in `prompts/*.md` and are bundled by `pnpm --filter @gb/talk run generate`. Run `pnpm --filter @gb/talk test`.
