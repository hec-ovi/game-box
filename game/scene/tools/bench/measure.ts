import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

/**
 * Drives `index.html` through a headless Chromium and prints what each run
 * measured. Vite has to be serving the repo root (`npx vite --port 5312`);
 * the browser is `CHROME` on the environment, `chromium` when unset. The
 * frame rate is uncapped and the GPU asked for, so a frame is what it costs
 * rather than the vsync. `SHOT` names a folder to drop a screenshot of each
 * run into, to see that what was timed is what was meant, and `BLOCKS` how
 * big a town the street view builds (default 2), `WHOLE=1` every building
 * whole at every distance.
 *
 *   CHROME=/path/to/chrome node game/scene/tools/bench/measure.ts street 0 4 8 16 32
 *   CHROME=/path/to/chrome node game/scene/tools/bench/measure.ts street-gl 0 4 8 16 32
 *   CHROME=/path/to/chrome node game/scene/tools/bench/measure.ts ceiling 0 1.6
 */

const PORT = 9333
const PAGE = 'http://127.0.0.1:5312/game/scene/tools/bench/index.html'

const [view = 'street', ...values] = process.argv.slice(2)

const browser = spawn(
  process.env['CHROME'] ?? 'chromium',
  [
    '--headless=new',
    '--no-sandbox',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-webgpu',
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--window-size=1920,1080',
    `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

interface Target {
  readonly webSocketDebuggerUrl: string
}

async function target(): Promise<Target> {
  for (let tries = 0; tries < 50; tries++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as Target[]
      if (list[0]) return list[0]
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('no browser target')
}

class Session {
  readonly #socket: WebSocket
  #id = 0
  readonly #waiting = new Map<number, (result: unknown) => void>()

  constructor(socket: WebSocket) {
    this.#socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown }
      if (message.id !== undefined) this.#waiting.get(message.id)?.(message.result)
    })
  }

  static async open(url: string): Promise<Session> {
    const socket = new WebSocket(url)
    await new Promise((resolve) => socket.addEventListener('open', resolve))
    return new Session(socket)
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = ++this.#id
    this.#socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve) => this.#waiting.set(id, resolve))
  }

  async evaluate(expression: string): Promise<unknown> {
    const answer = (await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })) as {
      result: { value: unknown }
    }
    return answer.result.value
  }

  close(): void {
    this.#socket.close()
  }
}

async function run(session: Session, url: string): Promise<unknown> {
  await session.send('Page.navigate', { url })
  for (let tries = 0; tries < 600; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const title = await session.evaluate('document.title')
    if (title === 'done') {
      const shot = process.env['SHOT']
      if (shot) {
        const png = (await session.send('Page.captureScreenshot', { format: 'png' })) as { data: string }
        await writeFile(`${shot}/${url.split('?')[1]!.replace(/[^a-z0-9]+/gi, '-')}.png`, Buffer.from(png.data, 'base64'))
      }
      return session.evaluate('JSON.stringify(window.bench)')
    }
    if (title === 'failed') throw new Error(String(await session.evaluate('document.getElementById("out").textContent')))
  }
  throw new Error('timed out')
}

try {
  const session = await Session.open((await target()).webSocketDebuggerUrl)
  await session.send('Page.enable')
  const param = view === 'ceiling' ? 'fill' : 'lights'
  const backend = view === 'street-gl' ? '&gl=1' : ''
  const blocks = process.env['BLOCKS'] ? `&blocks=${process.env['BLOCKS']}` : ''
  const look = process.env['WHOLE'] === '1' ? '&whole=1' : ''
  for (const value of values.length ? values : ['16']) {
    console.log(await run(session, `${PAGE}?view=${view.replace('-gl', '')}&${param}=${value}${backend}${blocks}${look}`))
  }
  session.close()
} finally {
  browser.kill()
}
