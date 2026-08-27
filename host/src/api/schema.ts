import { z } from 'zod'
import { contract } from '../contract.ts'
import { samplingFields } from '../llm/sampling.ts'
import {
  CHOICE_DESCRIPTION,
  MessageSchema,
  TOOLS_DESCRIPTION,
  ToolChoiceSchema,
  ToolSchema,
} from '../llm/schema.ts'
import { JobSchema } from '../providers/schema.ts'
import { AudioEnvelopeSchema } from '../stt/schema.ts'

const ARGUMENTS_DESCRIPTION = 'JSON text, as the OpenAI shape requires'
const SALVAGED_DESCRIPTION =
  'How many of the calls were rebuilt from prose the engine wrote instead of calling. Absent when none was.'

export const ChatRequestSchema = z
  .strictObject({
    model: z.string().optional(),
    messages: z.array(MessageSchema).min(1),
    job: JobSchema.optional(),
    stream: z.boolean().optional(),
    ...samplingFields,
    tools: z.array(ToolSchema).min(1).max(16).meta({ description: TOOLS_DESCRIPTION }).optional(),
    tool_choice: ToolChoiceSchema.meta({ description: CHOICE_DESCRIPTION }).optional(),
  })
  .meta({
    $id: 'game-box.dev/api/chat-request',
    title: 'POST /v1/chat/completions request (OpenAI-compatible subset)',
  })

/** One call in the OpenAI shape: arguments cross as JSON text, not as an object. */
const ToolCallSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal('function'),
  function: z.strictObject({
    name: z.string().min(1),
    arguments: z.string().meta({ description: ARGUMENTS_DESCRIPTION }),
  }),
})

const FinishReasonSchema = z.enum(['stop', 'length', 'error', 'tool_calls'])

export const ChatResponseSchema = z
  .strictObject({
    id: z.string().min(1),
    object: z.literal('chat.completion'),
    created: z.int().min(0),
    model: z.string(),
    choices: z
      .array(
        z.strictObject({
          index: z.literal(0),
          message: z.strictObject({
            role: z.literal('assistant'),
            content: z.string().optional(),
            tool_calls: z.array(ToolCallSchema).min(1).optional(),
          }),
          finish_reason: FinishReasonSchema,
        }),
      )
      .min(1)
      .max(1),
    salvaged: z.int().min(1).meta({ description: SALVAGED_DESCRIPTION }).optional(),
  })
  .meta({ $id: 'game-box.dev/api/chat-response', title: 'non-streaming chat completion response' })

export const ChatStreamEventSchema = z
  .strictObject({
    id: z.string().min(1),
    object: z.literal('chat.completion.chunk'),
    created: z.int().min(0),
    model: z.string(),
    choices: z
      .array(
        z.strictObject({
          index: z.literal(0),
          delta: z.strictObject({
            content: z.string().optional(),
            tool_calls: z.array(ToolCallSchema).min(1).optional(),
          }),
          finish_reason: FinishReasonSchema.nullable(),
        }),
      )
      .min(1)
      .max(1),
    salvaged: z.int().min(1).meta({ description: SALVAGED_DESCRIPTION }).optional(),
  })
  .meta({ $id: 'game-box.dev/api/chat-stream-event', title: 'streaming chat completion chunk (SSE data payload)' })

const CODE_DESCRIPTION = 'What a caller can act on. model-busy: the upstream is rate-limited, wait Retry-After seconds.'

const ErrorDetailSchema = z.strictObject({
  message: z.string().min(1),
  type: z.enum(['invalid_request_error', 'rate_limit_error', 'server_error']),
  code: z.literal('model-busy').meta({ description: CODE_DESCRIPTION }).optional(),
})

export const ErrorSchema = z
  .strictObject({ error: ErrorDetailSchema })
  .meta({ $id: 'game-box.dev/api/error', title: 'error body (OpenAI-compatible)' })

export const RealtimeClientEventSchema = z
  .union([
    z.strictObject({ type: z.literal('input_audio_buffer.append'), audio: AudioEnvelopeSchema }),
    z.strictObject({ type: z.literal('input_audio_buffer.commit') }),
  ])
  .meta({ $id: 'game-box.dev/api/realtime-client-event', title: '/v1/realtime client-to-server event' })

export const RealtimeServerEventSchema = z
  .union([
    z.strictObject({
      type: z.enum(['transcription.partial', 'transcription.completed']),
      text: z.string(),
    }),
    z.strictObject({ type: z.literal('error'), error: ErrorDetailSchema }),
  ])
  .meta({ $id: 'game-box.dev/api/realtime-server-event', title: '/v1/realtime server-to-client event' })

export const chatRequestContract = contract('chat-request', ChatRequestSchema)
export const chatResponseContract = contract('chat-response', ChatResponseSchema)
export const chatStreamEventContract = contract('chat-stream-event', ChatStreamEventSchema)
export const errorContract = contract('error', ErrorSchema)
export const realtimeClientEventContract = contract('realtime-client-event', RealtimeClientEventSchema)
export const realtimeServerEventContract = contract('realtime-server-event', RealtimeServerEventSchema)

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>
export type ChatToolCall = z.infer<typeof ToolCallSchema>
export type ErrorBody = z.infer<typeof ErrorSchema>
export type ErrorType = z.infer<typeof ErrorDetailSchema>['type']
export type ErrorCode = NonNullable<z.infer<typeof ErrorDetailSchema>['code']>
export type RealtimeServerEvent = z.infer<typeof RealtimeServerEventSchema>
