Technical Brief: Vijual Bake Studio (TS-1)

Version: 1.1 (April 2026)

Goal: Build an authoring tool for preparing AI-interpolated VJ loops in the open `.vjb` format.

1. Core System (The Engine)

The software acts as an orchestrator between user input, AI models, and video encoders.

A. AI interpolation module

- Implementation: RIFE v4.x integration via `rife-ncnn-vulkan`
- Features:
- `fp16` precision support with automatic enablement on Apple Silicon and RTX GPUs
- Target FPS selection: `auto`, `120`, `240`
- Optional upscale: Real-ESRGAN integration before interpolation

B. Video I/O and decoding

- Input: ProRes (`422`, `4444`, `Log`), `H.264`, `H.265`
- macOS: use VideoToolbox for hardware-accelerated ProRes decode
- Output (`The Bake`):
- Primary: `HAP Q` for Windows and universal playback
- Secondary: `ProRes 4444` for Mac and alpha workflows
- Authoritative write of `media.primaryVideo.alpha` into the manifest

2. Format Specification (`.vjb`)

Output must strictly follow the specification in the `vjb-format` repository.

- Metadata generator:
- automatic calculation of `source.durationMs`
- automatic calculation of `source.fpsNominal`
- automatic calculation of `source.frameCount`
- automatic calculation of `media.primaryVideo.alpha`
- Marker system:
- markers are written into the `markers` array
- each marker includes a `state` object with `mode`, `direction`, and `speed`
- `direction` in the exported manifest must never be `0`
- marker semantics should move toward an optional `roles` array such as `["cue"]` or `["quantize"]`
- if `roles` is absent, the compatibility default must be `["cue"]`
- `quantize` must always be explicit and must never become the implicit default
- Naming convention: consistent `camelCase` across the entire JSON manifest

3. Time Bases and Frame Transposition

Vijual Bake Studio operates with two frame spaces:

- `source frame space`: the original clip where the user authors markers
- `baked frame space`: the interpolated export written into `.vjb`

Normative implementation rules:

- the editor stores markers internally as `sourceFrame`
- the exporter converts markers into baked frame space using `targetFps / source.fpsNominal`
- the final `manifest.json` always writes `markers[].frame` in baked frame space
- `.vjb` marker validation runs against `media.primaryVideo.frameCount`
- one central rounding strategy must be used consistently in preview, export, and segment logic

4. UI/UX Architecture (The Studio)

The interface must be optimized for fast work with rhythmic material.

A. Timeline and scrubbing

- Filmstrip view: generate background thumbnails for the full timeline
- Rhythm grid: optional BPM-based grid for precise marker placement
- Hotkeys: keys `1-9` for immediate marker insertion at the playhead

B. Marker inspector

- Inspector panel for editing the selected marker:
- change frame numerically and by dragging
- set entry behavior through a `mode` menu
- interactive dial for `direction` with snap points at `-1.0` and `1.0`
- `0.0` may exist only as an internal UI intermediate state and must never be written to the exported manifest
- authoring workflow should support separate insertion modes for `Cue` and `Quantize`
- if the user needs both roles at the same source frame, prefer two colocated markers over an opaque hybrid marker type

C. Preview engine

- Smart proxy: show source video or proxy while scrubbing quickly
- AI preview: when playback stops on a frame, run a fast interpolation preview of the resulting smoothness

5. Workflow (User Journey)

- Import: the user drops in a ProRes Log video from an iPhone
- Enhance: optionally enables 4K upscale and applies basic color correction
- Index: reviews the video and places markers on key moments such as `m_hit` and `m_build`
- Define states: sets `direction: -1.0` and `mode: pingpong` on marker `m_reverse`
- Bake: starts the AI process and exports a `.vjb` bundle

6. Technical Stack

- Platforms: Windows 11 and native ARM64 macOS
- Desktop shell: Tauri 2
- Frontend: SolidJS + TypeScript
- Repository structure:
- `apps/studio`: Tauri + SolidJS application
- `packages/project-model`: internal authoring model and frame mapping
- `packages/vjb-core`: VJB manifest types, validation, and packaging
- `packages/media-pipeline`: ffprobe/ffmpeg/rife orchestration
- `packages/shared`: shared utilities and types
- Backend processing: FFmpeg binary including `libavcodec` for HAP and ProRes packaging

7. MVP Acceptance Criteria

- [ ] Successful loading of ProRes 422 video
- [ ] AI interpolation from 30 FPS to 120 FPS without application crash
- [ ] Export of a working `.vjb` bundle with a valid JSON manifest according to the specification
- [ ] Correct transposition of markers from source frame space to baked frame space
- [ ] Smooth timeline scrubbing without lag
- [ ] Clear distinction between playback cue markers and quantize-only timing markers

Developer note:

`media.primaryVideo.alpha` is the authoritative playback alpha flag. If the source has no alpha but the user requests an alpha-oriented export workflow, Vijual Bake Studio must either warn or automatically set the flag to `false` so the renderer and player do not waste work on an unnecessary alpha path.
