// Enforces the box rule: a box may only reach another box through its public
// entry, and only if its package.json declares the dependency.
// Run: node tools/check-isolation.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BOXES_DIR = join(ROOT, 'game')

const boxes = readdirSync(BOXES_DIR).filter((d) => statSync(join(BOXES_DIR, d)).isDirectory())
const manifests = new Map(
  boxes.map((b) => [b, JSON.parse(readFileSync(join(BOXES_DIR, b, 'package.json'), 'utf8'))]),
)
const byPackageName = new Map([...manifests].map(([box, m]) => [m.name, box]))

const files = []
for (const box of boxes) walk(join(BOXES_DIR, box), (f) => f.endsWith('.ts') && files.push({ box, file: f }))

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(full, visit)
    } else visit(full)
  }
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g
const violations = []

for (const { box, file } of files) {
  const source = readFileSync(file, 'utf8')
  const deps = { ...(manifests.get(box).dependencies ?? {}), ...(manifests.get(box).devDependencies ?? {}) }
  for (const [, spec] of source.matchAll(IMPORT)) {
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec)
      if (!target.startsWith(join(BOXES_DIR, box))) {
        violations.push(`${rel(file)}: relative import escapes the box -> ${spec}`)
      }
      continue
    }
    const owner = [...byPackageName.keys()].find((name) => spec === name || spec.startsWith(`${name}/`))
    if (!owner) continue
    if (spec !== owner) {
      violations.push(`${rel(file)}: deep import into another box -> ${spec} (use "${owner}" only)`)
    }
    if (byPackageName.get(owner) === box) continue
    if (!(owner in deps)) {
      violations.push(`${rel(file)}: imports "${owner}" but game/${box}/package.json does not declare it`)
    }
  }
}

for (const box of boxes) {
  const manifest = manifests.get(box)
  if (!manifest.exports || Object.keys(manifest.exports).some((k) => k !== '.')) {
    violations.push(`game/${box}/package.json: must expose exactly one public entry ("exports": { ".": ... })`)
  }
  try {
    statSync(join(BOXES_DIR, box, 'CONTRACT.md'))
  } catch {
    violations.push(`game/${box}: missing CONTRACT.md`)
  }
}

checkHost()

/**
 * The local AI service is not part of the game. It stands on its own so it can
 * be taken on its own: nothing in it may import the game, and nothing in the
 * game may import it. They meet over HTTP and nowhere else.
 */
function checkHost() {
  const HOST = join(ROOT, 'host')
  try {
    statSync(HOST)
  } catch {
    return
  }

  const hostFiles = []
  walk(HOST, (f) => (f.endsWith('.ts') || f.endsWith('.mjs')) && hostFiles.push(f))

  for (const file of hostFiles) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (spec.startsWith('@gb/')) {
        violations.push(`${rel(file)}: the service imports the game (${spec}); it must stand on its own`)
      }
      if (spec.startsWith('.') && !resolve(dirname(file), spec).startsWith(HOST)) {
        violations.push(`${rel(file)}: relative import escapes the service -> ${spec}`)
      }
    }
  }

  for (const { box, file } of files) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const reachesHost = spec.includes('/host/') || spec.startsWith('host/') || spec === '@gb/host'
      if (reachesHost) violations.push(`${rel(file)}: game/${box} imports the service; talk to it over HTTP`)
    }
  }

  try {
    statSync(join(HOST, 'CONTRACT.md'))
  } catch {
    violations.push('host: missing CONTRACT.md')
  }
}

function rel(f) {
  return relative(ROOT, f)
}

if (violations.length) {
  console.error(`box isolation broken (${violations.length}):`)
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}
console.log(`box isolation ok (${boxes.length} boxes, ${files.length} files)`)
