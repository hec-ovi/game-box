/** What the file is called: the city, then the seed that made it. */
export function exportName(world: { name: string; seed: string }): string {
  return `${named(world)}.gbworld.json`
}

/** And the pack cut from that city, which applies to it alone. */
export function packName(world: { name: string; seed: string }): string {
  return `${named(world)}.gbpack.json`
}

function named(world: { name: string; seed: string }): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${slug(world.name) || 'city'}-${slug(world.seed) || 'seed'}`
}

/**
 * Hand the sealed city to the browser as a file. It is the same document the
 * game just opened, so what the player keeps is exactly what they played.
 */
export function download(document_: unknown, name: string): void {
  const blob = new Blob([JSON.stringify(document_)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // give the download a tick to start before the blob goes
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
