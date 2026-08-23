// @vitest-environment jsdom
import type { Driving } from '@gb/drive'
import type { Hud } from '@gb/hud'
import { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import userEvent from '@testing-library/user-event'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import type { Buildings } from '../src/buildings.ts'
import type { Companions } from '../src/companions.ts'
import { Conditions } from '../src/conditions.ts'
import type { Guide } from '../src/guide.ts'
import { Interaction } from '../src/interaction.ts'
import { Player } from '../src/player.ts'
import type { Reporting } from '../src/reporting.ts'
import type { Talking } from '../src/talking.ts'
import type { Target } from '../src/targets.ts'

const nowhere = () => false
let close: Array<() => void> = []

afterEach(() => {
  for (const go of close) go()
  close = []
  document.body.innerHTML = ''
})

function stage(): { camera: THREE.PerspectiveCamera; element: HTMLElement } {
  const element = document.createElement('div')
  document.body.append(element)
  return { camera: new THREE.PerspectiveCamera(), element }
}

describe('riding in a car', () => {
  function body(): Player {
    const { camera, element } = stage()
    const player = new Player(camera, element, nowhere)
    close.push(() => player.dispose())
    return player
  }

  it('reads the same keys walking does, so the car needs no keyboard of its own', async () => {
    const player = body()
    const user = userEvent.setup()

    await user.keyboard('{w>}{Shift>}')
    expect(player.input).toEqual({ forward: 1, strafe: 0, running: true })
    await user.keyboard('{/w}{/Shift}{s>}{a>}')
    expect(player.input).toEqual({ forward: -1, strafe: -1, running: false })
    await user.keyboard('{/s}{/a}')
  })

  it('puts the eye where the seat is, turns the view with the car, and leans it over', () => {
    const player = body()
    player.placeAt(10, 10, 0)

    player.ride({ x: 3, y: 1.16, z: 4, turned: 0.5, roll: 0.08 })
    expect(player.position).toEqual({ x: 3, z: 4 })
    expect(player.heading).toBeCloseTo(0.5, 6)

    // and again next frame, so a car going round a corner carries the view round
    player.ride({ x: 3.2, y: 1.16, z: 4.4, turned: 0.25, roll: 0.08 })
    expect(player.heading).toBeCloseTo(0.75, 6)
  })

  it('will not walk out from under itself while the player is in the seat', async () => {
    const player = body()
    player.placeAt(10, 10, 0)
    await userEvent.setup().keyboard('{w>}')

    player.update(1 / 60)
    expect(player.position.z).toBeLessThan(10)

    player.ride({ x: 3, y: 1.16, z: 4, turned: 0, roll: 0 })
    player.update(1 / 60)
    player.update(1 / 60)
    expect(player.position).toEqual({ x: 3, z: 4 })

    // and walks again the moment they are put back on the pavement
    player.ride(undefined)
    player.placeAt(20, 20, 0)
    player.update(1 / 60)
    expect(player.position.z).toBeLessThan(20)
  })
})

describe('the keys the player presses', () => {
  function bound(input: { aimed?: Target; typing?: boolean } = {}) {
    const { camera, element } = stage()
    const clock = PlayerState.create('world_0001').clock
    const notes: string[] = []
    let got = 0

    const interaction = new Interaction({
      element,
      world: {} as World,
      player: {} as PlayerState,
      log: {} as QuestLog,
      hud: { typing: input.typing ?? false } as Hud,
      body: new Player(camera, element, nowhere),
      buildings: {} as Buildings,
      talking: { active: false } as Talking,
      companions: {} as Companions,
      driving: { act: () => void got++ } as unknown as Driving,
      guide: { say: () => 'The Copper Wheel: 40 m, head east' } as Guide,
      conditions: new Conditions(clock),
      report: { note: (text: string) => void notes.push(text) } as Reporting,
      aimed: () => input.aimed,
    })
    close.push(() => interaction.dispose())
    return { clock, notes, user: userEvent.setup(), got: () => got }
  }

  const wheel: Target = { kind: 'drive', id: 'car_3', label: 'Get in the taxi', at: { x: 1, z: 1 } }

  it('gets into the car in reach on the act key', async () => {
    const keys = bound({ aimed: wheel })
    await keys.user.keyboard('e')
    expect(keys.got()).toBe(1)
  })

  it('says the way to the quest being followed', async () => {
    const keys = bound()
    await keys.user.keyboard('g')
    expect(keys.notes).toEqual(['The Copper Wheel: 40 m, head east'])
  })

  it('turns the hour, the weather and the clock itself over', async () => {
    const keys = bound()
    await keys.user.keyboard('t')
    expect(keys.clock.hour).toBe(12)

    await keys.user.keyboard('k')
    expect(keys.clock.weather).toBe('overcast')

    await keys.user.keyboard('p')
    expect(keys.clock.rate).toBe(0)
    expect(keys.notes).toEqual(['12:00, the middle of the day', 'Cloud rolls in', 'Time held'])
  })

  it('hears none of it while the player is writing to somebody', async () => {
    const keys = bound({ aimed: wheel, typing: true })
    await keys.user.keyboard('etgkp')
    expect(keys.got()).toBe(0)
    expect(keys.notes).toEqual([])
    expect(keys.clock.hour).toBe(8)
  })
})
