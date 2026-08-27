/** Publishes every contract in this service as JSON Schema under schema/. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Contract } from '../src/contract.ts'
import {
  chatRequestContract,
  chatResponseContract,
  chatStreamEventContract,
  errorContract,
  realtimeClientEventContract,
  realtimeServerEventContract,
} from '../src/api/schema.ts'
import { generateRequestContract, tokenEventContract } from '../src/llm/schema.ts'
import { audioChunkContract, transcriptEventContract } from '../src/stt/schema.ts'
import { audioEventContract, speakRequestContract } from '../src/tts/schema.ts'
import { modelEntryContract, resolvedModelContract } from '../src/models/schema.ts'
import {
  configurationContract,
  configurationViewContract,
  providerHealthContract,
  providerModelsContract,
  providerTestContract,
  saveContract,
} from '../src/providers/schema.ts'

/** Every published schema, by the layer it belongs to. */
export const published: Record<string, ReadonlyArray<Contract<unknown>>> = {
  api: [
    chatRequestContract,
    chatResponseContract,
    chatStreamEventContract,
    errorContract,
    realtimeClientEventContract,
    realtimeServerEventContract,
    configurationViewContract,
    saveContract,
    providerHealthContract,
    providerTestContract,
    providerModelsContract,
  ] as ReadonlyArray<Contract<unknown>>,
  llm: [generateRequestContract, tokenEventContract] as ReadonlyArray<Contract<unknown>>,
  stt: [audioChunkContract, transcriptEventContract] as ReadonlyArray<Contract<unknown>>,
  tts: [speakRequestContract, audioEventContract] as ReadonlyArray<Contract<unknown>>,
  models: [modelEntryContract, resolvedModelContract] as ReadonlyArray<Contract<unknown>>,
  providers: [configurationContract] as ReadonlyArray<Contract<unknown>>,
}

export const schemaDir = join(import.meta.dirname, '..', 'schema')

export function fileFor(layer: string, name: string): string {
  return join(schemaDir, layer, `${name}.json`)
}

export function serialise(entry: Contract<unknown>): string {
  return `${JSON.stringify(entry.jsonSchema(), null, 2)}\n`
}

if (process.argv[1] === import.meta.filename) {
  for (const [layer, contracts] of Object.entries(published)) {
    mkdirSync(join(schemaDir, layer), { recursive: true })
    for (const entry of contracts) {
      const out = fileFor(layer, entry.name)
      writeFileSync(out, serialise(entry))
      console.log(`wrote ${out}`)
    }
  }
}
