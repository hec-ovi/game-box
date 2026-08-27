/**
 * game-box host: the local AI sidecar. Callers speak the OpenAI-compatible
 * HTTP contract in CONTRACT.md and schema/; the layers behind it are here for
 * anyone embedding the service in their own process.
 */
export { createServer, listen, CHAT_PATH, HEALTH_PATH, PROVIDERS_PATH, REALTIME_PATH } from './server.ts'
export { CONTRACT_VERSION } from './api/health.ts'
export { chat, type ChatResult } from './api/chat.ts'
export { RealtimeSession } from './api/realtime.ts'
export * as apiSchema from './api/schema.ts'
export * as llm from './llm/index.ts'
export * as stt from './stt/index.ts'
export * as tts from './tts/index.ts'
export * as models from './models/index.ts'
export * as providers from './providers/index.ts'
export { contract, Contract, violationText, type SchemaViolation } from './contract.ts'
export { ok, err, type Result } from './result.ts'
