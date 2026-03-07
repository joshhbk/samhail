import { unlink } from "node:fs/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import {
  getConfigPath,
  readConfig,
  writeConfig,
} from "../../shared/config.js";

function cancelGuard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  return value;
}

export const unlinkCommand = defineCommand({
  meta: {
    name: "unlink",
    description: "Remove a linked package from .localdev.json",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("localdev unlink");

    const config = await readConfig(cwd);
    const entries = config ? Object.entries(config.links) : [];

    if (entries.length === 0) {
      p.log.error("No linked packages found.");
      p.outro("Nothing to unlink.");
      process.exit(1);
    }

    let selectedName: string;

    if (entries.length === 1) {
      selectedName = entries[0][0];
    } else {
      selectedName = cancelGuard(
        await p.select({
          message: "Which package do you want to unlink?",
          options: entries.map(([name, link]) => ({
            value: name,
            label: name,
            hint: link.path,
          })),
        }),
      );
    }

    const confirmed = cancelGuard(
      await p.confirm({ message: `Unlink ${selectedName}?` }),
    );

    if (!confirmed) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    delete config!.links[selectedName];

    const remaining = Object.keys(config!.links).length;

    if (remaining === 0) {
      await unlink(getConfigPath(cwd));
      p.outro(
        `Unlinked ${selectedName}. No packages remain \u2014 removed .localdev.json.`,
      );
    } else {
      await writeConfig(cwd, config!);
      p.outro(`Unlinked ${selectedName}`);
    }
  },
});
