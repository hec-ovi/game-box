import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The lab is a developer page, not a box and not part of the game. It is served
 * out of its own folder and reads every box in place: the prompts off
 * `game/scribe/prompts`, the tool schemas off the same code the build calls, so
 * what the page shows cannot drift from what a build sends.
 *
 * `tools/` is outside the pnpm workspace, so nothing is linked into a
 * `node_modules` here. Each box's public entry is aliased straight at the file
 * its own `package.json` names, which is also what keeps the page honest.
 */
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..')
const games = join(repo, 'game')

const alias = readdirSync(games, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const manifest = JSON.parse(readFileSync(join(games, entry.name, 'package.json'), 'utf8'))
    const entryPoint = typeof manifest.exports?.['.'] === 'string' ? manifest.exports['.'] : undefined
    return entryPoint ? [{ find: manifest.name, replacement: join(games, entry.name, entryPoint) }] : []
  })

/**
 * Every file the page quotes, in one module read off disk each time it is asked
 * for. One request rather than several hundred, and it is still the file on
 * disk: the page's prompts and line numbers are whatever the repository says
 * right now, and a save to any of them reloads the page.
 *
 * Which files those are is read off the page's own code: every `game/...` or
 * `docs/...` path it names in a `site()` or a `fileText()` call, plus the whole
 * of the prompt folder, which it reads by name. So naming a new file in a stage
 * is the only thing anybody has to do to quote it.
 */
const VIRTUAL = 'virtual:lab-sources'
const RESOLVED = `\0${VIRTUAL}`
const PROMPTS = join(games, 'scribe', 'prompts')
const NAMED = /'((?:game|docs)\/[A-Za-z0-9_./-]+\.(?:ts|md))'/g

function labSources() {
  return {
    name: 'lab-sources',
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null
      const files = {}
      for (const path of named()) read(join(repo, path), path, files)
      for (const entry of readdirSync(PROMPTS)) read(join(PROMPTS, entry), `game/scribe/prompts/${entry}`, files)
      return `export const FILES = ${JSON.stringify(files)}\n`
    },
    configureServer(server) {
      const watched = [...named().map((path) => join(repo, path)), PROMPTS]
      server.watcher.add(watched)
      server.watcher.on('all', (_event, path) => {
        if (!watched.some((one) => path === one || path.startsWith(PROMPTS))) return
        const module = server.moduleGraph.getModuleById(RESOLVED)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

/** Every repository file the page's own code names, found by reading that code. */
function named() {
  const paths = new Set()
  for (const file of walk(join(here, 'src'))) {
    for (const [, path] of readFileSync(file, 'utf8').matchAll(NAMED)) paths.add(path)
  }
  return [...paths].sort()
}

function read(full, path, into) {
  try {
    into[path] = readFileSync(full, 'utf8')
  } catch {
    /* a file the page names and the repository does not have says so on the page */
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.name.endsWith('.ts')) yield full
  }
}

export default {
  root: here,
  plugins: [labSources()],
  resolve: { alias },
  server: { port: 5199, strictPort: false, fs: { allow: [repo] } },
  optimizeDeps: { entries: ['src/main.ts'] },
}
