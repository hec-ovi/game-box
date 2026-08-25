import type { Report } from './problem.ts'
import type { Access } from './reward.ts'
import type { Condition, QuestDoc, Step } from './schema.ts'
import type { WorldView } from './world-view.ts'

/** Every person, place, thing, door and machine a quest names has to be in the world it is played in. */
export function checkReferences(quest: QuestDoc, world: WorldView, report: Report): void {
  if (!world.hasNpc(quest.giverNpcId)) report(quest.id, `giver ${quest.giverNpcId} is not in the world`)
  for (const itemId of quest.reward.items) {
    if (!world.hasItem(itemId)) report(quest.id, `reward item ${itemId} is not in the world`)
  }
  for (const access of quest.reward.access ?? []) checkAccess(access, quest.id, world, report)
  if (quest.reward.deed && !world.hasInterior(quest.reward.deed)) report(quest.id, `deed to ${quest.reward.deed}, which is not in the world`)
  for (const condition of quest.requires ?? []) checkCondition(condition, quest.id, world, report)
  for (const rule of quest.failWhen ?? []) {
    if (rule.kind === 'npc-lost' && !world.hasNpc(rule.npcId)) report(quest.id, `fails on unknown npc ${rule.npcId}`)
    if (rule.kind === 'item-lost' && !world.hasItem(rule.itemId)) report(quest.id, `fails on unknown item ${rule.itemId}`)
  }
  for (const step of quest.steps) checkStep(step, world, report)
}

function checkStep(step: Step, world: WorldView, report: Report): void {
  const place = 'place' in step ? step.place : undefined
  if (place && 'plotId' in place && !world.hasPlot(place.plotId)) report(step.id, `plot ${place.plotId} is not in the world`)
  if (place && 'interiorId' in place && !world.hasInterior(place.interiorId)) {
    report(step.id, `interior ${place.interiorId} is not in the world`)
  }
  if ('npcId' in step && !world.hasNpc(step.npcId)) report(step.id, `npc ${step.npcId} is not in the world`)
  if ('toNpcId' in step && !world.hasNpc(step.toNpcId)) report(step.id, `npc ${step.toNpcId} is not in the world`)
  if ('itemId' in step && !world.hasItem(step.itemId)) report(step.id, `item ${step.itemId} is not in the world`)
  for (const itemId of ('alternates' in step ? step.alternates : undefined) ?? []) {
    if (!world.hasItem(itemId)) report(step.id, `item ${itemId} is not in the world`)
  }
  if ('doorId' in step && !world.hasDoor(step.doorId)) report(step.id, `door ${step.doorId} is not in the world`)
  if ('machineId' in step && !world.hasMachine(step.machineId)) report(step.id, `machine ${step.machineId} is not in the world`)
  if (step.kind === 'stash') {
    if (!world.hasInterior(step.interiorId)) report(step.id, `interior ${step.interiorId} is not in the world`)
    else if (!world.hasAnchor(step.interiorId, step.anchorId)) {
      report(step.id, `anchor ${step.anchorId} is not in interior ${step.interiorId}`)
    }
  }
  for (const effect of step.effects) {
    if ('itemId' in effect && !world.hasItem(effect.itemId)) report(step.id, `effect names unknown item ${effect.itemId}`)
    if ('npcId' in effect && !world.hasNpc(effect.npcId)) report(step.id, `effect names unknown npc ${effect.npcId}`)
  }
  for (const condition of step.requires) checkCondition(condition, step.id, world, report)
}

function checkCondition(condition: Condition, where: string, world: WorldView, report: Report): void {
  if ('itemId' in condition && !world.hasItem(condition.itemId)) report(where, `requires unknown item ${condition.itemId}`)
  if ('npcId' in condition && !world.hasNpc(condition.npcId)) report(where, `requires unknown npc ${condition.npcId}`)
}

function checkAccess(access: Access, where: string, world: WorldView, report: Report): void {
  if ('doorId' in access && !world.hasDoor(access.doorId)) report(where, `access to door ${access.doorId}, which is not in the world`)
  if ('interiorId' in access && !world.hasInterior(access.interiorId)) {
    report(where, `access to interior ${access.interiorId}, which is not in the world`)
  }
}
