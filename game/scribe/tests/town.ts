import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
import { JAIL } from './places.ts'

/**
 * A model that answers every question a whole build asks, off the shells and
 * the ids it is handed rather than off anything written down here.
 *
 * There is one narrator in this game and it is this box, so a test that wants a
 * finished city stubs the sidecar and lets the scribe write the town through
 * it. Nothing here composes a city on the side: every answer is read back out
 * of the call it is answering, which is also what makes it a test of the
 * requests rather than of a canned reply.
 */

/** A history that invents a kind of place no preset is, so a build asks for its charter too. */
export const PREMISE = {
  livesOn: 'Container freight off the elevated line.',
  happened: 'The line shut last winter.',
  stake: 'Who gets the freight contract.',
  sides: [
    { name: 'the Vance yards', wants: 'the contract back' },
    { name: 'the Dockhands Local', wants: 'the yards broken up' },
  ],
  common: ['Nothing has moved since November.'],
  build: { moreOf: ['warehouse'], fewerOf: [], mustHave: ['jail'] },
}

/** Family names that differ from each other, so no building spends one twice. */
const FAMILIES = ['orne', 'ellis', 'ax', 'underhill', 'ester', 'ombe', 'ade', 'ury', 'ansom', 'ovell', 'itt', 'ance']

/** A place written to the shell the tool was built around: every post filled, every thing named, back to front. */
export function writtenPlace(call: Sent, options: { name?: string; given?: string; stages?: readonly string[] } = {}) {
  const shell = shellOf(call)
  return {
    name: options.name ?? `The ${shell.letters} House`,
    character: 'A low room that smells of wet rope, with the radio left on.',
    // written back to front, so a caller that zips by position rather than by id gets it wrong
    people: shell.posts
      .map((postId, i) => ({
        postId,
        given: options.given ?? `Given${i}`,
        family: `${shell.letters[i % shell.letters.length]}${FAMILIES[i % FAMILIES.length]}`,
        personality: 'Watches the door more than the glasses.',
        knowledge: ['The tide is late again.', 'Nobody has paid for the crates.'],
        life: lifeOf(`Given${i}`),
        background: backgroundOf(`Given${i}`).map((fact, k) => (options.stages ? { ...fact, unlockedBy: options.stages[k % options.stages.length]! } : fact)),
      }))
      .reverse(),
    things: shell.things.map((thingId) => ({ thingId, name: `Thing ${thingId}`, description: 'Worn and heavy.' })),
  }
}

/** A person for the single-person call, under a family name the letters it was dealt allow. */
function writtenPerson(call: Sent, index: number) {
  const shell = shellOf(call)
  return {
    name: `Given${index} ${shell.letters[0]}${FAMILIES[index % FAMILIES.length]}`,
    given: `Given${index}`,
    family: `${shell.letters[0]}${FAMILIES[index % FAMILIES.length]}`,
    personality: 'Watches the door more than the glasses.',
    knowledge: ['The tide is late again.', 'Nobody has paid for the crates.'],
    life: lifeOf(`Given${index}`),
    background: backgroundOf(`Given${index}`),
  }
}

/** The ids a field of the quest tool was pinned to, through the `$defs` the repeats were hoisted into. */
function idsOf(call: Sent, field: string): string[] {
  const parameters = call.parameters as Record<string, Record<string, Record<string, string>>> & { $defs?: Record<string, { enum: string[] }> }
  const ref = parameters['properties']![field]!['$ref']
  const node = ref ? parameters.$defs![ref.split('/').pop()!]! : (parameters['properties']![field] as unknown as { enum: string[] })
  return node.enum
}

/** The labels a batch tool was built around: one per building, or one per part of the city. */
function labelsOf(call: Sent, list: string, field: string): string[] {
  const properties = call.parameters['properties'] as Record<string, Record<string, Record<string, Record<string, Record<string, string[]>>>>>
  return properties[list]!['items']!['properties']![field]!['enum']!
}

/** A quest as the writer tells it: one conversation with whoever the corner offered as its giver. */
function writtenQuest(call: Sent) {
  const asked = /the id (quest_\d+) and the kind (main|side)/.exec(call.user)!
  const giver = idsOf(call, 'giverNpcId')[0]!
  return {
    id: asked[1],
    kind: asked[2],
    title: 'A word with the freight office',
    summary: 'Somebody has been waiting all week for an answer.',
    giverNpcId: giver,
    beats: [{ kind: 'talk', npcId: giver, objective: 'Hear them out' }],
    reward: { money: 20, reputation: 2, faction: 'town', items: [] },
  }
}

/** A sidecar with a model behind it that answers every tool a build reaches for. */
export function townModel() {
  return fakeModel((call, index) => {
    switch (call.toolName) {
      case 'write_premise':
        return PREMISE
      case 'write_charter':
        // the tool pins the word, so the charter comes back for the kind of place that was asked about
        return { ...JAIL, word: (call.parameters['properties'] as Record<string, Record<string, string>>)['word']!['const']! }
      case 'name_city':
        return { name: 'Cold Harbour' }
      case 'name_districts':
        return { districts: labelsOf(call, 'districts', 'district').map((label) => ({ district: label, name: `Kiln ${label.slice(1)}` })) }
      case 'name_signs':
        return { signs: labelsOf(call, 'signs', 'building').map((label) => ({ building: label, name: `Head${label.slice(1)} Supply` })) }
      case 'name_place':
        return { name: `Sign${index} Row` }
      case 'write_instance':
        return writtenPlace(call)
      case 'describe_npc':
        return writtenPerson(call, index)
      case 'describe_item':
        return { name: `Thing ${index}`, description: 'Worn and heavy.' }
      case 'write_quest':
        return writtenQuest(call)
      default:
        return {
          theme: 'rain-soaked cargo port',
          brief: 'The container line shut last winter and the yards have been idle since.',
          mainQuest: 'Find out who signed off on cargo that never arrived.',
          sideQuests: 'Fetching and carrying for the people still working the sheds.',
          tone: 'guarded, dry, tired',
        }
    }
  })
}
