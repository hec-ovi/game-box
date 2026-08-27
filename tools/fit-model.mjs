/**
 * Turns a downloaded model into one fit to ship, and prints what it cost.
 *
 *   node tools/fit-model.mjs <file-or-folder> [more...] --out <dir>
 *        [--triangles 12000] [--texture 1024]
 *        [--flat] [--bake] [--keep-parts] [--keep-hidden] [--spare <word>] [--dry]
 *
 * It drops what nobody sees from outside (interiors, engine bays, brake discs),
 * welds and simplifies the geometry to the triangle budget, resizes the
 * textures and merges the materials, then writes the result beside its report.
 * `--flat` gives up the texture sheets so the materials can merge all the way
 * down to a palette, which is how the pack's own cars are painted.
 * `--bake` reads the sheets onto the vertices first, so a model painted with
 * one atlas keeps its livery once the images are gone.
 * `--keep-parts` leaves the node graph and the material names alone for a model
 * that still has to be rigged, wheels onto pivots and a nose pointed down +Z.
 *
 * It prints what the file says about its own licence and writes it either way.
 *
 * `node tools/inspect-glb.mjs` is the same measurement without the fitting.
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { Fit } from './model/fit.mjs'
import { against, BUDGET, line, measure, reader } from './model/measure.mjs'
import { licenceOf } from './licences.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at < 0 ? fallback : args[at + 1]
}
const flags = new Set(args.filter((one) => one.startsWith('--')))
const targets = args.filter((one, at) => !one.startsWith('--') && !args[at - 1]?.startsWith('--'))
const outDir = flag('out')
const dry = flags.has('--dry')

if (targets.length === 0 || (!outDir && !dry)) {
  console.error('usage: node tools/fit-model.mjs <file-or-folder> [more...] --out <dir> [--flat] [--bake] [--keep-parts] [--triangles n] [--texture n]')
  process.exit(1)
}

const how = {
  triangles: Number(flag('triangles', 12000)),
  texture: Number(flag('texture', 1024)),
  spare: args.filter((one, at) => args[at - 1] === '--spare'),
  keepHidden: flags.has('--keep-hidden'),
  keepParts: flags.has('--keep-parts'),
  flat: flags.has('--flat'),
  bake: flags.has('--bake'),
}

const io = reader()
if (outDir) mkdirSync(outDir, { recursive: true })

const verdicts = []
for (const file of targets.flatMap(filesIn)) {
  const name = basename(file)
  console.log(`\n${name}`)
  let document
  try {
    document = await io.read(file)
  } catch (error) {
    console.log(`  cannot read it: ${error.message}`)
    verdicts.push({ name, verdict: 'unreadable' })
    continue
  }

  // What the file says about itself, printed and nothing more. The owner
  // decides what goes in his own repository; this tool fits models to a budget.
  const licence = licenceOf(document)
  console.log(`  licence  ${licence.id}${licence.author ? `, ${licence.author}` : ''}`)

  const fit = await new Fit(document, how).run()
  console.log(`  ${line('before', { ...fit.before, bytes: statSync(file).size })}`)
  for (const step of fit.steps) console.log(`    ${step.name.padEnd(10)} ${step.said}`)

  if (!dry) {
    const out = join(outDir, `${basename(file, extname(file))}.glb`)
    await io.write(out, document)
    console.log(`  ${line('after', { ...measure(document), bytes: statSync(out).size })} -> ${out}`)
  } else {
    console.log(`  ${line('after', measure(document))}`)
  }

  const over = against(fit.after, { triangles: how.triangles, draws: BUDGET.draws, texture: how.texture })
  console.log(`  ${over.length ? `still over: ${over.join('; ')}` : 'fits the budget'}`)
  verdicts.push({ name, verdict: over.length ? 'over budget' : 'fits' })
}

console.log('')
for (const one of verdicts) console.log(`${one.name.padEnd(46)} ${one.verdict}`)

function filesIn(target) {
  const path = resolve(target)
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path)
    .filter((name) => ['.glb', '.gltf'].includes(extname(name).toLowerCase()))
    .map((name) => join(path, name))
    .sort()
}
