import { basename } from "node:path";
import type { SourceMedia } from "@vijual-bake-studio/project-model";
import { MediaProbeError, MissingDependencyError } from "./errors";

type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type ProbeOptions = {
  execCommand?: (
    command: string,
    args: string[],
  ) => Promise<ExecResult>;
};

type FfprobeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  nb_frames?: string;
  pix_fmt?: string;
};

type FfprobeFormat = {
  duration?: string;
  tags?: Record<string, string>;
};

type FfprobePayload = {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
};

export async function probeSourceMedia(
  path: string,
  options: ProbeOptions = {},
): Promise<SourceMedia> {
  const execCommand = options.execCommand ?? defaultExecCommand;

  let result: ExecResult;
  try {
    result = await execCommand("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      path,
    ]);
  } catch (error) {
    if (isMissingBinaryError(error)) {
      throw new MissingDependencyError(
        "ffprobe",
        "ffprobe is required to probe source media. Install FFmpeg or bundle ffprobe with the app.",
      );
    }

    throw error;
  }

  if (result.exitCode !== 0) {
    throw new MediaProbeError(result.stderr.trim() || "ffprobe failed to inspect the media.");
  }

  let payload: FfprobePayload;
  try {
    payload = JSON.parse(result.stdout) as FfprobePayload;
  } catch {
    throw new MediaProbeError("ffprobe returned invalid JSON.");
  }

  const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");

  if (!videoStream) {
    throw new MediaProbeError("No video stream found in the source media.");
  }

  const fpsNominal = parseFrameRate(videoStream.avg_frame_rate ?? videoStream.r_frame_rate);
  const durationMs = parseDurationMs(payload.format?.duration);
  const width = videoStream.width ?? 0;
  const height = videoStream.height ?? 0;

  if (!fpsNominal || !Number.isFinite(fpsNominal) || fpsNominal <= 0) {
    throw new MediaProbeError("Could not determine nominal FPS from ffprobe output.");
  }

  if (!durationMs || width < 1 || height < 1) {
    throw new MediaProbeError("ffprobe did not provide valid duration or dimensions.");
  }

  const explicitFrameCount = Number(videoStream.nb_frames);
  const frameCount =
    Number.isFinite(explicitFrameCount) && explicitFrameCount > 0
      ? explicitFrameCount
      : Math.max(1, Math.round((durationMs / 1000) * fpsNominal));

  return {
    path,
    fileName: basename(path),
    durationMs,
    width,
    height,
    fpsNominal,
    frameCount,
    colorSpace: payload.format?.tags?.["com.apple.quicktime.color-primaries"],
    hasAlpha: inferAlpha(videoStream.pix_fmt),
    audioEmbedded: payload.streams?.some((stream) => stream.codec_type === "audio") ?? false,
  };
}

async function defaultExecCommand(command: string, args: string[]): Promise<ExecResult> {
  const { spawn } = await import("node:child_process");

  return await new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (exitCode: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      });
    });
  });
}

function parseFrameRate(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  if (!value.includes("/")) {
    return Number(value);
  }

  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function parseDurationMs(value: string | undefined): number {
  const durationSeconds = Number(value);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  return Math.round(durationSeconds * 1000);
}

function inferAlpha(pixelFormat: string | undefined): boolean {
  if (!pixelFormat) {
    return false;
  }

  return /rgba|bgra|yuva|argb|abgr|gbrap/i.test(pixelFormat);
}

function isMissingBinaryError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT",
  );
}
