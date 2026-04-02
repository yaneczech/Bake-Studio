export type BakeJobStage =
  | "idle"
  | "probing"
  | "proxying"
  | "interpolating"
  | "encoding"
  | "packaging"
  | "done"
  | "failed";

export type BakeJobState = {
  stage: BakeJobStage;
  detail?: string;
  progress?: number;
};

export function createInitialBakeJobState(): BakeJobState {
  return {
    stage: "idle",
    progress: 0,
  };
}
