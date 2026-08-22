import { violationText } from '../contract.ts'
import { collect, generate, type GenerateRequest, type TokenEvent } from '../llm/index.ts'
import { errorBody } from './errors.ts'
import { nextCallId, nextCompletionId, nowUnix } from './ids.ts'
import {
  chatRequestContract,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  type ChatToolCall,
  type ErrorBody,
} from './schema.ts'

export type ChatResult =
  | { readonly kind: 'json'; readonly status: number; readonly body: ChatResponse | ErrorBody }
  | { readonly kind: 'stream'; readonly chunks: AsyncIterable<ChatStreamEvent> }

/**
 * `POST /v1/chat/completions`. The body is validated before any other layer is
 * called, and a reply keeps both what the speaker said and what they did.
 */
export async function chat(rawBody: string): Promise<ChatResult> {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return refuse(400, 'body is not valid JSON')
  }

  const parsed = chatRequestContract.parse(body)
  if (!parsed.ok) return refuse(400, violationText(parsed.error))
  const request = parsed.value

  const stream = await generate(llmRequestFrom(request))
  if (!stream.ok) {
    return stream.error.code === 'invalid-request'
      ? refuse(400, stream.error.message)
      : { kind: 'json', status: 502, body: errorBody(stream.error.message, 'server_error') }
  }

  const model = request.model ?? 'game-box/standin'
  const id = nextCompletionId()
  const created = nowUnix()

  if (request.stream === true) {
    return { kind: 'stream', chunks: chunksOf(stream.value, { id, created, model }) }
  }

  return { kind: 'json', status: 200, body: completionOf(await collect(stream.value), { id, created, model }) }
}

interface Head {
  readonly id: string
  readonly created: number
  readonly model: string
}

/** Tool definitions and the tool choice are forwarded to the engine unchanged. */
function llmRequestFrom(request: ChatRequest): GenerateRequest {
  return {
    messages: request.messages,
    ...(request.model === undefined ? {} : { model: request.model }),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.tools === undefined ? {} : { tools: request.tools }),
    ...(request.tool_choice === undefined ? {} : { tool_choice: request.tool_choice }),
  }
}

function completionOf(events: readonly TokenEvent[], head: Head): ChatResponse {
  const content = events
    .filter((e) => e.type === 'token')
    .map((e) => e.text)
    .join('')
  const calls = events.filter((e) => e.type === 'tool-call').map(toolCall)
  const done = events.findLast((e) => e.type === 'done')

  // A speaker can say something and do something in the same breath, so
  // neither one is dropped for the other.
  const message: ChatResponse['choices'][number]['message'] = { role: 'assistant' }
  if (content !== '' || calls.length === 0) message.content = content
  if (calls.length > 0) message.tool_calls = calls

  return {
    id: head.id,
    object: 'chat.completion',
    created: head.created,
    model: head.model,
    choices: [{ index: 0, message, finish_reason: calls.length > 0 ? 'tool_calls' : (done?.finishReason ?? 'stop') }],
  }
}

async function* chunksOf(events: AsyncIterable<TokenEvent>, head: Head): AsyncGenerator<ChatStreamEvent> {
  for await (const event of events) {
    yield { ...head, object: 'chat.completion.chunk', choices: [{ index: 0, ...deltaOf(event) }] }
  }
}

function deltaOf(event: TokenEvent): Pick<ChatStreamEvent['choices'][number], 'delta' | 'finish_reason'> {
  if (event.type === 'token') return { delta: { content: event.text }, finish_reason: null }
  if (event.type === 'tool-call') return { delta: { tool_calls: [toolCall(event)] }, finish_reason: null }
  return { delta: {}, finish_reason: event.finishReason }
}

/** A token-event tool call in the OpenAI shape: arguments as JSON text. */
function toolCall(event: Extract<TokenEvent, { type: 'tool-call' }>): ChatToolCall {
  return {
    id: event.id ?? nextCallId(),
    type: 'function',
    function: { name: event.name, arguments: JSON.stringify(event.arguments) },
  }
}

function refuse(status: number, message: string): ChatResult {
  return { kind: 'json', status, body: errorBody(message, 'invalid_request_error') }
}
