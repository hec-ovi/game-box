/** Ids and timestamps for chat completions, in the OpenAI shape. */
let completions = 1
let calls = 1

export function nextCompletionId(): string {
  return `chatcmpl-gb${completions++}`
}

export function nextCallId(): string {
  return `call_gb${calls++}`
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}
