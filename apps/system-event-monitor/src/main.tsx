import { render, type TuiRenderHandle } from "@faux-ui/ui/tui";

import { EventMonitorApp } from "./app.js";
import {
  createSystemEventStream,
  type EventSourceName,
} from "./system-events.js";

const cli = parseArguments(process.argv.slice(2));
if (cli.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const stream = createSystemEventStream({
  sources: cli.sources,
  cpuSampleMilliseconds: cli.cpuSampleMilliseconds,
});
let app: TuiRenderHandle | undefined;
let closing = false;

function shutdown(exitCode: number): void {
  if (closing) return;
  closing = true;
  stream.close();
  app?.unmount();
  process.exitCode = exitCode;
}

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));
process.once("uncaughtException", (error) => {
  shutdown(1);
  process.stderr.write(`${publicError(error)}\n`);
});
process.once("unhandledRejection", (reason) => {
  shutdown(1);
  process.stderr.write(`${publicError(reason)}\n`);
});

app = render(<EventMonitorApp stream={stream} onQuit={() => shutdown(0)} />, {
  exitOnCtrlC: false,
});

interface CliOptions {
  readonly sources: readonly EventSourceName[];
  readonly cpuSampleMilliseconds: number;
  readonly help: boolean;
}

function parseArguments(args: readonly string[]): CliOptions {
  let sources: readonly EventSourceName[] = ["cpu", "journal", "udev"];
  let cpuSampleMilliseconds = 20;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--sources") {
      const value = args[++index];
      if (value === undefined) throw new Error("--sources needs a value.");
      sources = parseSources(value);
      continue;
    }
    if (argument === "--sample-ms") {
      const value = args[++index];
      if (value === undefined) throw new Error("--sample-ms needs a value.");
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 5 || parsed > 60_000) {
        throw new Error("--sample-ms must be an integer from 5 to 60000.");
      }
      cpuSampleMilliseconds = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${argument ?? ""}`);
  }

  return { sources, cpuSampleMilliseconds, help };
}

function parseSources(value: string): readonly EventSourceName[] {
  if (value === "all") return ["cpu", "journal", "udev"];
  const allowed = new Set<EventSourceName>(["cpu", "journal", "udev"]);
  const selected = [...new Set(value.split(",").filter(Boolean))];
  if (selected.length === 0) throw new Error("--sources cannot be empty.");
  for (const source of selected) {
    if (!allowed.has(source as EventSourceName)) {
      throw new Error(`Unknown source: ${source}`);
    }
  }
  return selected as EventSourceName[];
}

function usage(): string {
  return [
    "Faux UI live Linux event monitor",
    "",
    "Usage: bun run example:system-events -- [options]",
    "",
    "Options:",
    "  --sources all|cpu,journal,udev  Sources to monitor (default: all)",
    "  --sample-ms N                   /proc/stat interval (default: 20)",
    "  -h, --help                      Show this help",
    "",
  ].join("\n");
}

function publicError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
