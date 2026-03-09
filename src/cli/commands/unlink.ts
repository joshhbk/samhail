import { unlink } from "node:fs/promises";
import * as p from "@clack/prompts";
import { getConfigPath, readConfig, writeConfig } from "../../shared/config.js";
import { cancelGuard, defineSamhailCommand } from "../command.js";

export const unlinkCommand = defineSamhailCommand({
  meta: {
    name: "unlink",
    description: "Remove a linked package from .samhail.json",
  },
  async run() {
    const cwd = process.cwd();

    p.intro("samhail unlink");

    const config = await readConfig(cwd);
    const entries = config ? Object.entries(config.links) : [];

    if (entries.length === 0) {
      return {
        status: "error",
        message: "No linked packages found.",
        detail: "Nothing to unlink.",
      };
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
      return { status: "cancelled" };
    }

    // Save to history before removing
    config!.history = config!.history ?? {};
    config!.history[selectedName] = config!.links[selectedName];

    delete config!.links[selectedName];

    const remaining = Object.keys(config!.links).length;
    const hasHistory = Object.keys(config!.history).length > 0;

    if (remaining === 0 && !hasHistory) {
      await unlink(getConfigPath(cwd));
      p.outro(
        `Unlinked ${selectedName}. No packages remain — removed .samhail.json.`,
      );
    } else {
      await writeConfig(cwd, config!);
      p.outro(`Unlinked ${selectedName}`);
    }

    return { status: "ok" };
  },
});
