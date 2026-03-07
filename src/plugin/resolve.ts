import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exports as resolveExports } from "resolve.exports";
import type { ResolveLinkedPackageOptions } from "../shared/types.js";

export function resolveLinkedPackage(
  options: ResolveLinkedPackageOptions,
): string | null {
  const { packageDir, subpath, conditions } = options;

  let pkg: Record<string, unknown>;
  try {
    const raw = readFileSync(join(packageDir, "package.json"), "utf-8");
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (pkg.exports) {
    const resolved = resolveExports(pkg, subpath, {
      conditions,
      unsafe: true,
    });
    if (resolved && resolved.length > 0) {
      return join(packageDir, resolved[0]);
    }
    return null;
  }

  // Fallback: module field (for import conditions), then main
  if (conditions.includes("import") && typeof pkg.module === "string") {
    return join(packageDir, pkg.module);
  }

  if (typeof pkg.main === "string") {
    return join(packageDir, pkg.main);
  }

  return null;
}
