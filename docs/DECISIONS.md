# game-box decision record (2026-07-20)

Decisions locked after a four-track research pass (TTS, STT, tiny LLMs + runtime, integration architecture), each track done against July 2026 sources with an adversarial verification step. The full findings with sources live in the local research store; this file keeps the conclusions the project is built on.

## D1. Delivery shape: loopback sidecar with an OpenAI-compatible API

game-box ships as one sidecar process bound to 127.0.0.1 that exposes:

- `POST /v1/chat/completions` with SSE streaming (NPC dialogue, agents)
- `POST /v1/audio/speech` (one-shot TTS)
- `/v1/realtime` WebSocket carrying PCM chunks, mirroring the OpenAI Realtime shape (streaming voice in and out)

Why: this is the shape the whole local ecosystem converged on (llama-server, Ollama, KoboldCpp, LM Studio, LocalAI). Any engine that can do HTTP integrates for free, existing OpenAI SDKs work unchanged, and an inference crash or VRAM OOM cannot take the game down. Precedent for the pattern: LLMUnity ships embedded-by-default plus an HTTP remote mode; NobodyWho ships embedded per-engine bindings. We invert their default: sidecar first, native C-API embed later as an opt-in for latency-critical or single-binary titles.

Rejected: in-process embedding as primary (per-engine native binaries, no crash isolation), custom API surface (throws away free SDK interop), WebTransport (not production-ready in 2026).

## D2. LLM runtime: llama.cpp, Vulkan build (Metal on Apple)

The "llama.cpp Vulkan bundle" hypothesis was confirmed: llama.cpp's own releases ship ONE unified Vulkan binary per OS/arch that covers NVIDIA, AMD and Intel, discrete and integrated. Benchmarks (April 2026 scoreboard, FOSDEM 2026 talk): Vulkan is roughly 75-90% of CUDA on prompt processing and par or better on token generation, and generation speed is what NPC dialogue feels. `GGML_BACKEND_DL` allows shipping several backends and picking at runtime. Apple gets the native Metal build (MoltenVK is a translation layer with overhead). Browser games get a WebGPU fallback (WebLLM, OpenAI-API-compatible) in a later phase.

Known risk: Vulkan correctness is driver-sensitive (documented 2026 regressions on specific GPU/driver combos), so the box needs per-target validation and an automatic CPU fallback.

Rejected as base runtime: Ollama (daemon wrapper over llama.cpp, adds moving parts), candle (no cross-vendor Vulkan), ONNX Runtime GenAI for the LLM (DirectML is Windows-only), mistral.rs (viable, smaller ecosystem; keep an eye on it).

## D3. Default LLM: Qwen3-4B, with smaller tiers

- Default: Qwen3-4B, Apache 2.0, ~2.5 GB at Q4, 128K context, native tool calling, fits a 4 GB GPU.
- Mid tier: Qwen3-1.7B or Gemma 4 E2B; also SmolLM3-3B (Apache 2.0).
- CPU-only floor: Qwen3-0.6B (~1 GB) or LFM2 (fastest on CPU, but its license gates commercial use above $10M revenue, so it is optional, not default).
- Alternative default: Gemma 4 E4B (Apache 2.0 since April 2026, native audio-in, phone-capable).

Rejected: Llama 3.2 (Community License: MAU cap, competitor restriction, output-training ban), Gemma 3 (superseded by Gemma 4's Apache 2.0).

Expectation setting from the research: 4B is the quality floor for convincing free dialogue; 1-2B works with tight prompting and tool calls; long-form roleplay consistency really wants 7-12B, which stays out of scope for the default tier. Thinking modes stay off for latency.

## D4. STT: sherpa-onnx running Nemotron-3.5-ASR-Streaming-0.6B

Primary: NVIDIA Nemotron-3.5-ASR-Streaming-0.6B (June 2026): true cache-aware streaming with selectable 80-1120 ms chunks, 40 language-locales from one 600M checkpoint, real-time on CPU (RTFx > 6), int4 build ~0.67 GB, OpenMDW-1.1 permissive license. Runs in sherpa-onnx (Apache 2.0 runtime, C/C++/Rust bindings, CPU everywhere plus CUDA/DirectML).

Fallbacks: sherpa-onnx streaming Zipformer (most battle-tested, real-time down to Cortex-A7), Moonshine v2 (MIT, English only, ~107 ms), Parakeet-TDT-0.6b-v3 for push-to-talk accuracy (CC-BY-4.0, needs visible credit). Endpointing: Silero VAD (MIT).

Rejected: faster-whisper/CTranslate2 (CUDA+CPU only, Python-first), Whisper/whisper.cpp as primary STT (sliding-window pseudo-streaming, hallucinates on silence), Moonshine non-English (non-commercial license).

Known risk: Nemotron-3.5 is a month old; weak on German/Chinese, sherpa-onnx support is greedy-search only. The Zipformer fallback stays wired in until it matures.

## D5. TTS: sherpa-onnx running Kokoro-82M

Primary: Kokoro-82M (Apache 2.0 weights, ~330 MB, best naturalness per megabyte, 8 languages). Streaming is sentence-chunk pipelining (Kokoro is non-autoregressive): feed clauses, play as they render, first audio in well under a second on capable hardware.

The one trap: Kokoro's default eSpeak-NG phonemizer is GPL and would contaminate a closed-source game if statically linked. sherpa-onnx's own Apache 2.0 front end replaces it; that is the shipping path.

Fallbacks and options: piper-plus (fully MIT fork with streaming and its own G2P) for guaranteed real-time on weak CPUs; ZipVoice (Apache 2.0, in sherpa-onnx) if voice cloning is requested; Chatterbox (MIT) only for the future GPU-guaranteed quality tier.

Rejected: XTTS-v2 and F5-TTS (non-commercial licenses), Qwen3-TTS (CUDA-only), Orpheus/CSM as default (8-12 GB VRAM class). Independent benchmark note (Picovoice): Piper is measurably faster than Kokoro on CPU, so the box should pick per-machine.

## D6. Distribution and policy

- Models are downloaded on first run with resume, never bundled in the game install (the ecosystem convention: Ollama, LM Studio, LLMUnity's Download-on-Build).
- One model instance shared across all NPCs, preloaded during a loading screen (NobodyWho's explicit warning against per-NPC loading).
- Steam allows live on-device generation but requires the live-AI disclosure (Valve, January 2026 framework): the box must document its guardrails and content filtering as a first-class feature so games can fill in the disclosure.
- Browser games hitting the sidecar trigger Chrome's Local Network Access permission prompt (Chrome 142+, WebSockets since 147); the in-browser WebGPU fallback exists because of this.

## Planned layer layout (contract-isolated blackboxes)

Each subsystem will be one folder with CONTRACT.md, schema/, src/, tests/; outsiders read only contracts and schemas. Planned layers: `api` (the public OpenAI-compatible surface), `llm` (llama.cpp wrapper), `stt` (sherpa-onnx streaming recognizer), `tts` (sherpa-onnx synthesizer + chunker), `models` (download, verify, cache), plus `docs/INDEX.md` as the resolver. Voice data crosses contracts as schema-validated envelopes (PCM by reference or base64 chunk), never bare byte streams.
