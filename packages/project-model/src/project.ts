export type MarkerMode = "once" | "loop" | "pingpong" | "hold";
export type Direction = -1 | 1;
export type TargetFps = 120 | 240 | "auto";

export type SourceMedia = {
  path: string;
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

export type BakePreset = {
  targetFps: TargetFps;
  upscale: {
    enabled: boolean;
    factor?: 2 | 4;
    model?: string;
  };
  output: {
    codec: "hap_q" | "prores_422" | "prores_4444";
    container: "mov";
  };
  aiEngine: {
    id: "rife-ncnn-vulkan";
    model: string;
    version?: string;
    precision?: "fp16" | "fp32";
  };
};

export type TransportDefaults = {
  defaultMode: MarkerMode;
  defaultDirection: Direction;
  defaultSpeed: number;
  seekMode: "frame-accurate";
  quantizeUnit?: "none" | "marker" | "beat" | "bar";
};

export type SourceMarker = {
  id: string;
  index: number;
  label?: string;
  color?: string;
  sourceFrame: number;
  sourceTimeMs?: number;
  segmentEndMarkerId?: string;
  state: {
    mode?: MarkerMode;
    direction?: Direction;
    speed?: number;
    easing?: string;
  };
};

export type RhythmGrid = {
  bpm?: number;
  beatsPerBar?: number;
  offsetMs?: number;
  enabled: boolean;
};

export type BakeStudioProject = {
  id: string;
  version: 1;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  source: SourceMedia;
  bake: BakePreset;
  transport: TransportDefaults;
  rhythmGrid?: RhythmGrid;
  markers: SourceMarker[];
};

export function createProject(
  input: Omit<BakeStudioProject, "id" | "version" | "createdAt" | "updatedAt">,
): BakeStudioProject {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  };
}
