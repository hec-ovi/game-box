// @vitest-environment jsdom
import { fireEvent, getAllByText, getByRole, getByText, queryAllByText, queryByRole, queryByText, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import type { JournalEntry, Objective } from '@gb/quest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HUD_CSS,
  HUD_KEYS,
  Hud,
  HudError,
  type ControlHint,
  type HudIntent,
  type LoaderView,
  type MapView,
  type QuestEntry,
  type MinimapView,
  type ScreenView,
} from '../src/index.ts'
import { CORNER_RESERVED, LAYOUT } from '../src/style/layout.ts'
import { TOKENS } from '../src/style/tokens.ts'

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
  return queryByRole(screen, 'textbox', { name: /Say something|Enter custom query_/ })
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

  it('points at the journal when the next thing is a decision', () => {
    const { hud, screen } = mount()
    // The corner takes no clicks, so a step answered in the journal has to say
    // where, or a decision sits open with the player waiting for a target.
    hud.show({
      objectives: [
        objective({
          text: 'Decide whose the ledger is',
          choice: {
            prompt: 'Hollis is offering more than Mara did. Whose is it?',
            options: [{ key: 'keep-word', label: 'Keep your word to Mara' }],
          },
        }),
      ],
    })

    const line = getByText(screen, 'Decide whose the ledger is').closest('li') as HTMLElement
    within(line).getByText('Decide')
    expect(within(line).getByText('J').tagName).toBe('KBD')
    expect(queryByRole(screen, 'button', { name: 'Keep your word to Mara' })).toBeNull()
  })

  it('says whether the player is on the story or an errand', () => {
    const { hud, screen } = mount()
    const quests = [
      { questId: 'q1', title: 'The Copper Wheel', kind: 'main' as const, steps: [] },
      { questId: 'q2', title: 'Salt and Lamp Oil', kind: 'side' as const, steps: [] },
    ]
    const objectives = [
      objective({ text: 'Carry the crate to the docks' }),
      objective({ questId: 'q2', questTitle: 'Salt and Lamp Oil', text: 'Buy lamp oil' }),
    ]

    hud.show({ quests, objectives, trackedQuestId: 'q1' })
    const panel = screen.querySelector('.gb-objectives') as HTMLElement
    const main = panel.querySelector('.gb-chip-main') as HTMLElement
    expect(main.hidden).toBe(false)
    expect(main.textContent).toBe('Main')
    within(panel).getByText('1 more quest')

    // Following an errand while the story waits, with nothing saying so, is how
    // a player loses the main line among the jobs they picked up on the way.
    hud.show({ trackedQuestId: 'q2' })
    expect(main.hidden).toBe(true)
    within(panel).getByText('1 more quest, the main line')
  })

  it('scrolls inside its corner rather than running off the screen', () => {
    const { screen } = mount()
    const style = getComputedStyle(screen.querySelector('.gb-objectives') as HTMLElement)
    expect(style.overflowY).toBe('auto')
    expect(Number.parseFloat(style.maxHeight)).toBeGreaterThan(0)
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

describe('conversation', () => {
  it('takes a typed line and leaves by the button, which says which key does the same', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()

    hud.show({ talk: { speaker: 'Mara Quill' } })
    expect(getAllByText(screen, 'Mara Quill').length).toBeGreaterThan(0)
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
    await waitFor(() => expect(queryAllByText(screen, 'Mara Quill')).toHaveLength(0))
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

  it('appends a streamed reply into the same node and draws what the speaker did apart', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })

    hud.show({ talk: { replyChunk: 'The crate ' } })
    const reply = getByText(screen, 'The crate')
    hud.show({ talk: { replyChunk: 'is at the docks.' } })
    hud.show({ talk: { does: 'wipes the counter' } })

    expect(reply.textContent).toBe('The crate is at the docks.')
    expect(getByText(screen, 'The crate is at the docks.')).toBe(reply)
    // Stage direction is not dialogue: it sits on the same turn, drawn apart.
    const turn = reply.closest('.gb-turn') as HTMLElement
    expect(turn.dataset.who).toBe('them')
    expect(within(turn).getByText('wipes the counter').className).toBe('gb-does')
    expect(reply.className).toBe('gb-says')
  })

  it('carries what the speaker does this turn, and only this turn', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', reply: 'Come in.', does: 'waves you over' } })
    getByText(screen, 'waves you over')

    hud.show({ talk: { does: 'goes back to the glass' } })
    expect(queryByText(screen, 'waves you over')).toBeNull()
    getByText(screen, 'goes back to the glass')

    hud.show({ talk: { does: null } })
    expect(queryByText(screen, 'goes back to the glass')).toBeNull()
    getByText(screen, 'Come in.')
    expect(screen.querySelector('.gb-does:not([hidden])')).toBeNull()
  })

  it('keeps the whole conversation, the player\'s turns and the speaker\'s apart', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill', reply: 'What do you want?' } })
    await user.keyboard('Where is the crate?{Enter}')
    hud.show({ talk: { replyChunk: 'At the docks.' } })
    await user.keyboard('Thanks.{Enter}')
    hud.show({ talk: { reply: 'Go on, then.' } })

    // Every turn stays on screen, oldest first, so the player can read back
    // what they asked and what they were told two turns ago.
    const turns = [...screen.querySelectorAll('.gb-turn')].map((turn) => [
      (turn as HTMLElement).dataset.who,
      turn.querySelector('.gb-says')?.textContent,
    ])
    expect(turns).toEqual([
      ['them', 'What do you want?'],
      ['you', 'Where is the crate?'],
      ['them', 'At the docks.'],
      ['you', 'Thanks.'],
      ['them', 'Go on, then.'],
    ])

    // The game may hand the transcript over whole, as it keeps it.
    hud.show({ talk: { turns: [{ who: 'them', says: 'Still here?', does: 'looks up' }] } })
    expect(screen.querySelectorAll('.gb-turn')).toHaveLength(1)
    getByText(screen, 'looks up')
  })

  it('is a side panel of one width, and the transcript scrolls inside it', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })
    const panel = screen.querySelector('.gb-talk') as HTMLElement
    const before = getComputedStyle(panel).width

    hud.show({ talk: { replyChunk: 'A long reply. '.repeat(200) } })
    // Text arriving does not move the frame: the width is a number, not the content.
    expect(getComputedStyle(panel).width).toBe(before)
    expect(Number.parseFloat(before)).toBeGreaterThan(0)
    expect(getComputedStyle(panel).right).toBe(getComputedStyle(panel).top)
    expect(getComputedStyle(screen.querySelector('.gb-transcript') as HTMLElement).overflowY).toBe('auto')
  })
})

describe('the moves on the table', () => {
  const MOVES = [
    { key: 'give_quest#q_ledger', label: 'Take the job: The Ledger' },
    { key: 'hand_over#i_ledger', label: 'Hand over the ledger' },
  ]

  /** Every move on screen right now, in the order the player reads them. */
  function options(screen: HTMLElement): string[] {
    return [...screen.querySelectorAll('.gb-move .gb-what')].map((node) => node.textContent ?? '')
  }

  it('draws nothing until there is something worth clicking', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' } })
    expect(options(screen)).toEqual([])

    // A conversation with nothing left to do but leave draws no menu either.
    hud.show({ talk: { moves: [] } })
    expect(options(screen)).toEqual([])

    hud.show({ talk: { moves: MOVES } })
    expect(options(screen)).toEqual(['Take the job: The Ledger', 'Hand over the ledger'])
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
    getByText(screen, 'Take the job: The Ledger', { selector: '[data-who="you"] .gb-says' })
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
    getByText(screen, 'what have you got?', { selector: '[data-who="you"] .gb-says' })
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
    expect(screen.querySelector('.gb-turn')).toBeNull()
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

    await user.click(within(panel).getByRole('tab', { name: 'Inventory I' }))
    getByRole(screen, 'dialog', { name: 'Inventory' })
    expect(within(panel).getByRole('tab', { name: 'Inventory I' }).getAttribute('aria-selected')).toBe('true')
    expect(within(panel).getByRole('tab', { name: 'Quests J' }).getAttribute('aria-selected')).toBe('false')

    await user.click(within(panel).getByRole('button', { name: 'Close (Escape)' }))
    expect(queryByRole(screen, 'dialog')).toBeNull()
  })

  it('is one frame whatever face is up, and the face scrolls inside it', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ quests: QUESTS, controls: CONTROLS, window: 'quests' })
    const frame = getByRole(screen, 'dialog') as HTMLElement
    const size = (): [string, string] => [getComputedStyle(frame).width, getComputedStyle(frame).height]
    // One frame filling the screen in fullscreen view
    const first = size()
    expect(first).toEqual(['1024px', '768px'])

    // A tab with one line and a tab with fifty are the same shape: nothing in
    // the window sizes itself to what is on the face.
    for (const key of ['m', 'i', 'x', 'o', '?']) {
      await user.keyboard(key)
      expect(size()).toEqual(first)
    }
    const body = frame.querySelector('.gb-window-body') as HTMLElement
    expect(getComputedStyle(body).overflowY).toBe('auto')
    expect(getComputedStyle(frame).height).not.toBe('auto')

    // At that width a face that is a list of rows reads in columns rather than
    // one line running the whole frame. The map fills the frame instead, and a
    // quest page is a row with its steps under it, so both take the width.
    for (const face of ['.gb-inventory', '.gb-codex', '.gb-settings', '.gb-controls']) {
      expect(getComputedStyle(frame.querySelector(face) as HTMLElement).getPropertyValue('columns')).toBe('440px')
    }
    for (const wide of ['.gb-map', '.gb-quests']) {
      expect(getComputedStyle(frame.querySelector(wide) as HTMLElement).getPropertyValue('columns')).toBe('')
    }
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

    const track = getByRole(screen, 'button', { name: 'Track Salt and Lamp Oil' })
    expect(track.textContent).toBe('Track')
    await user.click(track)
    expect(intents).toContainEqual({ kind: 'track', questId: 'q2' })

    within(objectives).getByText('Buy lamp oil')
    within(objectives).getByText('Salt and Lamp Oil')
    expect(within(objectives).queryByText('Carry the crate to the docks')).toBeNull()

    const tracking = getByRole(screen, 'button', { name: 'Stop tracking Salt and Lamp Oil' })
    expect(tracking.textContent).toBe('Tracking')
    await user.click(tracking)
    expect(intents).toContainEqual({ kind: 'track', questId: null })
  })

  it('draws each of the four states a step can be in', () => {
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
            { stepId: 's4', text: 'Burn the ledger instead', state: 'dropped' },
            { stepId: 's5', text: 'Sign the ledger', done: true },
          ],
        },
      ],
    })

    // Work the player cannot start yet, drawn like work they can, sends them
    // across town for a step that is not on the board; and a branch the quest
    // did not take, thrown away, hides that the story ever split.
    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    const state = (text: string): string | undefined => getByText(panel, text).closest('li')?.className
    expect(state('Talk to Mara')).toBe('gb-step-done')
    expect(state('Carry the crate to the docks')).toBe('gb-step-open')
    expect(state('Come back for the pay')).toBe('gb-step-upcoming')
    expect(state('Burn the ledger instead')).toBe('gb-step-dropped')
    within(getByText(panel, 'Burn the ledger instead').closest('li') as HTMLElement).getByText('Not taken')
    // and the shorter shape reads the same as it always did
    expect(state('Sign the ledger')).toBe('gb-step-done')
  })

  it('takes a journal page as the quest engine writes it', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    // The engine's own page, `questTitle` and all, so nothing in between has to
    // rename a field to put a quest on screen. A type error here is that
    // mapper coming back.
    const journal: readonly JournalEntry[] = [
      {
        questId: 'q1',
        questTitle: 'The Copper Wheel',
        kind: 'main',
        status: 'active',
        steps: [{ stepId: 's1', text: 'Talk to Mara', state: 'open' }],
      },
    ]
    hud.show({ window: 'quests', quests: journal })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    getByText(panel, 'The Copper Wheel')
    await user.click(getByRole(panel, 'button', { name: 'Track The Copper Wheel' }))
    expect(intents).toContainEqual({ kind: 'track', questId: 'q1' })
    getByRole(panel, 'button', { name: 'Give up The Copper Wheel' })
  })

  it('asks the quest\'s question on the step the player is on', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    // A `choice` step advances on nothing else, so a journal that draws the
    // question but no way back is a quest that cannot be finished.
    const journal: readonly JournalEntry[] = [
      {
        questId: 'q1',
        questTitle: 'The Copper Wheel',
        kind: 'main',
        status: 'active',
        steps: [
          { stepId: 's1', text: 'Take the ledger', state: 'done' },
          {
            stepId: 's2',
            text: 'Decide whose the ledger is',
            state: 'open',
            choice: {
              prompt: 'Hollis is offering more than Mara did. Whose is it?',
              options: [
                { key: 'keep-word', label: 'Keep your word to Mara' },
                { key: 'sell-out', label: 'Sell it to Hollis' },
              ],
            },
          },
        ],
      },
    ]
    hud.show({ window: 'quests', quests: journal })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    getByText(panel, 'Hollis is offering more than Mara did. Whose is it?')
    await user.click(getByRole(panel, 'button', { name: 'Sell it to Hollis' }))

    expect(intents).toContainEqual({ kind: 'decide', questId: 'q1', stepId: 's2', optionId: 'sell-out' })
  })

  it('offers no answer on a decision the player is not standing on', () => {
    const { hud, screen } = mount()
    const choice = {
      prompt: 'Hollis is offering more than Mara did. Whose is it?',
      options: [{ key: 'sell-out', label: 'Sell it to Hollis' }],
    }
    hud.show({
      window: 'quests',
      quests: [
        {
          questId: 'q1',
          title: 'The Copper Wheel',
          steps: [
            { stepId: 's1', text: 'Decide whose the crate is', state: 'done', choice },
            { stepId: 's2', text: 'Decide whose the ledger is', state: 'upcoming', choice },
          ],
        },
      ],
    })

    // Answering a step the flow is not on moves nothing, so a panel that offers
    // it is a button that does nothing, on the one screen that says what to do.
    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    expect(queryByRole(panel, 'button', { name: 'Sell it to Hollis' })).toBeNull()
    expect(queryByText(panel, 'Hollis is offering more than Mara did. Whose is it?')).toBeNull()
  })

  it('keeps the story where the player can find it', () => {
    const { hud, screen } = mount()
    // Nine errands running and the main line somewhere down the list is the
    // player scrolling the journal to find out what the game is about.
    hud.show({
      window: 'quests',
      quests: [
        { questId: 'q2', title: 'Salt and Lamp Oil', kind: 'side', steps: [] },
        { questId: 'q3', title: 'Lamps for the Alley', kind: 'side', steps: [] },
        { questId: 'q1', title: 'The Copper Wheel', kind: 'main', steps: [] },
      ],
    })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    const titles = [...panel.querySelectorAll('.gb-quest-entry .gb-row-title')].map((node) => node.textContent)
    expect(titles).toEqual(['The Copper Wheel', 'Salt and Lamp Oil', 'Lamps for the Alley'])

    const marked = [...panel.querySelectorAll('.gb-quest-entry')].map((entry) => entry.querySelector('.gb-chip-main') !== null)
    expect(marked).toEqual([true, false, false])
  })

  it('shows a failed quest as failed, with the reason, and a finished one as done', () => {
    const { hud, screen } = mount()
    // A quest that is simply gone reads as a bug; one that says it failed and
    // why is a story the player can read.
    hud.show({
      window: 'quests',
      quests: [
        { questId: 'q1', title: 'The Copper Wheel', status: 'failed', failReason: 'time-limit', steps: [] },
        { questId: 'q2', title: 'Salt and Lamp Oil', status: 'complete', steps: [] },
        { questId: 'q3', title: 'Lamps for the Alley', steps: [] },
      ],
    })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    const failed = getByText(panel, 'The Copper Wheel').closest('.gb-quest-entry') as HTMLElement
    expect(failed.dataset.status).toBe('failed')
    within(failed).getByText('Failed')
    within(failed).getByText('Ran out of time')
    // Nothing on a finished page can be tracked or given up: it would do nothing.
    expect(within(failed).queryByRole('button')).toBeNull()
    within(getByText(panel, 'Salt and Lamp Oil').closest('.gb-quest-entry') as HTMLElement).getByText('Done')
    getByRole(panel, 'button', { name: 'Give up Lamps for the Alley' })
  })

  it('counts a timed quest down from the values the journal gives', () => {
    const { hud, screen } = mount()
    const page = (remaining: number): QuestEntry => ({
      questId: 'q1',
      title: 'The Copper Wheel',
      timer: { remaining, total: 10800 },
      steps: [{ stepId: 's1', text: 'Carry the crate to the docks' }],
    })
    hud.show({ window: 'quests', quests: [page(4320)] })

    const panel = getByRole(screen, 'dialog', { name: 'Quests' })
    within(panel).getByText('Time left')
    const timer = panel.querySelector('.gb-quest-timer') as HTMLElement
    const clock = timer.querySelector('.gb-num') as HTMLElement
    expect(clock.textContent).toBe('1 h 12 min')
    expect(timer.dataset.low).toBe('false')
    expect((panel.querySelector('.gb-quest-timer .gb-fill') as HTMLElement).style.transform).toBe('scaleX(0.4)')

    // The timer runs on the game clock, so each push of the journal moves it,
    // written into the node already there: the page is not rebuilt around it.
    hud.show({ quests: [page(540)] })
    expect(panel.querySelector('.gb-quest-timer .gb-num')).toBe(clock)
    expect(clock.textContent).toBe('9 min')
    expect(timer.dataset.low).toBe('true')
    hud.show({ quests: [page(45)] })
    expect(clock.textContent).toBe('45 s')
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

describe('the inventory tab', () => {
  it('holds the credits and what is in hand, quest items first, each with its value', () => {
    const { hud, screen } = mount()
    hud.show({
      window: 'inventory',
      money: 128,
      carrying: [
        { id: 'i1', name: 'Green bottle', value: 3 },
        { id: 'i2', name: 'Brass ledger', quest: true },
      ],
    })

    // Money is a thing the player carries, so it is read here and nowhere else.
    const panel = getByRole(screen, 'dialog', { name: 'Inventory' })
    within(panel).getByText('128')
    expect(screen.querySelectorAll('.gb-coin')).toHaveLength(1)
    const names = [...panel.querySelectorAll('.gb-carried .gb-row-title')].map((node) => node.textContent)
    expect(names).toEqual(['Brass ledger', 'Green bottle'])
    within(panel).getByText('Quest')
    // What a thing is worth sits on its row; a thing with no value says nothing.
    expect(within(panel).getByText('3 credits').closest('li')?.textContent).toContain('Green bottle')
    expect(panel.querySelectorAll('.gb-carried .gb-value')).toHaveLength(1)
  })

  it('lists the places the player owns and what they left in each', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'inventory' })
    const panel = getByRole(screen, 'dialog', { name: 'Inventory' })
    within(panel).getByText('No place of your own yet.')

    hud.show({
      homes: [
        { id: 'in1', name: 'The flat over Lantern Row', text: 'Two rooms and a balcony.', placed: [{ id: 'i3', name: 'Oil painting', value: 300 }] },
        { id: 'in2', name: 'The dock house', placed: [] },
      ],
    })
    within(panel).getByText('Your places')
    const flat = within(panel).getByText('The flat over Lantern Row').closest('.gb-home') as HTMLElement
    within(flat).getByText('Two rooms and a balcony.')
    within(flat).getByText('Oil painting')
    within(flat).getByText('300 credits')
    const dock = within(panel).getByText('The dock house').closest('.gb-home') as HTMLElement
    within(dock).getByText('Nothing placed here yet.')
    expect(queryByText(panel, 'No place of your own yet.')).toBeNull()
  })

  it('says so plainly when there is nothing to carry', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'inventory' })
    within(getByRole(screen, 'dialog', { name: 'Inventory' })).getByText('Your pockets are empty.')
  })
})

describe('the codex tab', () => {
  it('files the places entered and the people met, each person with their standing and their facts, locked ones marked', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({
      codex: {
        places: [{ id: 'i1', name: 'The Copper Wheel', text: 'A bar on Lantern Row.' }],
        people: [
          {
            id: 'n1',
            name: 'Mara Quill',
            role: 'Keeps the bar at The Copper Wheel.',
            disposition: 'warm',
            // A fact's id is the game's handle: the index in the person's background, as a string.
            facts: [{ id: '0', text: 'Came up from the docks.' }, { id: '1' }],
          },
        ],
        history: [{ id: 'h1', title: 'The flood', text: 'The river took the old docks.' }],
      },
    })

    await user.keyboard('x')
    const panel = getByRole(screen, 'dialog', { name: 'Codex' })
    const heads = [...panel.querySelectorAll('.gb-codex-group h3')].map((node) => node.textContent)
    expect(heads).toEqual(['Places', 'People'])
    within(panel).getByText('A bar on Lantern Row.')

    const mara = within(panel).getByText('Mara Quill').closest('.gb-person') as HTMLElement
    within(mara).getByText('Keeps the bar at The Copper Wheel.')
    expect(within(mara).getByLabelText('Disposition: Warm').getAttribute('data-disposition')).toBe('warm')
    within(mara).getByText('1 of 2 known')
    within(mara).getByText('Came up from the docks.')
    // A fact not yet earned is a line that says so, never a gap.
    const locked = within(mara).getByText('Not learned yet').closest('li') as HTMLElement
    expect(locked.className).toBe('gb-fact-locked')

    // A standing that moved reads as moved on the next push.
    hud.show({
      codex: {
        places: [],
        people: [{ id: 'n1', name: 'Mara Quill', disposition: 'hostile', facts: [] }],
      },
    })
    within(panel).getByLabelText('Disposition: Hostile')
    expect(queryByText(panel, 'Places')).toBeNull()
  })

  it('says what it is for before anything is in it', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'codex' })
    within(getByRole(screen, 'dialog', { name: 'Codex' })).getByText(/Nothing recorded yet/)
  })
})

describe('the settings tab', () => {
  it('shows the hour, locks and skips the clock, picks the weather, and leaves', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ settings: { hour: 7, minute: 5, locked: false, weather: 'rain', weathers: ['clear', 'overcast', 'rain'] } })

    await user.keyboard('o')
    const panel = getByRole(screen, 'dialog', { name: 'Settings' })
    expect(within(panel).getByLabelText('Hour').textContent).toBe('07:05')

    await user.click(within(panel).getByRole('button', { name: 'Lock time' }))
    expect(intents).toContainEqual({ kind: 'lock-time', locked: true })
    // The hud decides nothing: the button reads locked once the game says so.
    hud.show({ settings: { hour: 7, minute: 5, locked: true, weather: 'rain', weathers: ['clear', 'overcast', 'rain'] } })
    expect(within(panel).getByRole('button', { name: 'Time locked' }).getAttribute('aria-pressed')).toBe('true')

    await user.click(within(panel).getByRole('button', { name: 'Skip ahead' }))
    expect(intents).toContainEqual({ kind: 'skip-time' })

    expect(within(panel).getByRole('button', { name: 'rain' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(within(panel).getByRole('button', { name: 'overcast' }))
    expect(intents).toContainEqual({ kind: 'weather', weather: 'overcast' })

    await user.click(within(panel).getByRole('button', { name: 'Exit game' }))
    // The tab reports nothing until the question in front of the player is answered.
    expect(intents).not.toContainEqual({ kind: 'exit' })
    await user.click(getByRole(screen, 'button', { name: 'Yes (Enter)' }))
    expect(intents).toContainEqual({ kind: 'exit' })
  })


  it('shows the minimap and full screen as the game has them, and asks for the other', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ window: 'settings' })
    const panel = getByRole(screen, 'dialog', { name: 'Settings' })

    // Before the game says otherwise: the minimap is on, the game is in a window.
    const minimap = within(panel).getByRole('button', { name: 'Minimap' })
    expect(minimap.getAttribute('aria-pressed')).toBe('true')
    await user.click(minimap)
    expect(intents).toContainEqual({ kind: 'minimap', shown: false })

    const full = within(panel).getByRole('button', { name: 'Full screen' })
    expect(full.getAttribute('aria-pressed')).toBe('false')
    await user.click(full)
    expect(intents).toContainEqual({ kind: 'fullscreen', on: true })

    // The hud decides neither: both read what the game pushed back.
    hud.show({
      settings: { hour: 7, minute: 0, locked: false, weather: 'clear', weathers: ['clear'], minimap: false, fullscreen: true },
    })
    expect(within(panel).getByRole('button', { name: 'Minimap' }).getAttribute('aria-pressed')).toBe('false')
    const back = within(panel).getByRole('button', { name: 'Leave full screen' })
    expect(back.getAttribute('aria-pressed')).toBe('true')
    await user.click(back)
    expect(intents).toContainEqual({ kind: 'fullscreen', on: false })
  })

  it('offers the way out before the game has pushed the clock', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'settings' })
    const panel = getByRole(screen, 'dialog', { name: 'Settings' })
    getByRole(panel, 'button', { name: 'Exit game' })
    expect(queryByText(panel, 'Lock time')).toBeNull()
    within(panel).getByText(/once the city is running/)
  })
})

describe('the bar', () => {
  it('names the way out, and its key does the same', async () => {
    const user = userEvent.setup()
    const { screen, intents } = mount()
    const leave = getByRole(screen, 'button', { name: 'Leave (N)' })
    within(leave).getByText('N')
    // Leaving throws the walk away, so the button asks before anything goes out.
    await user.click(leave)
    expect(intents).toEqual([])
    await user.click(getByRole(screen, 'button', { name: 'Yes (Enter)' }))
    expect(intents).toEqual([{ kind: 'exit' }])

    await user.keyboard('n')
    await user.click(getByRole(screen, 'button', { name: 'Yes (Enter)' }))
    expect(intents).toEqual([{ kind: 'exit' }, { kind: 'exit' }])
  })
})

describe('the map tab', () => {
  const MAP: MapView = {
    width: 40,
    height: 30,
    plots: [
      { id: 'p1', rect: { x: 4, y: 4, w: 8, h: 6 }, label: 'The Copper Wheel', named: true, prominence: 'landmark' },
      { id: 'p2', rect: { x: 20, y: 4, w: 8, h: 6 }, label: 'A warehouse' },
      { id: 'p3', rect: { x: 4, y: 16, w: 8, h: 6 }, prominence: 'notable' },
    ],
    marks: [
      { x: 6, y: 20, label: 'You', kind: 'you', facing: Math.PI / 2 },
      { x: 8, y: 7, label: 'The Copper Wheel', kind: 'goal', line: 'main' },
      { x: 30, y: 7, label: 'The docks', kind: 'goal', line: 'side' },
    ],
  }

  function viewBox(panel: HTMLElement): number[] {
    return (panel.querySelector('.gb-plan svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number)
  }

  it('draws the city with three fills, the player facing their way, the names it was told to write, and the story marked apart from an errand', () => {
    const { hud, screen } = mount()
    hud.show({ window: 'map', map: MAP })

    const panel = getByRole(screen, 'dialog', { name: 'Map' })
    const fills = [...panel.querySelectorAll('.gb-plan svg .gb-block')].map((node) => node.getAttribute('data-prominence'))
    expect(fills).toEqual(['landmark', 'background', 'notable'])

    const you = panel.querySelector('.gb-plan .gb-mark-you') as SVGElement
    expect(you.getAttribute('transform')).toMatch(/^translate\(6 20\) rotate\(90\) scale\(/)

    // Only the plot marked named is written on the plan; the other keeps its name for hovering.
    const names = [...panel.querySelectorAll('.gb-plan .gb-name text')].map((node) => node.textContent)
    expect(names).toEqual(['The Copper Wheel'])
    expect(panel.querySelector('.gb-plan .gb-block:nth-child(2) title')?.textContent).toBe('A warehouse')

    const goals = [...panel.querySelectorAll('.gb-plan .gb-mark-goal')]
    expect(goals.map((node) => node.getAttribute('data-line'))).toEqual(['main', 'side'])
    // a job already taken wears the ring as well as the square
    for (const goal of goals) expect(goal.querySelector('.gb-mark-ring')).not.toBeNull()
    expect(goals.map((node) => node.querySelector('text')?.textContent)).toEqual(['The Copper Wheel', 'The docks'])

    // The bearings under the plan say the same, the story first with its tag.
    const bearings = panel.querySelector('.gb-bearings') as HTMLElement
    const rows = [...bearings.querySelectorAll('li')]
    expect(rows.map((row) => row.getAttribute('data-line'))).toEqual(['main', 'side'])
    within(rows[0] as HTMLElement).getByText('Main')
  })

  it('fills the frame at first, then zooms and pans inside it by wheel, drag, button and key, and finds a bearing on a click', async () => {
    const user = userEvent.setup()
    const { hud, screen } = mount()
    hud.show({ window: 'map', map: MAP })
    const panel = getByRole(screen, 'dialog', { name: 'Map' })
    const plan = panel.querySelector('.gb-plan') as HTMLElement

    // Fit: the whole city framed to the plan's aspect, so nothing is cropped.
    const [x0, y0, w0, h0] = viewBox(panel) as [number, number, number, number]
    expect(x0).toBeLessThanOrEqual(0)
    expect(y0).toBeLessThanOrEqual(0)
    expect(x0 + w0).toBeGreaterThanOrEqual(40)
    expect(y0 + h0).toBeGreaterThanOrEqual(30)

    // The wheel zooms in about the pointer; the corner under it stays put.
    fireEvent.wheel(plan, { deltaY: -100, clientX: 0, clientY: 0 })
    const [x1, , w1] = viewBox(panel) as [number, number, number, number]
    expect(w1).toBeCloseTo(w0 / 1.5, 5)
    expect(x1).toBeCloseTo(x0, 5)

    // A drag to the left pans the view to the right, in the plan's own cells.
    await user.pointer([
      { keys: '[MouseLeft>]', target: plan, coords: { clientX: 200, clientY: 100 } },
      { coords: { clientX: 100, clientY: 100 } },
      { keys: '[/MouseLeft]' },
    ])
    const [x2] = viewBox(panel) as [number, number, number, number]
    expect(x2).toBeGreaterThan(x1)

    // The buttons carry their keys and do the same as the keys.
    await user.click(within(panel).getByRole('button', { name: 'Zoom in (+)' }))
    expect((viewBox(panel)[2] as number)).toBeCloseTo(w1 / 1.5, 5)
    await user.click(within(panel).getByRole('button', { name: 'Fit (0)' }))
    expect(viewBox(panel)).toEqual([x0, y0, w0, h0])
    ;(panel.querySelector('.gb-map') as HTMLElement).focus()
    await user.keyboard('+')
    expect((viewBox(panel)[2] as number)).toBeCloseTo(w0 / 1.5, 5)
    await user.keyboard('{ArrowRight}')
    expect((viewBox(panel)[0] as number)).toBeGreaterThan(x0)
    await user.keyboard('0')
    expect(viewBox(panel)).toEqual([x0, y0, w0, h0])

    // Zoomed well in and centred on the player, the player is mid-frame; a bearing clicked swings it onto the goal.
    await user.keyboard('++++')
    await user.click(within(panel).getByRole('button', { name: 'You (Y)' }))
    let [x, y, w, h] = viewBox(panel) as [number, number, number, number]
    expect(x + w / 2).toBeCloseTo(6, 5)
    expect(y + h / 2).toBeCloseTo(20, 5)
    await user.click(within(panel).getByRole('button', { name: 'The docks' }))
    ;[x, y, w, h] = viewBox(panel) as [number, number, number, number]
    expect(x + w / 2).toBeCloseTo(30, 5)
    expect(y + h / 2).toBeCloseTo(7, 5)

    // The view survives the next push of the survey: the player moved, the zoom did not.
    hud.show({ map: { ...MAP, marks: [{ x: 7, y: 20, label: 'You', kind: 'you', facing: 0 }] } })
    expect(viewBox(panel)[2]).toBeCloseTo(w, 5)
    expect(panel.querySelectorAll('.gb-plan .gb-mark-goal')).toHaveLength(0)
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
    expect((panel.querySelector('.gb-plan') as HTMLElement).hidden).toBe(true)
  })
})

describe('the stations on the map', () => {
  const CITY: MapView = {
    width: 40,
    height: 30,
    plots: [{ id: 'p1', rect: { x: 4, y: 4, w: 8, h: 6 }, label: 'The Copper Wheel' }],
    stations: [
      { id: 'p9', name: 'Northgate', x: 30, y: 25 },
      { id: 'p10', name: 'Dock Street', x: 5, y: 5 },
    ],
  }

  it('marks and lists every station, and offers a ride only from one the player stands at', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ window: 'map', map: CITY })
    const panel = getByRole(screen, 'dialog', { name: 'Map' })

    const marks = [...panel.querySelectorAll('.gb-plan .gb-station')]
    expect(marks.map((node) => node.querySelector('text')?.textContent)).toEqual(['Northgate', 'Dock Street'])
    expect(marks[0]?.getAttribute('transform')).toMatch(/^translate\(30 25\) scale\(/)
    const list = within(panel).getByText('Stations').closest('.gb-station-list') as HTMLElement
    within(list).getByText('Northgate')
    within(list).getByText('Dock Street')
    within(list).getByText('Walk up to a station entrance to ride.')
    expect(within(list).queryAllByRole('button')).toHaveLength(0)

    // At a station, the others can be ridden to; this one says it is here.
    hud.show({ map: { ...CITY, boarding: 'p10' } })
    expect(within(list).getByText('Walk up to a station entrance to ride.').hidden).toBe(true)
    within(within(list).getByText('Dock Street').closest('li') as HTMLElement).getByText('Here')
    await user.click(within(list).getByRole('button', { name: 'Travel to Northgate' }))
    expect(intents).toContainEqual({ kind: 'travel', stationId: 'p9' })

    // The ride: a veil with the title alone, gone when the game has moved the player.
    hud.show({ window: null, loading: { title: 'Riding to Northgate', stages: [] } })
    const veil = getByRole(screen, 'status', { name: '' })
    getByText(veil, 'Riding to Northgate')
    expect(veil.dataset.veil).toBe('true')
    hud.show({ loading: null })
    expect(veil.getAttribute('aria-hidden')).toBe('true')

    // A city with no stations lists none.
    hud.show({ window: 'map', map: { ...CITY, stations: [] } })
    expect((panel.querySelector('.gb-station-list') as HTMLElement).hidden).toBe(true)
  })
})

describe('the counter', () => {
  it('lists what is on offer at its price against the player\'s credits, buys on a click, and closes both ways', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({
      money: 50,
      counter: {
        seller: 'Mara Quill',
        offers: [
          { id: 'i1', name: 'Green bottle', price: 3 },
          { id: 'i2', name: 'A cut gem', price: 300 },
        ],
      },
    })

    const counter = getByRole(screen, 'dialog', { name: 'Mara Quill' })
    within(counter).getByText('Your credits')
    within(counter).getByText('50')
    within(counter).getByText('3 credits')
    await user.click(within(counter).getByRole('button', { name: 'Buy Green bottle, 3 credits' }))
    expect(intents).toContainEqual({ kind: 'buy', itemId: 'i1' })

    // What costs more than the player holds stays on the counter to read, with its button off.
    const gem = within(counter).getByRole('button', { name: 'Buy A cut gem, 300 credits, not enough credits' }) as HTMLButtonElement
    expect(gem.disabled).toBe(true)
    expect(gem.closest('li')?.dataset.short).toBe('true')
    hud.show({ money: 400 })
    expect((within(counter).getByRole('button', { name: 'Buy A cut gem, 300 credits' }) as HTMLButtonElement).disabled).toBe(false)

    // Nothing is taken off the counter here: a thing sold is gone on the next push.
    hud.show({ counter: { seller: 'Mara Quill', offers: [] } })
    within(counter).getByText('Nothing for sale today.')

    // Escape closes it, and so does the button that carries the key.
    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'counter-closed' })
    expect(counter.getAttribute('aria-hidden')).toBe('true')
    hud.show({ counter: { seller: 'Mara Quill', offers: [] } })
    expect(counter.getAttribute('aria-hidden')).toBeNull()
    await user.click(within(counter).getByRole('button', { name: 'Close (Escape)' }))
    expect(intents.filter((intent) => intent.kind === 'counter-closed')).toHaveLength(2)
    hud.show({ counter: { seller: 'Hollis', offers: [] } })
    hud.show({ counter: null })
    expect(counter.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('the screen', () => {
  const LEDGER: ScreenView = {
    machineId: 'machine_0001',
    title: 'Front desk terminal',
    locked: true,
    program: { kind: 'text', title: 'Ledger', lines: Array.from({ length: 30 }, (_, at) => `Entry ${at + 1}`) },
  }

  function glass(screen: HTMLElement): string {
    return screen.querySelector('.gb-screen-text')?.textContent ?? ''
  }

  /** What the glass says, row by row, without the padding that squares it. */
  function rows(screen: HTMLElement): string[] {
    return glass(screen).split('\n').map((row) => row.trim())
  }

  function press(...keys: string[]): void {
    for (const key of keys) fireEvent.keyDown(document.body, { key })
  }

  it('asks a locked machine\'s password, hands it to the game, and runs the program once the game opens it', () => {
    const { hud, screen, intents } = mount()
    hud.show({ screen: LEDGER })
    getByRole(screen, 'dialog', { name: 'Front desk terminal' })
    expect(glass(screen)).toContain('LOCKED')
    expect(glass(screen)).toContain('Password: _')

    // Typed characters go in as stars; Enter hands the line over.
    press('o', 'p', 'e', 'n')
    expect(glass(screen)).toContain('Password: ****_')
    press('Enter')
    expect(intents).toContainEqual({ kind: 'unlock', machineId: 'machine_0001', password: 'open' })
    expect(glass(screen)).toContain('Password: _')

    hud.show({ screen: { ...LEDGER, refused: true } })
    expect(glass(screen)).toContain('Wrong password. Try again.')

    // Open, it reads the program: the title, the lines, and the arrows scroll what does not fit.
    hud.show({ screen: { ...LEDGER, locked: false } })
    expect(glass(screen)).not.toContain('LOCKED')
    expect(rows(screen)[0]).toBe('Ledger')
    expect(rows(screen)).toContain('Entry 1')
    expect(rows(screen)).not.toContain('Entry 30')
    press('ArrowDown')
    expect(rows(screen)).not.toContain('Entry 1')
    expect(rows(screen)[2]).toBe('Entry 2')
  })

  it('takes every key while it is up, and Escape closes it after the keyboard is handed back', () => {
    const { hud, screen, intents } = mount()
    const heard: string[] = []
    const game = (event: Event): void => {
      heard.push((event as KeyboardEvent).key)
    }
    window.addEventListener('keydown', game)
    try {
      hud.show({ screen: { ...LEDGER, locked: false } })
      expect(hud.typing).toBe(true)
      press('j', 'w', 'ArrowUp')
      expect(heard).toEqual([])
      expect(intents.some((intent) => intent.kind === 'window')).toBe(false)

      press('Escape')
      expect(intents.slice(-2)).toEqual([
        { kind: 'typing', typing: false },
        { kind: 'screen-closed', machineId: 'machine_0001' },
      ])
      expect(hud.typing).toBe(false)
      expect((screen.querySelector('.gb-screen') as HTMLElement).getAttribute('aria-hidden')).toBe('true')
      press('w')
      expect(heard).toEqual(['w'])
    } finally {
      window.removeEventListener('keydown', game)
    }
  })

  it('plays snake with the arrows, draws the best score it was given, and reports the score when the game ends', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen, intents } = mount()
      hud.show({ screen: { machineId: 'machine_0002', title: 'Laptop', locked: false, program: { kind: 'snake', best: 120 } } })
      expect(glass(screen)).toContain('SNAKE')
      expect(glass(screen)).toContain('Best 120')
      const at = (): number => glass(screen).split('\n').find((row) => row.includes('@'))?.indexOf('@') ?? -1

      // The first arrow sets it going; a step later the head has moved that way.
      press('ArrowRight')
      const start = at()
      expect(start).toBeGreaterThan(0)
      vi.advanceTimersByTime(120)
      expect(at()).toBe(start + 1)

      // Straight into the east wall: the game is over and the score goes out once.
      vi.advanceTimersByTime(120 * 30)
      expect(glass(screen)).toContain('GAME OVER')
      const scores = intents.filter((intent) => intent.kind === 'score')
      expect(scores).toEqual([{ kind: 'score', machineId: 'machine_0002', game: 'snake', score: expect.any(Number) }])

      // The game draws the best the playthrough pushes back, without starting over.
      hud.show({ screen: { machineId: 'machine_0002', title: 'Laptop', locked: false, program: { kind: 'snake', best: 200 } } })
      expect(glass(screen)).toContain('Best 200')
      expect(glass(screen)).toContain('GAME OVER')
      press('Enter')
      expect(glass(screen)).toContain('Arrows to start')
    } finally {
      vi.useRealTimers()
    }
  })

  it('plays tetris with the arrows and Space, draws the best score it was given, and reports the score when the well fills', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen, intents } = mount()
      hud.show({ screen: { machineId: 'machine_0003', title: 'Monitor', locked: false, program: { kind: 'tetris', best: 1200 } } })
      expect(glass(screen)).toContain('TETRIS')
      expect(glass(screen)).toContain('BEST  1200')
      expect(glass(screen)).toContain('NEXT')

      press('ArrowLeft')
      vi.advanceTimersByTime(500)
      expect(glass(screen)).toContain('[]')
      // Dropping every piece on the same column fills the well in the middle.
      for (let drop = 0; drop < 40; drop += 1) press(' ')
      expect(glass(screen)).toContain('GAME OVER')
      expect(intents.filter((intent) => intent.kind === 'score')).toEqual([
        { kind: 'score', machineId: 'machine_0003', game: 'tetris', score: expect.any(Number) },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the compass', () => {
  it('slides the points as the player turns, marks the tracked goal at its bearing with how far, and pins it to an edge behind them', () => {
    const { hud, screen } = mount()
    expect(queryByRole(screen, 'region', { name: 'Compass' })).toBeNull()

    const east = Math.PI / 2
    hud.show({ compass: { facing: 0, goal: { label: 'The Copper Wheel', bearing: east / 2, distance: 140, line: 'main' } } })
    const compass = screen.querySelector('.gb-compass') as HTMLElement
    expect(compass.hidden).toBe(false)
    const track = compass.querySelector('.gb-compass-track') as HTMLElement
    const mark = compass.querySelector('.gb-compass-mark') as HTMLElement
    const points = [...compass.querySelectorAll('.gb-compass-tick[data-point]')].map((node) => node.getAttribute('data-point'))
    expect(points.slice(0, 4)).toEqual(['S', 'W', 'N', 'E'])
    // Facing north, a goal to the north-east sits 45 degrees right of centre: the strip shows 120 degrees over 360 px.
    expect(mark.style.getPropertyValue('--at')).toBe('315px')
    expect(mark.getAttribute('data-line')).toBe('main')
    expect(mark.hasAttribute('data-edge')).toBe(false)
    getByText(compass, 'The Copper Wheel')
    getByText(compass, '140 m')
    const at0 = track.style.transform

    // Turning to face east slides the track by ninety degrees and brings the mark to centre.
    hud.show({ compass: { facing: east, goal: { label: 'The Copper Wheel', bearing: east, distance: 1240, line: 'main' } } })
    expect(mark.style.getPropertyValue('--at')).toBe('180px')
    expect(track.style.transform).not.toBe(at0)
    getByText(compass, '1.2 km')

    // A goal behind the player is pinned to the nearer edge; an errand wears the other mark.
    hud.show({ compass: { facing: 0, goal: { label: 'The docks', bearing: Math.PI * 1.2, distance: 80, line: 'side' } } })
    expect(mark.style.getPropertyValue('--at')).toBe('0px')
    expect(mark.getAttribute('data-edge')).toBe('left')
    expect(mark.getAttribute('data-line')).toBe('side')

    // No goal: the points stay, the mark and the line go.
    hud.show({ compass: { facing: 0 } })
    expect(mark.hidden).toBe(true)
    expect(queryByText(compass, 'The docks')).toBeNull()

    hud.show({ compass: null })
    expect(compass.getAttribute('aria-hidden')).toBe('true')
  })
})


const NEAR: MinimapView = {
  x: 20,
  y: 15,
  facing: Math.PI / 2,
  radius: 30,
  plots: [
    { id: 'p1', rect: { x: 16, y: 10, w: 6, h: 4 }, label: 'The Copper Wheel', prominence: 'landmark' },
    { id: 'p2', rect: { x: 26, y: 18, w: 5, h: 5 } },
  ],
  marks: [
    { x: 24, y: 12, label: 'The Copper Wheel', kind: 'goal', line: 'main' },
    { x: 400, y: 15, label: 'The docks', kind: 'goal', line: 'side' },
  ],
  doors: [{ id: 'd1', name: 'The Copper Wheel', x: 19, y: 14 }],
}

/** Where a thing drawn in pixels was put, in the plan's own cells. */
function at(node: Element | null): number[] {
  const found = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(node?.getAttribute('transform') ?? '')
  return found ? [Number(found[1]), Number(found[2])] : []
}

describe('the minimap', () => {
  it('draws the streets round the player north up, with the goals and the doors he knows', () => {
    const { hud, screen } = mount()
    const corner = screen.querySelector('.gb-minimap') as HTMLElement
    expect(corner.hidden).toBe(true)

    hud.show({ minimap: NEAR })
    expect(corner.hidden).toBe(false)
    within(corner).getByText('N')

    // North up, the player at the centre: the box is the radius either side of him.
    const plan = corner.querySelector('svg') as SVGElement
    expect(plan.getAttribute('viewBox')).toBe('-10 -15 60 60')
    expect(corner.querySelectorAll('.gb-near-plots .gb-block')).toHaveLength(2)
    expect(corner.querySelectorAll('.gb-near-doors .gb-door')).toHaveLength(1)
    expect(at(corner.querySelector('.gb-door'))).toEqual([19, 14])

    // Facing east turns the arrow ninety degrees and nothing else.
    expect((corner.querySelector('.gb-mark-you') as SVGElement).getAttribute('transform')).toMatch(
      /^translate\(20 15\) rotate\(90\) scale\(/,
    )

    // A goal inside the radius sits where it is; one beyond it is held at the rim and says so.
    const goals = [...corner.querySelectorAll('.gb-near-goals .gb-mark-goal')]
    expect(goals.map((goal) => goal.getAttribute('data-line'))).toEqual(['main', 'side'])
    expect(at(goals[0] as Element)).toEqual([24, 12])
    expect((goals[0] as HTMLElement).dataset.edge).toBeUndefined()
    const [x, y] = at(goals[1] as Element) as [number, number]
    expect((goals[1] as HTMLElement).dataset.edge).toBe('true')
    expect(Math.hypot(x - NEAR.x, y - NEAR.y)).toBeCloseTo(NEAR.radius * 0.86, 5)
  })

  it('follows the player without rebuilding the streets, and goes when settings turn it off', () => {
    const { hud, screen } = mount()
    hud.show({ minimap: NEAR })
    const corner = screen.querySelector('.gb-minimap') as HTMLElement
    const block = corner.querySelector('.gb-block') as SVGElement

    hud.show({ minimap: { ...NEAR, x: 22, facing: 0 } })
    expect((corner.querySelector('svg') as SVGElement).getAttribute('viewBox')).toBe('-8 -15 60 60')
    // The same node: a walk moves the view, it does not rebuild the city.
    expect(corner.querySelector('.gb-block')).toBe(block)

    hud.show({ settings: { hour: 7, minute: 0, locked: false, weather: 'clear', weathers: ['clear'], minimap: false } })
    expect(corner.getAttribute('aria-hidden')).toBe('true')
    hud.show({ settings: { hour: 7, minute: 0, locked: false, weather: 'clear', weathers: ['clear'], minimap: true } })
    expect(corner.hasAttribute('aria-hidden')).toBe(false)

    hud.show({ minimap: null })
    expect(corner.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('the two lines of work', () => {
  const PLAN: MapView = {
    width: 40,
    height: 30,
    plots: [{ id: 'p1', rect: { x: 4, y: 4, w: 8, h: 6 } }],
    marks: [
      { x: 8, y: 7, label: 'The Copper Wheel', kind: 'goal', line: 'main' },
      { x: 30, y: 7, label: 'The docks', kind: 'goal', line: 'side' },
    ],
  }

  it('wears one mark for the story and another for an errand, on the plan, the minimap and the strip', () => {
    const { hud, screen } = mount()
    hud.show({
      window: 'map',
      map: PLAN,
      minimap: NEAR,
      compass: { facing: 0, goal: { label: 'The Copper Wheel', bearing: 0, distance: 90, line: 'main' } },
    })

    // One square in two colours, and each one over a glow of its own colour.
    const paint = (node: Element): string[] => [
      getComputedStyle(node).getPropertyValue('fill'),
      getComputedStyle(node).getPropertyValue('stroke'),
    ]
    for (const root of ['.gb-plan', '.gb-near']) {
      const main = screen.querySelector(`${root} .gb-mark-goal[data-line='main'] .gb-mark-core`) as Element
      const side = screen.querySelector(`${root} .gb-mark-goal[data-line='side'] .gb-mark-core`) as Element
      const glow = screen.querySelector(`${root} .gb-mark-goal[data-line='main'] .gb-mark-halo`) as Element
      expect(main.tagName).toBe('rect')
      expect(side.tagName).toBe('rect')
      expect(glow).not.toBeNull()
      expect(paint(main)).not.toEqual(paint(side))
      for (const value of [...paint(main), ...paint(side)]) expect(value).not.toBe('')
    }

    // The bearings under the plan wear the same two marks.
    const rows = [...screen.querySelectorAll('.gb-bearings li')]
    expect(rows.map((row) => row.getAttribute('data-line'))).toEqual(['main', 'side'])

    // And so does the compass, in its own medium: the same square in the same
    // colour, drawn at strip size, so a place on the plan and the same place
    // on the strip are recognisably one place.
    const strip = screen.querySelector('.gb-compass-mark') as HTMLElement
    const asMain = strip.querySelector('.gb-mark-core') as Element
    expect(asMain.tagName).toBe('rect')
    const mainPaint = paint(asMain)
    hud.show({ compass: { facing: 0, goal: { label: 'The docks', bearing: 0, distance: 90, line: 'side' } } })
    const asSide = strip.querySelector('.gb-mark-core') as Element
    expect(paint(asSide)).not.toEqual(mainPaint)
  })
})

describe('leaving asks first', () => {
  it('asks in place, leaves on yes, stays on no, and takes the keyboard while it is up', async () => {
    const user = userEvent.setup()
    const { screen, intents } = mount()
    expect(queryByRole(screen, 'alertdialog')).toBeNull()

    await user.keyboard('n')
    const ask = getByRole(screen, 'alertdialog', { name: 'Leave the game' })
    expect(intents).toEqual([])
    // Yes has the ring, because Enter is yes: the keyboard and the ring never disagree.
    expect(ask.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Yes (Enter)' }))

    // Nothing else hears a key while a question is in front of the player.
    await user.keyboard('j')
    expect(intents).toEqual([])

    await user.keyboard('{Escape}')
    expect(intents).toEqual([{ kind: 'stay' }])
    expect(queryByRole(screen, 'alertdialog')).toBeNull()

    await user.keyboard('n')
    await user.keyboard('{Enter}')
    expect(intents).toEqual([{ kind: 'stay' }, { kind: 'exit' }])

    // No answers as well as Escape does, and Tab stays on the two answers.
    await user.keyboard('n')
    const again = getByRole(screen, 'alertdialog', { name: 'Leave the game' })
    await user.keyboard('{Tab}')
    expect(again.contains(document.activeElement)).toBe(true)
    await user.click(within(again).getByRole('button', { name: 'No (Esc)' }))
    expect(intents).toEqual([{ kind: 'stay' }, { kind: 'exit' }, { kind: 'stay' }])
  })

  it('stands in front of the window, and answering hands the keyboard back', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ window: 'settings', settings: { hour: 7, minute: 0, locked: false, weather: 'clear', weathers: ['clear'] } })
    const panel = getByRole(screen, 'dialog', { name: 'Settings' })
    await user.click(within(panel).getByRole('button', { name: 'Exit game' }))

    // The window is still there behind the question, and Escape answers the question.
    getByRole(screen, 'dialog', { name: 'Settings' })
    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'stay' })
    getByRole(screen, 'dialog', { name: 'Settings' })
    // The next Escape is the window's, which is what says the question let go.
    await user.keyboard('{Escape}')
    expect(intents).toContainEqual({ kind: 'window', window: null })
  })
})

describe('the controls tab', () => {
  it('lists every key the game declared next to the ones the interface owns', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({
      controls: [
        ...CONTROLS,
        { keys: ['G'], text: 'Say the way to the tracked quest', group: 'World' },
        { keys: ['T'], text: 'Turn the time of day', group: 'World' },
        { keys: ['K'], text: 'Change the weather', group: 'World' },
        { keys: ['P'], text: 'Hold the clock', group: 'World' },
      ],
    })

    await user.keyboard('?')
    expect(intents).toContainEqual({ kind: 'window', window: 'controls' })
    const panel = getByRole(screen, 'dialog', { name: 'Controls' })
    within(panel).getByText('Move')
    within(panel).getByText('Walk')
    const body = panel.querySelector('.gb-window-body') as HTMLElement
    const keys = [...body.querySelectorAll('.gb-row kbd')].map((node) => node.textContent)
    for (const key of ['W', 'G', 'T', 'K', 'P', 'N', 'I', 'J', 'M', 'X', 'O', '?', 'Esc']) expect(keys).toContain(key)
    within(body).getByText('Leave the game')
    within(body).getByText('Inventory')
    within(body).getByText('Close the window in front of you')
  })
})

describe('the loader', () => {
  it('names each stage of a build and how far it has got, and goes when the city is ready', () => {
    const { hud, screen } = mount()
    const build = (places: number, state: LoaderView['stages'][number]['state']): LoaderView => ({
      title: 'Writing Gullhaven',
      stages: [
        { id: 'history', label: 'Writing the history', state: 'done' },
        { id: 'city', label: 'Laying out the city', state: 'done' },
        { id: 'places', label: 'Writing the places', state, done: places, total: 8 },
        { id: 'quests', label: 'Writing the quests', state: 'waiting' },
      ],
    })
    hud.show({ loading: build(3, 'running') })

    const loader = getByRole(screen, 'status', { name: '' })
    getByText(loader, 'Writing Gullhaven')
    const places = getByRole(loader, 'progressbar', { name: 'Writing the places' })
    expect(places.getAttribute('aria-valuenow')).toBe('38')
    within(places).getByText('3/8')
    expect((places.querySelector('.gb-fill') as HTMLElement).style.transform).toBe('scaleX(0.375)')
    expect(getByRole(loader, 'progressbar', { name: 'Writing the quests' }).getAttribute('aria-valuenow')).toBe('0')

    // The next push fills the bar already there rather than drawing a new one.
    hud.show({ loading: build(8, 'done') })
    expect(getByRole(loader, 'progressbar', { name: 'Writing the places' })).toBe(places)
    expect(places.getAttribute('aria-valuenow')).toBe('100')

    hud.show({ loading: null })
    expect(loader.hidden || loader.getAttribute('aria-hidden') === 'true').toBe(true)
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
      getByText(screen, '+40 credits · Brass key')

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

  it('says the model is busy with the seconds counting down, and reads apart from an error', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen } = mount()
      hud.announce({ kind: 'model-busy', retryIn: 12 })
      hud.announce({ kind: 'error', text: 'The sidecar is not running' })

      const busy = getByText(screen, 'The model is busy').closest('.gb-notice') as HTMLElement
      const fault = getByText(screen, 'The sidecar is not running').closest('.gb-notice') as HTMLElement
      expect(busy.dataset.mood).toBe('wait')
      expect(fault.dataset.mood).toBe('fault')
      expect(busy.dataset.tone).toBe('minor')

      const clock = busy.querySelector('.gb-num') as HTMLElement
      within(busy).getByText(/Trying again in/)
      expect(clock.textContent).toBe('0:12')
      vi.advanceTimersByTime(5000)
      expect(clock.textContent).toBe('0:07')
      // It stays for the whole wait, so it does not vanish before the retry.
      vi.advanceTimersByTime(4000)
      getByText(screen, 'The model is busy')
      vi.advanceTimersByTime(3200)
      expect(queryByText(screen, 'The model is busy')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('words every kind of event, and says nothing for credits that did not move', () => {
    vi.useFakeTimers()
    try {
      const { hud, screen } = mount()
      hud.announce({ kind: 'quest-started', title: 'The Copper Wheel' })
      hud.announce({ kind: 'step-done', text: 'Talk to Mara' })
      hud.announce({ kind: 'quest-failed', title: 'Salt and Lamp Oil' })
      hud.announce({ kind: 'money', delta: -12 })
      const cards = [...screen.querySelectorAll('.gb-notice')].map((card) => [card.textContent, (card as HTMLElement).dataset.tone])
      expect(cards).toEqual([
        ['New quest: The Copper Wheel', 'major'],
        ['Done: Talk to Mara', 'minor'],
        ['Quest failed: Salt and Lamp Oil', 'major'],
        ['-12 credits', 'minor'],
      ])
      expect((getByText(screen, '-12 credits').closest('.gb-notice') as HTMLElement).dataset.sign).toBe('down')

      hud.announce({ kind: 'money', delta: 0 })
      expect(screen.querySelectorAll('.gb-notice')).toHaveLength(4)
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

describe('the layers', () => {
  it('gives every surface its own layer, front to back, with nothing shared', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' }, window: 'quests', loading: { title: 'Writing', stages: [] }, compass: { facing: 0 } })
    const z = (selector: string): number => Number(getComputedStyle(screen.querySelector(selector) as HTMLElement).zIndex)
    const order = [
      '.gb-objectives',
      '.gb-minimap',
      '.gb-compass',
      '.gb-talk',
      '.gb-notices',
      '.gb-bar',
      '.gb-scrim',
      '.gb-counter-room',
      '.gb-window-room:not(.gb-counter-room)',
      '.gb-screen-room',
      '.gb-confirm-room',
      '.gb-loader',
    ].map(z)
    for (const layer of order) expect(Number.isFinite(layer)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })

  it('keeps the objectives corner, the minimap, the notices column, the conversation and the window in disjoint regions', () => {
    const { hud, screen } = mount()
    hud.show({ talk: { speaker: 'Mara Quill' }, compass: { facing: 0 } })
    hud.announce({ kind: 'note', text: 'A note' })
    const px = (selector: string, prop: string): number =>
      Number.parseFloat(getComputedStyle(screen.querySelector(selector) as HTMLElement).getPropertyValue(prop))

    // Left to right along the top band: the corner, then the notices, then the
    // side panel, each ending before the next begins.
    const cornerRight = px('.gb-objectives', 'left') + px('.gb-objectives', 'width')
    expect(px('.gb-compass', 'left')).toBeGreaterThan(cornerRight)
    expect(px('.gb-notices', 'left')).toBeGreaterThan(cornerRight)
    // The compass strip sits at the top of the band and the notices start under it.
    expect(px('.gb-notices', 'top')).toBeGreaterThanOrEqual(px('.gb-compass', 'top') + px('.gb-compass', 'height'))
    const sideWidth = (px('.gb-talk', 'width') || 0) + (px('.gb-talk', 'right') || 0)
    expect(px('.gb-notices', 'right')).toBeGreaterThanOrEqual(0)
    // The window's room covers the screen edge to edge in fullscreen view.
    expect(px('.gb-window-room', 'left')).toBe(0)
    expect(px('.gb-window-room', 'top')).toBe(0)
    // And the side panel stops above the bar's band.
    expect(px('.gb-talk', 'bottom') || LAYOUT.foot).toBeGreaterThanOrEqual(px('.gb-bar', 'bottom') || 0)

    // The minimap shares the corner's column: the same edge, above the bar.
    expect(px('.gb-minimap', 'left')).toBe(px('.gb-objectives', 'left'))
    expect(px('.gb-minimap', 'bottom')).toBeGreaterThan(px('.gb-bar', 'bottom'))
    // The column gives the minimap and the foot their pixels first and the
    // corner what is left, so in a view this tall the corner still gets all of
    // its height and the two never meet.
    expect(CORNER_RESERVED + LAYOUT.corner.height).toBeLessThanOrEqual(window.innerHeight)

    // The question stands in the room the window and the counter share, and in front of both.
    for (const side of ['left', 'right', 'top', 'bottom']) {
      expect(px('.gb-confirm-room', side)).toBe(px('.gb-window-room', side))
    }
  })
})

describe('the look', () => {
  /** Every declaration in the sheet that is not the block declaring the tokens. */
  function withoutTokens(): string {
    return HUD_CSS.replace(TOKENS, '')
  }

  it('writes every colour as a token, so one file retunes the whole interface', () => {
    // A hex or an rgb() anywhere else is a colour that cannot be changed with
    // the rest, which is how one panel ends up a shade off every other.
    expect(withoutTokens()).not.toMatch(/#[0-9a-fA-F]{3}\b/)
    expect(withoutTokens()).not.toMatch(/rgba?\(/)
    expect(TOKENS).toMatch(/--gb-accent:/)
  })

  it('cuts its corners rather than rounding them, and never draws a border-radius', () => {
    expect(HUD_CSS).not.toMatch(/border-radius/)
    expect(HUD_CSS).toMatch(/clip-path: polygon/)
    const { hud, screen } = mount()
    hud.show({ window: 'quests', quests: QUESTS })
    const frame = getByRole(screen, 'dialog', { name: 'Quests' })
    expect(frame.classList.contains('gb-cut')).toBe(true)
    expect(getComputedStyle(frame).getPropertyValue('clip-path')).toContain('polygon')
  })

  it('gives every row its icon, its state and the button that acts on it', () => {
    const { hud, screen } = mount()
    hud.show({
      money: 50,
      counter: { seller: 'Mara Quill', offers: [{ id: 'i1', name: 'Green bottle', price: 3 }] },
    })
    const row = getByText(screen, 'Green bottle').closest('.gb-row') as HTMLElement
    expect(row.querySelector('.gb-tile svg')).not.toBeNull()
    within(row).getByText('3 credits')
    // A row that can be acted on says so, so the pointer answers on it and
    // nowhere else.
    expect(row.dataset.acts).toBe('true')
    expect((row.querySelector('.gb-row-acts button') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('motion', () => {
  /** The property each transition and each keyframe in the sheet writes. */
  function animated(): string[] {
    const moved: string[] = []
    for (const match of HUD_CSS.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of (match[1] ?? '').split(',')) {
        const name = part.trim().split(/\s+/)[0]
        if (name) moved.push(name)
      }
    }
    for (const frames of HUD_CSS.matchAll(/@keyframes[^{]+\{([\s\S]*?\}\s*)\}/g)) {
      for (const line of (frames[1] ?? '').matchAll(/([a-z-]+):\s*[^;]+;/g)) {
        if (line[1]) moved.push(line[1])
      }
    }
    return moved
  }

  it('moves nothing but transform, opacity and colour, because it draws over a running scene', () => {
    // Anything that lays out or repaints per frame over a 3D scene costs the
    // frame, so the sheet may not name one at all.
    expect([...new Set(animated())].sort()).toEqual(['background-color', 'color', 'opacity', 'transform'])
    expect(HUD_CSS).not.toMatch(/backdrop-filter/)
    expect(HUD_CSS).not.toMatch(/transition:\s*all/)
  })

  it('says how a surface arrives and how it leaves, one family per kind', () => {
    const { hud, screen } = mount()
    hud.show({ compass: { facing: 0 }, talk: { speaker: 'Mara Quill' }, window: 'quests', quests: QUESTS })
    const at = (selector: string): string[] => {
      const node = screen.querySelector(selector) as HTMLElement
      return [node.dataset.reveal ?? '', node.dataset.state ?? '']
    }
    // A corner panel drops in, a side panel comes in from its edge, a frame rises.
    expect(at('.gb-compass')).toEqual(['corner', 'open'])
    expect(at('.gb-talk')).toEqual(['side', 'open'])
    expect(at('.gb-window:not(.gb-counter)')).toEqual(['frame', 'open'])
    expect(at('.gb-scrim')).toEqual(['fade', 'open'])

    // Closed the moment it is asked: it takes no clicks and leaves the
    // accessible tree while its pixels are still there.
    hud.show({ window: null })
    const frame = screen.querySelector('.gb-window:not(.gb-counter)') as HTMLElement
    expect(frame.dataset.state).toBe('closing')
    expect(frame.getAttribute('aria-hidden')).toBe('true')
    expect(frame.hidden).toBe(false)
  })

  it('collapses to an instant change when the player asks for less movement', () => {
    vi.useFakeTimers()
    const real = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('prefers-reduced-motion'), media: query })) as typeof window.matchMedia
    try {
      const { hud, screen } = mount()
      hud.show({ window: 'quests', quests: QUESTS })
      hud.show({ window: null })
      // Nothing lingers: the frame is out on the same tick rather than after a
      // leave the player did not ask to watch.
      vi.advanceTimersByTime(0)
      expect((screen.querySelector('.gb-window:not(.gb-counter)') as HTMLElement).hidden).toBe(true)

      // And a number that would count to its new value is simply at it.
      hud.show({ money: 50, counter: { seller: 'Mara Quill', offers: [] } })
      const counter = getByRole(screen, 'dialog', { name: 'Mara Quill' })
      hud.show({ money: 400 })
      within(counter).getByText('400')
    } finally {
      window.matchMedia = real
      vi.useRealTimers()
    }
  })

  it('acts on a click before it moves anything', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    hud.show({ money: 50, counter: { seller: 'Mara Quill', offers: [{ id: 'i1', name: 'Green bottle', price: 3 }] } })
    // The intent is out on the same tick as the click: motion follows what the
    // player asked for, it never delays it.
    await user.click(getByRole(screen, 'button', { name: 'Buy Green bottle, 3 credits' }))
    expect(intents).toContainEqual({ kind: 'buy', itemId: 'i1' })
  })
})

describe('what the interface claims', () => {
  it('names its keys so the game can bind around them, and they are the keys that work', async () => {
    const user = userEvent.setup()
    const { hud, screen, intents } = mount()
    expect(Object.keys(HUD_KEYS)).toEqual([
      'quests',
      'map',
      'inventory',
      'codex',
      'settings',
      'controls',
      'leave',
      'fullscreen',
      'close',
      'send',
      'pick',
    ])

    await user.keyboard(HUD_KEYS.map)
    expect(intents).toContainEqual({ kind: 'window', window: 'map' })
    hud.show({ window: 'map' })
    getByRole(screen, 'dialog', { name: 'Map' })
    await user.keyboard(HUD_KEYS.fullscreen)
    expect(intents).toContainEqual({ kind: 'fullscreen', on: true })
    await user.keyboard(HUD_KEYS.leave)
    await user.keyboard('{Enter}')
    expect(intents).toContainEqual({ kind: 'exit' })
  })

  it('ships its stylesheet as one string, installed once, with square corners throughout', () => {
    mount()
    mount()
    const installed = [...document.head.querySelectorAll('style')].filter((style) => style.textContent === HUD_CSS)
    expect(installed).toHaveLength(1)
    expect(HUD_CSS.length).toBeGreaterThan(0)
    expect(HUD_CSS).not.toMatch(/border-radius/)
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
