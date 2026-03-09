import { relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import { readConfig, writeConfig } from "../../shared/config.js";
import { cancelGuard, defineSamhailCommand } from "../command.js";
import {
  discoverLocalPackage,
  readConsumerDeps,
  readPackageScripts,
  validateLinkedPackage,
} from "./link-helpers.js";

export const linkCommand = defineSamhailCommand({
  meta: {
    name: "link",
    description: "Link a dependency to a local directory",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("samhail link");

    // Step 1 — Read consumer's package.json
    const deps = await readConsumerDeps(cwd);
    if (deps.length === 0) {
      return {
        status: "error",
        message:
          "No dependencies found in package.json. Install dependencies first.",
        detail: "Nothing to link.",
      };
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
            validate: (input = "") => {
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
          validate: (input = "") => {
            if (!input.trim()) return "Path is required.";
            return undefined;
          },
        }),
      );
      selectedPath = resolve(cwd, manualPath);
    }

    // Validate the chosen path
    const targetPackage = await validateLinkedPackage(
      selectedDep,
      selectedPath,
    );
    if (!targetPackage.ok && targetPackage.reason === "missing-package-json") {
      return {
        status: "error",
        message: `No package.json found at ${selectedPath}`,
        detail: "Cannot link.",
      };
    }
    if (!targetPackage.ok) {
      return {
        status: "error",
        message: `package.json at ${selectedPath} has name "${targetPackage.actualName}", expected "${selectedDep}".`,
        detail: "Cannot link.",
      };
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
            validate: (input = "") => {
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
          validate: (input = "") => {
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
      await p.confirm({ message: "Write this link to .samhail.json?" }),
    );

    if (!confirmed) {
      return { status: "cancelled" };
    }

    const linkEntry = { path: relativePath, dev: devCommand };
    const config = {
      links: {
        ...existingConfig?.links,
        [selectedDep]: linkEntry,
      },
      history: {
        ...existingConfig?.history,
        [selectedDep]: linkEntry,
      },
    };
    await writeConfig(cwd, config);

    p.outro(`Linked ${selectedDep} → ${relativePath}`);
    return { status: "ok" };
  },
});
