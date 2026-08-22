# gb-tts contract

contractVersion: 0.1.0

## Purpose

Turn a stream of text tokens into a stream of PCM audio frames, speaking while the sentence is still being written.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `request` (per `new_session`) | [schema/speak-request.json](schema/speak-request.json) | `voice` is one of `voices()`; sampleRate 8000-48000 (default 24000); speed 0.5-2.0 (default 1.0) |
| `text` (per `Session::push_text`) | plain `&str` | any slice: one LLM token, a word, a whole line |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| audio events (from `push_text` and `finish`) | [schema/audio-event.json](schema/audio-event.json) | `push_text` yields zero or more 80 ms `frame` events; `finish` yields the trailing frames plus exactly one `end`, then resets the session |
| `voices()` | list of voice ids | every id is accepted by `new_session` |

## Events

`frame` (mono 16-bit PCM, base64, 80 ms at the session sample rate) and `end` (utterance closed, total `durationMs`). No other events.

## Errors (closed set)

- `InvalidRequest`: speak request failed schema validation. No session is created.
- `UnknownVoice`: voice id is not one the loaded engine can speak. No session is created.

## Dependencies

None (no other layer contracts). Pairs with `gb-llm` by feeding its `token` events straight into `push_text`.

## Invariants

- Audio only ever crosses this boundary as the schema-validated JSON envelope; never bare byte streams (fail closed).
- Frames are emitted at 12.5 Hz (80 ms each, the Mimi codec frame rate); only the trailing frame from `finish` may be shorter.
- Audio for a word is released as soon as that word closes, so a caller streaming an LLM gets audio before the sentence exists.
- `finish` always emits exactly one `end` event and resets to a fresh utterance.
- Current engine is a deterministic stand-in (silence, timed from the text); replacing it with Kyutai Pocket TTS (DSM streaming) is a `src/`-only change behind the same push_text/finish surface, and `voices()` then reports the loaded checkpoint's voices.

## How to modify this blackbox safely

Keep `new_session()` / `push_text` / `finish` / `voices()` as the whole boundary. Additive changes (new optional request field, new event field) bump the minor contractVersion. Real-engine swap must keep every emitted event valid against `schema/audio-event.json`. Run `cargo test -p gb-tts`; update this file and `schema/` in the same change.
