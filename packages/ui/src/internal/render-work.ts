export type RenderProfileStage = "indexing" | "layout" | "scene";

export interface RenderStageDurations {
  readonly indexingMilliseconds: number;
  readonly layoutMilliseconds: number;
  readonly sceneMilliseconds: number;
}

export interface RenderWorkCounts {
  readonly sourceCodeUnitsInspected: number;
  readonly metadataRecordsSearched: number;
  readonly linesIndexed: number;
  readonly graphemesPrepared: number;
  readonly cellSlotsRetained: number;
  readonly copiedGlyphPayloadCodeUnitsRetained: number;
  readonly cellsPainted: number;
  readonly entriesDisposed: number;
}

export type RenderStageWorkCounts = Readonly<
  Record<RenderProfileStage, RenderWorkCounts>
>;

type MutableRenderWorkCounts = {
  -readonly [Name in keyof RenderWorkCounts]: RenderWorkCounts[Name];
};

function emptyWorkCounts(): MutableRenderWorkCounts {
  return {
    sourceCodeUnitsInspected: 0,
    metadataRecordsSearched: 0,
    linesIndexed: 0,
    graphemesPrepared: 0,
    cellSlotsRetained: 0,
    copiedGlyphPayloadCodeUnitsRetained: 0,
    cellsPainted: 0,
    entriesDisposed: 0,
  };
}

/** Mount-local deterministic counters exposed only through the testing entry. */
export class RenderWorkTracker {
  #sourceCodeUnitsInspected = 0;
  #metadataRecordsSearched = 0;
  #linesIndexed = 0;
  #graphemesPrepared = 0;
  #cellSlotsRetained = 0;
  #copiedGlyphPayloadCodeUnitsRetained = 0;
  #cellsPainted = 0;
  #entriesDisposed = 0;
  #indexingMilliseconds = 0;
  #layoutMilliseconds = 0;
  #sceneMilliseconds = 0;
  #retainedEntryIds = new Set<number>();
  #textEntryIds = new Set<number>();
  #stage: RenderProfileStage | null = null;
  #stageWork: Record<RenderProfileStage, MutableRenderWorkCounts> = {
    indexing: emptyWorkCounts(),
    layout: emptyWorkCounts(),
    scene: emptyWorkCounts(),
  };
  #disposed = false;

  inspectSourceCodeUnits(count: number): void {
    this.#sourceCodeUnitsInspected += count;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].sourceCodeUnitsInspected += count;
    }
  }

  searchMetadataRecords(count: number): void {
    this.#metadataRecordsSearched += count;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].metadataRecordsSearched += count;
    }
  }

  indexLines(count: number): void {
    this.#linesIndexed += count;
    if (this.#stage !== null)
      this.#stageWork[this.#stage].linesIndexed += count;
  }

  prepareGraphemes(count: number): void {
    this.#graphemesPrepared += count;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].graphemesPrepared += count;
    }
  }

  paintCells(count: number): void {
    this.#cellsPainted += count;
    if (this.#stage !== null)
      this.#stageWork[this.#stage].cellsPainted += count;
  }

  measure<T>(stage: RenderProfileStage, operation: () => T): T {
    const previousStage = this.#stage;
    this.#stage = stage;
    const started = performance.now();
    try {
      return operation();
    } finally {
      const duration = performance.now() - started;
      this.#stage = previousStage;
      if (stage === "indexing") this.#indexingMilliseconds += duration;
      else if (stage === "layout") this.#layoutMilliseconds += duration;
      else this.#sceneMilliseconds += duration;
    }
  }

  trackTextEntries(entryIds: ReadonlySet<number>): void {
    for (const id of this.#textEntryIds) {
      if (!entryIds.has(id)) this.releaseTextEntry(id);
    }
    this.#textEntryIds = new Set(entryIds);
  }

  retainTextScene(
    entryIds: ReadonlySet<number>,
    cellSlots: number,
    copiedGlyphPayloadCodeUnits: number,
  ): void {
    for (const id of this.#retainedEntryIds) {
      if (!entryIds.has(id)) this.#retainedEntryIds.delete(id);
    }
    this.#retainedEntryIds = new Set(
      [...entryIds].filter((id) => this.#textEntryIds.has(id)),
    );
    this.#cellSlotsRetained = cellSlots;
    this.#copiedGlyphPayloadCodeUnitsRetained = copiedGlyphPayloadCodeUnits;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].cellSlotsRetained = cellSlots;
      this.#stageWork[this.#stage].copiedGlyphPayloadCodeUnitsRetained =
        copiedGlyphPayloadCodeUnits;
    }
  }

  releaseTextEntry(id: number): void {
    if (!this.#textEntryIds.delete(id)) return;
    this.#retainedEntryIds.delete(id);
    this.#entriesDisposed += 1;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].entriesDisposed += 1;
    }
  }

  clearTextScene(): void {
    for (const id of this.#retainedEntryIds) this.releaseTextEntry(id);
    this.#retainedEntryIds.clear();
    this.#cellSlotsRetained = 0;
    this.#copiedGlyphPayloadCodeUnitsRetained = 0;
    if (this.#stage !== null) {
      this.#stageWork[this.#stage].cellSlotsRetained = 0;
      this.#stageWork[this.#stage].copiedGlyphPayloadCodeUnitsRetained = 0;
    }
  }

  clearMeasurements(): void {
    this.#sourceCodeUnitsInspected = 0;
    this.#metadataRecordsSearched = 0;
    this.#linesIndexed = 0;
    this.#graphemesPrepared = 0;
    this.#cellsPainted = 0;
    this.#entriesDisposed = 0;
    this.#indexingMilliseconds = 0;
    this.#layoutMilliseconds = 0;
    this.#sceneMilliseconds = 0;
    this.#stageWork = {
      indexing: emptyWorkCounts(),
      layout: emptyWorkCounts(),
      scene: emptyWorkCounts(),
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const id of this.#textEntryIds) this.releaseTextEntry(id);
    this.clearTextScene();
  }

  stageDurations(): RenderStageDurations {
    return {
      indexingMilliseconds: this.#indexingMilliseconds,
      layoutMilliseconds: this.#layoutMilliseconds,
      sceneMilliseconds: this.#sceneMilliseconds,
    };
  }

  stageWorkCounts(): RenderStageWorkCounts {
    return {
      indexing: { ...this.#stageWork.indexing },
      layout: { ...this.#stageWork.layout },
      scene: { ...this.#stageWork.scene },
    };
  }

  snapshot(): RenderWorkCounts {
    return {
      sourceCodeUnitsInspected: this.#sourceCodeUnitsInspected,
      metadataRecordsSearched: this.#metadataRecordsSearched,
      linesIndexed: this.#linesIndexed,
      graphemesPrepared: this.#graphemesPrepared,
      cellSlotsRetained: this.#cellSlotsRetained,
      copiedGlyphPayloadCodeUnitsRetained:
        this.#copiedGlyphPayloadCodeUnitsRetained,
      cellsPainted: this.#cellsPainted,
      entriesDisposed: this.#entriesDisposed,
    };
  }
}
