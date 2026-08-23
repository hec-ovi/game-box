import { z } from 'zod'
import { contract } from '../contract.ts'
import { samplingFields } from './sampling.ts'

export const MessageSchema = z.strictObject({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

/** A callable tool: a name plus the JSON Schema its arguments must satisfy. */
export const ToolSchema = z.strictObject({
  type: z.literal('function'),
  function: z.strictObject({
    name: z.string().min(1).max(64),
    description: z.string().optional(),
    parameters: z.looseObject({}).meta({ description: 'JSON Schema for the arguments' }),
  }),
})

export const ToolChoiceSchema = z.union([
  z.enum(['auto', 'none', 'required']),
  z.strictObject({
    type: z.literal('function'),
    function: z.strictObject({ name: z.string().min(1) }),
  }),
])

export const TOOLS_DESCRIPTION = 'Callable tools. The model answers by calling one instead of writing prose.'
export const CHOICE_DESCRIPTION = 'auto lets the model decide, required forces some call, or name the one tool it must call.'

export const GenerateRequestSchema = z
  .strictObject({
    messages: z.array(MessageSchema).min(1),
    model: z.string().optional(),
    ...samplingFields,
    tools: z.array(ToolSchema).min(1).max(16).meta({ description: TOOLS_DESCRIPTION }).optional(),
    tool_choice: ToolChoiceSchema.meta({ description: CHOICE_DESCRIPTION }).optional(),
  })
  .meta({ $id: 'game-box.dev/llm/generate-request', title: 'llm generate request' })

export const TokenEventSchema = z
  .union([
    z.strictObject({ type: z.literal('token'), text: z.string().min(1) }),
    z.strictObject({
      type: z.literal('tool-call'),
      id: z.string().optional(),
      name: z.string().min(1),
      arguments: z.looseObject({}).meta({ description: 'Parsed arguments. Unparseable JSON never reaches here.' }),
    }),
    z.strictObject({ type: z.literal('done'), finishReason: z.enum(['stop', 'length', 'error']) }),
  ])
  .meta({ $id: 'game-box.dev/llm/token-event', title: 'llm token event' })

export const generateRequestContract = contract('generate-request', GenerateRequestSchema)
export const tokenEventContract = contract('token-event', TokenEventSchema)

export type Message = z.infer<typeof MessageSchema>
export type Tool = z.infer<typeof ToolSchema>
export type ToolChoice = z.infer<typeof ToolChoiceSchema>
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>
export type TokenEvent = z.infer<typeof TokenEventSchema>
export type ToolCallEvent = Extract<TokenEvent, { type: 'tool-call' }>
export type DoneEvent = Extract<TokenEvent, { type: 'done' }>
