import type { BakeProject } from "./project";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateBakeProject(project: BakeProject): ValidationResult {
  const errors: string[] = [];
  const markerIds = new Set<string>();
  const markerIndices = new Set<number>();

  if (!project.title.trim()) {
    errors.push("Project title is required.");
  }

  if (project.source.fpsNominal <= 0) {
    errors.push("Source FPS must be greater than zero.");
  }

  if (project.source.frameCount < 1) {
    errors.push("Source frame count must be at least 1.");
  }

  if (project.transport.defaultSpeed < 0) {
    errors.push("Transport default speed cannot be negative.");
  }

  for (const marker of project.markers) {
    if (markerIds.has(marker.id)) {
      errors.push(`Duplicate marker id: ${marker.id}`);
    }
    markerIds.add(marker.id);

    if (markerIndices.has(marker.index)) {
      errors.push(`Duplicate marker index: ${marker.index}`);
    }
    markerIndices.add(marker.index);

    if (marker.sourceFrame < 0 || marker.sourceFrame >= project.source.frameCount) {
      errors.push(`Marker ${marker.id} sourceFrame is out of source bounds.`);
    }

    if (marker.state.speed !== undefined && marker.state.speed < 0) {
      errors.push(`Marker ${marker.id} speed cannot be negative.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
