# game-box

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
| TTS | Kokoro-82M via sherpa-onnx (Apache 2.0) | sentence-chunk streaming, sub-1s first audio; piper-plus (MIT) fallback for weak CPUs |
| VAD | Silero VAD (MIT) | voice endpointing |
| Models | downloaded on first run | never bundled in the game install |

Everything in the default stack is commercially shippable (Apache 2.0 / MIT / OpenMDW-1.1). The known trap is Kokoro's default eSpeak-NG phonemizer, which is GPL; the shipping path uses sherpa-onnx's own Apache 2.0 front end instead.

## Status

Research and architecture decisions are done; no code yet. [docs/DECISIONS.md](docs/DECISIONS.md) has the full decision record: why each piece won, what was rejected and why, and the open risks (Chrome's Local Network Access prompt for browser games, Vulkan driver quirks, Steam's live-AI disclosure, Nemotron's one-month-old tooling).
