/** Speech recognition: envelopes in, partials and one final out. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newSession, transcriptEventContract, type Session, type TranscriptEvent } from '../src/stt/index.ts'
import { chunkOfMs } from './support/audio.ts'

function heard(session: Session, ms: number): TranscriptEvent[] {
  const pushed = session.push(chunkOfMs(ms, 16000))
  assert.ok(pushed.ok, `expected ${ms}ms to be accepted: ${JSON.stringify(pushed)}`)
  return pushed.value
}

describe('a recognition session', () => {
  it('streams partials, then a final, and resets', () => {
    const session = newSession()

    const first = heard(session, 1000)
    assert.deepEqual(first, [{ type: 'partial', text: 'heard 1000ms' }])
    const second = heard(session, 500)
    assert.deepEqual(second, [{ type: 'partial', text: 'heard 1500ms' }])
    const done = session.finish()
    assert.deepEqual(done, [{ type: 'final', text: 'heard 1500ms total' }])
    for (const event of [...first, ...second, ...done]) {
      assert.ok(transcriptEventContract.is(event), `event off-contract: ${JSON.stringify(event)}`)
    }

    // finish resets the utterance
    assert.deepEqual(heard(session, 200), [{ type: 'partial', text: 'heard 200ms' }])
  })

  it('fails closed on an invalid chunk without mutating', () => {
    const session = newSession()
    heard(session, 1000)

    for (const bad of [
      {},
      { mediaType: 'audio/ogg', sampleRate: 16000, dataBase64: 'AAAA' },
      { mediaType: 'audio/pcm;bits=16', sampleRate: 4000, dataBase64: 'AAAA' },
      { mediaType: 'audio/pcm;bits=16', sampleRate: 16000, dataBase64: 'not base64!!' },
      { mediaType: 'audio/pcm;bits=16', sampleRate: 16000, dataBase64: 'AAAA', extra: 1 },
    ]) {
      const pushed = session.push(bad)
      assert.ok(!pushed.ok, `expected a refusal for ${JSON.stringify(bad)}`)
      assert.equal(pushed.error.code, 'invalid-chunk')
    }

    // state untouched by the failed pushes
    assert.equal(session.finish()[0]?.text, 'heard 1000ms total')
  })
})
