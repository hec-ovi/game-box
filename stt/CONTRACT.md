# gb-stt contract

contractVersion: 0.1.0

## Purpose

Turn a stream of audio chunks into streaming partial transcripts and a final transcript.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `chunk` (per `Session::push`) | [schema/audio-chunk.json](schema/audio-chunk.json) | mono 16-bit PCM, base64 in a JSON envelope; sampleRate 8000-48000; even byte count |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| transcript events (from `push` and `finish`) | [schema/transcript-event.json](schema/transcript-event.json) | `push` yields `partial` events; `finish` yields exactly one `final` event and resets the session |

## Events

`partial` (revisable text while audio arrives) and `final` (utterance closed). No other events.

## Errors (closed set)

- `InvalidChunk`: envelope failed schema validation, base64 was undecodable, or byte count was odd. Session state is unchanged.

## Dependencies

None (no other layer contracts).

## Invariants

- Audio only ever crosses this boundary as the schema-validated JSON envelope; never bare byte streams (fail closed).
- An invalid chunk never mutates the session.
- `finish` always emits exactly one `final` event and resets to a fresh utterance.
- Current engine is a deterministic stand-in (reports heard duration); replacing it with a real recognizer (sherpa-onnx Nemotron/Zipformer) is a `src/`-only change behind the same push/finish surface.

## How to modify this blackbox safely

Keep `new_session()` / `push` / `finish` as the whole boundary. Additive changes (new optional envelope field, new event field) bump the minor contractVersion. Real-engine swap must keep every emitted event valid against `schema/transcript-event.json`. Run `cargo test -p gb-stt`; update this file and `schema/` in the same change.
