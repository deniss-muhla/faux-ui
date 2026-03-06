export type Size = {
  width: number;
  height: number;
};

export type Constraints = {
  maxWidth?: number;
  maxHeight?: number;
};

export interface LayoutNode {
  layout(constraints: Constraints): Size;
}

export type FixedTrack = {
  type: "fixed";
  size: number;
};

export type ContentTrack = {
  type: "content";
};

export type FractionTrack = {
  type: "fraction";
  weight: number;
};

export type Track = FixedTrack | ContentTrack | FractionTrack;

export type TrackShorthand = number | "auto" | `${number}fr`;

export function clampSize(size: number, max?: number): number {
  return max === undefined ? size : Math.min(size, max);
}

export function normalizeTrack(track: Track | TrackShorthand): Track {
  if (typeof track === "object") {
    return track;
  }

  if (typeof track === "number") {
    assertNonNegativeInteger(track, "fixed track size");
    return { type: "fixed", size: track };
  }

  if (track === "auto") {
    return { type: "content" };
  }

  if (typeof track === "string" && track.endsWith("fr")) {
    const weight = Number.parseFloat(track.slice(0, -2));
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Fraction track weight must be positive: ${track}`);
    }

    return { type: "fraction", weight };
  }

  throw new Error(`Unsupported track shorthand: ${track}`);
}

export function normalizeTrackList(
  tracks: Array<Track | TrackShorthand>,
): Track[] {
  return tracks.map(normalizeTrack);
}

export function normalizeResolvedSize(size: number): number {
  if (!Number.isFinite(size)) {
    throw new Error(`Resolved size must be finite: ${size}`);
  }

  return Math.max(0, Math.floor(size));
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer: ${value}`);
  }
}
