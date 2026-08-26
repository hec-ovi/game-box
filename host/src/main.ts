/** Run the sidecar: `node --experimental-strip-types src/main.ts`. */
import { listen } from './server.ts'

const port = Number.parseInt(process.env.GAME_BOX_PORT ?? '', 10)
const host = process.env.GAME_BOX_HOST || '127.0.0.1'
const { port: bound } = await listen(Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 8976, host)
console.log(`game-box listening on http://${host}:${bound}`)
