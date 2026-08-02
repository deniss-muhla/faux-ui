import type { Track } from "@faux-ui/ui";

import type { GridGap, GridGaps } from "./types.js";

export const MAX_GRID_TRACKS = 10_000;

export function normalizeTracks(
  tracks: readonly Track[],
  name: string,
): Track[] {
  return tracks.map((track, index) =>
    normalizeTrack(track, `${name}[${index}]`),
  );
}

export function normalizeTrack(track: Track, name: string): Track {
  if (typeof track === "number") {
    return nonNegativeInteger(track, name);
  }
  if (track === "auto") return track;
  const match = /^(?:([1-9]\d*(?:\.\d+)?)|(0?\.\d+))fr$/u.exec(track);
  if (match === null) {
    throw new Error(
      `${name} must be a non-negative integer, "auto", or a positive fraction.`,
    );
  }
  const weight = Number.parseFloat(track.slice(0, -2));
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`${name} must have a positive fraction weight.`);
  }
  return `${weight}fr`;
}

export function normalizeGap(gap: GridGap): GridGaps {
  if (typeof gap === "number") {
    const value = nonNegativeInteger(gap, "Grid gap");
    return { x: value, y: value };
  }
  if (typeof gap !== "object" || gap === null) {
    throw new Error("Grid gap must be a number or an object with x/y fields.");
  }
  return {
    x: nonNegativeInteger(gap.x ?? 0, "Grid gap.x"),
    y: nonNegativeInteger(gap.y ?? 0, "Grid gap.y"),
  };
}

export function extendTracks(
  tracks: readonly Track[],
  count: number,
  implicit: Track,
): Track[] {
  if (count > MAX_GRID_TRACKS) {
    throw new Error(`Grid cannot create more than ${MAX_GRID_TRACKS} tracks per axis.`);
  }
  return Array.from({ length: count }, (_, index) => tracks[index] ?? implicit);
}

export function optionalLine(
  value: number | undefined,
  name: string,
): number | null {
  return value === undefined ? null : positiveInteger(value, name) - 1;
}

export function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive integer.`);
  }
  if (value > MAX_GRID_TRACKS) {
    throw new Error(`${name} cannot exceed ${MAX_GRID_TRACKS}.`);
  }
  return value;
}

export function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative integer.`);
  }
  return value;
}

/** CSS-like track repetition helper. */
export function repeat(
  count: number,
  pattern: Track | readonly Track[],
): Track[] {
  const normalizedCount = nonNegativeInteger(count, "repeat count");
  const inputTracks: readonly Track[] = Array.isArray(pattern)
    ? pattern
    : [pattern];
  if (inputTracks.length === 0 && normalizedCount > 0) {
    throw new Error("repeat pattern must contain at least one track.");
  }
  const tracks = normalizeTracks(inputTracks, "repeat pattern");
  if (normalizedCount * tracks.length > MAX_GRID_TRACKS) {
    throw new Error(`repeat cannot create more than ${MAX_GRID_TRACKS} tracks.`);
  }
  return Array.from({ length: normalizedCount }, () => tracks).flat();
}
