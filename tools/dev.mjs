/**
 * Start the game and the sidecar together. `pnpm dev`
 *
 * The model behind the sidecar is whoever GAME_BOX_LLM_UPSTREAM names. This
 * does not start that process.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ENV_FILE = resolve(ROOT, '.env')
const VITE = resolve(ROOT, 'game/app/node_modules/.bin/vite')
const HOST = resolve(ROOT, 'host/src/main.ts')

if (!existsSync(VITE)) {
  console.error('the workspace is not installed: run pnpm install, then start again')
  process.exit(1)
}

loadEnv(ENV_FILE)

const port = Number.parseInt(process.env.GAME_BOX_PORT ?? '', 10)
const api = Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 8976

await sayModel()
console.log('web  http://localhost:5180')
console.log(`api  http://localhost:${api}`)

const children = []
let stopping = false

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env })
  children.push(child)
  child.on('exit', () => {
    if (!stopping) shutdown(child.exitCode ?? 1)
  })
}

function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
  Promise.all(
    children.map(
      (child) =>
        new Promise((done) => {
          if (child.exitCode !== null || child.signalCode !== null) return done()
          child.once('exit', done)
        }),
    ),
  ).then(() => process.exit(code))
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start(process.execPath, ['--experimental-strip-types', HOST], resolve(ROOT, 'host'))
start(VITE, [], resolve(ROOT, 'game/app'))

/** A variable already exported wins over the file, same as `pnpm -C host dev`. */
function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const cut = trimmed.indexOf('=')
    if (cut <= 0) continue
    const name = trimmed.slice(0, cut)
    if (process.env[name] === undefined) process.env[name] = trimmed.slice(cut + 1)
  }
}

async function sayModel() {
  const at = (process.env.GAME_BOX_LLM_UPSTREAM ?? '').trim()
  if (at === '') {
    console.log('model: the built-in stand-in (GAME_BOX_LLM_UPSTREAM is unset)')
    return
  }
  if (at === 'openrouter') {
    console.log(process.env.OPENROUTER_API_KEY ? 'model: openrouter' : 'model: openrouter, but OPENROUTER_API_KEY is not set')
    return
  }
  try {
    const reply = await fetch(new URL('./models', at.endsWith('/') ? at : `${at}/`), { signal: AbortSignal.timeout(4000) })
    console.log(`model: ${at} answered ${reply.status}`)
  } catch {
    console.log(`model: ${at} did not answer`)
  }
}
