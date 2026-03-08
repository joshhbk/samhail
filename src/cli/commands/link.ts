import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { readConfig, writeConfig } from "../../shared/config.js";
import type { LocaldevConfig } from "../../shared/types.js";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

async function readPackageJson(dir: string): Promise<PackageJson | null> {
  try {
    const raw = await readFile(join(dir, "package.json"), "utf-8");
    return JSON.parse(raw) as PackageJson;
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

      // Skip the consumer directory itself
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

      // Check one level deeper (handles packages/ui-kit, libs/core, etc.)
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

function cancelGuard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  return value;
}

export const linkCommand = defineCommand({
  meta: {
    name: "link",
    description: "Link a dependency to a local directory",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("localdev link");

    // Step 1 — Read consumer's package.json
    const deps = await readConsumerDeps(cwd);
    if (deps.length === 0) {
      p.log.error(
        "No dependencies found in package.json. Install dependencies first.",
      );
      p.outro("Nothing to link.");
      process.exit(1);
    }

    // Step 2 — Pick dependency
    const existingConfig = await readConfig(cwd);
    const selectedDep = cancelGuard(
      await p.select({
        message: "Which dependency do you want to link locally?",
        options: deps.map((dep) => ({
          value: dep,
          label: dep,
          hint: existingConfig?.links[dep] ? "already linked" : undefined,
        })),
      }),
    );

    // Step 3 — Discover local path
    const discovered = await discoverLocalPackage(selectedDep, cwd);
    let selectedPath: string;

    if (discovered.length > 0) {
      const manualOption = "__manual__";
      const pathChoice = cancelGuard(
        await p.select({
          message: `Found local copies of ${selectedDep}. Pick one:`,
          options: [
            ...discovered.map((absPath) => ({
              value: absPath,
              label: relative(cwd, absPath),
              hint: absPath,
            })),
            {
              value: manualOption,
              label: "Enter path manually...",
            },
          ],
        }),
      );

      if (pathChoice === manualOption) {
        selectedPath = cancelGuard(
          await p.text({
            message: `Enter the path to ${selectedDep}:`,
            validate: (input) => {
              if (!input.trim()) return "Path is required.";
              return undefined;
            },
          }),
        );
        selectedPath = resolve(cwd, selectedPath);
      } else {
        selectedPath = pathChoice;
      }
    } else {
      const manualPath = cancelGuard(
        await p.text({
          message: `No local copies of ${selectedDep} found nearby. Enter the path:`,
          validate: (input) => {
            if (!input.trim()) return "Path is required.";
            return undefined;
          },
        }),
      );
      selectedPath = resolve(cwd, manualPath);
    }

    // Validate the chosen path
    const targetPkg = await readPackageJson(selectedPath);
    if (!targetPkg) {
      p.log.error(`No package.json found at ${selectedPath}`);
      p.outro("Cannot link.");
      process.exit(1);
    }
    if (targetPkg.name !== selectedDep) {
      p.log.error(
        `package.json at ${selectedPath} has name "${targetPkg.name}", expected "${selectedDep}".`,
      );
      p.outro("Cannot link.");
      process.exit(1);
    }

    const relativePath = relative(cwd, selectedPath);

    // Step 4 — Pick dev command
    const scripts = await readPackageScripts(selectedPath);
    const scriptEntries = Object.entries(scripts);
    let devCommand: string;

    const customOption = "__custom__";
    if (scriptEntries.length > 0) {
      const scriptChoice = cancelGuard(
        await p.select({
          message: "Which script should run for local development?",
          options: [
            ...scriptEntries.map(([name, cmd]) => ({
              value: cmd,
              label: name,
              hint: cmd,
            })),
            { value: customOption, label: "Custom command..." },
          ],
        }),
      );

      if (scriptChoice === customOption) {
        devCommand = cancelGuard(
          await p.text({
            message: "Enter the dev command:",
            validate: (input) => {
              if (!input.trim()) return "Command is required.";
              return undefined;
            },
          }),
        );
      } else {
        devCommand = scriptChoice;
      }
    } else {
      p.log.warn(`No scripts found in ${selectedDep}'s package.json.`);
      devCommand = cancelGuard(
        await p.text({
          message: "Enter the dev command:",
          validate: (input) => {
            if (!input.trim()) return "Command is required.";
            return undefined;
          },
        }),
      );
    }

    // Step 5 — Confirm & write
    p.log.step(`Package:  ${selectedDep}`);
    p.log.step(`Path:     ${relativePath}`);
    p.log.step(`Command:  ${devCommand}`);

    const confirmed = cancelGuard(
      await p.confirm({ message: "Write this link to .localdev.json?" }),
    );

    if (!confirmed) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    const config: LocaldevConfig = existingConfig ?? { links: {} };
    const linkEntry = { path: relativePath, dev: devCommand };
    config.links[selectedDep] = linkEntry;
    config.history = config.history ?? {};
    config.history[selectedDep] = linkEntry;
    await writeConfig(cwd, config);

    p.outro(`Linked ${selectedDep} → ${relativePath}`);
  },
});
