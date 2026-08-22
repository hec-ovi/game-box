export type HudErrorCode = 'hud-destroyed' | 'unknown-notice' | 'no-conversation'

const WHY: Record<HudErrorCode, string> = {
  'hud-destroyed': 'this hud was destroyed; build a new one',
  'unknown-notice': 'not a notice kind the hud knows',
  'no-conversation': 'no conversation is open; send a speaker first',
}

/** The only thing this box throws. */
export class HudError extends Error {
  readonly code: HudErrorCode

  constructor(code: HudErrorCode, detail?: string) {
    super(detail ? `${code}: ${WHY[code]} (${detail})` : `${code}: ${WHY[code]}`)
    this.name = 'HudError'
    this.code = code
  }
}
