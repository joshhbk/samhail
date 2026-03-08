import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exports as resolveExports } from "resolve.exports";
import { isJsonObject, parseJson } from "./json.js";
import type { ExportCondition, ResolveLinkedPackageOptions } from "./types.js";

type PackageManifest = Record<string, unknown>;

export const DEFAULT_EXPORT_CONDITIONS: ExportCondition[] = [
  "import",
  "module",
  "default",
];

const OUTPUT_DIR_PATTERN = /^\.\/(dist|build|lib|out)\//;
const JS_EXT_PATTERN = /\.(js|mjs|cjs)$/;

export interface ResolvedPackageTarget {
  subpath: string;
  distPath: string;
  sourcePath: string | null;
  watchDir: string | null;
  isWildcard: boolean;
}

export type PackageTargetIndex = Record<string, ResolvedPackageTarget>;

function normalizePackageRelativePath(path: string): string {
  if (path.startsWith("./") || path.startsWith("../") || path.startsWith("/")) {
    return path;
  }
  return `./${path}`;
}

function stripDotSlash(path: string): string {
  return path.replace(/^\.\//, "");
}

function readPackageManifest(packageDir: string): PackageManifest | null {
  try {
    const raw = readFileSync(join(packageDir, "package.json"), "utf-8");
    return parseJson(raw, isJsonObject);
  } catch {
    return null;
  }
}

export function getExportSubpaths(pkg: PackageManifest): string[] {
  const exportsField = pkg.exports;

  if (!exportsField || typeof exportsField === "string") {
    return ["."];
  }

  if (typeof exportsField === "object") {
    const keys = Object.keys(exportsField as Record<string, unknown>);
    const isSubpathKeyed = keys.some((key) => key.startsWith("."));
    if (isSubpathKeyed) {
      return keys;
    }
    return ["."];
  }

  return ["."];
}

function resolveConditionPath(
  exportsValue: unknown,
  preferredConditions: readonly string[] = DEFAULT_EXPORT_CONDITIONS,
): string | null {
  if (typeof exportsValue === "string") {
    return normalizePackageRelativePath(exportsValue);
  }

  if (typeof exportsValue === "object" && exportsValue !== null) {
    const obj = exportsValue as Record<string, unknown>;
    for (const cond of preferredConditions) {
      if (typeof obj[cond] === "string") {
        return normalizePackageRelativePath(obj[cond] as string);
      }
    }
  }

  return null;
}

export function deriveSourcePath(distPath: string): string | null {
  const normalized = normalizePackageRelativePath(distPath);
  if (!OUTPUT_DIR_PATTERN.test(normalized)) return null;

  const withoutPrefix = normalized.replace(OUTPUT_DIR_PATTERN, "");
  const withoutExt = withoutPrefix.replace(JS_EXT_PATTERN, "");

  const sourceStem = `src/${withoutExt}`;
  return sourceStem.includes("*") ? sourceStem : `${sourceStem}.ts`;
}

export function deriveWatchDir(distPath: string): string | null {
  const normalized = normalizePackageRelativePath(distPath);
  if (!OUTPUT_DIR_PATTERN.test(normalized)) return null;

  const parent = dirname(stripDotSlash(normalized));
  return parent === "." ? null : parent;
}

function createTarget(subpath: string, distPath: string): ResolvedPackageTarget {
  const normalizedDistPath = normalizePackageRelativePath(distPath);

  return {
    subpath,
    distPath: normalizedDistPath,
    sourcePath: deriveSourcePath(normalizedDistPath),
    watchDir: deriveWatchDir(normalizedDistPath),
    isWildcard: subpath.includes("*"),
  };
}

function resolveDistPath(
  pkg: PackageManifest,
  subpath: string,
  conditions: ExportCondition[],
): string | null {
  if (pkg.exports) {
    if (subpath.includes("*")) {
      if (typeof pkg.exports !== "object" || pkg.exports === null) {
        return null;
      }

      return resolveConditionPath(
        (pkg.exports as Record<string, unknown>)[subpath],
        conditions,
      );
    }

    const resolved = resolveExports(pkg, subpath, {
      conditions,
      unsafe: true,
    });
    if (resolved && resolved.length > 0) {
      return normalizePackageRelativePath(resolved[0]);
    }
    return null;
  }

  if (subpath !== ".") return null;

  if (conditions.includes("import") && typeof pkg.module === "string") {
    return normalizePackageRelativePath(pkg.module);
  }

  if (typeof pkg.main === "string") {
    return normalizePackageRelativePath(pkg.main);
  }

  return null;
}

export function resolvePackageTarget(
  options: ResolveLinkedPackageOptions,
): ResolvedPackageTarget | null {
  const { packageDir, subpath, conditions } = options;
  const pkg = readPackageManifest(packageDir);
  if (!pkg) return null;

  const distPath = resolveDistPath(pkg, subpath, conditions);
  return distPath ? createTarget(subpath, distPath) : null;
}

export function buildPackageTargetIndex(
  packageDir: string,
  conditions: ExportCondition[] = DEFAULT_EXPORT_CONDITIONS,
): PackageTargetIndex | null {
  const pkg = readPackageManifest(packageDir);
  if (!pkg) return null;

  const index: PackageTargetIndex = {};

  for (const subpath of getExportSubpaths(pkg)) {
    const distPath = resolveDistPath(pkg, subpath, conditions);
    if (!distPath) continue;
    index[subpath] = createTarget(subpath, distPath);
  }

  return index;
}

export async function sourcePathExists(
  packageDir: string,
  sourcePath: string,
): Promise<boolean> {
  try {
    await access(join(packageDir, sourcePath));
    return true;
  } catch {
    return false;
  }
}

export function getPackageWatchDirs(
  packageDir: string,
  conditions: ExportCondition[] = DEFAULT_EXPORT_CONDITIONS,
): string[] {
  const index = buildPackageTargetIndex(packageDir, conditions);
  if (!index) return [];

  return [...new Set(Object.values(index).flatMap((target) => target.watchDir ?? []))];
}
