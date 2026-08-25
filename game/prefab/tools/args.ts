/** The value after a `--flag` on the command line, if the flag is there. */
export function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
