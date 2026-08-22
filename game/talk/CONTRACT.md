# @gb/talk contract

contractVersion: 0.1.0

## Purpose

Conversations with the people in the city: the model writes what they say, and anything they do is a tool call that was only on the table because the quest script made it legal.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Conversation.open({ world, log, player, sidecar, npcId })` | a `@gb/world` `World`, `@gb/quest` `QuestLog`, `@gb/play` `PlayerState`, `@gb/sidecar` `Sidecar` | the NPC is in the world |
| `say(text)` | what the player said | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `open` | `{ conversation, changes }` | walking up to someone is a `talked` event, so a step that asked for it completes here |
| `say` | a stream of `TalkEvent` | `said` pieces as they are spoken, `did` for each action taken, `changed` for every quest change it caused, `over` when it ends |
| `available()` | the action names legal right now | what the UI can promise before a word is said |

## Actions (closed set)

`give_quest`, `take_delivery`, `hand_over`, `follow_player`, `stop_following`, `end_talk`. There are no others, and each is offered only when it is legal.

## Errors (closed set)

- `unknown-npc`: nobody by that id lives here. No conversation is opened.

A sidecar that cannot be reached is not an error: the NPC says the first thing they actually know, and the conversation ends.

## Dependencies

- `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/sidecar` contracts.

## Invariants

- An NPC can only do what the live state allows, and the ids they may name are written into the tool's own schema as an enum. Offering a quest that is not theirs, or taking an item the player is not carrying, is not something they can say, not something we catch afterwards. Every action is then checked again before it is carried out.
- Every action goes through the box that owns the state: quests through `@gb/quest`, inventory, money and companions through `@gb/play`. This box changes nothing itself.
- What an NPC knows is what the world file says they know. The prompt says so and lists it; nothing else about the world is in their context.
- The reply streams, so speech can start before the sentence is finished.

## How to modify this blackbox safely

A new action is a name in `ACTIONS`, a rule in `legalActions` for when it is offered and what ids it may name, and a branch in `#perform` that goes through the owning box. Prompts live in `prompts/*.md` and are bundled by `pnpm --filter @gb/talk run generate`. Run `pnpm --filter @gb/talk test`.
