import { bundleContract, saveContract } from './schema.ts'

interface Published {
  readonly name: string
  jsonSchema(): unknown
}

/** The file formats this box publishes, one `schema/<name>.json` each. */
export const PUBLISHED: readonly Published[] = [bundleContract, saveContract]

/** The exact bytes a published schema file holds, so the writer and the check cannot disagree. */
export function schemaText(published: Published): string {
  return `${JSON.stringify(published.jsonSchema(), null, 2)}\n`
}
