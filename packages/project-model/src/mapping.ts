import type { TargetFps } from "./project";

export type FrameMapping = {
  sourceFps: number;
  targetFps: number;
  sourceToBakedFrame: (sourceFrame: number) => number;
  bakedToSourceFrame: (bakedFrame: number) => number;
  sourceFrameToTimeMs: (sourceFrame: number) => number;
  bakedFrameToTimeMs: (bakedFrame: number) => number;
};

export function createFrameMapping(sourceFps: number, targetFps: number): FrameMapping {
  const ratio = targetFps / sourceFps;

  return {
    sourceFps,
    targetFps,
    sourceToBakedFrame(sourceFrame) {
      return Math.round(sourceFrame * ratio);
    },
    bakedToSourceFrame(bakedFrame) {
      return Math.round(bakedFrame / ratio);
    },
    sourceFrameToTimeMs(sourceFrame) {
      return Math.round((sourceFrame / sourceFps) * 1000);
    },
    bakedFrameToTimeMs(bakedFrame) {
      return Math.round((bakedFrame / targetFps) * 1000);
    },
  };
}

export function resolveTargetFps(sourceFps: number, targetFps: TargetFps): number {
  if (targetFps !== "auto") {
    return targetFps;
  }

  return sourceFps > 60 ? 120 : 120;
}
