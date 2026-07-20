# game-box

> **Under construction. This is an idea, not a usable product.** What exists so far is research, the architecture decisions below, and a skeleton API with stand-in engines so the surface can be tested. No real model runs inside the box yet. Everything here can still change.

Offline AI sidecar for games. It runs a tiny local LLM plus speech-to-text and text-to-speech on the player's machine, behind an OpenAI-compatible localhost API, so any game (Electron, web, Rust, C++, Unity, Godot) can have talking, listening, LLM-driven NPCs without cloud calls or per-token costs.

## Shape

One sidecar process bound to 127.0.0.1. The game talks to it over HTTP and WebSocket:

- `POST /v1/chat/completions` (SSE streaming) for NPC dialogue and agent calls
- `POST /v1/audio/speech` for one-shot TTS
- `/v1/realtime` WebSocket for streaming voice both ways (PCM chunks, OpenAI Realtime shape)

Mirroring the OpenAI surface means existing SDKs work unchanged, and running out of process means an inference crash or VRAM OOM cannot take the game down. A native C-API embed path and an in-browser WebGPU fallback are planned as secondary options.

## Stack (decided 2026-07-20)

| Piece | Pick | Notes |
|---|---|---|
| LLM runtime | llama.cpp, Vulkan build | one binary per OS covers NVIDIA/AMD/Intel dGPU and iGPU; Metal on Apple; CPU fallback |
| LLM model | Qwen3-4B (Apache 2.0) | default tier; Qwen3-1.7B / 0.6B for weaker hardware |
| STT | Nemotron-3.5-ASR-Streaming-0.6B via sherpa-onnx | true streaming partials from 80 ms chunks, 40 locales, real-time on CPU; Zipformer fallback |
| TTS | Kyutai Pocket TTS 100M (MIT code, CC-BY-4.0 weights) | true streaming-text input (DSM): speaks while the LLM is still generating, ~200ms first audio, real-time on 2 CPU cores; Kyutai TTS 1.6B when a GPU exists; NeuTTS Air (Apache 2.0, GGUF) as sentence-chunked fallback |
| VAD | Silero VAD (MIT) | voice endpointing |
| Models | downloaded on first run | never bundled in the game install |

Everything in the decided stack is commercially shippable (Apache 2.0 / MIT / OpenMDW-1.1 / CC-BY-4.0 with attribution).

## Layout

A Rust workspace of contract-isolated layers; each folder is a blackbox with its own `CONTRACT.md`, JSON Schemas, and tests. Outsiders read contracts and schemas only, never `src/`. [docs/INDEX.md](docs/INDEX.md) maps "what you want to change" to the one folder to open.

- `api/` builds the `game-box` binary: loopback server with `/health`, `/v1/chat/completions` (SSE), `/v1/realtime` (WebSocket transcription)
- `llm/` text generation: deterministic stand-in by default; set `GAME_BOX_LLM_UPSTREAM` to an OpenAI-compatible server (e.g. llama-server) to proxy real inference
- `stt/` streaming recognition sessions (stand-in engine; sherpa-onnx Nemotron is the planned swap-in)
- `models/` model cache with sha256 integrity check (download-on-first-run comes next)

## Build and test

```
cargo test          # all contract + end-to-end tests (12)
cargo run -p gb-api # serves http://127.0.0.1:8976 (GAME_BOX_PORT to change)
```

## Status

Phase 1: the sidecar skeleton is real (loopback server, SSE chat streaming, WebSocket transcription events, schema-validated boundaries, model cache check) with stand-in engines behind the llm/stt contracts, so games can integrate against the final API shape today. Real engines (llama.cpp Vulkan, sherpa-onnx, Kyutai Pocket TTS) land behind the same contracts next. [docs/DECISIONS.md](docs/DECISIONS.md) has the decision record and open risks (Chrome's Local Network Access prompt for browser games, Vulkan driver quirks, Steam's live-AI disclosure, Nemotron's one-month-old tooling).
