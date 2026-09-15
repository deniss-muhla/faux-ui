import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  createInterface,
  type Interface as ReadLineInterface,
} from "node:readline";

export type EventSourceName = "cpu" | "journal" | "udev";
export type EventRecordSource = EventSourceName | "state";

export interface SystemEventRecord {
  readonly sequence: number;
  readonly source: EventRecordSource;
  readonly occurredAt: number;
  readonly text: string;
  readonly timerLagMilliseconds: number;
}

export interface SystemEventStream {
  readonly description: string;
  subscribe(listener: (record: SystemEventRecord) => void): () => void;
  close(): void;
}

export interface SystemEventStreamOptions {
  readonly sources: readonly EventSourceName[];
  readonly cpuSampleMilliseconds: number;
}

export function createSystemEventStream(
  options: SystemEventStreamOptions,
): SystemEventStream {
  const listeners = new Set<(record: SystemEventRecord) => void>();
  const children = new Set<ChildProcess>();
  const readers = new Set<ReadLineInterface>();
  const selectedSources = new Set(options.sources);
  const description = options.sources
    .map((source) =>
      source === "cpu"
        ? `cpu ${options.cpuSampleMilliseconds} ms`
        : source === "journal"
          ? "journalctl follow"
          : "USB udev",
    )
    .join(" · ");
  let sequence = 0;
  let cpuTimer: NodeJS.Timeout | undefined;
  let started = false;
  let closed = false;

  function emit(
    source: EventRecordSource,
    text: string,
    timerLagMilliseconds = 0,
  ): void {
    if (closed) return;
    const record: SystemEventRecord = {
      sequence: sequence++,
      source,
      occurredAt: Date.now(),
      text,
      timerLagMilliseconds,
    };
    for (const listener of listeners) listener(record);
  }

  function start(): void {
    if (started || closed) return;
    started = true;
    emit("state", `started ${description}`);

    if (selectedSources.has("cpu")) startCpuSampling();
    if (selectedSources.has("journal")) {
      startCommand("journal", "journalctl", [
        "--follow",
        "--lines=0",
        "--output=short-iso-precise",
        "--no-pager",
      ]);
    }
    if (selectedSources.has("udev")) {
      startCommand("udev", "udevadm", [
        "monitor",
        "--kernel",
        "--udev",
        "--property",
        "--subsystem-match=usb",
      ]);
    }
  }

  function startCpuSampling(): void {
    let expectedAt = performance.now() + options.cpuSampleMilliseconds;
    let reading = false;

    cpuTimer = setInterval(() => {
      const now = performance.now();
      const timerLagMilliseconds = Math.max(0, now - expectedAt);
      expectedAt = now + options.cpuSampleMilliseconds;
      if (reading) return;
      reading = true;
      void readFile("/proc/stat", "utf8")
        .then((value) => {
          const cpuLine = value.split("\n", 1)[0];
          if (cpuLine === undefined || !cpuLine.startsWith("cpu ")) {
            throw new Error(
              "/proc/stat did not contain the aggregate CPU line",
            );
          }
          emit(
            "cpu",
            `${cpuLine} timer-lag=${timerLagMilliseconds.toFixed(2)}ms`,
            timerLagMilliseconds,
          );
        })
        .catch((error: unknown) => {
          if (cpuTimer !== undefined) clearInterval(cpuTimer);
          cpuTimer = undefined;
          emit("state", `CPU sampler stopped: ${publicError(error)}`);
        })
        .finally(() => {
          reading = false;
        });
    }, options.cpuSampleMilliseconds);
  }

  function startCommand(
    source: "journal" | "udev",
    command: string,
    args: readonly string[],
  ): void {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        env: {
          ...process.env,
          PAGER: "cat",
          SYSTEMD_COLORS: "0",
          SYSTEMD_URLIFY: "0",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      emit("state", `${source} failed to start: ${publicError(error)}`);
      return;
    }

    children.add(child);
    emit(
      "state",
      `${source} process started with PID ${child.pid ?? "unknown"}`,
    );

    if (child.stdout !== null) {
      const output = createInterface({ input: child.stdout });
      readers.add(output);
      output.on("line", (line) => emit(source, line));
      output.once("close", () => readers.delete(output));
    }
    if (child.stderr !== null) {
      const errors = createInterface({ input: child.stderr });
      readers.add(errors);
      errors.on("line", (line) => emit("state", `${source}: ${line}`));
      errors.once("close", () => readers.delete(errors));
    }

    child.once("error", (error) => {
      emit("state", `${source} process error: ${publicError(error)}`);
    });
    child.once("exit", (code, signal) => {
      children.delete(child);
      emit(
        "state",
        `${source} process exited (${signal ?? `code ${code ?? "unknown"}`})`,
      );
    });
  }

  return {
    description,
    subscribe(listener): () => void {
      if (closed) throw new Error("The system event stream is closed.");
      listeners.add(listener);
      start();
      return () => listeners.delete(listener);
    },
    close(): void {
      if (closed) return;
      closed = true;
      if (cpuTimer !== undefined) clearInterval(cpuTimer);
      cpuTimer = undefined;
      for (const reader of readers) reader.close();
      readers.clear();
      for (const child of children) {
        child.kill("SIGTERM");
        const forceKill = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }, 500);
        forceKill.unref();
        child.once("exit", () => clearTimeout(forceKill));
      }
      children.clear();
      listeners.clear();
    },
  };
}

function publicError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
