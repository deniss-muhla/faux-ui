import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import { fileURLToPath } from "node:url";

import type {
  BuildMode,
  Environment,
  ReferencePreflight,
} from "./benchmark-v1-types.js";

const lockfilePath = fileURLToPath(new URL("../bun.lock", import.meta.url));

/**
 * A reference environment records the lockfile digest that the frozen install
 * preflight accepted. `lockedDependencies` is true only when that same digest
 * still matches after the dry-run command exits successfully.
 */
export function collectEnvironment(
  buildMode: BuildMode,
  preflight: ReferencePreflight,
): Environment {
  const os = platform();
  return {
    bunVersion: process.versions.bun ?? "unknown",
    operatingSystem: os,
    osRelease: release(),
    architecture: arch(),
    processor: cpus()[0]?.model ?? "unknown",
    machineStatus: detectMachineStatus(),
    supportedOperatingSystem: os === "linux" || os === "darwin",
    lockedDependencies:
      preflight.frozenInstallSucceeded &&
      preflight.lockfileSha256 !== null &&
      preflight.lockfileSha256 === hashLockfile(),
    lockfileSha256: preflight.lockfileSha256 ?? "unavailable",
    frozenInstallDryRun: preflight.frozenInstallSucceeded,
    buildMode,
  };
}

/**
 * The reference operator first runs `bun install --frozen-lockfile` from a clean
 * command boundary. This preflight records the accepted `bun.lock` digest and
 * proves the frozen dry-run can still resolve it without writing files.
 */
export function runReferencePreflight(): ReferencePreflight {
  const digest = hashLockfile();
  if (digest === null) {
    return {
      lockfilePath,
      lockfileSha256: null,
      frozenInstallExitCode: null,
      frozenInstallSucceeded: false,
      error: "bun.lock is missing.",
    };
  }
  try {
    execFileSync("bun", ["install", "--frozen-lockfile", "--dry-run"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
  } catch (error) {
    return {
      lockfilePath,
      lockfileSha256: digest,
      frozenInstallExitCode: exitCode(error),
      frozenInstallSucceeded: false,
      error: firstDiagnosticLine(error),
    };
  }
  return {
    lockfilePath,
    lockfileSha256: digest,
    frozenInstallExitCode: 0,
    frozenInstallSucceeded: true,
    error: null,
  };
}

export function failedReferencePreflight(error: unknown): ReferencePreflight {
  return {
    lockfilePath,
    lockfileSha256: hashLockfile(),
    frozenInstallExitCode: null,
    frozenInstallSucceeded: false,
    error:
      error instanceof Error ? error.message : "Unknown preflight failure.",
  };
}

export function skippedReferencePreflight(): ReferencePreflight {
  return {
    lockfilePath,
    lockfileSha256: hashLockfile(),
    frozenInstallExitCode: null,
    frozenInstallSucceeded: false,
    error: null,
  };
}

export function environmentMatches(
  left: Environment,
  right: Environment,
): boolean {
  return (
    left.bunVersion === right.bunVersion &&
    left.operatingSystem === right.operatingSystem &&
    left.architecture === right.architecture &&
    left.machineStatus === right.machineStatus &&
    left.supportedOperatingSystem === right.supportedOperatingSystem &&
    left.lockedDependencies === right.lockedDependencies &&
    left.buildMode === right.buildMode
  );
}

function hashLockfile(): string | null {
  try {
    return createHash("sha256")
      .update(readFileSync(lockfilePath))
      .digest("hex");
  } catch {
    return null;
  }
}

function exitCode(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}

function firstDiagnosticLine(error: unknown): string {
  if (typeof error !== "object" || error === null)
    return "Frozen install failed.";
  const stderr =
    "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  const line = stderr
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry !== "");
  return line ?? "Frozen install failed.";
}

function detectMachineStatus(): Environment["machineStatus"] {
  const override = process.env.FAUX_UI_BENCHMARK_MACHINE_STATUS;
  if (override === "physical" || override === "virtual") return override;
  try {
    const value = execFileSync("systemd-detect-virt", [], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value === "" || value === "none" ? "physical" : "virtual";
  } catch (error) {
    const value =
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof error.stdout === "string"
        ? error.stdout.trim()
        : "";
    if (value === "none") return "physical";
    if (value !== "") return "virtual";
    return "unknown";
  }
}

export function bunVersionAtLeast(actual: string, minimum: string): boolean {
  const actualParts = stableVersionParts(actual);
  const minimumParts = stableVersionParts(minimum);
  if (actualParts === null || minimumParts === null) return false;
  for (let index = 0; index < actualParts.length; index += 1) {
    const difference = (actualParts[index] ?? 0) - (minimumParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function finiteMilliseconds(nanoseconds: number): number {
  if (!Number.isFinite(nanoseconds) || nanoseconds <= 0) return 0;
  return nanoseconds / 1_000_000;
}

function stableVersionParts(version: string): readonly number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) return null;
  return match.slice(1).map(Number);
}
