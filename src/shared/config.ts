import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJson } from "./json.js";
import type { LocaldevConfig } from "./types.js";

const CONFIG_FILENAME = ".localdev.json";

export function isLocaldevLink(link: unknown): boolean {
  return (
    typeof link === "object" &&
    link !== null &&
    typeof (link as Record<string, unknown>).path === "string" &&
    typeof (link as Record<string, unknown>).dev === "string"
  );
}

function isLinkRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(isLocaldevLink);
}

function isLocaldevConfig(value: unknown): value is LocaldevConfig {
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
): Promise<LocaldevConfig | null> {
  try {
    const raw = await readFile(getConfigPath(projectRoot), "utf-8");
    return parseJson(raw, isLocaldevConfig);
  } catch {
    return null;
  }
}

export async function writeConfig(
  projectRoot: string,
  config: LocaldevConfig,
): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch (cause) {
    throw new Error(`Failed to write ${CONFIG_FILENAME}`, { cause });
  }
}
