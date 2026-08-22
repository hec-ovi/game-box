// @vitest-environment jsdom
import { getByRole, getByText, queryByRole, queryByText, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import type { Objective } from '@gb/quest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hud, HudError, type HudIntent, type JournalQuest } from '../src/index.ts'

const huds: Hud[] = []

afterEach(() => {
  for (const hud of huds.splice(0)) hud.destroy()
  document.body.replaceChildren()
})

function mount(): { hud: Hud; screen: HTMLElement; intents: HudIntent[] } {
  const screen = document.createElement('div')
  document.body.append(screen)
  const intents: HudIntent[] = []
  const hud = new Hud(screen, { onIntent: (intent) => intents.push(intent) })
  huds.push(hud)
  return { hud, screen, intents }
}

function objective(fields: Partial<Objective> & { text: string }): Objective {
  return { questId: 'q1', questTitle: 'The Copper Wheel', stepId: 's1', ...fields }
}

const JOURNAL: readonly JournalQuest[] = [
  {
    questId: 'q1',
    title: 'The Copper Wheel',
    steps: [
      { stepId: 's1', text: 'Talk to Mara', done: true },
      { stepId: 's2', text: 'Carry the crate to the docks', done: false },
    ],
  },
]

describe('objectives', () => {
  it('lists what the player is meant to do and replaces it on the next push', () => {
    const { hud, screen } = mount()
    getByText(screen, 'Nothing yet. Find someone to talk to.')

    hud.show({ objectives: [objective({ text: 'Talk to Mara', hint: 'She works the bar' })] })
    getByText(screen, 'Talk to Mara')
    getByText(screen, 'The Copper Wheel')
    getByText(screen, 'She works the bar')

    hud.show({ objectives: [objective({ stepId: 's2', text: 'Carry the crate to the docks' })] })
    expect(queryByText(screen, 'Talk to Mara')).toBeNull()
    getByText(screen, 'Carry the crate to the docks')
  })
})

describe('the looked-at prompt', () => {
  it('appears while something is in reach and goes when it is not', () => {
    const { hud, screen } = mount()
    expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull()

    hud.show({ prompt: { key: 'E', text: 'Go into The Copper Wheel' } })
    getByText(screen, 'E')
    getByText(screen, 'Go into The Copper Wheel')

    hud.show({ prompt: null })
    expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull()
  })
})

describe('the purse', () => {
  it('shows money and what is being carried', () => {
    const { hud, screen } = mount()
    hud.show({ money: 42, carrying: [{ id: 'i1', name: 'Brass ledger', quest: true }] })
    getByText(screen, '42 coin')
    getByText(screen, 'Brass ledger')
  })
})

describe('conversation', () => {
  it('takes a typed line, reports typing, and closes on Escape', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()

    hud.show({ talk: { speaker: 'Mara Quill' } })
    getByText(screen, 'Mara Quill')
    const box = getByRole(screen, 'textbox', { name: 'Say something' })
    expect(document.activeElement).toBe(box)
    expect(intents).toContainEqual({ kind: 'typing', typing: true })
    expect(hud.typing).toBe(true)

    await user.keyboard('Where is the crate?{Enter}')
    expect(intents).toContainEqual({ kind: 'say', text: 'Where is the crate?' })
    expect((box as HTMLInputElement).value).toBe('')

    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'talk-closed' })
    expect(queryByRole(screen, 'textbox', { name: 'Say something' })).toBeNull()
    expect(queryByText(screen, 'Mara Quill')).toBeNull()
    expect(hud.typing).toBe(false)
  })

  it('appends a streamed reply into the same node and notes what the speaker did', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })

    hud.show({ talk: { replyChunk: 'The crate ' } })
    const reply = getByText(screen, 'The crate')
    hud.show({ talk: { replyChunk: 'is at the docks.' } })
    hud.show({ talk: { acted: 'gave you a job' } })

    expect(reply.textContent).toBe('The crate is at the docks.')
    expect(getByText(screen, 'The crate is at the docks.')).toBe(reply)
    getByText(screen, 'gave you a job')
  })
})

describe('announcements', () => {
  it('shows an event with its reward and clears itself', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen } = mount()
      hud.announce({ kind: 'quest-complete', title: 'The Copper Wheel', reward: { money: 40, items: ['Brass key'] } })
      getByText(screen, 'Quest complete: The Copper Wheel')
      getByText(screen, '+40 coin · Brass key')

      vi.advanceTimersByTime(3300)
      expect(queryByText(screen, 'Quest complete: The Copper Wheel')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the journal', () => {
  it('opens from its button and lists active quests and which steps are done', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ journal: JOURNAL })
    expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull()

    await user.click(getByRole(screen, 'button', { name: 'Journal' }))
    expect(intents).toContainEqual({ kind: 'journal', open: true })

    const panel = getByRole(screen, 'generic', { name: 'Journal' })
    within(panel).getByText('The Copper Wheel')
    const done = within(panel).getByText('Talk to Mara').closest('li')
    const open = within(panel).getByText('Carry the crate to the docks').closest('li')
    expect(done?.className).toBe('gb-step-done')
    expect(open?.className).toBe('gb-step-open')

    await user.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull()
  })
})

describe('errors', () => {
  it('refuses an unknown announcement', () => {
    const { hud } = mount()
    const bad = { kind: 'explosion', text: 'boom' } as unknown as Parameters<Hud['announce']>[0]
    expect(() => hud.announce(bad)).toThrow(HudError)
    expect(() => hud.announce(bad)).toThrow(/unknown-notice/)
  })

  it('refuses a reply when no conversation is open', () => {
    const { hud } = mount()
    expect(() => hud.show({ talk: { replyChunk: 'hello' } })).toThrow(/no-conversation/)
  })

  it('refuses to draw after it is destroyed', () => {
    const { hud } = mount()
    hud.destroy()
    expect(() => hud.show({ money: 1 })).toThrow(/hud-destroyed/)
  })
})
