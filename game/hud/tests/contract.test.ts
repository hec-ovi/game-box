// @vitest-environment jsdom
import { getByRole, getByText, queryByRole, queryByText, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import type { Objective } from '@gb/quest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hud, HudError, type ControlHint, type HudIntent, type JournalQuest } from '../src/index.ts'

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

/** What the player is looking at right now, whatever is still fading out. */
function box(screen: HTMLElement): HTMLElement | null {
  return queryByRole(screen, 'textbox', { name: 'Say something' })
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

const CONTROLS: readonly ControlHint[] = [{ keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' }]

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
  it('appears while something is in reach and goes when it is not', async () => {
    const { hud, screen } = mount()
    expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull()

    hud.show({ prompt: { key: 'E', text: 'Go into The Copper Wheel' } })
    getByText(screen, 'E')
    getByText(screen, 'Go into The Copper Wheel')

    hud.show({ prompt: null })
    await waitFor(() => expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull())
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
  it('takes a typed line and leaves by the button, which says which key does the same', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()

    hud.show({ talk: { speaker: 'Mara Quill' } })
    getByText(screen, 'Mara Quill')
    expect(document.activeElement).toBe(box(screen))
    expect(hud.typing).toBe(true)
    expect(intents).toContainEqual({ kind: 'typing', typing: true })

    await user.keyboard('Where is the crate?{Enter}')
    expect(intents).toContainEqual({ kind: 'say', text: 'Where is the crate?' })
    expect((box(screen) as HTMLInputElement).value).toBe('')

    const close = getByRole(screen, 'button', { name: 'Close conversation (Escape)' })
    within(close).getByText('Esc')
    await user.click(close)

    expect(intents).toContainEqual({ kind: 'talk-closed' })
    expect(hud.typing).toBe(false)
    expect(box(screen)).toBeNull()
    await waitFor(() => expect(queryByText(screen, 'Mara Quill')).toBeNull())
  })

  it('leaves on Escape and hands the keyboard back the same way', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })

    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'talk-closed' })
    expect(intents).toContainEqual({ kind: 'typing', typing: false })
    expect(hud.typing).toBe(false)
    expect(box(screen)).toBeNull()
  })

  it('lets go cleanly when the player leaves mid-word, and starts the next one empty', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()

    hud.show({ talk: { speaker: 'Mara Quill' } })
    await user.keyboard('where is the cr')
    expect((box(screen) as HTMLInputElement).value).toBe('where is the cr')

    await user.keyboard('{Escape}')
    // The game is told once that it has its keys back, not twice, and in time.
    expect(intents.filter((i) => i.kind === 'typing')).toEqual([
      { kind: 'typing', typing: true },
      { kind: 'typing', typing: false },
    ])
    expect(intents.at(-1)).toEqual({ kind: 'talk-closed' })

    hud.show({ talk: { speaker: 'Dorn Sela' } })
    expect((box(screen) as HTMLInputElement).value).toBe('')
  })

  it('swallows what the player types and gives the keys straight back when they stop', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    const heard: string[] = []
    const listen = (event: Event): void => void heard.push((event as KeyboardEvent).key)
    document.addEventListener('keydown', listen)

    try {
      hud.show({ talk: { speaker: 'Mara Quill' } })
      await user.keyboard('w')
      expect(heard).toEqual([])
      expect((box(screen) as HTMLInputElement).value).toBe('w')

      await user.keyboard('{Escape}')
      await user.keyboard('w')
      expect(heard).toEqual(['w'])
    } finally {
      document.removeEventListener('keydown', listen)
    }
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

describe('the journal', () => {
  it('opens on its key, lists the quests, and gives the keyboard back on the way out', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ journal: JOURNAL })
    expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull()

    await user.keyboard('j')
    expect(intents).toContainEqual({ kind: 'journal', open: true })

    const panel = getByRole(screen, 'dialog', { name: 'Journal' })
    expect(document.activeElement).toBe(panel)
    within(panel).getByText('The Copper Wheel')
    expect(within(panel).getByText('Talk to Mara').closest('li')?.className).toBe('gb-step-done')
    expect(within(panel).getByText('Carry the crate to the docks').closest('li')?.className).toBe('gb-step-open')

    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'journal', open: false })
    expect(queryByRole(screen, 'dialog', { name: 'Journal' })).toBeNull()
    expect(document.activeElement).toBe(document.body)
    await waitFor(() => expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull())
  })

  it('opens and closes from the buttons, which show the key that does the same', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ journal: JOURNAL })

    const opener = getByRole(screen, 'button', { name: 'Journal (J)' })
    within(opener).getByText('J')
    await user.click(opener)

    const panel = getByRole(screen, 'dialog', { name: 'Journal' })
    expect(opener.getAttribute('aria-expanded')).toBe('true')
    await user.click(within(panel).getByRole('button', { name: 'Close journal (Escape)' }))
    expect(queryByRole(screen, 'dialog', { name: 'Journal' })).toBeNull()
  })

  it('keeps Tab inside itself while it is up', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ journal: JOURNAL, journalOpen: true })

    const panel = getByRole(screen, 'dialog', { name: 'Journal' })
    await user.keyboard('{Tab}')
    expect(panel.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Tab}')
    expect(panel.contains(document.activeElement)).toBe(true)
  })
})

describe('the controls window', () => {
  it('shows what the game says its keys do next to the ones the interface owns', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ controls: CONTROLS })

    await user.keyboard('?')
    expect(intents).toContainEqual({ kind: 'help', open: true })
    const panel = getByRole(screen, 'dialog', { name: 'Controls' })
    within(panel).getByText('Move')
    within(panel).getByText('Walk')
    within(panel).getByText('Journal')
    within(panel).getByText('Close the window in front of you')

    await user.keyboard('{Escape}')
    expect(queryByRole(screen, 'dialog', { name: 'Controls' })).toBeNull()
  })
})

describe('windows on the way out', () => {
  it('does not swallow the key that opens the next thing', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ journal: JOURNAL, talk: { speaker: 'Mara Quill' } })

    await user.keyboard('{Escape}')
    // Still fading, already out of the way.
    const talk = screen.querySelector('.gb-talk') as HTMLElement
    expect(talk.dataset.state).toBe('closing')
    expect(box(screen)).toBeNull()
    expect(hud.typing).toBe(false)

    await user.keyboard('j')
    getByRole(screen, 'dialog', { name: 'Journal' })
  })

  it('closes one window at a time, front one first', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ journal: JOURNAL, journalOpen: true, helpOpen: true })

    await user.keyboard('{Escape}')
    expect(queryByRole(screen, 'dialog', { name: 'Controls' })).toBeNull()
    getByRole(screen, 'dialog', { name: 'Journal' })

    await user.keyboard('{Escape}')
    expect(queryByRole(screen, 'dialog', { name: 'Journal' })).toBeNull()
  })
})

describe('announcements', () => {
  it('lands a finished quest loud and a picked-up bottle quiet', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen } = mount()
      hud.announce({ kind: 'quest-complete', title: 'The Copper Wheel', reward: { money: 40, items: ['Brass key'] } })
      hud.announce({ kind: 'item-taken', item: 'Green bottle' })

      const big = getByText(screen, 'Quest complete: The Copper Wheel').closest('.gb-notice') as HTMLElement
      const small = getByText(screen, 'Picked up Green bottle').closest('.gb-notice') as HTMLElement
      expect(big.dataset.tone).toBe('major')
      expect(small.dataset.tone).toBe('minor')
      getByText(screen, '+40 coin · Brass key')

      // The quiet one is gone while the loud one is still being read.
      vi.advanceTimersByTime(2700)
      expect(queryByText(screen, 'Picked up Green bottle')).toBeNull()
      getByText(screen, 'Quest complete: The Copper Wheel')

      vi.advanceTimersByTime(2600)
      expect(queryByText(screen, 'Quest complete: The Copper Wheel')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the stack readable when everything happens at once', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen } = mount()
      for (const item of ['a', 'b', 'c', 'd', 'e']) hud.announce({ kind: 'item-taken', item })
      expect(screen.querySelectorAll('.gb-notice')).toHaveLength(4)
      expect(queryByText(screen, 'Picked up a')).toBeNull()
      getByText(screen, 'Picked up e')
    } finally {
      vi.useRealTimers()
    }
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

  it('refuses to draw after it is destroyed, and stops listening for keys', async () => {
    const user = userEvent.setup()
    const { hud, intents } = mount()
    hud.destroy()
    expect(() => hud.show({ money: 1 })).toThrow(/hud-destroyed/)

    await user.keyboard('j')
    expect(intents).toEqual([])
  })
})
