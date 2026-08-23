// @vitest-environment jsdom
import { getByRole, getByText, queryByRole, queryByText, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import type { Objective } from '@gb/quest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hud, HudError, type ControlHint, type HudIntent, type MapView, type QuestEntry } from '../src/index.ts'

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

const QUESTS: readonly QuestEntry[] = [
  {
    questId: 'q1',
    title: 'The Copper Wheel',
    steps: [
      { stepId: 's1', text: 'Talk to Mara', done: true },
      { stepId: 's2', text: 'Carry the crate to the docks', done: false },
    ],
  },
  { questId: 'q2', title: 'Salt and Lamp Oil', steps: [{ stepId: 's1', text: 'Buy lamp oil', done: false }] },
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

  it('follows one quest and counts the rest, however many are running', () => {
    const { hud, screen } = mount()
    const many = Array.from({ length: 10 }, (_, at) =>
      objective({ questId: `q${at}`, questTitle: `Quest ${at}`, text: `Step for ${at}` }),
    )
    hud.show({ objectives: many, trackedQuestId: 'q7' })

    getByText(screen, 'Quest 7')
    getByText(screen, 'Step for 7')
    expect(queryByText(screen, 'Step for 0')).toBeNull()
    expect(queryByText(screen, 'Step for 9')).toBeNull()
    expect((getByText(screen, '9 more quests').closest('.gb-more') as HTMLElement).hidden).toBe(false)

    hud.show({ trackedQuestId: 'q3' })
    getByText(screen, 'Step for 3')
    expect(queryByText(screen, 'Step for 7')).toBeNull()

    // One quest on the board is the whole board, so there is no rest to point at.
    hud.show({ objectives: [objective({ text: 'Talk to Mara' })], trackedQuestId: 'q1' })
    expect((screen.querySelector('.gb-more') as HTMLElement).hidden).toBe(true)
  })

  it('reads a counted step as a count and says which work is optional', () => {
    const { hud, screen } = mount()
    hud.show({
      objectives: [
        objective({ stepId: 's1', text: 'Collect crates', count: { done: 2, needed: 5 } }),
        objective({ stepId: 's2', text: 'Ask about the ledger', optional: true }),
        objective({ stepId: 's3', text: 'Take the key', count: { done: 0, needed: 1 } }),
      ],
    })

    getByText(screen, '2/5')
    expect(getByText(screen, 'Ask about the ledger').closest('li')?.dataset.optional).toBe('true')
    getByText(screen, 'Optional')
    // A count of one is not a count, so it stays out of the way.
    expect(queryByText(screen, '0/1')).toBeNull()
    expect(getByText(screen, 'Collect crates').closest('li')?.dataset.optional).toBeUndefined()
  })

  it('tells a player who has never had work from one between jobs', () => {
    const { hud, screen } = mount()
    getByText(screen, 'Nothing yet. Find someone to talk to.')

    // Finishing the only open step is a lull, not a fresh start, and the panel
    // that says otherwise reads as if the last hour of play never happened.
    hud.show({ objectives: [objective({ text: 'Talk to Mara' })] })
    hud.show({ objectives: [] })

    expect(queryByText(screen, 'Nothing yet. Find someone to talk to.')).toBeNull()
    getByText(screen, 'No step open right now. Ask around for the next job.')
  })

  it('scrolls inside its corner rather than running off the screen', () => {
    const { screen } = mount()
    for (const selector of ['.gb-objectives', '.gb-purse']) {
      const panel = screen.querySelector(selector) as HTMLElement
      const style = getComputedStyle(panel)
      expect(style.overflowY).toBe('auto')
      expect(Number.parseFloat(style.maxHeight)).toBeGreaterThan(0)
    }
  })
})

describe('the looked-at prompt', () => {
  it('appears while something is in reach and goes when it is not', async () => {
    const { hud, screen } = mount()
    expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull()

    hud.show({ prompt: { key: 'E', text: 'Go into The Copper Wheel' } })
    getByText(screen, 'E')
    getByText(screen, 'Go into The Copper Wheel')
    expect(screen.querySelector('.gb-hud')?.getAttribute('data-reach')).toBe('true')

    hud.show({ prompt: null })
    expect(screen.querySelector('.gb-hud')?.getAttribute('data-reach')).toBe('false')
    await waitFor(() => expect(queryByText(screen, 'Go into The Copper Wheel')).toBeNull())
  })
})

describe('the purse', () => {
  it('shows money, what is being carried, and which way the money moved', () => {
    const { hud, screen } = mount()
    hud.show({ money: 42, carrying: [{ id: 'i1', name: 'Brass ledger', quest: true }] })
    const purse = screen.querySelector('.gb-purse') as HTMLElement
    within(purse).getByText('42')
    within(purse).getByText('Brass ledger')
    expect((purse.querySelector('.gb-more') as HTMLElement).hidden).toBe(true)

    hud.show({ money: 60 })
    expect((purse.querySelector('.gb-coin') as HTMLElement).dataset.flash).toBe('up')
    hud.show({ money: 5 })
    expect((purse.querySelector('.gb-coin') as HTMLElement).dataset.flash).toBe('down')
  })

  it('keeps the corner short and points at the items tab for the rest', () => {
    const { hud, screen } = mount()
    hud.show({
      carrying: [
        ...Array.from({ length: 9 }, (_, at) => ({ id: `i${at}`, name: `Green bottle ${at}` })),
        { id: 'q', name: 'Brass ledger', quest: true },
      ],
    })

    const purse = screen.querySelector('.gb-purse') as HTMLElement
    // What a quest wants survives the cut, because it is the one not to sell.
    within(purse).getByText('Brass ledger')
    expect(purse.querySelectorAll('li')).toHaveLength(4)
    within(purse).getByText('6 more in hand')
    within(purse).getByText('I')
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
      await user.keyboard('j')
      expect(heard).toEqual([])
      expect((box(screen) as HTMLInputElement).value).toBe('j')

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

  it('carries what the speaker did this turn, and only this turn', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', acted: 'gave you a job' } })
    getByText(screen, 'gave you a job')

    // A line that piled up would read as a list of turns the player has left
    // behind, inside a panel where everything else is the turn in front of them.
    hud.show({ talk: { acted: 'took the ledger' } })
    expect(queryByText(screen, 'gave you a job')).toBeNull()
    getByText(screen, 'took the ledger')

    hud.show({ talk: { acted: null } })
    expect(queryByText(screen, 'took the ledger')).toBeNull()
  })
})

describe('the moves on the table', () => {
  const MOVES = [
    { key: 'give_quest#q_ledger', label: 'Take the job: The Ledger' },
    { key: 'hand_over#i_ledger', label: 'Hand over the ledger' },
  ]

  /** Every move on screen right now, in the order the player reads them. */
  function options(screen: HTMLElement): string[] {
    return [...screen.querySelectorAll('.gb-move')].map((node) => node.textContent ?? '')
  }

  it('draws nothing until there is something worth clicking', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })
    expect(options(screen)).toEqual([])
    expect(queryByText(screen, 'Pick a reply')).toBeNull()

    // A conversation with nothing left to do but leave draws no menu either.
    hud.show({ talk: { moves: [] } })
    expect(options(screen)).toEqual([])

    hud.show({ talk: { moves: MOVES } })
    expect(options(screen)).toEqual(['Take the job: The Ledger', 'Hand over the ledger'])
    getByText(screen, 'Pick a reply')
  })

  it('takes exactly the move that was clicked, and says so in the player\'s own words', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })
    intents.length = 0

    await user.click(getByRole(screen, 'button', { name: 'Take the job: The Ledger' }))

    expect(intents.filter((intent) => intent.kind === 'choose' || intent.kind === 'say')).toEqual([
      { kind: 'choose', key: 'give_quest#q_ledger' },
    ])
    // and it reads as something the player said, not a silent state change
    getByText(screen, 'Take the job: The Ledger', { selector: '.gb-you' })
  })

  it('keeps the keyboard when the move it just took goes quiet', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })

    await user.click(getByRole(screen, 'button', { name: 'Take the job: The Ledger' }))

    // the button the player clicked is disabled now, and a disabled button that
    // still held focus would hand the walk keys back mid-conversation
    expect(document.activeElement).toBe(box(screen))
    expect(hud.typing).toBe(true)
    expect(intents).not.toContainEqual({ kind: 'typing', typing: false })
  })

  it('drops a move the moment it stops being legal', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })

    hud.show({ talk: { moves: [MOVES[1]!] } })
    expect(options(screen)).toEqual(['Hand over the ledger'])
    expect(queryByRole(screen, 'button', { name: 'Take the job: The Ledger' })).toBeNull()
  })

  it('goes quiet while the answer is coming and comes back with the next menu', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })

    const take = getByRole(screen, 'button', { name: 'Take the job: The Ledger' }) as HTMLButtonElement
    await user.click(take)
    expect(take.disabled).toBe(true)

    // the reply arriving is not the turn ending, so a second click cannot land
    hud.show({ talk: { reply: '', replyChunk: "There's work going." } })
    await user.click(take)
    expect(intents.filter((intent) => intent.kind === 'choose')).toHaveLength(1)

    hud.show({ talk: { moves: [MOVES[1]!] } })
    expect((getByRole(screen, 'button', { name: 'Hand over the ledger' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('quiets the menu on a typed line too, so the two ways cannot overlap', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })

    await user.keyboard('what have you got?{Enter}')
    expect(intents).toContainEqual({ kind: 'say', text: 'what have you got?' })
    getByText(screen, 'what have you got?', { selector: '.gb-you' })
    expect((getByRole(screen, 'button', { name: 'Hand over the ledger' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reaches every move from the keyboard, and takes one on Enter', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })
    expect(document.activeElement).toBe(box(screen))

    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(getByRole(screen, 'button', { name: 'Take the job: The Ledger' }))
    // the game still hears nothing, because the conversation still has the keys
    expect(hud.typing).toBe(true)

    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(getByRole(screen, 'button', { name: 'Hand over the ledger' }))

    await user.keyboard('{Enter}')
    expect(intents).toContainEqual({ kind: 'choose', key: 'hand_over#i_ledger' })
  })

  it('starts a fresh panel for the next speaker, with none of the last one on it', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', moves: MOVES } })
    await user.click(getByRole(screen, 'button', { name: 'Hand over the ledger' }))
    hud.show({ talk: { replyChunk: 'Here. Don\'t lose it.' } })

    hud.show({ talk: { speaker: 'Dorn Sela' } })
    expect(options(screen)).toEqual([])
    expect((screen.querySelector('.gb-you') as HTMLElement).textContent).toBe('')
    expect(queryByText(screen, "Here. Don't lose it.")).toBeNull()
  })
})

describe('the window', () => {
  it('opens on its key, and gives the keyboard back on the way out', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ quests: QUESTS })
    expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull()

    await user.keyboard('j')
    expect(intents).toContainEqual({ kind: 'window', window: 'quests' })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    expect(document.activeElement).toBe(panel)
    within(panel).getByText('The Copper Wheel')
    expect(within(panel).getByText('Talk to Mara').closest('li')?.className).toBe('gb-step-done')
    expect(within(panel).getByText('Carry the crate to the docks').closest('li')?.className).toBe('gb-step-open')

    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'window', window: null })
    expect(queryByRole(screen, 'dialog')).toBeNull()
    expect(document.activeElement).toBe(document.body)
    await waitFor(() => expect(queryByText(screen, 'Carry the crate to the docks')).toBeNull())
  })

  it('hands the keyboard back to whatever had it', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    elsewhere.focus()
    hud.show({ quests: QUESTS })

    await user.keyboard('j')
    expect(document.activeElement).toBe(getByRole(screen, 'dialog', { name: 'Quests' }))

    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })

  it('shows one face at a time, so two windows are never up at once', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, controls: CONTROLS })

    await user.keyboard('j')
    getByRole(screen, 'dialog', { name: 'Quests' })

    await user.keyboard('?')
    getByRole(screen, 'dialog', { name: 'Controls' })
    expect(queryByRole(screen, 'dialog', { name: 'Quests' })).toBeNull()
    expect(queryByText(screen, 'The Copper Wheel')).toBeNull()
    getByText(screen, 'Walk')
    expect(screen.querySelectorAll('.gb-bar-button[aria-expanded="true"]')).toHaveLength(1)

    // The key of the face already up puts the whole window away.
    await user.keyboard('?')
    expect(queryByRole(screen, 'dialog')).toBeNull()
  })

  it('switches face from the tab strip and from the bar, which show their keys', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, money: 12 })

    const opener = getByRole(screen, 'button', { name: 'Quests (J)' })
    within(opener).getByText('J')
    await user.click(opener)
    const panel = getByRole(screen, 'dialog', { name: 'Quests' })

    await user.click(within(panel).getByRole('tab', { name: 'Items I' }))
    getByRole(screen, 'dialog', { name: 'Items' })
    expect(within(panel).getByRole('tab', { name: 'Items I' }).getAttribute('aria-selected')).toBe('true')
    expect(within(panel).getByRole('tab', { name: 'Quests J' }).getAttribute('aria-selected')).toBe('false')

    await user.click(within(panel).getByRole('button', { name: 'Close (Escape)' }))
    expect(queryByRole(screen, 'dialog')).toBeNull()
  })

  it('keeps Tab inside itself while it is up, all the way round', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, window: 'quests' })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    const stops = panel.querySelectorAll('button').length
    expect(stops).toBeGreaterThan(2)

    // Past the last control it comes back to the first, never out to the bar.
    for (let press = 0; press <= stops; press += 1) {
      await user.keyboard('{Tab}')
      expect(panel.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(panel.contains(document.activeElement)).toBe(true)
  })

  it('closes the window before the conversation, one press at a time', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, window: 'quests', talk: { speaker: 'Mara Quill' } })

    await user.keyboard('{Escape}')
    expect(queryByRole(screen, 'dialog')).toBeNull()
    expect(box(screen)).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(box(screen)).toBeNull()
  })

  it('does not swallow the key that opens the next thing', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, talk: { speaker: 'Mara Quill' } })

    await user.keyboard('{Escape}')
    // Still fading, already out of the way.
    const talk = screen.querySelector('.gb-talk') as HTMLElement
    expect(talk.dataset.state).toBe('closing')
    expect(box(screen)).toBeNull()
    expect(hud.typing).toBe(false)

    await user.keyboard('j')
    getByRole(screen, 'dialog', { name: 'Quests' })
  })
})

describe('the quests tab', () => {
  it('picks which quest the corner panel follows', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({
      quests: QUESTS,
      window: 'quests',
      objectives: [
        objective({ text: 'Carry the crate to the docks' }),
        objective({ questId: 'q2', questTitle: 'Salt and Lamp Oil', text: 'Buy lamp oil' }),
      ],
    })
    const objectives = screen.querySelector('.gb-objectives') as HTMLElement
    within(objectives).getByText('Carry the crate to the docks')

    await user.click(getByRole(screen, 'button', { name: 'Follow Salt and Lamp Oil' }))
    expect(intents).toContainEqual({ kind: 'track', questId: 'q2' })

    within(objectives).getByText('Buy lamp oil')
    within(objectives).getByText('Salt and Lamp Oil')
    expect(within(objectives).queryByText('Carry the crate to the docks')).toBeNull()

    await user.click(getByRole(screen, 'button', { name: 'Stop following Salt and Lamp Oil' }))
    expect(intents).toContainEqual({ kind: 'track', questId: null })
  })

  it('reads a step not reached yet apart from the one open now', () => {
    const { hud, screen } = mount()
    hud.show({
      window: 'quests',
      quests: [
        {
          questId: 'q1',
          title: 'The Copper Wheel',
          steps: [
            { stepId: 's1', text: 'Talk to Mara', state: 'done' },
            { stepId: 's2', text: 'Carry the crate to the docks', state: 'open' },
            { stepId: 's3', text: 'Come back for the pay', state: 'upcoming' },
            { stepId: 's4', text: 'Sign the ledger', done: true },
          ],
        },
      ],
    })

    // Work the player cannot start yet, drawn like work they can, sends them
    // across town for a step that is not on the board.
    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    const state = (text: string): string | undefined => getByText(panel, text).closest('li')?.className
    expect(state('Talk to Mara')).toBe('gb-step-done')
    expect(state('Carry the crate to the docks')).toBe('gb-step-open')
    expect(state('Come back for the pay')).toBe('gb-step-upcoming')
    // and the shorter shape reads the same as it always did
    expect(state('Sign the ledger')).toBe('gb-step-done')
  })

  it('asks a second time before it gives a quest up', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ quests: QUESTS, window: 'quests' })

    // One stray click, or one Enter on a button the player tabbed onto, would
    // otherwise cost them the quest and everything they had done towards it.
    await user.click(getByRole(screen, 'button', { name: 'Give up The Copper Wheel' }))
    expect(intents.filter((intent) => intent.kind === 'abandon')).toEqual([])

    await user.click(getByRole(screen, 'button', { name: 'Confirm giving up The Copper Wheel' }))
    expect(intents).toContainEqual({ kind: 'abandon', questId: 'q1' })
    getByRole(screen, 'button', { name: 'Give up The Copper Wheel' })

    // Walking off the question answers it: the next click starts again.
    await user.click(getByRole(screen, 'button', { name: 'Give up The Copper Wheel' }))
    await user.click(getByRole(screen, 'button', { name: 'Give up Salt and Lamp Oil' }))
    getByRole(screen, 'button', { name: 'Give up The Copper Wheel' })
    expect(intents.filter((intent) => intent.kind === 'abandon')).toHaveLength(1)
  })
})

describe('the items tab', () => {
  it('shows what can be spent and what is in hand, quest items first', () => {
    const { hud, screen } = mount()
    hud.show({
      window: 'items',
      money: 128,
      carrying: [
        { id: 'i1', name: 'Green bottle' },
        { id: 'i2', name: 'Brass ledger', quest: true },
      ],
    })

    const panel = getByRole(screen, 'dialog', { name: 'Items' })
    within(panel).getByText('128')
    const names = [...panel.querySelectorAll('.gb-carried .gb-what')].map((node) => node.textContent)
    expect(names).toEqual(['Brass ledger', 'Green bottle'])
    within(panel).getByText('Quest')
  })

  it('says so plainly when there is nothing to carry', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'items' })
    within(getByRole(screen, 'dialog', { name: 'Items' })).getByText('Your pockets are empty.')
  })
})

describe('the map tab', () => {
  const MAP: MapView = {
    width: 40,
    height: 30,
    plots: [{ id: 'p1', rect: { x: 4, y: 4, w: 8, h: 6 } }],
    marks: [
      { x: 6, y: 20, label: 'You', kind: 'you', facing: 0 },
      { x: 8, y: 7, label: 'The Copper Wheel', kind: 'goal' },
    ],
  }

  it('draws the survey and numbers what to head for', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'map', map: MAP })

    const panel = getByRole(screen, 'dialog', { name: 'Map' })
    expect(panel.querySelectorAll('.gb-plan svg .gb-block')).toHaveLength(1)
    expect(panel.querySelectorAll('.gb-plan svg .gb-you')).toHaveLength(1)
    const bearings = panel.querySelector('.gb-bearings') as HTMLElement
    within(bearings).getByText('The Copper Wheel')
    expect(bearings.querySelector('.gb-pip')?.textContent).toBe('1')
  })

  it('points at the tracked steps while there is no survey', () => {
    const { hud, screen } = mount()
    hud.show({
      window: 'map',
      objectives: [objective({ text: 'Carry the crate', markerLabel: 'The docks', hint: 'Past the bridge' })],
    })

    const panel = getByRole(screen, 'dialog', { name: 'Map' })
    within(panel).getByText('The docks')
    within(panel).getByText('Past the bridge')
    expect(panel.querySelector('.gb-plan svg')).toBeNull()
  })
})

describe('the controls tab', () => {
  it('shows what the game says its keys do next to the ones the interface owns', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ controls: CONTROLS })

    await user.keyboard('?')
    expect(intents).toContainEqual({ kind: 'window', window: 'controls' })
    const panel = getByRole(screen, 'dialog', { name: 'Controls' })
    within(panel).getByText('Move')
    within(panel).getByText('Walk')
    within(panel).getByText('Close the window in front of you')
    // The interface lists its own keys here too, next to the game's.
    within(panel.querySelector('.gb-window-body') as HTMLElement).getByText('Map')
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
