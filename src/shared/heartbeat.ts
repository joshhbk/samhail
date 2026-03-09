import { statSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJson, writeJsonFile } from "./json.js";
import type { HeartbeatManifest } from "./types.js";

const HEARTBEAT_FILENAME = ".samhail.lock";
export const HEARTBEAT_STALENESS_THRESHOLD_MS = 10_000;

export type HeartbeatStatus =
  | { state: "missing"; manifest: null }
  | { state: "invalid"; manifest: null }
  | { state: "stale"; manifest: HeartbeatManifest }
  | { state: "dead"; manifest: HeartbeatManifest }
  | { state: "active"; manifest: HeartbeatManifest };

function isHeartbeatManifest(value: unknown): value is HeartbeatManifest {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.pid === "number" &&
    typeof obj.startedAt === "string" &&
    typeof obj.updatedAt === "string" &&
    Array.isArray(obj.watching) &&
    obj.watching.every((v: unknown) => typeof v === "string")
  );
}

export function getHeartbeatPath(projectRoot: string): string {
  return resolve(projectRoot, HEARTBEAT_FILENAME);
}

export async function writeHeartbeat(
  projectRoot: string,
  manifest: HeartbeatManifest,
): Promise<void> {
  try {
    await writeJsonFile(getHeartbeatPath(projectRoot), manifest);
  } catch (cause) {
    throw new Error(`Failed to write ${HEARTBEAT_FILENAME}`, { cause });
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function getHeartbeatStatus(
  projectRoot: string,
): Promise<HeartbeatStatus> {
  let raw: string;

  try {
    raw = await readFile(getHeartbeatPath(projectRoot), "utf-8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { state: "missing", manifest: null };
    }

    return { state: "invalid", manifest: null };
  }

  const manifest = parseJson(raw, isHeartbeatManifest);
  if (!manifest) {
    return { state: "invalid", manifest: null };
  }

  if (!isPidAlive(manifest.pid)) {
    return { state: "dead", manifest };
  }

  const updatedAtMs = new Date(manifest.updatedAt).getTime();
  const age = Date.now() - updatedAtMs;

  if (
    !Number.isFinite(updatedAtMs) ||
    age >= HEARTBEAT_STALENESS_THRESHOLD_MS
  ) {
    return { state: "stale", manifest };
  }

  return { state: "active", manifest };
}

export function isHeartbeatFreshSync(projectRoot: string): boolean {
  try {
    const stats = statSync(getHeartbeatPath(projectRoot));
    return Date.now() - stats.mtimeMs < HEARTBEAT_STALENESS_THRESHOLD_MS;
  } catch {
    return false;
  }
}

export async function removeHeartbeat(projectRoot: string): Promise<void> {
  try {
    await unlink(getHeartbeatPath(projectRoot));
  } catch {
    // ignore if missing
  }
}
