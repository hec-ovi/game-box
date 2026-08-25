import type { Instance, InstancePerson, InstancePost, InstanceRequest, InstanceThing, Narrator } from '@gb/forge'
import type { Asker, Violation } from './asker.ts'
import { charterLines } from './charter-lines.ts'
import { FamilyClaims } from './claim.ts'
import { personProblems, profileOf } from './person.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { instanceTool, type WrittenPlace } from './tools.ts'
import { UniqueNames, type Pass } from './unique.ts'
import type { Waves } from './waves.ts'

export interface InstanceWriterOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly fallback: Narrator
  readonly registry: NameRegistry
  readonly progress: Progress
  readonly claims: FamilyClaims
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

  constructor(options: InstanceWriterOptions) {
    this.#asker = options.asker
    this.#fallback = options.fallback
    this.#registry = options.registry
    this.#progress = options.progress
    this.#claims = options.claims
    this.#unique = new UniqueNames(options.waves, options.registry, this)
  }

  /** Every place, several at a time, back in the order they were asked for. */
  async write(requests: readonly InstanceRequest[]): Promise<Instance[]> {
    this.#counted.clear()
    this.#progress.open('places', requests.length, `${requests.length} places`)
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
        cityName: this.#registry.cityName,
        theme: request.theme,
        label: request.charter.label,
        charter: charterLines(request.charter),
        premise: request.premise ?? prompt('no-history'),
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
      `place:${request.index}`,
      (value) => problemsWith(value, shell),
    )
    if (!answer) return undefined
    const instance = made(request, answer)
    this.#count(index, instance.name, request.charter.label)
    return instance
  }

  namesIn(instance: Instance): readonly string[] {
    return instance.people.map((person) => person.name)
  }

  signsIn(instance: Instance): readonly string[] {
    return [instance.name]
  }

  /** Every name the city has already spent is written again by the fallback narrator. */
  async repair(request: InstanceRequest, index: number, answer: Instance | undefined): Promise<Instance> {
    const name = answer !== undefined && !this.#registry.signTaken(answer.name) ? answer.name : await this.#spareName(request)
    this.#registry.hang(name)

    const people: InstancePerson[] = []
    for (const post of request.posts) {
      const written = answer?.people.find((person) => person.postId === post.postId)
      const person = written !== undefined && !this.#registry.taken(written.name) ? written : await this.#sparePerson(request, post, name)
      this.#registry.add(person.name)
      people.push(person)
    }

    const things = answer?.things.length ? answer.things : await this.#stock(request)
    this.#count(index, name, request.charter.label)
    return { name, character: answer?.character ?? '', people, things }
  }

  /** Keeps asking the fallback narrator for one more sign until the city has not already hung its head word. */
  async #spareName(request: InstanceRequest): Promise<string> {
    const at = (attempt: number) => ({
      kind: request.kind,
      charter: request.charter,
      theme: request.theme,
      index: request.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
    let name = await this.#fallback.namePlace(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.signTaken(name); attempt++) {
      name = await this.#fallback.namePlace(at(attempt))
    }
    return name
  }

  async #sparePerson(request: InstanceRequest, post: InstancePost, placeName: string): Promise<InstancePerson> {
    const at = (attempt: number) => ({
      role: post.role,
      placeKind: request.kind,
      place: request.charter,
      placeName,
      theme: request.theme,
      index: post.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
    let profile = await this.#fallback.describeNpc(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.taken(profile.name); attempt++) {
      profile = await this.#fallback.describeNpc(at(attempt))
    }
    return { ...profile, postId: post.postId, role: post.role }
  }

  async #stock(request: InstanceRequest): Promise<InstanceThing[]> {
    const things: InstanceThing[] = []
    for (const thing of request.things) {
      const written = await this.#fallback.describeItem({
        archetype: thing.archetype,
        theme: request.theme,
        index: thing.index,
      })
      things.push({ thingId: thing.thingId, ...written })
    }
    return things
  }

  /** One place counts once, whether it was written first time, asked again, or mended. */
  #count(index: number, name: string, label: string): void {
    if (this.#counted.has(index)) return
    this.#counted.add(index)
    this.#progress.finished(`${name}, a ${label}`)
  }
}

/** The answer, put back together against the shell it was written for. */
function made(request: InstanceRequest, answer: WrittenPlace): Instance {
  return {
    name: answer.name,
    character: answer.character,
    people: request.posts.map((post) => {
      const person = answer.people.find((one) => one.postId === post.postId)!
      return { ...profileOf(person), postId: post.postId, role: post.role }
    }),
    things: request.things.map((thing) => {
      const written = answer.things.find((one) => one.thingId === thing.thingId)!
      return { thingId: thing.thingId, name: written.name, description: written.description }
    }),
  }
}

/** Everything wrong with an answer that the schema alone could not refuse. */
function problemsWith(answer: WrittenPlace, shell: { postIds: readonly string[]; thingIds: readonly string[] }): Violation[] {
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
  for (const [i, person] of answer.people.entries()) problems.push(...personProblems(person, `people.${i}`))
  return problems
}
