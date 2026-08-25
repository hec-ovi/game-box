/** An id is a name to this box: it has to be non-blank, and nothing more is checked. */
export const named = (...ids: string[]): boolean => ids.every((id) => id.trim().length > 0)
