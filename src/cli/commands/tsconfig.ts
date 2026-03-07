import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { exports as resolveExports } from "resolve.exports";
import { readConfig } from "../../shared/config.js";

const OUTPUT_DIR_PATTERN = /^\.\/(dist|build|lib|out)\//;
const JS_EXT_PATTERN = /\.(js|mjs|cjs)$/;

/**
 * Extract subpath keys from a package.json's `exports` field.
 * Returns `["."]` as fallback when there's no exports or it's a single-export shape.
 */
export function getExportKeys(pkg: Record<string, unknown>): string[] {
  const exportsField = pkg.exports;

  if (!exportsField || typeof exportsField === "string") {
    return ["."];
  }

  if (typeof exportsField === "object") {
    const keys = Object.keys(exportsField as Record<string, unknown>);
    const isSubpathKeyed = keys.some((k) => k.startsWith("."));
    if (isSubpathKeyed) {
      return keys;
    }
    // Condition-keyed object (e.g. { import: "...", require: "..." })
    return ["."];
  }

  return ["."];
}

/**
 * Map a dist output path to its source `.ts`/`.tsx` file.
 * Returns the relative source path (e.g. "src/index.ts") or null if not found.
 */
export async function distToSrc(
  packageDir: string,
  distPath: string,
): Promise<string | null> {
  const match = distPath.match(OUTPUT_DIR_PATTERN);
  if (!match) return null;

  const withoutPrefix = distPath.replace(OUTPUT_DIR_PATTERN, "");
  const withoutExt = withoutPrefix.replace(JS_EXT_PATTERN, "");

  for (const ext of [".ts", ".tsx"]) {
    const candidate = `src/${withoutExt}${ext}`;
    try {
      await access(join(packageDir, candidate));
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Resolve the dist path for a given condition from a raw exports value.
 * Walks through condition objects to find a string path.
 */
function resolveConditionPath(
  exportsValue: unknown,
  preferredConditions: string[] = ["import", "module", "default"],
): string | null {
  if (typeof exportsValue === "string") return exportsValue;

  if (typeof exportsValue === "object" && exportsValue !== null) {
    const obj = exportsValue as Record<string, unknown>;
    for (const cond of preferredConditions) {
      if (typeof obj[cond] === "string") return obj[cond] as string;
    }
  }

  return null;
}

/**
 * Convert a dist wildcard pattern to a src wildcard pattern string.
 */
function distPatternToSrcPattern(distPath: string): string | null {
  const match = distPath.match(OUTPUT_DIR_PATTERN);
  if (!match) return null;

  const withoutPrefix = distPath.replace(OUTPUT_DIR_PATTERN, "");
  const withoutExt = withoutPrefix.replace(JS_EXT_PATTERN, "");

  return `src/${withoutExt}`;
}

/**
 * Read a package's package.json, enumerate exports, map each to source,
 * and return the tsconfig `paths` record.
 */
export async function buildPathEntries(
  packageName: string,
  packageDir: string,
  relativePath: string,
): Promise<Record<string, string[]>> {
  const raw = await readFile(join(packageDir, "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  const keys = getExportKeys(pkg);
  const paths: Record<string, string[]> = {};

  for (const key of keys) {
    const isWildcard = key.includes("*");
    const tsConfigKey =
      key === "." ? packageName : `${packageName}/${key.slice(2)}`;

    if (isWildcard) {
      // For wildcard exports, read the dist pattern directly from raw exports
      const exportsField = pkg.exports as Record<string, unknown>;
      const distPath = resolveConditionPath(exportsField[key]);
      if (distPath) {
        const srcPattern = distPatternToSrcPattern(distPath);
        if (srcPattern) {
          paths[tsConfigKey] = [`${relativePath}/${srcPattern}`];
        }
      }
      continue;
    }

    // For non-wildcard exports, resolve via resolve.exports or fallback
    let distPath: string | null = null;

    if (pkg.exports) {
      const resolved = resolveExports(pkg, key, {
        conditions: ["import", "module", "default"],
        unsafe: true,
      });
      if (resolved && resolved.length > 0) {
        distPath = resolved[0];
      }
    } else {
      // Fallback to module or main
      if (typeof pkg.module === "string") {
        distPath = pkg.module as string;
      } else if (typeof pkg.main === "string") {
        distPath = pkg.main as string;
      }
    }

    if (!distPath) continue;

    const srcPath = await distToSrc(packageDir, distPath);
    if (srcPath) {
      paths[tsConfigKey] = [`${relativePath}/${srcPath}`];
    }
  }

  return paths;
}

export const tsconfigCommand = defineCommand({
  meta: {
    name: "tsconfig",
    description:
      "Print tsconfig paths that map linked packages to their source files",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("localdev tsconfig");

    const config = await readConfig(cwd);
    const entries = config ? Object.entries(config.links) : [];

    if (entries.length === 0) {
      p.outro("No packages linked.");
      return;
    }

    const allPaths: Record<string, string[]> = {};
    let packageCount = 0;

    for (const [name, link] of entries) {
      try {
        const packageDir = join(cwd, link.path);
        const relativePath = link.path;
        const pathEntries = await buildPathEntries(
          name,
          packageDir,
          relativePath,
        );
        if (Object.keys(pathEntries).length > 0) {
          Object.assign(allPaths, pathEntries);
          packageCount++;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        p.log.warn(`Skipping ${name}: ${message}`);
      }
    }

    if (Object.keys(allPaths).length === 0) {
      p.outro("No path mappings could be generated.");
      return;
    }

    const output = {
      compilerOptions: {
        paths: allPaths,
      },
    };

    p.log.message("Add these paths to your tsconfig.json:\n");
    console.log(JSON.stringify(output, null, 2));

    p.outro(
      `Generated paths for ${packageCount} package${packageCount === 1 ? "" : "s"}`,
    );
  },
});
