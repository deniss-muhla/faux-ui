import type { RenderWorkTracker } from "./render-work.js";

const textSourceBrand: unique symbol = Symbol("faux-ui.text-source");

export type TextSourceSegment = Readonly<{
  id: string;
  text: string;
}>;

/** Immutable segmented text input. Its representation is private to Faux UI. */
export interface TextSource {
  readonly [textSourceBrand]: true;
}

interface TextChunk {
  readonly text: string;
  readonly previous: TextChunk | null;
  readonly identity: object;
}

interface SourceSegment {
  readonly id: string;
  readonly chunks: TextChunk;
  readonly chunkCount: number;
  readonly identity: object;
}

interface SegmentOrder {
  readonly id: string;
  readonly previous: SegmentOrder | null;
}

interface SegmentTrie {
  readonly value: SourceSegment | null;
  readonly children: readonly (SegmentTrie | undefined)[];
}

interface TextSourceState {
  readonly order: SegmentOrder | null;
  readonly segmentCount: number;
  readonly segmentsById: SegmentTrie;
  readonly identity: object;
  readonly change: TextSourceChange;
}

export interface TextSourceChange {
  readonly kind: "create" | "append" | "extend" | "replace";
  readonly previousIdentity: object | null;
  readonly id?: string;
  readonly text?: string;
  readonly segmentIdentity?: object;
  readonly chunkIdentity?: object;
}

export interface TextSourceChunkView {
  readonly text: string;
  readonly identity: object;
}

export interface TextSourceSegmentView {
  readonly id: string;
  readonly identity: object;
  readonly chunks: readonly TextSourceChunkView[];
}

export interface TextSourceChunkInspection {
  readonly text: string;
  readonly identity: object;
}

export interface TextSourceSegmentInspection {
  readonly id: string;
  readonly text: string;
  readonly identity: object;
  readonly chunks: readonly TextSourceChunkInspection[];
}

export interface TextSourceInspection {
  readonly text: string;
  readonly segments: readonly TextSourceSegmentInspection[];
}

/** One changed or appended segment in a private source update plan. */
export interface TextSourceSegmentUpdate {
  readonly id: string;
  readonly identity: object;
  readonly chunks: readonly TextSourceChunkInspection[];
}

/** One proven extension of an existing segment. */
export interface TextSourceExtensionUpdate {
  readonly id: string;
  readonly identity: object;
  readonly chunks: readonly TextSourceChunkInspection[];
}

/**
 * Private plan that describes how a mounted index can reach a new source
 * value from the last source it rendered without rescanning the retained
 * prefix. Every kind is derived from persistent identities only, so no
 * source text is compared or joined to build it.
 */
export type TextSourceUpdate =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "append";
      readonly appended: readonly TextSourceSegmentUpdate[];
    }
  | {
      readonly kind: "extend";
      readonly extensions: readonly TextSourceExtensionUpdate[];
      readonly appended: readonly TextSourceSegmentUpdate[];
    }
  | {
      readonly kind: "mixed";
      readonly changed: readonly TextSourceSegmentUpdate[];
      readonly appended: readonly TextSourceSegmentUpdate[];
    }
  | { readonly kind: "rebuild" };

const REBUILD_UPDATE: TextSourceUpdate = Object.freeze({ kind: "rebuild" });
const EMPTY_IDS: readonly string[] = Object.freeze([]);

const EMPTY_CHILDREN: readonly (SegmentTrie | undefined)[] = Object.freeze([]);
const EMPTY_TRIE: SegmentTrie = Object.freeze({
  value: null,
  children: EMPTY_CHILDREN,
});
const sourceStates = new WeakMap<object, TextSourceState>();

export function createTextSource(
  segments: readonly TextSourceSegment[] = [],
): TextSource {
  let source = createSource(null, 0, EMPTY_TRIE, {
    kind: "create",
    previousIdentity: null,
  });
  for (const supplied of segments) {
    const current = requireSource(source);
    const segment = snapshotSegment(supplied);
    if (findSegment(current.segmentsById, segment.id) !== null) {
      throw new RangeError(
        `TextSource segment ID already exists: ${segment.id}.`,
      );
    }
    source = appendSegment(current, segment);
  }
  return source;
}

export function appendTextSourceSegment(
  source: TextSource,
  supplied: TextSourceSegment,
): TextSource {
  const current = requireSource(source);
  const segment = snapshotSegment(supplied);
  if (findSegment(current.segmentsById, segment.id) !== null) {
    throw new RangeError(
      `TextSource segment ID already exists: ${segment.id}.`,
    );
  }
  return appendSegment(current, segment);
}

export function extendTextSourceSegment(
  source: TextSource,
  id: string,
  delta: string,
): TextSource {
  const current = requireSource(source);
  requireId(id);
  requireText(delta, "TextSource segment delta");
  const segment = findSegment(current.segmentsById, id);
  if (segment === null) {
    throw new RangeError(`TextSource segment ID does not exist: ${id}.`);
  }
  const chunk = createChunk(delta, segment.chunks);
  const replacement = Object.freeze({
    id: segment.id,
    chunks: chunk,
    chunkCount: segment.chunkCount + 1,
    identity: identity(),
  });
  return createSource(
    current.order,
    current.segmentCount,
    setSegment(current.segmentsById, id, replacement),
    {
      kind: "extend",
      previousIdentity: current.identity,
      id,
      text: delta,
      segmentIdentity: replacement.identity,
      chunkIdentity: chunk.identity,
    },
  );
}

export function replaceTextSourceSegment(
  source: TextSource,
  id: string,
  text: string,
): TextSource {
  const current = requireSource(source);
  requireId(id);
  requireText(text, "TextSource segment text");
  if (findSegment(current.segmentsById, id) === null) {
    throw new RangeError(`TextSource segment ID does not exist: ${id}.`);
  }
  const replacement = createSegment(id, text);
  return createSource(
    current.order,
    current.segmentCount,
    setSegment(current.segmentsById, id, replacement),
    {
      kind: "replace",
      previousIdentity: current.identity,
      id,
      text,
      segmentIdentity: replacement.identity,
      chunkIdentity: replacement.chunks.identity,
    },
  );
}

export function textSourceIdentity(source: TextSource): object {
  return requireSource(source).identity;
}

export function textSourceChange(source: TextSource): TextSourceChange {
  return requireSource(source).change;
}

export function textSourceSegments(
  source: TextSource,
): readonly TextSourceSegmentView[] {
  const current = requireSource(source);
  const orderedIds = new Array<string>(current.segmentCount);
  let order = current.order;
  for (let index = orderedIds.length - 1; index >= 0; index -= 1) {
    if (order === null) {
      throw new Error("Invalid TextSource segment order.");
    }
    orderedIds[index] = order.id;
    order = order.previous;
  }

  return Object.freeze(
    orderedIds.map((id) => {
      const segment = findSegment(current.segmentsById, id);
      if (segment === null) {
        throw new Error("Invalid TextSource segment index.");
      }
      return Object.freeze({
        id: segment.id,
        identity: segment.identity,
        chunks: inspectChunks(segment.chunks),
      });
    }),
  );
}

export function inspectTextSourceValue(
  source: TextSource,
): TextSourceInspection {
  const segments = textSourceSegments(source).map((segment) => {
    const chunks = segment.chunks.map((chunk) =>
      Object.freeze({ text: chunk.text, identity: chunk.identity }),
    );
    return Object.freeze({
      id: segment.id,
      text: chunks.map((chunk) => chunk.text).join(""),
      identity: segment.identity,
      chunks: Object.freeze(chunks),
    });
  });
  return Object.freeze({
    text: segments.map((segment) => segment.text).join(""),
    segments: Object.freeze(segments),
  });
}

/**
 * Plans how a mounted index reaches `next` from the last source it rendered.
 * Only persistent order, segment, trie, and chunk identities are compared, so
 * unchanged subtrees are recognized without reading source text, joining
 * retained strings, or retaining skipped versions. Work is bounded by the
 * appended segments, the differing trie paths, and the changed chunks.
 */
export function compareTextSources(
  previous: TextSource,
  next: TextSource,
  work?: RenderWorkTracker,
): TextSourceUpdate {
  const previousState = requireSource(previous);
  const nextState = requireSource(next);
  if (previousState.identity === nextState.identity) {
    return { kind: "unchanged" };
  }

  const appendedIds = appendedSegmentIds(previousState, nextState, work);
  if (appendedIds === null) return REBUILD_UPDATE;

  const changed: SourceSegmentDifference[] = [];
  const added = new Set<string>();
  const removed: string[] = [];
  if (previousState.segmentsById !== nextState.segmentsById) {
    collectSegmentDifferences(
      previousState.segmentsById,
      nextState.segmentsById,
      changed,
      added,
      removed,
      work,
    );
  }
  if (removed.length > 0) return REBUILD_UPDATE;
  if (added.size !== appendedIds.length) return REBUILD_UPDATE;
  for (const id of appendedIds) {
    if (!added.has(id)) return REBUILD_UPDATE;
  }

  const appended = appendedIds.map((id) =>
    segmentUpdate(id, requireSegment(nextState, id)),
  );
  if (changed.length === 0) {
    return appended.length === 0
      ? { kind: "unchanged" }
      : { kind: "append", appended: Object.freeze(appended) };
  }

  const extensions: TextSourceExtensionUpdate[] = [];
  for (const difference of changed) {
    const chunks = chunkExtension(difference.previous, difference.next);
    if (chunks === null) break;
    extensions.push(
      Object.freeze({
        id: difference.id,
        identity: difference.next.identity,
        chunks,
      }),
    );
  }
  if (extensions.length === changed.length) {
    return {
      kind: "extend",
      extensions: Object.freeze(extensions),
      appended: Object.freeze(appended),
    };
  }

  return {
    kind: "mixed",
    changed: Object.freeze(
      changed.map((difference) =>
        segmentUpdate(difference.id, difference.next),
      ),
    ),
    appended: Object.freeze(appended),
  };
}

interface SourceSegmentDifference {
  readonly id: string;
  readonly previous: SourceSegment;
  readonly next: SourceSegment;
}

function requireSegment(state: TextSourceState, id: string): SourceSegment {
  const segment = findSegment(state.segmentsById, id);
  if (segment === null) throw new Error("Invalid TextSource segment index.");
  return segment;
}

function segmentUpdate(
  id: string,
  segment: SourceSegment,
): TextSourceSegmentUpdate {
  return Object.freeze({
    id,
    identity: segment.identity,
    chunks: inspectChunks(segment.chunks),
  });
}

/**
 * Returns the segment IDs appended after the previously rendered value, or
 * null when the new order chain does not contain the previous one. The walk is
 * bounded by the appended count because the persistent chain is shared.
 */
function appendedSegmentIds(
  previous: TextSourceState,
  next: TextSourceState,
  work?: RenderWorkTracker,
): readonly string[] | null {
  const added = next.segmentCount - previous.segmentCount;
  if (added < 0) return null;
  if (added === 0) return next.order === previous.order ? EMPTY_IDS : null;

  const ids = new Array<string>(added);
  let order = next.order;
  for (let index = added - 1; index >= 0; index -= 1) {
    work?.searchMetadataRecords(1);
    if (order === null) return null;
    ids[index] = order.id;
    order = order.previous;
  }
  return order === previous.order ? Object.freeze(ids) : null;
}

/**
 * Collects differing segment values by identity, skipping any subtree that the
 * two tries share. A path is rebuilt only where a value was added, removed, or
 * replaced, so examined records follow changed leaves rather than history.
 */
function collectSegmentDifferences(
  previous: SegmentTrie,
  next: SegmentTrie,
  changed: SourceSegmentDifference[],
  added: Set<string>,
  removed: string[],
  work?: RenderWorkTracker,
): void {
  const pending: SegmentTriePair[] = [{ previous, next }];
  while (pending.length > 0) {
    const pair = pending.pop();
    if (pair === undefined) continue;
    work?.searchMetadataRecords(1);
    const previousValue = pair.previous.value;
    const nextValue = pair.next.value;
    if (previousValue === null && nextValue !== null) {
      added.add(nextValue.id);
    } else if (previousValue !== null && nextValue === null) {
      removed.push(previousValue.id);
    } else if (previousValue !== null && nextValue !== null) {
      if (previousValue !== nextValue) {
        changed.push({
          id: nextValue.id,
          previous: previousValue,
          next: nextValue,
        });
      }
    }
    const childCount = Math.max(
      pair.previous.children.length,
      pair.next.children.length,
    );
    for (let index = 0; index < childCount; index += 1) {
      const previousChild = pair.previous.children[index] ?? EMPTY_TRIE;
      const nextChild = pair.next.children[index] ?? EMPTY_TRIE;
      if (previousChild === nextChild) continue;
      pending.push({ previous: previousChild, next: nextChild });
    }
  }
}

interface SegmentTriePair {
  readonly previous: SegmentTrie;
  readonly next: SegmentTrie;
}

/**
 * Proves that the new chunk chain appends to the old one and returns only the
 * newly appended chunks in source order.
 */
function chunkExtension(
  previous: SourceSegment,
  next: SourceSegment,
): readonly TextSourceChunkInspection[] | null {
  const added = next.chunkCount - previous.chunkCount;
  if (added <= 0) return null;

  let probe: TextChunk | null = next.chunks;
  for (let index = 0; index < added; index += 1) {
    if (probe === null) return null;
    probe = probe.previous;
  }
  if (probe !== previous.chunks) return null;

  const chunks = new Array<TextSourceChunkInspection>(added);
  let current: TextChunk | null = next.chunks;
  for (let index = added - 1; index >= 0; index -= 1) {
    if (current === null) return null;
    chunks[index] = Object.freeze({
      text: current.text,
      identity: current.identity,
    });
    current = current.previous;
  }
  return Object.freeze(chunks);
}

function appendSegment(
  source: TextSourceState,
  segment: SourceSegment,
): TextSource {
  return createSource(
    Object.freeze({ id: segment.id, previous: source.order }),
    source.segmentCount + 1,
    setSegment(source.segmentsById, segment.id, segment),
    {
      kind: "append",
      previousIdentity: source.identity,
      id: segment.id,
      text: segment.chunks.text,
      segmentIdentity: segment.identity,
      chunkIdentity: segment.chunks.identity,
    },
  );
}

function createSource(
  order: SegmentOrder | null,
  segmentCount: number,
  segmentsById: SegmentTrie,
  change: TextSourceChange,
): TextSource {
  const source = Object.freeze(Object.create(null)) as TextSource;
  sourceStates.set(
    source,
    Object.freeze({
      order,
      segmentCount,
      segmentsById,
      identity: identity(),
      change: Object.freeze(change),
    }),
  );
  return source;
}

function snapshotSegment(supplied: TextSourceSegment): SourceSegment {
  if (typeof supplied !== "object" || supplied === null) {
    throw new TypeError("TextSource segment must be an object.");
  }
  requireId(supplied.id);
  requireText(supplied.text, "TextSource segment text");
  return createSegment(supplied.id, supplied.text);
}

function createSegment(id: string, text: string): SourceSegment {
  return Object.freeze({
    id,
    chunks: createChunk(text, null),
    chunkCount: 1,
    identity: identity(),
  });
}

function createChunk(text: string, previous: TextChunk | null): TextChunk {
  return Object.freeze({ text, previous, identity: identity() });
}

function inspectChunks(tail: TextChunk): readonly TextSourceChunkInspection[] {
  const reversed: TextChunk[] = [];
  let chunk: TextChunk | null = tail;
  while (chunk !== null) {
    reversed.push(chunk);
    chunk = chunk.previous;
  }
  const result = reversed
    .reverse()
    .map((current) =>
      Object.freeze({ text: current.text, identity: current.identity }),
    );
  return Object.freeze(result);
}

function requireSource(source: TextSource): TextSourceState {
  if (typeof source !== "object" || source === null) {
    throw new TypeError("Expected a TextSource created by createTextSource().");
  }
  const state = sourceStates.get(source);
  if (state === undefined) {
    throw new TypeError("Expected a TextSource created by createTextSource().");
  }
  return state;
}

function requireId(id: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("TextSource segment ID must be a nonempty string.");
  }
}

function requireText(text: string, name: string): void {
  if (typeof text !== "string") {
    throw new TypeError(`${name} must be a string.`);
  }
}

function identity(): object {
  return Object.freeze({});
}

function findSegment(root: SegmentTrie, id: string): SourceSegment | null {
  let node = root;
  for (const index of idPath(id)) {
    const child = node.children[index];
    if (child === undefined) return null;
    node = child;
  }
  return node.value;
}

function setSegment(
  root: SegmentTrie,
  id: string,
  value: SourceSegment,
): SegmentTrie {
  const indexes = idPath(id);
  const path: SegmentTrie[] = [root];
  let node = root;
  for (const index of indexes) {
    node = node.children[index] ?? EMPTY_TRIE;
    path.push(node);
  }

  let updated = createTrie(value, node.children);
  for (let offset = indexes.length - 1; offset >= 0; offset -= 1) {
    const parent = path[offset] ?? EMPTY_TRIE;
    const children = parent.children.slice();
    children[indexes[offset] ?? 0] = updated;
    updated = createTrie(parent.value, children);
  }
  return updated;
}

function idPath(id: string): number[] {
  const result = new Array<number>(id.length * 4);
  let offset = 0;
  for (let index = 0; index < id.length; index += 1) {
    const codeUnit = id.charCodeAt(index);
    result[offset++] = codeUnit >>> 12;
    result[offset++] = (codeUnit >>> 8) & 0x0f;
    result[offset++] = (codeUnit >>> 4) & 0x0f;
    result[offset++] = codeUnit & 0x0f;
  }
  return result;
}

function createTrie(
  value: SourceSegment | null,
  children: readonly (SegmentTrie | undefined)[],
): SegmentTrie {
  return Object.freeze({ value, children: Object.freeze(children) });
}
