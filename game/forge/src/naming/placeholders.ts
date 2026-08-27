/**
 * What the architecture calls itself before the story is written.
 *
 * A city is laid out by arithmetic first: the zones, the buildings, the posts
 * inside them and the stock on their shelves all exist, numbered, before a
 * model has written a word. The work is written over that, and only then does
 * the town get its names. So everything that will be named carries a
 * placeholder in the meantime, and the placeholder is the design rather than a
 * gap: it is what the blueprint preview shows, and it is what a quest written
 * against the bare architecture reads as until `bindNames` puts the written
 * names in its place.
 *
 * Every one of them is unique in a town, because every one is a town-wide
 * index, and every one is whole-word matchable, so binding cannot turn
 * "Instance 1" into a slice of "Instance 12".
 */

/** The city itself, before it is named. */
export const PLACEHOLDER_CITY = 'City'

/** A part of the city. */
export const zoneName = (index: number): string => `Zone ${index + 1}`

/** A building. */
export const instanceName = (index: number): string => `Instance ${index + 1}`

/** Somebody standing at a post. */
export const personName = (index: number): string => `Person ${index + 1}`

/** Something lying about. */
export const thingName = (index: number): string => `Thing ${index + 1}`

/** Every placeholder, as it turns up in a line written before the town was named. */
export const PLACEHOLDERS = /\b(?:zone|instance|person|thing) \d+\b/gi
