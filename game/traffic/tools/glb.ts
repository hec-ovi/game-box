import { writeFileSync } from 'node:fs'
import type { Object3D } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/**
 * Writes a three.js scene out as a .glb from Node.
 *
 * GLTFExporter is written for the browser and turns its buffers into bytes
 * through `FileReader`, which Node has no global for. `Blob.arrayBuffer()` does
 * the same job, so this hands the exporter a reader built on it.
 */
class BlobReader {
  result: ArrayBuffer | null = null
  onloadend: (() => void) | null = null

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((bytes) => {
      this.result = bytes
      this.onloadend?.()
    })
  }
}

export async function writeGlb(scene: Object3D, file: string): Promise<void> {
  const globals = globalThis as Record<string, unknown>
  globals['FileReader'] ??= BlobReader
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  writeFileSync(file, Buffer.from(glb))
}
