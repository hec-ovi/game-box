/**
 * Derives the maps a colour tile does not carry: a tangent space normal from
 * its own luminance, a roughness the material was authored at and the picture
 * moves about, and the occlusion of what the height field says is a hollow.
 *
 *   node tools/textures/relief.mjs <tile.png> <outdir> --surface <name>
 *        [--metres 2] [--metres 12x6.42] [--size 512] [--packed]
 *
 * `--metres` is how much real surface one repeat of the tile covers, across by
 * up. It is not a label: the slope of a normal is metres of height over metres
 * of surface, so a tile laid on a twelve metre wall and the same tile laid on a
 * two metre one are two different maps.
 *
 * Writes `<name>-normal.png` and `<name>-orm.png`, or one opaque
 * `<name>-relief.png` with `--packed` (normal x and y, roughness), and prints
 * what it measured off what it wrote.
 */
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Relief } from './relief/derive.mjs'
import { readTile, writeImage } from './relief/read.mjs'
import { SURFACE_NAMES } from './relief/surfaces.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const at = args.indexOf(`--${name}`)
  return at < 0 ? undefined : args[at + 1]
}
const [source, outDir] = args.filter((a, at) => !a.startsWith('--') && !(at > 0 && args[at - 1]?.startsWith('--')))
const surface = flag('surface')

if (!source || !outDir || !surface) {
  console.error('usage: node tools/textures/relief.mjs <tile.png> <outdir> --surface <name> [--metres 2] [--size 512] [--packed]')
  console.error(`surfaces: ${SURFACE_NAMES.join(', ')}`)
  process.exit(1)
}

const metres = metresOf(flag('metres') ?? '2')
const tile = await readTile(source)
const size = Number(flag('size') ?? tile.size)
// `--relief` overrides how deep the material is taken to be, in millimetres
// peak to peak. A material's own row is the depth of a close sample of it; a
// picture of a whole street face made of that material carries the reveal
// round a window and the band at a floor line as well, which are centimetres.
// Same material, deeper picture, so the depth moves and the roughness does not.
const deeper = flag('relief')
const relief = new Relief(tile, metres, surface, size, deeper === undefined ? undefined : Number(deeper))
const name = basename(source).replace(/\.[^.]+$/, '').replace(/-tile$/, '')

mkdirSync(outDir, { recursive: true })
if (args.includes('--packed')) {
  await writeImage(relief.packedBytes(), size, 3, join(outDir, `${name}-relief.png`))
} else {
  await writeImage(relief.normalBytes(), size, 3, join(outDir, `${name}-normal.png`))
  await writeImage(relief.ormBytes(), size, 3, join(outDir, `${name}-orm.png`))
}
print(relief.report())

/** "2" is a square tile; "12x6.42" is a tile laid wider than it is tall. */
function metresOf(text) {
  const [across, up] = text.split('x').map(Number)
  if (!Number.isFinite(across) || across <= 0) throw new Error(`relief: --metres ${text}`)
  return { across, up: Number.isFinite(up) && up > 0 ? up : across }
}

function print(report) {
  const one = (value) => value.toFixed(2)
  console.log(
    `${name} on ${report.surface}: ${report.size}px over ${report.metres.across}x${report.metres.up} m` +
      ` (${one(report.millimetresPerTexel.across)}x${one(report.millimetresPerTexel.up)} mm a texel)`,
  )
  console.log(
    `  normal   tilt ${one(report.tilt.median)} deg median, ${one(report.tilt.p90)} at p90, ${one(report.tilt.p99)} at p99` +
      `, ${one(report.relief)} mm peak to peak`,
  )
  console.log(`  rough    ${one(report.roughness.min)} to ${one(report.roughness.max)}, mean ${one(report.roughness.mean)}`)
  console.log(`  occlude  ${one(report.occlusion.min)} at the deepest, mean ${one(report.occlusion.mean)}`)
  console.log(`  metal    ${one(report.metalness)}`)
}
