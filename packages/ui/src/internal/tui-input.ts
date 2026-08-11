import type { KeyInput, PointerInput, ScrollInput } from "./model.js";

const ESC = "\u001b";

export type TerminalControl =
  | { readonly type: "keyDown"; readonly input: KeyInput }
  | { readonly type: "quit" }
  | { readonly type: "pointerDown"; readonly input: PointerInput }
  | { readonly type: "pointerMove"; readonly input: PointerInput }
  | { readonly type: "pointerUp"; readonly input: PointerInput }
  | { readonly type: "scroll"; readonly input: ScrollInput };

export interface TerminalInputResult {
  readonly controls: readonly TerminalControl[];
  readonly rest: string;
}

export function consumeTerminalInput(input: string): TerminalInputResult {
  const controls: TerminalControl[] = [];
  let index = 0;

  while (index < input.length) {
    const codePoint = input.codePointAt(index);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    if (char !== ESC) {
      const control = plainControl(codePoint, char);
      if (control !== null) controls.push(control);
      index += char.length;
      continue;
    }

    if (index + 1 >= input.length) {
      controls.push({ type: "keyDown", input: { key: "Escape" } });
      index += 1;
      continue;
    }

    if (input[index + 1] !== "[") {
      const nextCodePoint = input.codePointAt(index + 1);
      if (nextCodePoint === undefined) break;
      const next = String.fromCodePoint(nextCodePoint);
      controls.push({ type: "keyDown", input: { key: next, alt: true } });
      index += 1 + next.length;
      continue;
    }

    const sequence = parseCsi(input, index);
    if (sequence === null) break;
    if (sequence.control !== null) controls.push(sequence.control);
    index = sequence.end;
  }

  return { controls, rest: input.slice(index) };
}

function parseCsi(
  input: string,
  start: number,
): { readonly control: TerminalControl | null; readonly end: number } | null {
  if (start + 2 >= input.length) return null;
  const marker = input[start + 2];
  const simpleKeys: Record<string, string> = {
    A: "ArrowUp",
    B: "ArrowDown",
    C: "ArrowRight",
    D: "ArrowLeft",
    H: "Home",
    F: "End",
    Z: "Tab",
  };
  if (marker !== undefined && simpleKeys[marker] !== undefined) {
    return {
      control: {
        type: "keyDown",
        input: {
          key: simpleKeys[marker] ?? marker,
          ...(marker === "Z" ? { shift: true } : {}),
        },
      },
      end: start + 3,
    };
  }

  if (marker === "<") {
    const match = /^\u001b\[<(\d+);(\d+);(\d+)([Mm])/u.exec(
      input.slice(start),
    );
    if (match === null) return null;
    return {
      control: mouseControl(
        Number.parseInt(match[1] ?? "", 10),
        Number.parseInt(match[2] ?? "", 10),
        Number.parseInt(match[3] ?? "", 10),
        match[4] === "m",
      ),
      end: start + match[0].length,
    };
  }

  const tilde = /^\u001b\[(\d+)~/u.exec(input.slice(start));
  if (tilde !== null) {
    const keys: Record<string, string> = {
      "1": "Home",
      "2": "Insert",
      "3": "Delete",
      "4": "End",
      "5": "PageUp",
      "6": "PageDown",
      "7": "Home",
      "8": "End",
    };
    const key = keys[tilde[1] ?? ""];
    return {
      control:
        key === undefined ? null : { type: "keyDown", input: { key } },
      end: start + tilde[0].length,
    };
  }

  // Consume a complete unsupported CSI sequence; retain incomplete sequences.
  const complete = /^\u001b\[[\d;?]*[A-Za-z~]/u.exec(input.slice(start));
  return complete === null
    ? null
    : { control: null, end: start + complete[0].length };
}

function plainControl(codePoint: number, char: string): TerminalControl | null {
  if (codePoint === 3) return { type: "quit" };
  if (char === "\t") return { type: "keyDown", input: { key: "Tab" } };
  if (char === "\r" || char === "\n") {
    return { type: "keyDown", input: { key: "Enter" } };
  }
  if (codePoint === 0x7f || codePoint === 8) {
    return { type: "keyDown", input: { key: "Backspace" } };
  }
  if (codePoint > 0 && codePoint < 27) {
    return {
      type: "keyDown",
      input: { key: String.fromCharCode(96 + codePoint), ctrl: true },
    };
  }
  if (codePoint < 32) return null;
  return { type: "keyDown", input: { key: char } };
}

function mouseControl(
  code: number,
  column: number,
  row: number,
  released: boolean,
): TerminalControl | null {
  if (![code, column, row].every(Number.isInteger)) return null;
  const point = { x: Math.max(0, column - 1), y: Math.max(0, row - 1) };
  const modifiers = {
    shift: (code & 4) !== 0,
    alt: (code & 8) !== 0,
    ctrl: (code & 16) !== 0,
  };

  if ((code & 64) !== 0) {
    const direction = code & 3;
    if (direction > 1) return null;
    return {
      type: "scroll",
      input: {
        ...point,
        deltaX: 0,
        deltaY: direction === 0 ? -1 : 1,
      },
    };
  }

  const buttonCode = code & 3;
  const button = buttonCode === 0 ? 0 : buttonCode === 1 ? 1 : 2;
  const input = { ...point, button, buttons: released ? 0 : 1, ...modifiers };
  if (released) return { type: "pointerUp", input };
  if ((code & 32) !== 0) return { type: "pointerMove", input };
  return { type: "pointerDown", input };
}
