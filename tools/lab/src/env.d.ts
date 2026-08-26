/** What vite hands the page at runtime, declared here because `tools/` has no package of its own. */

declare module 'virtual:lab-sources' {
  /** Every `.ts` and `.md` the page quotes, keyed by its path from the repository root, read off disk on every request. */
  export const FILES: Record<string, string | undefined>
}
