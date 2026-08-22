# Resolver: what you want to change -> the one folder to open

| You want to change | Open |
|---|---|
| HTTP/WS endpoints, SSE shapes, OpenAI compatibility, error bodies | `api/` |
| Text generation, engine selection, llama.cpp/upstream wiring | `llm/` |
| Speech recognition, audio envelopes, partial transcripts | `stt/` |
| Speech synthesis, voices, streaming audio frames | `tts/` |
| Model cache, integrity check, (future) downloads | `models/` |
| Stack/architecture decisions and their rationale | `docs/DECISIONS.md` |

Rules of engagement: outsiders read a layer's `CONTRACT.md` + `schema/` only, never its `src/`. Cross-layer data is schema-validated JSON (fail closed); audio crosses as base64 PCM envelopes, never bare bytes. Every layer change updates that layer's contract/schemas in the same commit and passes `cargo test -p <crate>`.
