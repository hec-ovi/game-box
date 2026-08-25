import type { OpenedBundle, ResumeReport } from '@gb/bundle'
import type { Notice } from '@gb/hud'

/**
 * What a save lost coming back into a city that was written again since it was
 * made, by name. `@gb/bundle` reports ids; the city says what they were called,
 * and an id the city has not got any more is the whole of what can be said
 * about it. Nothing when the city is the one the save was written in.
 */
export function resumeNotice(bundle: OpenedBundle, report: ResumeReport): Notice | undefined {
  if (!report.rebuilt) return undefined
  const kept = report.kept.map((named) => nameOf(bundle, named))
  const dropped = report.dropped.map((named) => nameOf(bundle, named))
  const parts = [
    kept.length > 0 ? `kept ${kept.join(', ')}` : '',
    dropped.length > 0 ? `dropped ${dropped.join(', ')}` : '',
  ].filter(Boolean)
  return { kind: 'note', text: `The city was written again since your last visit: ${parts.join('; ') || 'nothing to carry over'}` }
}

function nameOf(bundle: OpenedBundle, named: { kind: string; id: string }): string {
  const world = bundle.world
  switch (named.kind) {
    case 'item':
    case 'placed':
      return world.item(named.id)?.name ?? named.id
    case 'companion':
    case 'person':
      return world.npc(named.id)?.name ?? named.id
    case 'place':
    case 'where': {
      const interior = world.interior(named.id)
      return (interior && world.plot(interior.plotId)?.name) ?? named.id
    }
    case 'quest':
    case 'tracked':
      return bundle.quests.find((quest) => quest.id === named.id)?.title ?? named.id
    default:
      return named.id
  }
}
