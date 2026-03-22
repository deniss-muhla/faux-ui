export type FauxUiMcpCommand =
  | "validate-document"
  | "render-dom-snapshot"
  | "render-tui-frame"
  | "dump-layout"
  | "dump-tracks";

export interface FauxUiMcpRequest {
  command: FauxUiMcpCommand;
  input: unknown;
}
