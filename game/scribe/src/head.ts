/**
 * The word a sign is read by: the first one after any article, without its
 * possessive or punctuation. Two signs with one head read as one place twice,
 * whatever follows it.
 */
export function headOf(name: string): string {
  const first = name.trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '').split(/\s+/)[0] ?? ''
  return first.replace(/['’]s$|s['’]$/, '').replace(/[^\p{L}\p{N}]/gu, '')
}
