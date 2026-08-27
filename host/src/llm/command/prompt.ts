import type { Message } from '../schema.ts'

/**
 * The message list as one prompt. A command runs one turn per call, so the
 * whole conversation goes into that turn: one message on its own is its own
 * text, and several are labelled with the role that wrote them.
 */
export function promptOf(messages: readonly Message[]): string {
  const only = messages.length === 1 ? messages[0] : undefined
  if (only !== undefined) return only.content
  return messages.map((message) => `${message.role}:\n${message.content}`).join('\n\n')
}
