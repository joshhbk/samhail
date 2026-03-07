import { defineCommand, runMain } from "citty";
import { linkCommand } from "./commands/link.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { tsconfigCommand } from "./commands/tsconfig.js";
import { unlinkCommand } from "./commands/unlink.js";

const main = defineCommand({
  meta: {
    name: "localdev",
    version: "0.1.0",
    description:
      "Zero-choreography local npm package development across repos",
  },
  subCommands: {
    link: linkCommand,
    start: startCommand,
    status: statusCommand,
    tsconfig: tsconfigCommand,
    unlink: unlinkCommand,
  },
});

runMain(main);
