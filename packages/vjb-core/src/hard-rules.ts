import type { VjbManifest } from "./manifest";

export type HardRuleReport = {
  valid: boolean;
  errors: string[];
};

export function createManifestHardRuleReport(manifest: VjbManifest): HardRuleReport {
  const errors: string[] = [];
  const markerIds = new Set<string>();
  const markerIndices = new Set<number>();
  const markerMap = new Map(manifest.markers.map((marker) => [marker.id, marker]));

  if (!isArchiveRelativePath(manifest.media.primaryVideo.path)) {
    errors.push("media.primaryVideo.path must stay archive-relative and normalized.");
  }

  if (Number(manifest.transport.defaultDirection) === 0) {
    errors.push("transport.defaultDirection must not be 0.");
  }

  for (const marker of manifest.markers) {
    if (markerIds.has(marker.id)) {
      errors.push(`Duplicate marker id: ${marker.id}`);
    }
    markerIds.add(marker.id);

    if (markerIndices.has(marker.index)) {
      errors.push(`Duplicate marker index: ${marker.index}`);
    }
    markerIndices.add(marker.index);

    if (marker.frame < 0 || marker.frame >= manifest.media.primaryVideo.frameCount) {
      errors.push(`Marker ${marker.id} frame is out of baked media bounds.`);
    }

    if (marker.state?.direction !== undefined && Number(marker.state.direction) === 0) {
      errors.push(`Marker ${marker.id} direction must not be 0.`);
    }

    if (marker.segmentEndMarkerId) {
      const endMarker = markerMap.get(marker.segmentEndMarkerId);

      if (!endMarker) {
        errors.push(`Marker ${marker.id} references missing segmentEndMarkerId.`);
      } else if (endMarker.id === marker.id) {
        errors.push(`Marker ${marker.id} segmentEndMarkerId must not reference itself.`);
      } else if (endMarker.frame < marker.frame) {
        errors.push(`Marker ${marker.id} segment end cannot be earlier than start.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isArchiveRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("//") &&
    !value.split("/").some((part) => part === "." || part === ".." || part.length === 0)
  );
}
