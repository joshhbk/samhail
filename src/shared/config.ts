import { resolve } from "node:path";
import { readJsonFile, writeJsonFile } from "./json.js";
import type { SamhailConfig } from "./types.js";

const CONFIG_FILENAME = ".samhail.json";

function isSamhailLink(link: unknown): boolean {
  return (
    typeof link === "object" &&
    link !== null &&
    typeof (link as Record<string, unknown>).path === "string" &&
    typeof (link as Record<string, unknown>).dev === "string"
  );
}

function isLinkRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(isSamhailLink);
}

function isSamhailConfig(value: unknown): value is SamhailConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!isLinkRecord(obj.links)) return false;
  if ("history" in obj && obj.history !== undefined) {
    if (!isLinkRecord(obj.history)) return false;
  }
  return true;
}

export function getConfigPath(projectRoot: string): string {
  return resolve(projectRoot, CONFIG_FILENAME);
}

export async function readConfig(
  projectRoot: string,
): Promise<SamhailConfig | null> {
  return readJsonFile(getConfigPath(projectRoot), isSamhailConfig);
}

export async function writeConfig(
  projectRoot: string,
  config: SamhailConfig,
): Promise<void> {
  try {
    await writeJsonFile(getConfigPath(projectRoot), config);
  } catch (cause) {
    throw new Error(`Failed to write ${CONFIG_FILENAME}`, { cause });
  }
}
