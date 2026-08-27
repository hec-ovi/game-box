import { DIFFICULTIES, REWARD_TABLE } from '@gb/quest'

/**
 * The pay bands, written out for the model from `@gb/quest`'s own table.
 *
 * Reading them off the table rather than typing them into the prompt is the
 * point: retune the table and the prompt retunes with it, so the model is never
 * asked for a number the validator will refuse.
 */
export function rewardBands(): string {
  const header =
    '| tier | pay | standing swing, at most | items, at most | doors opened, at most | a car | a home | a typical one |\n|---|---|---|---|---|---|---|---|'
  const rows = DIFFICULTIES.map((tier) => {
    const band = REWARD_TABLE[tier]
    return `| \`${tier}\` | ${band.money.min} to ${band.money.max} | ${band.reputation} | ${band.items} | ${band.access} | ${yesNo(band.car)} | ${yesNo(band.deed)} | ${band.typical.money} and ${band.typical.reputation} standing |`
  })
  return [header, ...rows].join('\n')
}

function yesNo(allowed: boolean): string {
  return allowed ? 'yes' : 'no'
}

/**
 * The pay bands as the `money` field's own description, because the prompt's
 * table is read once and this is read where the number is written. Measured: a
 * side job handed over a home and paid 150, which is under the floor of the
 * only tier that allows one, and it cost a whole city.
 */
export function moneyMeans(): string {
  const bands = DIFFICULTIES.map((tier) => `${tier} ${REWARD_TABLE[tier].money.min} to ${REWARD_TABLE[tier].money.max}`).join(', ')
  return `What the job pays in credits. The tier is read off what the whole reward hands over, and the pay has to sit in that tier's band: ${bands}. Pay for the work: a fetch across the street is the bottom of the range and a job that hands over a car or a home is the top.`
}

/** What handing this over commits the pay to, said on the field that hands it over. */
export function floorFor(carries: 'car' | 'deed'): string {
  const tier = DIFFICULTIES.find((one) => REWARD_TABLE[one][carries])
  if (!tier) return ''
  const article = /^[aeiou]/.test(tier) ? 'an' : 'a'
  return ` Handing one over makes this at least ${article} ${tier} job, so \`money\` has to be ${REWARD_TABLE[tier].money.min} or more.`
}
