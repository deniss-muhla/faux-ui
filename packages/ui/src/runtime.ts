import {
  createContext,
  createElement,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

import type { KeyInput } from "./internal/model.js";

export type InputHandler = (input: KeyInput) => boolean | void;

export interface FocusManager {
  focusNext(): void;
  focusPrevious(): void;
  clearFocus(): void;
}

/** @internal */
export interface RuntimeContextValue extends FocusManager {
  registerInput(handler: InputHandler): () => void;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function useInput(handler: InputHandler): void {
  const runtime = useRuntimeContext("useInput");
  useEffect(() => runtime.registerInput(handler), [runtime, handler]);
}

export function useFocusManager(): FocusManager {
  return useRuntimeContext("useFocusManager");
}

export interface InternalRuntimeProviderProps {
  readonly value: RuntimeContextValue;
  readonly children?: ReactNode;
}

export function InternalRuntimeProvider({
  value,
  children,
}: InternalRuntimeProviderProps): ReactNode {
  return createElement(RuntimeContext.Provider, { value }, children);
}

function useRuntimeContext(hook: string): RuntimeContextValue {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) {
    throw new Error(`${hook} must be used inside a mounted faux-ui application.`);
  }
  return runtime;
}
