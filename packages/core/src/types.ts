export type Size = {
  width: number;
  height: number;
};

export type Constraints = {
  maxWidth?: number;
  maxHeight?: number;
};

export type BoundedConstraints = {
  maxWidth: number;
  maxHeight: number;
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

export type TrackSizeShorthand = number | "auto" | `${number}fr`;

export type NamedTrackShorthand = {
  name: string;
  size: Track | TrackSizeShorthand;
};

export type TrackShorthand = TrackSizeShorthand | NamedTrackShorthand;

export function clampSize(size: number, max?: number): number {
  return max === undefined ? size : Math.min(size, max);
}

export function assertBoundedConstraints(
  constraints: Constraints,
  label = "constraints",
): BoundedConstraints {
  if (
    constraints.maxWidth === undefined ||
    constraints.maxHeight === undefined
  ) {
    throw new Error(`${label} must include explicit maxWidth and maxHeight.`);
  }

  return {
    maxWidth: normalizeResolvedSize(constraints.maxWidth),
    maxHeight: normalizeResolvedSize(constraints.maxHeight),
  };
}

export function normalizeTrack(track: Track | TrackShorthand): Track {
  if (typeof track === "object") {
    if (isNamedTrackShorthand(track)) {
      return normalizeTrack(track.size);
    }

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

export function cloneTrackShorthand(
  track: Track | TrackShorthand,
): Track | TrackShorthand {
  if (typeof track !== "object") {
    return track;
  }

  if (isNamedTrackShorthand(track)) {
    return {
      name: track.name,
      size: cloneTrackShorthand(track.size) as Track | TrackSizeShorthand,
    };
  }

  switch (track.type) {
    case "fixed":
      return { type: "fixed", size: track.size };
    case "fraction":
      return { type: "fraction", weight: track.weight };
    default:
      return { type: "content" };
  }
}

export function sameTrackShorthand(
  left: Track | TrackShorthand,
  right: Track | TrackShorthand,
): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }

  if (isNamedTrackShorthand(left) || isNamedTrackShorthand(right)) {
    return (
      isNamedTrackShorthand(left) &&
      isNamedTrackShorthand(right) &&
      left.name === right.name &&
      sameTrackShorthand(left.size, right.size)
    );
  }

  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case "fixed":
      return right.type === "fixed" && left.size === right.size;
    case "fraction":
      return right.type === "fraction" && left.weight === right.weight;
    default:
      return right.type === "content";
  }
}

export function readTrackName(track: Track | TrackShorthand): string | null {
  return isNamedTrackShorthand(track) ? track.name : null;
}

export function isNamedTrackShorthand(
  track: Track | TrackShorthand,
): track is NamedTrackShorthand {
  return (
    typeof track === "object" &&
    "name" in track &&
    "size" in track &&
    typeof track.name === "string" &&
    track.name.length > 0
  );
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
