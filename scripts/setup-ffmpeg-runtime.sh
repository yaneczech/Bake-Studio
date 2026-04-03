#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/apps/studio/src-tauri/resources/ffmpeg"

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-ffmpeg-runtime.sh [--ffmpeg /path/to/ffmpeg] [--ffprobe /path/to/ffprobe]

Copies ffmpeg and ffprobe into passive runtime asset files used by Vijual Bake Studio:
  apps/studio/src-tauri/resources/ffmpeg

Resolution order when explicit paths are not provided:
1. existing binaries on PATH
2. Homebrew ffmpeg prefix

Examples:
  scripts/setup-ffmpeg-runtime.sh
  scripts/setup-ffmpeg-runtime.sh --ffmpeg /opt/homebrew/bin/ffmpeg --ffprobe /opt/homebrew/bin/ffprobe
EOF
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

FFMPEG_PATH=""
FFPROBE_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ffmpeg)
      [[ $# -ge 2 ]] || fail "--ffmpeg requires a path"
      FFMPEG_PATH="$2"
      shift 2
      ;;
    --ffprobe)
      [[ $# -ge 2 ]] || fail "--ffprobe requires a path"
      FFPROBE_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

resolve_from_path() {
  local binary_name="$1"
  if command -v "$binary_name" >/dev/null 2>&1; then
    command -v "$binary_name"
    return 0
  fi
  return 1
}

resolve_from_homebrew() {
  local binary_name="$1"
  if ! command -v brew >/dev/null 2>&1; then
    return 1
  fi

  local prefix
  if ! prefix="$(brew --prefix ffmpeg 2>/dev/null)"; then
    return 1
  fi

  local candidate="$prefix/bin/$binary_name"
  [[ -x "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}

resolve_binary() {
  local provided_path="$1"
  local binary_name="$2"

  if [[ -n "$provided_path" ]]; then
    [[ -x "$provided_path" ]] || fail "$binary_name path is not executable: $provided_path"
    printf '%s\n' "$provided_path"
    return 0
  fi

  if resolve_from_path "$binary_name" >/dev/null 2>&1; then
    resolve_from_path "$binary_name"
    return 0
  fi

  if resolve_from_homebrew "$binary_name" >/dev/null 2>&1; then
    resolve_from_homebrew "$binary_name"
    return 0
  fi

  fail "could not resolve $binary_name. Install FFmpeg, put it on PATH, or pass --$binary_name /absolute/path"
}

copy_binary() {
  local source_path="$1"
  local target_name="$2"
  local target_path="$TARGET_DIR/$target_name"

  cp "$source_path" "$target_path"
  chmod 644 "$target_path"
  log "Copied $source_path -> $target_path"
}

mkdir -p "$TARGET_DIR"

FFMPEG_RESOLVED="$(resolve_binary "$FFMPEG_PATH" "ffmpeg")"
FFPROBE_RESOLVED="$(resolve_binary "$FFPROBE_PATH" "ffprobe")"

rm -f "$TARGET_DIR/ffmpeg" "$TARGET_DIR/ffprobe" "$TARGET_DIR/ffmpeg.exe" "$TARGET_DIR/ffprobe.exe"

copy_binary "$FFMPEG_RESOLVED" "ffmpeg.bin"
copy_binary "$FFPROBE_RESOLVED" "ffprobe.bin"

log ""
log "Runtime binaries are ready."
log "You can now run:"
log "  npm run dev"
