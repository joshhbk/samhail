import { join } from "node:path";
import * as p from "@clack/prompts";
import { readConfig } from "../../shared/config.js";
import { defineLocaldevCommand } from "../command.js";
import {
  buildPackageTargetIndex,
  DEFAULT_EXPORT_CONDITIONS,
  deriveSourcePath,
  getExportSubpaths,
  sourcePathExists,
} from "../../shared/package-targets.js";

export function getExportKeys(pkg: Record<string, unknown>): string[] {
  return getExportSubpaths(pkg);
}

export async function distToSrc(
  packageDir: string,
  distPath: string,
): Promise<string | null> {
  const sourcePath = deriveSourcePath(distPath);
  if (!sourcePath) return null;

  if (sourcePath.endsWith("/*")) {
    return sourcePath;
  }

  const basePath = sourcePath.slice(0, -3);
  for (const ext of [".ts", ".tsx"]) {
    const candidate = `${basePath}${ext}`;
    if (await sourcePathExists(packageDir, candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function buildPathEntries(
  packageName: string,
  packageDir: string,
  relativePath: string,
): Promise<Record<string, string[]>> {
  const paths: Record<string, string[]> = {};
  const index = buildPackageTargetIndex(packageDir, DEFAULT_EXPORT_CONDITIONS);
  if (!index) return paths;

  for (const target of Object.values(index)) {
    if (!target.sourcePath) continue;

    const tsConfigKey =
      target.subpath === "."
        ? packageName
        : `${packageName}/${target.subpath.slice(2)}`;

    const srcPath = target.isWildcard
      ? target.sourcePath
      : await distToSrc(packageDir, target.distPath);

    if (srcPath) {
      paths[tsConfigKey] = [`${relativePath}/${srcPath}`];
    }
  }

  return paths;
}

export const tsconfigCommand = defineLocaldevCommand({
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
        const message = error instanceof Error ? error.message : String(error);
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
