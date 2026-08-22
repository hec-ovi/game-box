/** Speech synthesis: frames while the sentence is still being written. */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { audioEventContract, newSession, voices, type AudioEvent, type Session } from '../src/tts/index.ts'

function frameMs(event: AudioEvent): number {
  assert.equal(event.type, 'frame')
  return Math.floor((Buffer.from(event.dataBase64, 'base64').length / 2 / event.sampleRate) * 1000)
}

function open(request: unknown): Session {
  const session = newSession(request)
  assert.ok(session.ok, `expected a session for ${JSON.stringify(request)}`)
  return session.value
}

describe('a speaking session', () => {
  it('speaks mid-sentence, then ends once and resets', () => {
    const session = open({ voice: 'narrator' })

    // audio arrives while the sentence is still being written
    const early = session.pushText('Hello there ')
    assert.ok(early.length > 0, 'no audio before the sentence closed')
    assert.ok(early.every((e) => e.type === 'frame'))
    assert.ok(early.every((e) => frameMs(e) === 80), `frames are not 80ms: ${JSON.stringify(early)}`)

    const more = session.pushText('stranger.')
    const done = session.finish()
    assert.equal(done.filter((e) => e.type === 'end').length, 1)
    const end = done.at(-1)
    assert.equal(end?.type, 'end')
    assert.ok(end?.type === 'end' && end.durationMs > 0, 'end reported no audio')

    for (const event of [...early, ...more, ...done]) {
      assert.ok(audioEventContract.is(event), `event off-contract: ${JSON.stringify(event)}`)
    }

    // finish reset the utterance: the next line is timed on its own
    assert.deepEqual(session.finish(), [{ type: 'end', durationMs: 0 }])
  })

  it('refuses a bad request or an unknown voice', () => {
    for (const bad of [
      {},
      { voice: '' },
      { voice: 'narrator', sampleRate: 4000 },
      { voice: 'narrator', speed: 5 },
      { voice: 'narrator', extra: 1 },
    ]) {
      const session = newSession(bad)
      assert.ok(!session.ok, `expected a refusal for ${JSON.stringify(bad)}`)
      assert.equal(session.error.code, 'invalid-request')
    }

    const dragon = newSession({ voice: 'dragon' })
    assert.ok(!dragon.ok)
    assert.equal(dragon.error.code, 'unknown-voice')

    for (const voice of voices()) {
      assert.ok(newSession({ voice }).ok, `voice ${voice} rejected`)
    }
  })
})
