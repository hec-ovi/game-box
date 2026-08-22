/**
 * Downloads the art packs listed in assets/registry/sources.json into
 * assets/src/, and records what it got.
 *
 * A pack that is not marked redistributable is refused here rather than
 * discovered later: our world files hand assets to other players, so
 * "use it but do not redistribute the file" is unusable whatever it costs.
 *
 * Run: node tools/fetch-assets.mjs [pack-id ...]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const REGISTRY = join(ROOT, 'assets', 'registry', 'sources.json')
const OUT = join(ROOT, 'assets', 'src')
const LOCK = join(ROOT, 'assets', 'registry', 'downloaded.json')

const ALLOWED = new Set(['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0'])

const wanted = process.argv.slice(2)
const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
const packs = registry.packs.filter((pack) => wanted.length === 0 || wanted.includes(pack.id))
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {}

for (const pack of packs) {
  if (!pack.redistributable) {
    console.error(`refusing ${pack.id}: not redistributable, and our world files redistribute`)
    process.exitCode = 1
    continue
  }
  if (!ALLOWED.has(pack.license)) {
    console.error(`refusing ${pack.id}: license ${pack.license} is not on the allowed list`)
    process.exitCode = 1
    continue
  }

  try {
    const files = await downloadFree(pack)
    lock[pack.id] = {
      page: pack.page,
      license: pack.license,
      downloadedAt: new Date().toISOString().slice(0, 10),
      files,
    }
    for (const file of files) console.log(`  ${pack.id}  ${file.name}  ${(file.bytes / 1e6).toFixed(1)} MB  ${file.sha256.slice(0, 12)}`)
  } catch (cause) {
    console.error(`  ${pack.id} failed: ${String(cause)}`)
    process.exitCode = 1
  }
}

writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`)
console.log(`\nrecorded in ${LOCK}`)

/** itch.io's pay-what-you-want flow: ask for the free download, then take the listed files. */
async function downloadFree(pack) {
  const jar = new Map()
  const page = await get(`${pack.page}/purchase`, jar)
  const csrf = /meta name="csrf_token" value="([^"]+)"/.exec(page.body)?.[1]
  if (!csrf) throw new Error('no csrf token on the purchase page')

  const grant = await post(`${pack.page}/download_url`, jar, JSON.stringify({ csrf_token: csrf }))
  const downloadPage = JSON.parse(grant.body).url
  if (!downloadPage) throw new Error('itch did not grant a download url')

  const listing = await get(downloadPage, jar)
  const uploads = [...listing.body.matchAll(/data-upload_id="(\d+)"/g)].map((m) => m[1])
  const names = [...listing.body.matchAll(/<strong title="([^"]+)" class="name">/g)].map((m) => m[1])
  if (!uploads.length) throw new Error('no uploads on the download page')

  const listingCsrf = /meta name="csrf_token" value="([^"]+)"/.exec(listing.body)?.[1] ?? csrf
  mkdirSync(join(OUT, pack.id), { recursive: true })

  const got = []
  for (const [index, uploadId] of uploads.entries()) {
    const name = names[index] ?? `${uploadId}.zip`
    // only the free tier: the paid ones answer with a price, not a file
    if (pack.file && name !== pack.file) continue

    const link = await post(
      `${pack.page}/file/${uploadId}?source=game_download`,
      jar,
      new URLSearchParams({ csrf_token: listingCsrf }).toString(),
      'application/x-www-form-urlencoded',
    )
    const url = safeUrl(link.body)
    if (!url) continue

    const file = await fetch(url)
    if (!file.ok) throw new Error(`${name}: HTTP ${file.status}`)
    const bytes = Buffer.from(await file.arrayBuffer())
    const target = join(OUT, pack.id, name)
    writeFileSync(target, bytes)
    got.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  if (!got.length) throw new Error('nothing downloadable in the free tier')
  return got
}

function safeUrl(body) {
  try {
    return JSON.parse(body).url
  } catch {
    return /https:\/\/[^"'\\ ]+\.zip[^"'\\ ]*/.exec(body)?.[0]
  }
}

async function get(url, jar) {
  return request(url, jar, { method: 'GET' })
}

async function post(url, jar, body, type = 'application/json') {
  return request(url, jar, {
    method: 'POST',
    headers: { 'content-type': type, 'x-requested-with': 'XMLHttpRequest' },
    body,
  })
}

async function request(url, jar, init) {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
    redirect: 'follow',
  })
  for (const set of response.headers.getSetCookie?.() ?? []) {
    const [pair] = set.split(';')
    const [name, ...rest] = pair.split('=')
    jar.set(name.trim(), rest.join('='))
  }
  return { body: await response.text(), status: response.status }
}
