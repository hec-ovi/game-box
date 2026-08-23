import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Reads the art packs as they ship. One pack names a texture it does not
 * carry under that name (`T_Eye_Normal_png.png` against `T_Eye_Normal.png`),
 * so the name is resolved here rather than by editing files we did not write.
 */
export class SourceReader {
  #io

  constructor() {
    this.#io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
  }

  /** The gltf-transform IO, for writing finished files. */
  get io() {
    return this.#io
  }

  /** One glTF, with its buffers and images resolved off disk. */
  async read(file) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    const dir = dirname(file)
    const resources = {}
    for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
      if (!item.uri) continue
      resources[item.uri] = readFileSync(this.resolve(dir, item.uri))
    }
    return this.#io.readJSON({ json, resources })
  }

  /** Where a `uri` written next to `dir` actually lives. */
  resolve(dir, uri) {
    const named = decodeURIComponent(uri)
    if (existsSync(join(dir, named))) return join(dir, named)
    const alias = named.replace(/_png\.png$/, '.png')
    if (existsSync(join(dir, alias))) return join(dir, alias)
    throw new Error(`${uri}: no such file next to ${dir}`)
  }
}
