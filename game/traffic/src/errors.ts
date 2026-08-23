/** Everything this box can refuse, and nothing else. */
export type TrafficError =
  | { readonly code: 'broken-graph'; readonly message: string }
  | { readonly code: 'no-lanes'; readonly message: string }

/** What loading the car pack refuses. Driving, once it is loaded, is forgiving. */
export type CarPackErrorCode =
  /** The file would not fetch, or is not a GLB three can read. */
  | 'unreadable-pack'
  /** It read, but a model or one of its wheels is not in it. */
  | 'incomplete-pack'

export class CarPackError extends Error {
  readonly code: CarPackErrorCode
  /** The file or model at fault. */
  readonly what: string

  constructor(code: CarPackErrorCode, what: string, detail: string) {
    super(`${what}: ${detail}`)
    this.name = 'CarPackError'
    this.code = code
    this.what = what
  }
}
