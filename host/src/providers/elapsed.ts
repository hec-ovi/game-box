/** How long a probe took, never negative however the clock moved. */
export function since(started: number): number {
  return Math.max(0, Date.now() - started)
}
