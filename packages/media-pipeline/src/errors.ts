export class MissingDependencyError extends Error {
  constructor(public readonly dependencyName: string, message?: string) {
    super(message ?? `Missing required dependency: ${dependencyName}`);
    this.name = "MissingDependencyError";
  }
}

export class MediaProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaProbeError";
  }
}
