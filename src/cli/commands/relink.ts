import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { readConfig, writeConfig } from "../../shared/config.js";
import { isJsonObject, readJsonFile } from "../../shared/json.js";
import { defineSamhailCommand } from "../command.js";

async function readPackageName(dir: string): Promise<string | null> {
  const pkg = await readJsonFile(join(dir, "package.json"), isJsonObject);
  return typeof pkg?.name === "string" ? pkg.name : null;
}

async function validateCandidate(
  cwd: string,
  name: string,
  path: string,
): Promise<string | null> {
  const absolutePath = resolve(cwd, path);
  try {
    const s = await stat(absolutePath);
    if (!s.isDirectory()) return `${name}: ${path} is not a directory`;
  } catch {
    return `${name}: ${path} no longer exists`;
  }
  const pkgName = await readPackageName(absolutePath);
  if (pkgName !== name)
    return `${name}: package at ${path} has name "${pkgName ?? "(none)"}"`;
  return null;
}

export const relinkCommand = defineSamhailCommand({
  meta: {
    name: "relink",
    description: "Restore all previously linked packages from history",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("samhail relink");

    const config = await readConfig(cwd);
    const history = config?.history ?? {};
    const activeLinks = config?.links ?? {};

    const candidates = Object.entries(history).filter(
      ([name]) => !(name in activeLinks),
    );

    if (candidates.length === 0) {
      return {
        status: "error",
        message: "No previously linked packages to restore.",
        detail: "Use `samhail link` to link a new package.",
      };
    }

    const errors: string[] = [];
    const restored: string[] = [];

    const updatedConfig = config ?? { links: {} };

    for (const [name, link] of candidates) {
      const error = await validateCandidate(cwd, name, link.path);
      if (error) {
        errors.push(error);
      } else {
        updatedConfig.links[name] = link;
        restored.push(`${name} → ${link.path}`);
      }
    }

    if (restored.length > 0) {
      await writeConfig(cwd, updatedConfig);
      for (const msg of restored) {
        p.log.success(msg);
      }
    }

    for (const msg of errors) {
      p.log.warn(msg);
    }

    if (restored.length === 0) {
      return {
        status: "error",
        message: "Nothing relinked. Use `samhail link` to link manually.",
      };
    }

    p.outro(
      `Relinked ${restored.length} package${restored.length > 1 ? "s" : ""}`,
    );
    return { status: "ok" };
  },
});
