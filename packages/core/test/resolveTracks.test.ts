import { describe, expect, it, vi } from "vitest";

import { normalizeTrackList, resolveTracks } from "../src/index.js";

describe("resolveTracks", () => {
  it("resolves fixed and content tracks deterministically", () => {
    const tracks = normalizeTrackList([3, "auto", 5]);
    const sizes = resolveTracks(tracks, undefined, (index) =>
      index === 1 ? 7 : 0,
    );

    expect(sizes).toEqual([3, 7, 5]);
  });

  it("treats fraction tracks as content tracks when the axis is unbounded", () => {
    const tracks = normalizeTrackList(["1fr", "2fr"]);
    const sizes = resolveTracks(tracks, undefined, (index) =>
      index === 0 ? 4 : 9,
    );

    expect(sizes).toEqual([4, 9]);
  });

  it("distributes bounded fraction space left to right after flooring", () => {
    const tracks = normalizeTrackList(["1fr", "1fr", "1fr"]);
    const sizes = resolveTracks(tracks, 10, () => 0);

    expect(sizes).toEqual([4, 3, 3]);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(10);
  });

  it("assigns zero to bounded fraction tracks when no remaining space exists", () => {
    const tracks = normalizeTrackList([8, "auto", "1fr"]);
    const sizes = resolveTracks(tracks, 10, (index) => (index === 1 ? 4 : 0));

    expect(sizes).toEqual([8, 4, 0]);
  });

  it("measures each content-backed track at most once per resolution pass", () => {
    const tracks = normalizeTrackList(["auto", "2fr"]);
    const measure = vi.fn((index: number) => index + 2);

    resolveTracks(tracks, undefined, measure);

    expect(measure).toHaveBeenCalledTimes(2);
    expect(measure).toHaveBeenNthCalledWith(1, 0);
    expect(measure).toHaveBeenNthCalledWith(2, 1);
  });
});
