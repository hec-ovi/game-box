import type { Sent } from './fake-model.ts'

/** The shell a place or person tool was built around, read back off the schema the model was handed. */
export function shellOf(call: Sent) {
  const properties = (call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>>)['properties']!
  const person = call.toolName === 'describe_npc' ? properties : properties['people']!['items']!['properties']!
  return {
    posts: call.toolName === 'describe_npc' ? [] : (properties['people']!['items']!['properties']!['postId']!['enum'] as unknown as string[]),
    things: call.toolName === 'describe_npc' ? [] : (properties['things']!['items']!['properties']!['thingId']!['enum'] as unknown as string[]),
    letters: /\^\[([A-Z]+)]/.exec(String(person['family']!['pattern']))![1]!,
    person,
  }
}

/** A life in `@gb/world`'s shape, every part filled. */
export function lifeOf(who: string) {
  return {
    history: `${who} came down from the yards when the line shut and never went back.`,
    interests: 'the tide tables and other people\'s debts',
    manner: 'short sentences, never the first to speak',
    cares: 'that the crates get paid for',
    avoids: 'anything to do with the Local',
    reason: 'I keep the counter here because nobody else will stand it after dark.',
    errand: 'I am walking the tabs round to the people who owe them.',
  }
}

/** One fact for each way of earning one. */
export function backgroundOf(who: string) {
  return [
    { fact: `${who} works the counter.`, unlockedBy: 'met' },
    { fact: `${who} came off the yards.`, unlockedBy: 'talked' },
    { fact: `${who} keeps the tabs in their head.`, unlockedBy: 'quest' },
    { fact: `${who} once ran with the Local.`, unlockedBy: 'told' },
  ]
}
