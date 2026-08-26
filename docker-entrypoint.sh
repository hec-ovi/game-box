#!/usr/bin/env bash
set -e

cleanup() {
  kill -TERM "$HOST_PID" "$APP_PID" 2>/dev/null || true
  wait "$HOST_PID" "$APP_PID" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

if [ ! -x /app/game/app/node_modules/.bin/vite ]; then
  echo "the workspace is not installed: run pnpm install on the machine, then start again"
  exit 1
fi

# Say where generation is pointed before anything asks for it. A connection
# that never opens surfaces mid-build as one line in a loader, long after the
# address was wrong.
node -e '
const at = (process.env.GAME_BOX_LLM_UPSTREAM ?? "").trim()
if (at === "") { console.log("model: the built-in stand-in (GAME_BOX_LLM_UPSTREAM is unset)"); process.exit(0) }
if (at === "openrouter") {
  console.log(process.env.OPENROUTER_API_KEY ? "model: openrouter" : "model: openrouter, but OPENROUTER_API_KEY is not set")
  process.exit(0)
}
fetch(new URL("./models", at.endsWith("/") ? at : at + "/"), { signal: AbortSignal.timeout(4000) })
  .then((reply) => console.log(`model: ${at} answered ${reply.status}`))
  .catch(() => console.log(`model: ${at} did not answer. In a container 127.0.0.1 is the container: use host.docker.internal for a server on your machine, or the service name of a container you share a network with.`))
'

echo "web  http://localhost:5180"
echo "api  http://localhost:${GAME_BOX_PORT:-8976}"

# node directly, never pnpm: pnpm reads the workspace's own installs as stale
# (the mount records the store path of the machine that made it) and asks to
# delete them, which is the machine's node_modules, not the container's.
node --experimental-strip-types /app/host/src/main.ts &
HOST_PID=$!

(cd /app/game/app && exec ./node_modules/.bin/vite --host 0.0.0.0) &
APP_PID=$!

wait -n "$HOST_PID" "$APP_PID"
