/** Run the sidecar: `node --experimental-strip-types src/main.ts`. */
import { listen } from './server.ts'

const port = Number.parseInt(process.env.GAME_BOX_PORT ?? '', 10)
const { port: bound } = await listen(Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 8976)
console.log(`game-box listening on http://127.0.0.1:${bound}`)
