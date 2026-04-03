# Vijual Bake Studio

<img src="src/vbs-logo.png" alt="Vijual Bake Studio logo" width="250" />

Vijual Bake Studio is an authoring tool for VJs and visual artists who need the fluidity of AI-interpolated motion with the precision of a rhythmic sampler. It prepares raw footage for live playback by baking it into `.vjb` bundles with high-FPS media, marker transport metadata, and deterministic playback behavior.

The goal is simple: do the expensive temporal work ahead of time, then perform with media that can jump, freeze, reverse, loop, and hit exact moments without falling apart under pressure.

## Why Vijual Bake Studio

Standard video players are not designed for aggressive rhythmic seeking, reverse traversal, or repeated segment jumps at club tempo. Vijual Bake Studio solves that by precomputing temporal motion and exporting a playback-oriented bundle instead of a generic video file.

- Temporal super-resolution: turn 30 FPS footage into 120 or 240 FPS using RIFE v4.x
- Zero-latency teleporting: prepare media for codecs and containers suited to realtime playback
- Smart indexing: define markers with entry behavior such as mode, direction, speed, and easing
- Hardware-aware baking: prefer `fp16` paths on Apple Silicon and modern GPUs where available

## Core Concepts

### Source vs Baked Timeline

Vijual Bake Studio works with two frame spaces:

- `source frame space`: the original clip where the user places markers
- `baked frame space`: the interpolated export that becomes the authoritative playback timeline

This matters because VJB playback uses baked timing as the source of truth. Internally, Vijual Bake Studio authors markers in source space and rewrites them during export so that `markers[].frame` matches `media.primaryVideo.frameCount` and `media.primaryVideo.fps`.

### The `.vjb` Bundle

A VJB bundle is a ZIP-based package built around:

- `manifest.json` at archive root
- `media/master.mov` or equivalent primary playback media
- optional thumbnails, proxies, analysis, and extension assets

Vijual Bake Studio targets the public VJB spec from [`yaneczech/vjb-format`](https://github.com/yaneczech/vjb-format).

## Core Features

### The Engine

- AI interpolation via `rife-ncnn-vulkan`
- Optional Real-ESRGAN upscale before interpolation
- Export targets:
- `HAP Q` for broad realtime playback workflows
- `ProRes 422` and `ProRes 4444` for Apple-centric and alpha-preserving workflows
- Manifest generation with authoritative playback timing and `media.primaryVideo.alpha`

### The Authoring UI

- Timeline scrubbing with marker placement
- Marker inspector for per-marker behavior
- Keyboard hotkeys `1-9` for fast index dropping
- Rhythm-oriented workflow for beat-driven loop authoring

### Playback Intent

Each marker can carry entry state such as:

- `mode`
- `direction`
- `speed`
- `easing`

That gives the playback tool enough information to jump into a segment with defined transport intent, while still allowing runtime overrides in performance software.

### Marker Roles

Vijual Bake Studio is being prepared for a VJB marker model with explicit marker roles:

- `cue`: a playback entry marker that can define segment behavior
- `quantize`: a timing reference marker for snapping, sync, or quantized jumps

The intended VJB-compatible direction is:

- `roles` is an optional marker field
- missing `roles` defaults to `["cue"]` for backward compatibility
- only markers with the `cue` role participate in implicit segment resolution
- `quantize` markers do not implicitly terminate or start playback segments

In the Bake Studio editor, this will map to separate authoring modes such as `Cue` and `Quantize`. If a user wants both meanings on the same frame, the editor may create two markers on the same source frame instead of forcing a hybrid marker UI.

## Architecture

The repo is structured as a desktop workspace:

- `apps/studio`: Tauri 2 + SolidJS desktop app
- `packages/project-model`: internal authoring model and source-to-baked frame mapping
- `packages/vjb-core`: VJB manifest types, export conversion, and hard-rule validation
- `packages/media-pipeline`: bake job orchestration for probe, interpolate, encode, and package steps
- `packages/shared`: shared utility types

The important boundary is:

- authoring data lives in the Vijual Bake Studio project model
- export data lives in the VJB manifest model
- conversion between them is explicit and deterministic

## Status

This repository is currently an early scaffold. The current implementation includes:

- Tauri + SolidJS workspace setup
- initial Vijual Bake Studio project model
- source-to-baked frame mapping utilities
- VJB manifest conversion
- VJB hard-rule validation stubs

Planned next steps:

- schema-based manifest validation against `vjb-format`
- media probe and ingest pipeline
- proxy and thumbnail generation
- interpolation and encode pipeline
- timeline and marker editing UI

## Development

Requirements:

- Node.js 22+
- Rust toolchain
- Tauri prerequisites for your platform

Install and run:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run build
cd apps/studio/src-tauri && cargo check
```

### FFmpeg Runtime

For development or packaging, Vijual Bake Studio can resolve `ffmpeg` and `ffprobe` in this order:

1. explicit env vars:
   - `VIJUAL_BAKE_STUDIO_FFMPEG_PATH`
   - `VIJUAL_BAKE_STUDIO_FFPROBE_PATH`
2. repo-local bundled binaries in [apps/studio/src-tauri/resources/ffmpeg](/Users/janjanecek/Documents/GitHub/VJB/Bake%20Studio/apps/studio/src-tauri/resources/ffmpeg)
3. packaged app resources
4. system-installed binaries on `PATH`

To avoid depending on Homebrew or a system install during development, place binaries here:

- `apps/studio/src-tauri/resources/ffmpeg/ffmpeg.bin`
- `apps/studio/src-tauri/resources/ffmpeg/ffprobe.bin`

On Windows use `.exe.bin` filenames instead.

Helper script:

```bash
scripts/setup-ffmpeg-runtime.sh
```

Or with explicit paths:

```bash
scripts/setup-ffmpeg-runtime.sh \
  --ffmpeg /absolute/path/to/ffmpeg \
  --ffprobe /absolute/path/to/ffprobe
```

## Format Notes

Vijual Bake Studio follows the VJB rules that matter most for playback interoperability:

- `manifest.json` is the root manifest file
- `media.primaryVideo.path` must stay archive-relative
- `media.primaryVideo.frameCount` and `media.primaryVideo.fps` are authoritative
- exported marker `frame` values are written in baked frame space
- `media.primaryVideo.alpha` is the authoritative playback alpha flag

Planned VJB format evolution for marker semantics:

- markers should move toward an optional `roles` array instead of a single marker kind
- the compatibility default should remain `["cue"]`
- `quantize` should be explicit, never the implicit default

## Community

Vijual Bake Studio is being developed as part of the wider VJB tooling family.

Areas where feedback is especially useful:

- live VJ playback workflows
- marker ergonomics and beat indexing
- codec and container interoperability
- Apple Silicon and Vulkan bake performance

## License

Vijual Bake Studio is distributed under the `Vijual Bake Studio Free Use No-Resale License 1.0`.

In practical terms:

- you may use the software for free, including for commercial work and profit-generating output
- you may modify and share it
- you may not sell the software itself or resell copies of it to third parties
- you may charge for services performed with it, as long as the software itself remains free

This is a source-available license, not an OSI open-source license.

See also: [LICENSE-FAQ.md](/Users/janjanecek/Documents/GitHub/VJB/Bake%20Studio/LICENSE-FAQ.md)

Developed by Jan Janeček.
