Write the errands the people of this city hand out.

Theme: {{theme}}
City: {{cityName}}

Here is everyone in it and everything lying around, by id:

{{places}}

Write {{questCount}} quests, the first one the main one. Each is a short chain
of steps the player performs in order.

Rules that make a quest playable, and that will be checked:
- Use only the ids listed above. Inventing an id fails the quest.
- Every step id is unique inside its quest and looks like step_0001.
- A step's `next` names the step that follows. The last step in a chain is a
  `complete` step with an empty `next`.
- Before a `deliver` step, an earlier step on the same path must `collect` that
  same item.
- The person who gives the quest must be somewhere the player can reach, and
  the first step is normally talking to them.
- If an item has an owner, taking it is stealing: set `allowSteal` to true and
  expect the reward to reflect it.

Write the objective lines in the second person and keep them short: "Take the
ledger to Mara at the Copper Wheel".
