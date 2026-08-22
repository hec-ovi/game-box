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

## D5. TTS: Kyutai Pocket TTS 100M (DSM, true streaming-text input)

Decided 2026-07-20 after the requirement changed to true token/frame-level streaming (audio starts before the utterance text is complete; the engine can consume an LLM's token stream). The re-research found the field moved: this no longer needs a big GPU.

- Primary: **Kyutai Pocket TTS** (Jan 2026). 100M params (~100-160MB), Delayed-Streams-Modeling: a transformer coordinates the text stream and the Mimi-codec audio stream at 12.5 Hz, speaking word-by-word as text arrives. Real-time on 2 CPU cores (~6x RT on M4-class), ~200ms to first audio, voice cloning from ~5s, 27 voices, 6 languages. MIT code, CC-BY-4.0 weights (attribution required; individual voice licenses need auditing). CPU-only viability sidesteps the AMD/Intel GPU story entirely.
- Quality tier (GPU present): **Kyutai TTS 1.6B**, same DSM architecture, 220ms, EN/FR, better voices; Rust moshi-server is Apache 2.0.
- Fallback on the llama.cpp runtime: **NeuTTS Air** (748M, Apache 2.0 code AND weights, GGUF Q4 ~500MB, CPU real-time, 3s cloning). Partial fit only: it waits for a complete sentence before synthesizing (sentence-chunk pipelining), so it does not meet the sub-sentence requirement.

Known caveats, recorded honestly: Pocket's shipped Python API splits input into sentences; literal sub-sentence token input means driving the lower-level DSM streaming interface, and the community Rust/Candle port (pocket-tts-candle, "full-pipeline stateful streaming") or the C++ ONNX build are the non-Python paths, both to be validated. One user issue rates Pocket's prosody below Kokoro: the tiny footprint trades some naturalness. Candle has no Vulkan backend (CPU/CUDA/Metal only), which is acceptable because Pocket is CPU-real-time.

Rejected: VibeVoice-Realtime-0.5B (true text-streaming and MIT, but diffusion/Python/GPU with a 2025 repo-takedown history and use restrictions), OuteTTS 1.0 (CC-BY-NC-SA weights despite its clean llama.cpp any-vendor path), Voxtral TTS (CC-BY-NC, ~4B), Chatterbox Turbo (output-streaming only, GPU-bound), CosyVoice (no embeddable runtime), Orpheus small variants (still unshipped).

### Superseded record (chunk-pipelined era): sherpa-onnx running Kokoro-82M

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

Each subsystem will be one folder with CONTRACT.md, schema/, src/, tests/; outsiders read only contracts and schemas. Planned layers: `api` (the public OpenAI-compatible surface), `llm` (llama.cpp wrapper), `stt` (sherpa-onnx streaming recognizer), `tts` (streaming synthesizer: text tokens in, PCM frames out), `models` (download, verify, cache), plus `docs/INDEX.md` as the resolver. Voice data crosses contracts as schema-validated envelopes (PCM by reference or base64 chunk), never bare byte streams.

---

# game decision record (2026-08-22)

The game itself, decided after three research passes (quest-loop gameplay, engine and systems, art and animation), each verified against primary sources by a second pass that read the licence files and the repos rather than the blog posts.

## D7. Shape: quests first, contract-isolated boxes, browser three.js

The game is a first-person city where the loop is talk, travel, take, carry, deliver, get paid. Combat is not a pillar. The city, its interiors, its people and its quests are generated, exported as one file, and replayed identically by anyone who opens it.

Everything is cut into boxes with a CONTRACT.md, a published JSON Schema and a closed error set: `kit`, `world`, `play`, `quest`, `forge`, `bundle`, `nav`, `sidecar`, `scribe`, `talk`, `scene`, `app`, `cli`. Isolation is enforced, not documented: one public entry per box, and `pnpm run check:isolation` fails the build on a deep import or an undeclared dependency.

## D8. The model writes meaning, code writes geometry

Streets, plot footprints, entrances, rooms, furniture and anchors are arithmetic from a seeded stream. Names, personalities, what people know and quest logic come from the model. A narrator is never asked for a coordinate.

Every answer from the model is a **forced tool call** whose parameters are the JSON Schema of the contract that will validate it, so the thing that defines the shape and the thing that checks it are the same object. A rejected call is retried once with the exact violations quoted back, then falls through to a deterministic offline narrator, so generation always finishes. Quests are written one call at a time.

Nothing generated is trusted: a quest is refused unless every path ends, every reference resolves, and every item is guaranteed to be in hand before the player is asked for it.

## D9. Same seed, same city

One PRNG stream, forked per block, per site and per interior, so adding a building later cannot change one already built. `extend` fills empty land without moving anything. This is what makes "add three more houses" cheap and what makes a shared world file reproducible.

## D10. Renderer: three.js r185, WebGPU with a real WebGL2 path

`WebGPURenderer` from `three/webgpu`, TSL for shading, vanilla three.js for the scene graph, plain DOM for the HUD. WebGPU is where new capability lives and it carries a WebGL2 backend in the same class.

Known risk: WebGPU is about 86% coverage, Firefox on Linux has none at all, and this project is developed on Linux. The WebGL2 tier is a real path that renders a smaller city, not an uglier one, and a `forceWebGL` switch stays wired for A/B on the same build.

Rejected: react-three-fiber (its own guidance is to bypass React for per-frame work, which is all of this), Draco (its decoder is 344 KB against meshopt's 29 KB, and neither speeds up rendering).

## D11. Art direction: stylized low-poly from one hand

Incoherence is what reads as amateur, not polycount. Characters, clothes, animation and the city kit all come from Quaternius, all CC0, all on one skeleton.

- Bodies: Universal Base Characters. Clips: Universal Animation Library 1 and 2, which bind to that skeleton with no retargeting.
- City: Downtown City MegaKit for street level.
- Second clip source: KayKit Character Animations, CC0, retargeted.
- Interior dressing: Ultimate House Interior, Ultimate Furniture, Sushi Restaurant kits.

## D12. Only CC0 animation ships

A browser game serves `.glb` over HTTP and a shared world file is a redistribution vector by design, so "use it but do not redistribute the file" licences are unusable here whatever they cost.

Rejected for that reason alone: Adobe Mixamo (its own terms forbid free distribution of raw animation files), Fab and Unity Asset Store standard terms, MoCap Online and MoCap Central (both require distribution "in such a manner that prevents their extraction"), Ready Player Me, Epic's Game Animation Sample and MetaHuman (Unreal-only content).

Usable beyond CC0: 100STYLE under CC BY 4.0 with a modification notice, and CMU mocap, which permits commercial use but not resale of the data, so CMU-derived clips exist only as heavily retargeted derivatives merged into the shared clip file, never as extractable per-clip files.

The clip library ships with the runtime. A world file carries clip names, never clip data.

## D13. Buildings: our own generator, plus a kit at street level

Massing and facades come from `glb-buildings-skill` (MIT, ours): a building is a JSON document of floor bands that builds into validated glTF, with contact, support and triangle budget proved before a file exists. Roofs get a closed-form hip/gable/pyramidal pass with a mandatory eave overhang and fascia cap, because a roof that does not meet its wall is the classic generated-building failure. Windows get parallax interior mapping and a lit night mask, because black windows are the second one. Street level and shopfronts come from the Downtown kit.

Plots stay rectilinear, which removes any need for a straight-skeleton library and therefore any GPL exposure.

## D14. Scale contract

One unit is one metre, Y up. Grid cell 2 m. Roadway 6 m, pavement 2 m, kerb 15 cm. Ground floor 4 m, upper storeys 3.2 m, doors 2.1 m. Bar counter 1.1 m, table 0.75 m, stool 0.75 m: those three drive the sit, drink and serve clips, so they are fixed before any animation is bound. Eye height 1.7 m, walk 1.4 m/s, run 4.5 m/s, reach 2.5 m. Everything generated obeys these or is rejected at intake.

## D15. Navigation: the grid is the navmesh

Pedestrians walk an A* over the same cell grid the city was generated on, with pavement cheap and roadway expensive. Nothing is baked, so adding a building needs no rebuild. A navmesh runtime (navcat, or recast-navigation-js) is the answer for interiors and crowds when they need it, not before.

## D16. What a world file is

One sealed JSON document: the world, its quests, and the asset packs it needs, under a sha-256 of a stable serialisation. Opening one checks shape, then hash, then world soundness, then every quest, and refuses at the first failure. A save carries the world id and the same content hash, so a playthrough can only resume against the exact city it was made in. Static world data and playthrough state never mix.
