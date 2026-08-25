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
