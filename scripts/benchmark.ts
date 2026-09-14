import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { LARGE_TEXT_BENCHMARK_V1 } from "../packages/ui/test/support/large-text-benchmark-v1.js";
import {
  collectEnvironment,
  failedReferencePreflight,
  runReferencePreflight,
  skippedReferencePreflight,
} from "./benchmark-v1-environment.js";
import {
  buildBenchmarkReport,
  type BenchmarkRun,
} from "./benchmark-v1-report.js";
import { runWorker } from "./benchmark-v1-runtime.js";
import {
  DEFAULT_BUILD_MODE,
  DEFAULT_MEASURED_RUNS,
  DEFAULT_WARMUP_RUNS,
  type BenchmarkOptions,
  type BenchmarkReport,
  type BuildMode,
  type WorkerReport,
} from "./benchmark-v1-types.js";

if (import.meta.main) {
  const options = parseOptions(process.argv.slice(2));
  if (options.worker) {
    process.stdout.write(`${JSON.stringify(await runWorker(options))}\n`);
  } else {
    const report = await runBenchmark(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.referenceGate.status === "failed") process.exitCode = 1;
  }
}

export function parseOptions(args: readonly string[]): BenchmarkOptions {
  let worker = false;
  let buildMode: BuildMode = DEFAULT_BUILD_MODE;
  let referenceRequested = false;
  let preflightVerified = false;
  let warmupRuns = DEFAULT_WARMUP_RUNS;
  let measuredRuns = DEFAULT_MEASURED_RUNS;
  let onlySize: number | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    if (argument === "--worker") {
      worker = true;
      continue;
    }
    if (argument === "--reference") {
      referenceRequested = true;
      continue;
    }
    if (argument === "--preflight-verified") {
      preflightVerified = true;
      continue;
    }
    const [name, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? args[++index];
    if (value === undefined) throw new Error(`Missing value for ${name}.`);
    if (name === "--build-mode") {
      if (value !== "source" && value !== "production") {
        throw new Error("Build mode must be source or production.");
      }
      buildMode = value;
      continue;
    }
    if (name === "--warmups") {
      warmupRuns = parseCount(value, "warmups");
      continue;
    }
    if (name === "--runs") {
      measuredRuns = parseCount(value, "runs");
      continue;
    }
    if (name === "--only-size") {
      onlySize = parseSafeInteger(value, "only-size");
      if (
        !LARGE_TEXT_BENCHMARK_V1.retainedSizes.some((size) => size === onlySize)
      ) {
        throw new Error(
          "only-size must be one of the versioned fixture sizes.",
        );
      }
      continue;
    }
    throw new Error(`Unknown benchmark argument: ${argument}.`);
  }

  if (referenceRequested && onlySize !== null) {
    throw new Error(
      "A reference run must cover all three fixture sizes; --only-size is diagnostic only.",
    );
  }

  return {
    worker,
    buildMode,
    referenceRequested,
    preflightVerified,
    warmupRuns,
    measuredRuns,
    onlySize,
  };
}

async function runBenchmark(
  benchmarkOptions: BenchmarkOptions,
): Promise<BenchmarkReport> {
  if (benchmarkOptions.worker) {
    throw new Error("Worker mode cannot orchestrate runs.");
  }

  const preflight = benchmarkOptions.referenceRequested
    ? collectReferencePreflight()
    : skippedReferencePreflight();
  const environment = collectEnvironment(benchmarkOptions.buildMode, preflight);
  if (
    benchmarkOptions.referenceRequested &&
    !preflight.frozenInstallSucceeded
  ) {
    return buildBenchmarkReport(benchmarkOptions, environment, preflight, []);
  }
  const workerArguments = [
    "--worker",
    `--build-mode=${benchmarkOptions.buildMode}`,
    ...(benchmarkOptions.referenceRequested && preflight.frozenInstallSucceeded
      ? ["--preflight-verified"]
      : []),
    ...(benchmarkOptions.onlySize === null
      ? []
      : [`--only-size=${benchmarkOptions.onlySize}`]),
  ];

  for (let index = 0; index < benchmarkOptions.warmupRuns; index += 1) {
    runFreshWorker(workerArguments);
  }

  const runs: BenchmarkRun[] = [];
  for (let index = 0; index < benchmarkOptions.measuredRuns; index += 1) {
    runs.push({
      runIndex: index + 1,
      ...runFreshWorker(workerArguments),
    });
  }

  return buildBenchmarkReport(benchmarkOptions, environment, preflight, runs);
}

function collectReferencePreflight() {
  try {
    return runReferencePreflight();
  } catch (error) {
    return failedReferencePreflight(error);
  }
}

function runFreshWorker(args: readonly string[]): WorkerReport {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("large-text-benchmark-v1 worker failed.");
  }
  const output = result.stdout.trim();
  if (output === "") {
    throw new Error("large-text-benchmark-v1 worker was empty.");
  }
  const parsed = JSON.parse(output) as WorkerReport;
  if (!Array.isArray(parsed.cold) || !Array.isArray(parsed.warm)) {
    throw new Error(
      "large-text-benchmark-v1 worker returned an invalid report.",
    );
  }
  return parsed;
}

function parseCount(value: string, name: string): number {
  const count = parseSafeInteger(value, name);
  if (count < 0) throw new Error(`${name} must be non-negative.`);
  return count;
}

function parseSafeInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return parsed;
}
