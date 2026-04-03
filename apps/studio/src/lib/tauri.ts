import { invoke } from "@tauri-apps/api/core";
import type { SourceMedia } from "@vijual-bake-studio/project-model";

export async function probeSourceMediaViaTauri(path: string): Promise<SourceMedia> {
  const media = await invoke<SourceMedia & {
    colorSpace?: string | null;
    hasAlpha?: boolean | null;
    audioEmbedded?: boolean | null;
  }>("probe_source_media", { path });

  return {
    ...media,
    colorSpace: media.colorSpace ?? undefined,
    hasAlpha: media.hasAlpha ?? undefined,
    audioEmbedded: media.audioEmbedded ?? undefined,
  };
}

export async function renderSourceFramePreviewViaTauri(
  path: string,
  frame: number,
  maxWidth = 960,
): Promise<{ dataUrl: string; frame: number }> {
  return invoke<{ dataUrl: string; frame: number }>("render_source_frame_preview", {
    path,
    frame,
    maxWidth,
  });
}
