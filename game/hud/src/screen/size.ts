/** The screen, in characters: every machine draws into the same grid. */
export const SCREEN = { cols: 48, rows: 21 } as const

/** The rows an app draws into: the status line under them is the surface's. */
export const BODY_ROWS = SCREEN.rows - 1

/** A line clipped or padded to the screen's width, so every row is the same length. */
export function fit(line: string): string {
  return line.length > SCREEN.cols ? line.slice(0, SCREEN.cols) : line.padEnd(SCREEN.cols)
}

/** A line centred in a width, the whole screen's unless said otherwise. */
export function centre(line: string, width: number = SCREEN.cols): string {
  const pad = Math.max(0, Math.floor((width - line.length) / 2))
  return (' '.repeat(pad) + line).padEnd(width).slice(0, width)
}

/** Exactly `BODY_ROWS` lines: what is given, padded with blank ones or clipped. */
export function body(lines: readonly string[]): string[] {
  const rows = lines.slice(0, BODY_ROWS).map(fit)
  while (rows.length < BODY_ROWS) rows.push(fit(''))
  return rows
}

/** `lines` with `over` written across its middle rows: a message on top of a game. */
export function overlay(lines: readonly string[], over: readonly string[], width: number = SCREEN.cols): string[] {
  const rows = [...lines]
  const top = Math.floor((rows.length - over.length) / 2)
  over.forEach((line, at) => {
    rows[top + at] = centre(line, width)
  })
  return rows
}
