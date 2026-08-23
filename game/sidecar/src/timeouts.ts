/**
 * How long a call may take before it is treated as stalled.
 *
 * A buffered answer can only be judged on its total length. A streamed reply
 * cannot: a long answer is not a stalled one, so it is judged on how long the
 * first piece takes and on the gap between pieces.
 *
 * Every number is overridable per call, and per `Sidecar` for a caller whose
 * whole job is one kind of work.
 */
export interface Timeouts {
  /**
   * `ask`: request start to the last byte of the answer. A quest written by a
   * local model was measured at 170 s, so this leaves generous room over that
   * and still returns a stalled call in five minutes instead of never.
   */
  readonly askMs: number
  /**
   * `converse`: request start to the first byte of the reply. Covers the
   * connection and prompt processing, which is the slow part on a cold local
   * model with a long system prompt.
   */
  readonly firstTokenMs: number
  /**
   * `converse`: the longest gap between two pieces of a reply that is already
   * flowing. Tokens arrive tens of milliseconds apart; half a minute of
   * silence mid-sentence is a stall.
   */
  readonly idleMs: number
}

export const DEFAULT_TIMEOUTS: Timeouts = {
  askMs: 300_000,
  firstTokenMs: 60_000,
  idleMs: 30_000,
}
