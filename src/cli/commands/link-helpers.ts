import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isJsonObject } from "../../shared/json.js";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

async function readPackageJson(dir: string): Promise<PackageJson | null> {
  try {
    const raw = await readFile(join(dir, "package.json"), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) return null;
    return parsed as PackageJson;
  } catch {
    return null;
  }
}

export async function readConsumerDeps(cwd: string): Promise<string[]> {
  const pkg = await readPackageJson(cwd);
  if (!pkg) return [];
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return Object.keys(deps).sort();
}

export async function discoverLocalPackage(
  name: string,
  cwd: string,
): Promise<string[]> {
  const matches: string[] = [];
  const parentDir = resolve(cwd, "..");
  const grandparentDir = resolve(cwd, "../..");

  const searchDirs = [parentDir, grandparentDir];

  for (const searchDir of searchDirs) {
    let entries: string[];
    try {
      entries = await readdir(searchDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const candidate = join(searchDir, entry);

      if (resolve(candidate) === resolve(cwd)) continue;

      try {
        const s = await stat(candidate);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }

      const pkg = await readPackageJson(candidate);
      if (pkg?.name === name && !matches.includes(candidate)) {
        matches.push(candidate);
        continue;
      }

      let subEntries: string[];
      try {
        subEntries = await readdir(candidate);
      } catch {
        continue;
      }

      for (const subEntry of subEntries) {
        const subCandidate = join(candidate, subEntry);
        if (resolve(subCandidate) === resolve(cwd)) continue;
        try {
          const ss = await stat(subCandidate);
          if (!ss.isDirectory()) continue;
        } catch {
          continue;
        }

        const subPkg = await readPackageJson(subCandidate);
        if (subPkg?.name === name && !matches.includes(subCandidate)) {
          matches.push(subCandidate);
        }
      }
    }
  }

  return matches;
}

export async function readPackageScripts(
  packageDir: string,
): Promise<Record<string, string>> {
  const pkg = await readPackageJson(packageDir);
  return pkg?.scripts ?? {};
}

export async function validateLinkedPackage(
  expectedName: string,
  packageDir: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "missing-package-json" }
  | { ok: false; reason: "name-mismatch"; actualName?: string }
> {
  const pkg = await readPackageJson(packageDir);
  if (!pkg) {
    return { ok: false, reason: "missing-package-json" };
  }

  if (pkg.name !== expectedName) {
    return { ok: false, reason: "name-mismatch", actualName: pkg.name };
  }

  return { ok: true };
}
