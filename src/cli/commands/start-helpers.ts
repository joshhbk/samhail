import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { readConfig } from "../../shared/config.js";
import { getHeartbeatStatus } from "../../shared/heartbeat.js";
import type { SamhailLink } from "../../shared/types.js";

export interface LinkedPackageSpec {
  name: string;
  link: SamhailLink;
  packageDir: string;
}

export async function getLinkedPackageSpecs(
  cwd: string,
): Promise<LinkedPackageSpec[]> {
  const config = await readConfig(cwd);
  if (!config) return [];

  return Object.entries(config.links).map(([name, link]) => ({
    name,
    link,
    packageDir: resolve(cwd, link.path),
  }));
}

export async function findMissingLinkedPackage(
  packages: LinkedPackageSpec[],
): Promise<LinkedPackageSpec | null> {
  for (const pkg of packages) {
    try {
      await access(pkg.packageDir);
    } catch {
      return pkg;
    }
  }

  return null;
}

export type StartSessionState =
  | { state: "ready" }
  | { state: "already-running"; pid: number }
  | { state: "cleanup-stale" };

export async function getStartSessionState(
  cwd: string,
): Promise<StartSessionState> {
  const heartbeatStatus = await getHeartbeatStatus(cwd);

  if (heartbeatStatus.state === "active") {
    return {
      state: "already-running",
      pid: heartbeatStatus.manifest.pid,
    };
  }

  if (heartbeatStatus.state === "stale" || heartbeatStatus.state === "dead") {
    return { state: "cleanup-stale" };
  }

  return { state: "ready" };
}
