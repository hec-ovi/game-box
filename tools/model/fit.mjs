/**
 * Takes a downloaded model to a budget: drops what nobody sees from outside,
 * welds and simplifies the geometry, resizes the textures, and merges the
 * materials so a car is a handful of draws rather than sixty.
 *
 * Every step records what it did, because the only way to know a simplifier
 * did not ruin a model is to see how far it had to go.
 */
import { Logger } from '@gltf-transform/core'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { dedup, flatten, join, palette, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { bakeVertexColour } from './bake.mjs'
import { hiddenGroupOf, HIDDEN_GROUPS } from './hidden.mjs'
import { BUDGET, measure, triangleCount } from './measure.mjs'

/**
 * How far the simplifier's error bound is allowed to open, as a share of the
 * mesh's own size. The first is a bound that keeps a silhouette; the last is
 * one that will melt anything to reach a triangle count.
 */
const ERROR_BOUNDS = [0.01, 0.05, 0.2, 0.5, 1]

export class Fit {
  /**
   * @param {import('@gltf-transform/core').Document} document
   * @param {{ triangles?: number, texture?: number, spare?: string[], keepHidden?: boolean,
   *           flat?: boolean, bake?: boolean, keepParts?: boolean }} how
   */
  constructor(document, how = {}) {
    this.document = document.setLogger(new Logger(Logger.Verbosity.ERROR))
    this.triangles = how.triangles ?? BUDGET.triangles
    this.texture = how.texture ?? BUDGET.texture
    this.spare = how.spare ?? []
    this.keepHidden = how.keepHidden ?? false
    this.flat = how.flat ?? false
    this.bake = how.bake ?? false
    this.keepParts = how.keepParts ?? false
    this.steps = []
  }

  async run() {
    this.before = measure(this.document)
    if (!this.keepHidden) await this.dropHidden()
    if (this.flat) await this.dropTextures()
    await this.decimate()
    if (this.bake) await this.paintVertices()
    await this.shrinkTextures()
    await this.mergeMaterials()
    // the baked colour is the only place a model's paint is left, and no
    // material declares it, so pruning must be told to leave the vertices alone
    await this.document.transform(dedup(), prune({ keepAttributes: this.bake }))
    this.after = measure(this.document)
    return this
  }

  /** Interiors, engine bays and brake discs: paid for on every car, never seen. */
  async dropHidden() {
    const saved = Object.fromEntries(HIDDEN_GROUPS.map((group) => [group, { parts: 0, triangles: 0 }]))
    for (const mesh of this.document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const group =
          hiddenGroupOf(primitive.getMaterial()?.getName(), this.spare) ??
          hiddenGroupOf(mesh.getName(), this.spare)
        if (!group) continue
        saved[group].parts++
        saved[group].triangles += triangleCount(primitive)
        mesh.removePrimitive(primitive)
        primitive.dispose()
      }
      if (mesh.listPrimitives().length === 0) mesh.dispose()
    }
    await this.document.transform(prune({ keepAttributes: false }))
    const gone = HIDDEN_GROUPS.filter((group) => saved[group].parts > 0)
    this.steps.push({
      name: 'hidden',
      said: gone.length
        ? gone.map((group) => `${group} ${saved[group].parts} parts, ${saved[group].triangles.toLocaleString()} tris`).join('; ')
        : 'nothing named as hidden',
    })
  }

  /**
   * Strips every image, leaving each material its own colour. A textured
   * material cannot be merged into another one without repacking its UVs, and
   * nothing here repacks UVs, so a model that has to come down to a few draws
   * gives up its sheets and keeps its palette.
   */
  async dropTextures() {
    let dropped = 0
    for (const material of this.document.getRoot().listMaterials()) {
      for (const slot of ['BaseColor', 'Emissive', 'MetallicRoughness', 'Normal', 'Occlusion']) {
        if (material[`get${slot}Texture`]() === null) continue
        material[`set${slot}Texture`](null)
        dropped++
      }
    }
    await this.document.transform(prune({ keepAttributes: false }))
    this.steps.push({ name: 'textures', said: `${dropped} image slots dropped, colours kept` })
  }

  /**
   * Weld the loose corners back together, then take the triangles to budget.
   *
   * A simplifier stops at whatever error bound it was given, so one pass at a
   * tight bound lands wherever it lands. This walks the bound out until the
   * budget is met or the mesh stops giving, and reports the bound it needed:
   * how far the error had to open is the honest measure of how much a model was
   * asked to give up, and it is what says whether it is still the same car.
   */
  async decimate() {
    await this.document.transform(weld())
    const welded = measure(this.document).triangles
    if (welded <= this.triangles) {
      this.steps.push({ name: 'simplify', said: `${welded.toLocaleString()} tris after welding, already inside budget` })
      return
    }
    await MeshoptSimplifier.ready
    let now = welded
    let error = 0
    for (const bound of ERROR_BOUNDS) {
      error = bound
      await this.document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: this.triangles / now, error: bound }))
      const next = measure(this.document).triangles
      if (next <= this.triangles || next >= now) {
        now = next
        break
      }
      now = next
    }
    this.steps.push({
      name: 'simplify',
      said:
        `${welded.toLocaleString()} welded -> ${now.toLocaleString()} at error ${error}` +
        ` (${((1 - now / welded) * 100).toFixed(1)}% of the triangles gone)`,
    })
  }

  /**
   * Reads the sheets onto the vertices and drops them. It runs after the
   * simplifier, so it samples the vertices that survived rather than the ones
   * that were about to go.
   */
  async paintVertices() {
    const read = await bakeVertexColour(this.document)
    this.steps.push({
      name: 'bake',
      said: `${read.sheets} sheets onto the vertices, ${read.painted} parts sampled, ${read.flat} left their own colour`,
    })
  }

  async shrinkTextures() {
    const widest = measure(this.document).widest
    if (widest <= this.texture) {
      this.steps.push({ name: 'resize', said: widest ? `widest is ${widest} px, already inside budget` : 'no textures' })
      return
    }
    await this.document.transform(
      textureCompress({ encoder: sharp, resize: [this.texture, this.texture], resizeFilter: 'lanczos3' }),
    )
    this.steps.push({ name: 'resize', said: `${widest} px -> ${measure(this.document).widest} px` })
  }

  /**
   * Folds materials that differ only in their colour into one with a palette
   * texture, then joins the meshes that end up sharing one, which is what
   * turns a merged material into a saved draw call.
   *
   * `keepParts` leaves both alone: a model that still has to be rigged, wheels
   * onto pivots and a nose pointed down +Z, is only useful while its parts are
   * still their own nodes and its materials still carry the names that say
   * which part is glass and which is a tyre. Whoever rigs it does the merging.
   */
  async mergeMaterials() {
    const before = measure(this.document)
    if (this.keepParts) {
      this.steps.push({
        name: 'materials',
        said: `${before.materials} materials and ${before.draws} draws kept for rigging`,
      })
      return
    }
    await this.document.transform(palette({ min: 2, blockSize: 4 }))
    await this.document.transform(flatten(), join({ keepNamed: false, keepMeshes: false }))
    await this.document.transform(dedup(), prune({ keepAttributes: false }))
    const after = measure(this.document)
    this.steps.push({
      name: 'materials',
      said: `${before.materials} -> ${after.materials} materials, ${before.draws} -> ${after.draws} draws`,
    })
  }
}
