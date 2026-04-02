import {
  createFrameMapping,
  resolveTargetFps,
  type BakeProject,
  type Direction,
  type MarkerMode,
  type TransportDefaults,
} from "@vijual-bake-studio/project-model";

export type VjbManifest = {
  schema: "com.vjb.bundle";
  schemaVersion: "1.0.0";
  bundleId: string;
  createdAt?: string;
  title: string;
  description?: string;
  source: {
    fileName: string;
    durationMs: number;
    width: number;
    height: number;
    fpsNominal: number;
    frameCount: number;
    colorSpace?: string;
    hasAlpha?: boolean;
    audioEmbedded?: boolean;
  };
  bake: {
    targetFps: number;
    interpolationFactor?: number;
    upscaleApplied?: boolean;
    upscaleFactor?: number;
    aiEngine?: {
      id: string;
      version: string;
      model: string;
      precision?: string;
    };
  };
  media: {
    primaryVideo: {
      path: string;
      container: "mov";
      codec: "hap_q" | "prores_422" | "prores_4444";
      width: number;
      height: number;
      fps: number;
      frameCount: number;
      durationMs: number;
      alpha?: boolean;
    };
  };
  transport: TransportDefaults;
  markers: Array<{
    id: string;
    index: number;
    label?: string;
    color?: string;
    frame: number;
    timeMs?: number;
    segmentEndMarkerId?: string;
    state?: {
      mode?: MarkerMode;
      direction?: Direction;
      speed?: number;
      easing?: string;
    };
  }>;
};

export type BakedMediaDescriptor = {
  path: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  durationMs: number;
  codec: "hap_q" | "prores_422" | "prores_4444";
  alpha: boolean;
};

export function projectToVjbManifest(
  project: BakeProject,
  bakedMedia: BakedMediaDescriptor,
): VjbManifest {
  const targetFps = resolveTargetFps(project.source.fpsNominal, project.bake.targetFps);
  const mapping = createFrameMapping(project.source.fpsNominal, targetFps);

  return {
    schema: "com.vjb.bundle",
    schemaVersion: "1.0.0",
    bundleId: project.id,
    createdAt: project.updatedAt,
    title: project.title,
    description: project.description,
    source: {
      fileName: project.source.fileName,
      durationMs: project.source.durationMs,
      width: project.source.width,
      height: project.source.height,
      fpsNominal: project.source.fpsNominal,
      frameCount: project.source.frameCount,
      colorSpace: project.source.colorSpace,
      hasAlpha: project.source.hasAlpha,
      audioEmbedded: project.source.audioEmbedded,
    },
    bake: {
      targetFps,
      interpolationFactor: targetFps / project.source.fpsNominal,
      upscaleApplied: project.bake.upscale.enabled,
      upscaleFactor: project.bake.upscale.factor,
      aiEngine: {
        id: project.bake.aiEngine.id,
        version: project.bake.aiEngine.version ?? "unknown",
        model: project.bake.aiEngine.model,
        precision: project.bake.aiEngine.precision,
      },
    },
    media: {
      primaryVideo: {
        path: bakedMedia.path,
        container: "mov",
        codec: bakedMedia.codec,
        width: bakedMedia.width,
        height: bakedMedia.height,
        fps: bakedMedia.fps,
        frameCount: bakedMedia.frameCount,
        durationMs: bakedMedia.durationMs,
        alpha: bakedMedia.alpha,
      },
    },
    transport: project.transport,
    markers: project.markers.map((marker) => {
      const frame = mapping.sourceToBakedFrame(marker.sourceFrame);

      return {
        id: marker.id,
        index: marker.index,
        label: marker.label,
        color: marker.color,
        frame,
        timeMs: mapping.bakedFrameToTimeMs(frame),
        segmentEndMarkerId: marker.segmentEndMarkerId,
        state: marker.state,
      };
    }),
  };
}
