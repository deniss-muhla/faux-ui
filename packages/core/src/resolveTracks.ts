import { normalizeResolvedSize, type Track } from "./types.js";

export function resolveTracks(
  tracks: Track[],
  maxSize: number | undefined,
  measureContentTrack: (trackIndex: number) => number,
): number[] {
  const sizes = new Array<number>(tracks.length).fill(0);
  const measurementCache = new Map<number, number>();
  const fractionIndexes: number[] = [];

  let allocated = 0;

  for (let index = 0; index < tracks.length; index += 1) {
    const track = getTrack(index);

    if (track.type === "fixed") {
      const resolvedSize = normalizeResolvedSize(track.size);
      sizes[index] = resolvedSize;
      allocated += resolvedSize;
      continue;
    }

    if (track.type === "content") {
      const resolvedSize = measure(index);
      sizes[index] = resolvedSize;
      allocated += resolvedSize;
      continue;
    }

    fractionIndexes.push(index);
  }

  if (fractionIndexes.length === 0) {
    return sizes;
  }

  if (maxSize === undefined) {
    for (const index of fractionIndexes) {
      sizes[index] = measure(index);
    }

    return sizes;
  }

  const boundedMax = normalizeResolvedSize(maxSize);
  const remaining = boundedMax - allocated;

  if (remaining <= 0) {
    return sizes;
  }

  let totalWeight = 0;
  for (const index of fractionIndexes) {
    totalWeight += getFractionTrack(index).weight;
  }

  const baseSizes = fractionIndexes.map((index) => {
    const track = getFractionTrack(index);
    return Math.floor((remaining * track.weight) / totalWeight);
  });

  let consumed = 0;
  for (const size of baseSizes) {
    consumed += size;
  }

  let remainder = remaining - consumed;

  for (let offset = 0; offset < fractionIndexes.length; offset += 1) {
    const index = fractionIndexes[offset];
    const baseSize = baseSizes[offset] ?? 0;

    if (index === undefined) {
      throw new Error(`Missing fraction track index at offset ${offset}`);
    }

    sizes[index] = baseSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
  }

  return sizes;

  function measure(trackIndex: number): number {
    const cached = measurementCache.get(trackIndex);
    if (cached !== undefined) {
      return cached;
    }

    const measured = normalizeResolvedSize(measureContentTrack(trackIndex));
    measurementCache.set(trackIndex, measured);
    return measured;
  }

  function getTrack(index: number): Track {
    const track = tracks[index];
    if (track === undefined) {
      throw new Error(`Missing track at index ${index}`);
    }

    return track;
  }

  function getFractionTrack(
    index: number,
  ): Extract<Track, { type: "fraction" }> {
    const track = getTrack(index);
    if (track.type !== "fraction") {
      throw new Error(`Track ${index} is not a fraction track.`);
    }

    return track;
  }
}
