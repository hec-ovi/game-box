import type { Narrator } from '@gb/forge'
import type { BuildingKind, ItemArchetype, NpcRole, RoomKind } from '@gb/world'
import type { Asker, Violation } from './asker.ts'
import { FamilyClaims } from './claim.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { instanceTool, type Premises } from './tools.ts'
import { UniqueNames, type Pass } from './unique.ts'
import type { Waves } from './waves.ts'

/** A place somebody stands and does a job, and the job. */
export interface InstancePost {
  readonly postId: string
  readonly role: NpcRole
}

/** Something the place keeps lying about, and what shape it is. */
export interface InstanceStock {
  readonly thingId: string
  readonly archetype: ItemArchetype
}

/**
 * One building, and nothing about any other.
 *
 * Everything here is either the city as a whole (its name, its theme, its
 * story) or this building's own shell. No other place, nobody else's people and
 * no other errand, because two places written in one context are two places
 * that read like one, and because a request that names its neighbours cannot be
 * sent at the same time as theirs.
 */
export interface InstanceRequest {
  readonly kind: BuildingKind
  readonly theme: string
  /** The rooms the shell was cut into, so the place is written into the building it has. */
  readonly rooms: readonly RoomKind[]
  readonly posts: readonly InstancePost[]
  readonly things: readonly InstanceStock[]
  /** The city's own story, once there is one to tell. */
  readonly premise?: string
}

export interface InstancePerson {
  readonly postId: string
  readonly role: NpcRole
  readonly name: string
  readonly personality: string
  readonly knowledge: readonly string[]
}

export interface InstanceThing {
  readonly thingId: string
  readonly name: string
  readonly description: string
}

/** A place decided all at once: what it is, who is in it, and what is lying about. */
export interface Instance {
  readonly name: string
  /** What this place is and what goes on in it. Empty when no model wrote it. */
  readonly character: string
  readonly people: readonly InstancePerson[]
  readonly things: readonly InstanceThing[]
}

export interface InstanceWriterOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly fallback: Narrator
  readonly registry: NameRegistry
  readonly progress: Progress
  readonly seed: string
}

/**
 * How many times a name is asked for again before the city takes what it is
 * given. It doubles as the spacing between two places' fallback streams, so no
 * two of them draw the same spare name.
 */
const ATTEMPTS = 40

/**
 * Writes a place and the people in it in one call.
 *
 * A clinic is not a name plus three people who happen to stand in it: it is a
 * place with a job, and who staffs it, what they cover for each other and what
 * has been going on there are one decision. So one call decides all of it, and
 * that call is shown its own building and nothing else, which is exactly what
 * lets every place in the city be written at the same time.
 */
export class InstanceWriter implements Pass<InstanceRequest, Instance> {
  #asker: Asker
  #fallback: Narrator
  #registry: NameRegistry
  #progress: Progress
  #claims: FamilyClaims
  #unique: UniqueNames<InstanceRequest, Instance>
  #counted = new Set<number>()
  #cityName = ''

  constructor(options: InstanceWriterOptions) {
    this.#asker = options.asker
    this.#fallback = options.fallback
    this.#registry = options.registry
    this.#progress = options.progress
    this.#claims = new FamilyClaims(options.seed)
    this.#unique = new UniqueNames(options.waves, options.registry, this)
  }

  /** Every place, several at a time, back in the order they were asked for. */
  async write(requests: readonly InstanceRequest[]): Promise<Instance[]> {
    this.#cityName = this.#registry.cityName
    this.#counted.clear()
    this.#progress.start('instances', requests.length, `${requests.length} places`)
    return this.#unique.write(requests)
  }

  async ask(request: InstanceRequest, index: number, taken: readonly string[]): Promise<Instance | undefined> {
    const shell = {
      postIds: request.posts.map((post) => post.postId),
      thingIds: request.things.map((thing) => thing.thingId),
      letters: this.#claims.for(index),
    }
    const answer = await this.#asker.ask(
      instanceTool(shell),
      prompt('write-instance', {
        cityName: this.#cityName,
        theme: request.theme,
        kind: request.kind,
        premise: request.premise ?? 'Nothing has been written about the city itself yet.',
        rooms: request.rooms.length ? request.rooms.join(', ') : 'one room',
        letters: shell.letters.split('').join(', '),
        posts: bullets(
          request.posts.map((post) => `${post.postId}: the ${post.role}`),
          'Nobody works here.',
        ),
        things: bullets(
          request.things.map((thing) => `${thing.thingId}: a ${thing.archetype}`),
          'Nothing is lying about in here.',
        ),
        usedNames: bullets(taken, 'None yet.'),
      }),
      (value) => problemsWith(value, shell),
    )
    if (!answer) return undefined
    const instance = made(request, answer)
    this.#count(index, instance.name, request.kind)
    return instance
  }

  namesIn(instance: Instance): readonly string[] {
    return [instance.name, ...instance.people.map((person) => person.name)]
  }

  /** Every name the city has already spent is written again by the fallback narrator. */
  async repair(request: InstanceRequest, index: number, answer: Instance | undefined): Promise<Instance> {
    const name = this.#free(answer?.name) ? answer!.name : await this.#spareName(request, index)
    this.#registry.add(name)

    const people: InstancePerson[] = []
    for (const [k, post] of request.posts.entries()) {
      const written = answer?.people.find((person) => person.postId === post.postId)
      const person = this.#free(written?.name) ? written! : await this.#sparePerson(request, post, name, index, k)
      this.#registry.add(person.name)
      people.push(person)
    }

    const things = answer?.things.length ? answer.things : await this.#stock(request, index)
    this.#count(index, name, request.kind)
    return { name, character: answer?.character ?? '', people, things }
  }

  #free(name: string | undefined): boolean {
    return name !== undefined && !this.#registry.taken(name)
  }

  /** Keeps asking the fallback narrator for one more sign until the city has not already hung it. */
  async #spareName(request: InstanceRequest, index: number): Promise<string> {
    const at = (attempt: number) => ({ kind: request.kind, theme: request.theme, index: index * ATTEMPTS + attempt })
    let name = await this.#fallback.namePlace(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.taken(name); attempt++) {
      name = await this.#fallback.namePlace(at(attempt))
    }
    return name
  }

  async #sparePerson(
    request: InstanceRequest,
    post: InstancePost,
    placeName: string,
    index: number,
    k: number,
  ): Promise<InstancePerson> {
    const at = (attempt: number) => ({
      role: post.role,
      placeKind: request.kind,
      placeName,
      theme: request.theme,
      index: (index * request.posts.length + k) * ATTEMPTS + attempt,
    })
    let profile = await this.#fallback.describeNpc(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.taken(profile.name); attempt++) {
      profile = await this.#fallback.describeNpc(at(attempt))
    }
    return {
      postId: post.postId,
      role: post.role,
      name: profile.name,
      personality: profile.personality,
      knowledge: [...profile.knowledge],
    }
  }

  async #stock(request: InstanceRequest, index: number): Promise<InstanceThing[]> {
    const things: InstanceThing[] = []
    for (const [k, thing] of request.things.entries()) {
      const written = await this.#fallback.describeItem({
        archetype: thing.archetype,
        theme: request.theme,
        index: index * ATTEMPTS + k,
      })
      things.push({ thingId: thing.thingId, ...written })
    }
    return things
  }

  /** One place counts once, whether it was written first time, asked again, or mended. */
  #count(index: number, name: string, kind: BuildingKind): void {
    if (this.#counted.has(index)) return
    this.#counted.add(index)
    this.#progress.finished(`${name}, a ${kind}`)
  }
}

/** The answer, put back together against the shell it was written for. */
function made(request: InstanceRequest, answer: Premises): Instance {
  return {
    name: answer.name,
    character: answer.character,
    people: request.posts.map((post) => {
      const person = answer.people.find((one) => one.postId === post.postId)!
      return {
        postId: post.postId,
        role: post.role,
        name: `${person.given} ${person.family}`,
        personality: person.personality,
        knowledge: [...person.knowledge],
      }
    }),
    things: request.things.map((thing) => {
      const written = answer.things.find((one) => one.thingId === thing.thingId)!
      return { thingId: thing.thingId, name: written.name, description: written.description }
    }),
  }
}

/** Everything wrong with an answer that the schema alone could not refuse. */
function problemsWith(answer: Premises, shell: { postIds: readonly string[]; thingIds: readonly string[] }): Violation[] {
  const problems: Violation[] = []
  const once = (got: readonly string[], wanted: readonly string[], field: string, what: string): void => {
    for (const id of wanted) {
      const times = got.filter((one) => one === id).length
      if (times !== 1) problems.push({ path: field, message: `write ${what} ${id} exactly once, not ${times} times` })
    }
  }
  once(answer.people.map((person) => person.postId), shell.postIds, 'people', 'the person at post')
  once(answer.things.map((thing) => thing.thingId), shell.thingIds, 'things', 'the thing')

  const repeats = (values: readonly string[], field: string, what: string): void => {
    for (const [i, value] of values.entries()) {
      if (values.indexOf(value) !== i) problems.push({ path: `${field}.${i}`, message: `${value} ${what}` })
    }
  }
  repeats(answer.people.map((person) => person.family), 'people', 'is already a family name in this building')
  repeats(answer.things.map((thing) => thing.name), 'things', 'is already the name of something else in here')
  return problems
}
