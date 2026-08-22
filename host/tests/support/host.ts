/** A host bound to a free loopback port, for tests that go over real HTTP. */
import type { Server } from 'node:http'
import { listen } from '../../src/server.ts'

export interface RunningHost {
  readonly base: string
  readonly wsBase: string
  close(): Promise<void>
}

export async function startHost(): Promise<RunningHost> {
  const { server, port } = await listen(0)
  return {
    base: `http://127.0.0.1:${port}`,
    wsBase: `ws://127.0.0.1:${port}`,
    close: () => stop(server),
  }
}

export function stop(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })
}
