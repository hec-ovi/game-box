import type { Instance, InstancePerson, InstancePost, InstanceRequest, InstanceThing, Narrator } from '@gb/forge'
import { ok, type Result } from '@gb/kit'
import type { Asker, Violation } from './asker.ts'
import { briefLines } from './brief-lines.ts'
import { charterLines } from './charter-lines.ts'
import { FamilyClaims } from './claim.ts'
import type { ScribeFailure } from './failure.ts'
import { personProblems, profileOf } from './person.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { answered } from './stand-in.ts'
import { instanceTool, type WrittenPlace } from './tools.ts'
import { UniqueNames, type Pass } from './unique.ts'
import type { Waves } from './waves.ts'

export interface InstanceWriterOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly registry: NameRegistry
  readonly progress: Progress
  readonly claims: FamilyClaims
  /** Only where a caller handed one in. Nothing in the game does. */
  readonly standIn?: Narrator | undefined
}

/**
 * How many times a name is asked for again before the city takes what it is
 * given. It doubles as the spacing between two places' stand-in streams, so no
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
  #registry: NameRegistry
  #progress: Progress
  #claims: FamilyClaims
  #standIn: Narrator | undefined
  #unique: UniqueNames<InstanceRequest, Instance>
  #counted = new Set<number>()

  constructor(options: InstanceWriterOptions) {
    this.#asker = options.asker
    this.#registry = options.registry
    this.#progress = options.progress
    this.#claims = options.claims
    this.#standIn = options.standIn
    this.#unique = new UniqueNames(options.waves, options.registry, this)
  }

  /** Every place, several at a time, back in the order they were asked for. */
  async write(requests: readonly InstanceRequest[]): Promise<Result<Instance[], ScribeFailure>> {
    this.#counted.clear()
    this.#progress.open('places', requests.length, `${requests.length} places`)
    return this.#unique.write(requests)
  }

  async ask(request: InstanceRequest, index: number, taken: readonly string[]): Promise<Result<Instance, ScribeFailure>> {
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
        has: briefLines(request.has),
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
      callFor(request),
      (value) => problemsWith(value, shell),
    )
    if (!answer.ok) return answer
    const instance = made(request, answer.value)
    this.#count(index, instance.name, request.charter.label)
    return ok(instance)
  }

  namesIn(instance: Instance): readonly string[] {
    return instance.people.map((person) => person.name)
  }

  signsIn(instance: Instance): readonly string[] {
    return [instance.name]
  }

  /** Which name the model spent twice, so the caller is told what stopped the place rather than just that it stopped. */
  clash(request: InstanceRequest, _index: number, answer: Instance): ScribeFailure {
    const spent =
      [answer.name].find((sign) => this.#registry.signTaken(sign)) ??
      answer.people.map((person) => person.name).find((name) => this.#registry.taken(name)) ??
      answer.name
    return this.#asker.unusable(callFor(request), `${spent} is already spent somewhere else in this city and the model wrote it again`)
  }

  /**
   * Every spent name written again by the stand-in a caller handed in. Nothing
   * in the game hands one in, and a stand-in that will not write either leaves
   * the place unmended, which stops the stage.
   */
  async mend(request: InstanceRequest, index: number, answer: Instance | undefined): Promise<Instance | undefined> {
    const standIn = this.#standIn
    if (!standIn) return undefined
    const name = answer !== undefined && !this.#registry.signTaken(answer.name) ? answer.name : await this.#spareName(standIn, request)
    if (name === undefined) return undefined
    this.#registry.hang(name)

    const people: InstancePerson[] = []
    for (const post of request.posts) {
      const written = answer?.people.find((person) => person.postId === post.postId)
      const person = written !== undefined && !this.#registry.taken(written.name) ? written : await this.#sparePerson(standIn, request, post, name)
      if (person === undefined) return undefined
      this.#registry.add(person.name)
      people.push(person)
    }

    const things = answer?.things.length ? answer.things : await this.#stock(standIn, request)
    if (things === undefined) return undefined
    this.#count(index, name, request.charter.label)
    return { name, character: answer?.character ?? '', people, things }
  }

  /** Keeps asking the stand-in for one more sign until the city has not already hung its head word. */
  async #spareName(standIn: Narrator, request: InstanceRequest): Promise<string | undefined> {
    const at = (attempt: number) => ({
      kind: request.kind,
      charter: request.charter,
      theme: request.theme,
      index: request.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
    let name = answered(await standIn.namePlace(at(0)))
    for (let attempt = 1; attempt <= ATTEMPTS && name !== undefined && this.#registry.signTaken(name); attempt++) {
      name = answered(await standIn.namePlace(at(attempt)))
    }
    return name
  }

  async #sparePerson(standIn: Narrator, request: InstanceRequest, post: InstancePost, placeName: string): Promise<InstancePerson | undefined> {
    const at = (attempt: number) => ({
      role: post.role,
      placeKind: request.kind,
      place: request.charter,
      placeName,
      theme: request.theme,
      index: post.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
    let profile = answered(await standIn.describeNpc(at(0)))
    for (let attempt = 1; attempt <= ATTEMPTS && profile !== undefined && this.#registry.taken(profile.name); attempt++) {
      profile = answered(await standIn.describeNpc(at(attempt)))
    }
    return profile && { ...profile, postId: post.postId, role: post.role }
  }

  async #stock(standIn: Narrator, request: InstanceRequest): Promise<InstanceThing[] | undefined> {
    const things: InstanceThing[] = []
    for (const thing of request.things) {
      const written = answered(await standIn.describeItem({ archetype: thing.archetype, theme: request.theme, index: thing.index }))
      if (written === undefined) return undefined
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

/** Where this place sits in the build, and what it is in the words a failure is read in. */
const callFor = (request: InstanceRequest): { at: string; what: string } => ({
  at: `place:${request.index}`,
  what: `the ${request.charter.label} and the people in it`,
})

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
