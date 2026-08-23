import type { CastPerson, CastPlace } from './cast.ts'

/**
 * What a town remembers about the player.
 *
 * A choice that only moves a number leaves no history: the player ends up with
 * a different score, not a different town. A mark is the other thing a choice
 * leaves behind, and it outlives the quest that set it. It is a flag, so
 * `@gb/quest` gates on it with the conditions it already has, and it names a
 * place or a person the town actually generated, so two towns remember two
 * different sets of things and no two marks mean the same.
 *
 * The kinds are closed and there are four, because four things are worth
 * remembering about somebody who walks into your town: whether they did what
 * you wanted, whether they went against you, whether you owe them, and which
 * side of the town's own argument they came down on.
 */
export type MarkKind = 'sided' | 'crossed' | 'owed' | 'allied'

const mark = (kind: MarkKind, subject: string): string => `${kind}:${subject}`

/** You did what this place wanted. */
export const sided = (place: CastPlace): string => mark('sided', place.plotId)

/** You went against this place, and they know. */
export const crossed = (place: CastPlace): string => mark('crossed', place.plotId)

/** This person owes you one. */
export const owed = (person: CastPerson): string => mark('owed', person.npc.npcId)

/** The side of the town's own argument you came down on. */
export const allied = (place: CastPlace): string => mark('allied', place.plotId)

/**
 * Standing with one place rather than with the town at large. A generated town
 * has no factions written down, so its factions are its places: doing a job for
 * one of them is standing with them, and crossing them costs it.
 */
export const partyOf = (place: CastPlace): string => place.plotId

/** Standing with the town as a whole, which is what a reputation was before there were sides. */
export const TOWN = 'town'
