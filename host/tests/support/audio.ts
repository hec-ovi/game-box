/** Silence of a known length, in the envelope the contracts require. */
export function chunkOfMs(ms: number, sampleRate: number): Record<string, unknown> {
  const samples = (ms * sampleRate) / 1000
  return {
    mediaType: 'audio/pcm;bits=16',
    sampleRate,
    dataBase64: Buffer.alloc(samples * 2).toString('base64'),
  }
}
