import { Rng } from '@gb/kit'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator } from '../src/index.ts'
import type { Instance, InstanceRequest, Narrator, NpcProfile, PlaceRequest, WorldSummary } from '../src/narrator.ts'
import { headOf } from '../src/narrator/places.ts'
import { StreetNames } from '../src/narrator/streets.ts'
import type { Premise } from '@gb/world'
import { buildTown, digest } from './support.ts'

const BRIEF = { theme: 'rain-soaked port city under a permanent drizzle', seed: 'fanned', blocksX: 3, blocksY: 3 }

/**
 * A narrator that answers a whole town at once.
 *
 * It writes every place off the same offline narrator in request order, the way
 * a narrator that keeps its own city straight has to, and then hands the
 * answers back through `width` calls in the air: they land in whatever order
 * the jitter puts them, and the people and things inside each answer come back
 * in whatever order that call wrote them. Everything a fan-out can vary, this
 * varies.
 */
class Fanned implements Narrator {
  readonly asked = { instances: 0, places: 0, npcs: 0, items: 0 }
  #offline: OfflineNarrator
  #width: number
  #rng: Rng

  constructor(seed: string, width: number) {
    this.#offline = new OfflineNarrator(seed)
    this.#width = width
    this.#rng = new Rng(`fan/${width}`)
  }

  writePremise(input: { theme: string; seed: string }): Promise<Premise> {
    return this.#offline.writePremise(input)
  }

  nameCity(input: Parameters<Narrator['nameCity']>[0]): Promise<string> {
    return this.#offline.nameCity(input)
  }

  namePlace(input: Parameters<Narrator['namePlace']>[0]): Promise<string> {
    this.asked.places++
    return this.#offline.namePlace(input)
  }

  describeNpc(input: Parameters<Narrator['describeNpc']>[0]): Promise<NpcProfile> {
    this.asked.npcs++
    return this.#offline.describeNpc(input)
  }

  describeItem(input: Parameters<Narrator['describeItem']>[0]): Promise<{ name: string; description: string }> {
    this.asked.items++
    return this.#offline.describeItem(input)
  }

  writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]> {
    return this.#offline.writeQuests(input)
  }

  async writeInstances(requests: readonly InstanceRequest[]): Promise<readonly Instance[]> {
    this.asked.instances++
    const settled = await this.#offline.writeInstances(requests)
    const landed: Instance[] = new Array(settled.length)
    for (let sent = 0; sent < settled.length; sent += this.#width) {
      const wave = settled.slice(sent, sent + this.#width).map((one, at) => ({ one, at: sent + at }))
      await Promise.all(
        this.#rng.shuffle(wave).map(async ({ one, at }) => {
          await new Promise((done) => setTimeout(done, this.#rng.int(0, 4)))
          landed[at] = { ...one, people: this.#rng.shuffle([...one.people]), things: this.#rng.shuffle([...one.things]) }
        }),
      )
    }
    return landed
  }
}

/**
 * A narrator with no plural of its own: the shape a model-backed narrator has
 * when it answers one question at a time. Every answer takes a jittered while,
 * the way a model call does, and the narrator counts how many questions it has
 * in the air at once, which is what the fan-out is for.
 */
class Singular implements Narrator {
  #offline = new OfflineNarrator('fanned')
  #rng = new Rng('singular')
  #inFlight = 0
  peak = 0

  writePremise = (input: { theme: string; seed: string }) => this.#offline.writePremise(input)
  nameCity = (input: Parameters<Narrator['nameCity']>[0]) => this.#offline.nameCity(input)
  namePlace = (input: Parameters<Narrator['namePlace']>[0]) => this.#slow(() => this.#offline.namePlace(input))
  describeNpc = (input: Parameters<Narrator['describeNpc']>[0]) => this.#slow(() => this.#offline.describeNpc(input))
  describeItem = (input: Parameters<Narrator['describeItem']>[0]) => this.#slow(() => this.#offline.describeItem(input))
  writeQuests = (input: { summary: WorldSummary; sideQuests: number }) => this.#offline.writeQuests(input)

  async #slow<T>(answer: () => Promise<T>): Promise<T> {
    this.#inFlight++
    this.peak = Math.max(this.peak, this.#inFlight)
    await new Promise((done) => setTimeout(done, this.#rng.int(0, 4)))
    const written = await answer()
    this.#inFlight--
    return written
  }
}

const town = async (narrator: Narrator) => {
  const built = await new Forge(narrator).build(BRIEF)
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value
}

describe('a town written by a narrator answering many places at once', () => {
  it('asks about every place that opens in one call, and about no door that does not', async () => {
    const narrator = new Fanned('fanned', 5)
    const { world } = await town(narrator)

    expect(narrator.asked).toEqual({ instances: 1, places: 0, npcs: 0, items: 0 })
    // and the rest of the town still has its signs up, written here rather than asked for
    const shut = world.plots().filter((plot) => !world.interiors().some((interior) => interior.plotId === plot.id))
    expect(shut.length).toBeGreaterThan(world.interiors().length * 4)
    for (const plot of shut) expect(plot.name.length, `${plot.id} has no sign`).toBeGreaterThan(2)
    // and they are signs, not one sign repeated down the street
    expect(new Set(shut.map((plot) => plot.name)).size).toBeGreaterThan(shut.length * 0.6)
  })

  it('builds the same city however many answers are in the air and whatever order they land in', async () => {
    const [one, few, all] = await Promise.all([town(new Fanned('fanned', 1)), town(new Fanned('fanned', 4)), town(new Fanned('fanned', 999))])

    expect(digest(few.world.toJSON())).toBe(digest(one.world.toJSON()))
    expect(digest(all.world.toJSON())).toBe(digest(one.world.toJSON()))
    expect(digest(few.quests)).toBe(digest(one.quests))
    expect(digest(all.quests)).toBe(digest(one.quests))
    expect(one.world.npcs().length).toBeGreaterThan(5)
  })

  it('leaves a post empty rather than filling it with somebody who was written for another one', async () => {
    // one person per place and a stranger nobody has a post for: matched by id,
    // the stranger is dropped; matched by position, they would be standing in
    // somebody else's job
    const thin = new Fanned('fanned', 3)
    const inner = thin.writeInstances.bind(thin)
    thin.writeInstances = async (requests) =>
      (await inner(requests)).map((one) => ({
        ...one,
        people: [...one.people.slice(0, 1), { postId: 'anchor_nowhere', role: 'guard' as const, name: 'A Stranger', personality: 'Uninvited.', knowledge: [] }],
        things: [],
      }))

    const { world } = await town(thin)
    expect(world.check()).toEqual([])
    expect(world.npcs().some((npc) => npc.name === 'A Stranger')).toBe(false)
    // one person per place: the rest of the answer named a post that is not there
    expect(world.npcs().length).toBe(world.interiors().filter((interior) => interior.anchors.length > 0).length)
    for (const npc of world.npcs()) {
      const interior = world.interior(npc.station!.interiorId)!
      expect(interior.anchors.some((anchor) => anchor.id === npc.station!.anchorId), `${npc.name} stands nowhere`).toBe(true)
    }
    // nothing the narrator was asked to name; only what the box writes off its own facts, a deed or a key
    expect(world.items().filter((item) => item.deedTo === undefined && item.opens === undefined)).toEqual([])
  })

  it('builds the same city out of a narrator that only answers one question at a time, with the whole town in the air', async () => {
    const singular = new Singular()
    const [plural, single] = await Promise.all([town(new OfflineNarrator('fanned')), town(singular)])

    expect(digest(single.world.toJSON())).toBe(digest(plural.world.toJSON()))
    expect(digest(single.quests)).toBe(digest(plural.quests))
    // every place, post and thing was asked about at once, not one after another
    expect(singular.peak, 'the narrator was asked one question at a time').toBeGreaterThan(single.world.npcs().length / 2)
  })

  it('writes what a narrator says a place is onto its interior, and leaves the field off a place it says nothing about', async () => {
    // the offline narrator writes no character at all, so the first place stands
    // for every place nobody wrote about and the rest carry what was written
    const said = (at: number) => `The ${at}th place, with the radio left on and a tab nobody has settled since spring.`
    const fanned = new Fanned('character', 3)
    const inner = fanned.writeInstances.bind(fanned)
    fanned.writeInstances = async (requests) => (await inner(requests)).map((one, at) => (at === 0 ? one : { ...one, character: said(at) }))

    const { world } = await town(fanned)
    const interiors = world.interiors()
    expect(interiors.length).toBeGreaterThan(1)
    expect(interiors[0]!.description).toBeUndefined()
    expect('description' in interiors[0]!).toBe(false)
    for (const [at, interior] of interiors.entries()) {
      if (at > 0) expect(interior.description, `place ${at} lost what it is`).toBe(said(at))
    }
  })

  it('writes every person a life and a staged background, in the first person where talk says it out loud', async () => {
    const { world } = await town(new OfflineNarrator('fanned'))
    const premise = world.premise()!
    for (const npc of world.npcs()) {
      const life = npc.life!
      expect(life, `${npc.name} has no life`).toBeDefined()
      for (const part of ['reason', 'errand', 'history', 'interests', 'manner', 'cares', 'avoids'] as const) {
        expect(life[part]?.length, `${npc.name} has no ${part}`).toBeGreaterThan(3)
      }
      // said as the greeting's middle beat exactly as written, so it has to be something they could say
      expect(life.reason, `${npc.name}: "${life.reason}" is not said in the first person`).toMatch(/\b(I|I'm|I've|my)\b/)
      expect(life.errand).toMatch(/\b(I|I'm|I've|my)\b/)
      expect(life.history).toContain(premise.happened.replace(/\.$/, ''))
      const stages = new Set(npc.background!.map((fact) => fact.unlockedBy))
      expect(npc.background!.length).toBeGreaterThanOrEqual(4)
      expect([...stages].sort()).toEqual(['met', 'quest', 'talked', 'told'])
    }
    // and two people in one room are not one person twice
    const lives = new Set(world.npcs().map((npc) => JSON.stringify(npc.life)))
    expect(lives.size).toBe(world.npcs().length)
  })
})

describe('the signs over the doors', () => {
  it('asks a narrator that hangs signs for every shut door at once, and keeps its answers in order', async () => {
    const asked: PlaceRequest[][] = []
    const offline = new OfflineNarrator('hung')
    const narrator: Narrator = {
      writePremise: (input) => offline.writePremise(input),
      nameCity: (input) => offline.nameCity(input),
      namePlace: (input) => offline.namePlace(input),
      describeNpc: (input) => offline.describeNpc(input),
      describeItem: (input) => offline.describeItem(input),
      writeQuests: (input) => offline.writeQuests(input),
      namePlaces: async (requests) => {
        asked.push([...requests])
        // one left blank, to prove the sign written here stays over that door
        return requests.map((request, at) => (at === 1 ? '' : `Sign ${request.index} ${request.charter.label}`))
      },
    }
    const built = await new Forge(narrator).build({ ...BRIEF, seed: 'hung' })
    if (!built.ok) throw new Error('the town would not build')
    const { world } = built.value
    const shut = world.plots().filter((plot) => !world.interiors().some((interior) => interior.plotId === plot.id))
    expect(asked.length).toBe(1)
    expect(asked[0]!.map((request) => request.kind)).toEqual(shut.map((plot) => plot.kind))
    expect(shut[0]!.name).toBe(`Sign ${asked[0]![0]!.index} ${world.charter(shut[0]!.kind)!.label}`)
    expect(shut[1]!.name).not.toMatch(/^Sign /)
    expect(shut.slice(2).every((plot, at) => plot.name === `Sign ${asked[0]![at + 2]!.index} ${world.charter(plot.kind)!.label}`)).toBe(true)
    // and no open door was named that way
    for (const interior of world.interiors()) expect(world.plot(interior.plotId)!.name).not.toMatch(/^Sign /)
  })

  it('tells every narrator the street a door is on, and a numbered address is on that street', async () => {
    const offline = new OfflineNarrator('kettle-row')
    const asked: PlaceRequest[] = []
    const narrator: Narrator = {
      writePremise: (input) => offline.writePremise(input),
      nameCity: (input) => offline.nameCity(input),
      namePlace: (input) => offline.namePlace(input),
      describeNpc: (input) => offline.describeNpc(input),
      describeItem: (input) => offline.describeItem(input),
      writeQuests: (input) => offline.writeQuests(input),
      writeInstances: (requests) => {
        asked.push(...requests)
        return offline.writeInstances(requests)
      },
      namePlaces: async (requests) => {
        asked.push(...requests)
        return []
      },
    }
    const built = await new Forge(narrator).build({ ...BRIEF, seed: 'kettle-row' })
    if (!built.ok) throw new Error('the town would not build')
    const { world } = built.value
    const streets = StreetNames.of(world)

    // every door, open or shut, is on a named street, and the town's streets are all different
    expect(asked.length).toBe(world.plots().length)
    for (const request of asked) expect(request.street, `plot ${request.index} is on no street`).toBeTruthy()
    expect(new Set(streets.all).size).toBe(streets.all.length)
    expect(new Set(asked.map((request) => request.street))).toEqual(new Set(streets.all))
    for (const name of streets.all) expect(name).toMatch(/^[A-Z][a-z]+ (Street|Row|Lane|Avenue)$/)

    // a sign that is an address is the address of the door it hangs over
    const numbered = world.plots().filter((plot) => /^\d+ /.test(plot.name))
    expect(numbered.length).toBeGreaterThan(0)
    for (const plot of numbered) expect(plot.name).toBe(`${plot.name.split(' ')[0]} ${streets.at(plot.entrance.cell, plot.entrance.facing)}`)

    // and a building added later stands on the street it always did
    const added = await new Forge(narrator).extend(world, 3)
    if (!added.ok) throw new Error('the town would not extend')
    expect(StreetNames.of(world).all).toEqual(streets.all)
    for (const id of added.value) {
      const plot = world.plot(id)!
      expect(asked.find((request) => request.index === world.plots().indexOf(plot))?.street).toBe(streets.at(plot.entrance.cell, plot.entrance.facing))
    }
  })

  it("hands the owner's brief and asks to the history writer, and the asks on to the quest writer", async () => {
    const offline = new OfflineNarrator('asked')
    let history: Parameters<NonNullable<Narrator['writePremise']>>[0] | undefined
    let summary: WorldSummary | undefined
    const narrator: Narrator = {
      writePremise: (input) => {
        history = input
        return offline.writePremise(input)
      },
      nameCity: (input) => offline.nameCity(input),
      namePlace: (input) => offline.namePlace(input),
      describeNpc: (input) => offline.describeNpc(input),
      describeItem: (input) => offline.describeItem(input),
      writeInstances: (requests) => offline.writeInstances(requests),
      writeQuests: (input) => {
        summary = input.summary
        return offline.writeQuests(input)
      },
    }
    const asks = { mainQuest: 'find out who owns the wharves', tone: 'dry', style: { neon: 'dark' as const } }
    const built = await new Forge(narrator).build({ ...BRIEF, seed: 'asked', brief: 'A port town that lost its trade.', asks })
    if (!built.ok) throw new Error('the town would not build')
    expect(history).toEqual({ theme: BRIEF.theme, seed: 'asked', brief: 'A port town that lost its trade.', asks })
    expect(summary?.asks).toEqual(asks)
    expect(built.value.world.brief()).toBe('A port town that lost its trade.')
    expect(built.value.world.asks()).toEqual(asks)
  })

  it('lets no word head two names in a town, and hangs more than one shape of sign', async () => {
    const themes = ['dusty western mining town', 'quiet coastal town', 'dense neon port city', 'cold industrial rail town', 'snowy alpine ski town']
    const towns = await Promise.all(themes.flatMap((theme, at) => [buildTown(`signs-${at}`, { theme, blocksX: 3, blocksY: 3 }), buildTown(`signs-${at}-b`, { theme, blocksX: 4, blocksY: 4 })]))
    const shapeOf = (name: string) => (/^\d/.test(name) ? 'number' : /^The /.test(name) ? 'the' : /'s\b/.test(name) ? 'somebody' : /&|Brothers/.test(name) ? 'family' : 'trade')
    const shapes = new Set<string>()
    let plots = 0
    for (const { world } of towns) {
      const names = world.plots().map((plot) => plot.name)
      plots += names.length
      const heads = names.map((name) => headOf(name).toLowerCase())
      expect(new Set(heads).size, `${world.name}: ${names.filter((name, at) => heads.indexOf(heads[at]!) !== at).join(', ')}`).toBe(heads.length)
      for (const name of names) shapes.add(shapeOf(name))
    }
    expect(plots).toBeGreaterThan(500)
    expect(shapes.size).toBeGreaterThanOrEqual(4)
  })

  it('lets the town its own story into the names', async () => {
    const built = await buildTown('storied-signs', { theme: 'quiet coastal town', blocksX: 4, blocksY: 4 })
    const premise = built.world.premise()!
    const story = `${premise.livesOn} ${premise.happened} ${premise.stake}`.toLowerCase()
    const heads = built.world.plots().map((plot) => headOf(plot.name).toLowerCase())
    const fromStory = heads.filter((head) => head.length >= 4 && story.includes(head))
    expect(fromStory.length, `no sign in ${built.world.name} speaks its history`).toBeGreaterThan(2)
  })
})
