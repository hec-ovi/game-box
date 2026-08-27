export const CONTRACT_VERSION = '0.7.0'

export function health(): Record<string, string> {
  return { status: 'ok', service: 'game-box', contractVersion: CONTRACT_VERSION }
}
