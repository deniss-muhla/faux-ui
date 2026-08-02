import type { BoxProps, Track } from "@faux-ui/ui";
import type { ReactElement } from "react";

type GridChild = ReactElement | null | undefined | boolean;
type GridChildren = GridChild | readonly GridChild[];

export type GridGap =
  | number
  | {
      readonly x?: number;
      readonly y?: number;
    };

export interface GridProps extends Omit<BoxProps, "children"> {
  /** Explicit column tracks. At least one column is required. */
  readonly columns: readonly Track[];
  /** Explicit row tracks. Additional rows are implicit auto tracks. */
  readonly rows?: readonly Track[];
  readonly gap?: GridGap;
  readonly children?: GridChildren;
}

export interface GridItemProps extends Omit<BoxProps, "children"> {
  /** One-based row number. Omit for auto-placement. */
  readonly row?: number;
  /** One-based column number. Omit for auto-placement. */
  readonly column?: number;
  readonly rowSpan?: number;
  readonly columnSpan?: number;
  /** One semantic child; wrap text in Text and groups in Rows/Columns/Box. */
  readonly children?: GridChild;
}

export interface ItemSpec {
  readonly sourceIndex: number;
  readonly row: number | null;
  readonly column: number | null;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly element: ReactElement;
}

export interface PlacedItem extends ItemSpec {
  readonly placedRow: number;
  readonly placedColumn: number;
}

export interface PlacementResult {
  readonly items: readonly PlacedItem[];
  readonly rowCount: number;
  readonly columnCount: number;
}

export interface GridGaps {
  readonly x: number;
  readonly y: number;
}
