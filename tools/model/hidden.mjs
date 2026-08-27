/**
 * What nobody sees from outside a car on the street, by the names showroom
 * models give it.
 *
 * A showroom model is built to be opened: seats, carpet, a stitched steering
 * wheel, an engine, a gearbox, brake discs behind the rims. On a street car the
 * glass is a near-black mirror and the camera never gets under the sills, so
 * every one of those triangles is paid for and never seen.
 *
 * Matching is on the material name and the node or mesh name, lowercased,
 * anywhere in the string. It is deliberately conservative: a word that could
 * name the bodywork on some model (`chassis`, `body`, `panel`) is not in here,
 * and the tool prints every part it dropped with what it saved, so the list can
 * be checked against a picture rather than trusted.
 */

/** One group of hidden parts, so the report says what kind of thing went. */
export const HIDDEN = {
  interior: [
    'interior', 'seat', 'leather', 'carpet', 'dash', 'steering', 'pedal', 'stitch',
    'handbrake', 'gearstick', 'gearlever', 'airbag', 'seatbelt', 'headliner',
    'sunvisor', 'speedo', 'gauge', 'cluster', 'glovebox', 'armrest', 'cupholder',
  ],
  engine: ['engine', 'radiator', 'intercooler', 'turbo', 'alternator', 'manifold', 'airbox', 'sparkplug'],
  underneath: ['undercarriage', 'underbody', 'suspension', 'driveshaft', 'differential', 'subframe', 'fueltank', 'exhaustpipe'],
  brakes: ['discbrake', 'brakedisc', 'brakedisk', 'brake_disk', 'brake disk', 'caliper'],
}

export const HIDDEN_GROUPS = Object.keys(HIDDEN)

/** Which group of hidden parts a name belongs to, or undefined when it is bodywork. */
export function hiddenGroupOf(name, spared = []) {
  const lower = (name ?? '').toLowerCase()
  if (!lower) return undefined
  if (spared.some((word) => lower.includes(word.toLowerCase()))) return undefined
  for (const group of HIDDEN_GROUPS) {
    if (HIDDEN[group].some((word) => lower.includes(word))) return group
  }
  return undefined
}
