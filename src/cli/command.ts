import { defineCommand } from "citty";
import * as p from "@clack/prompts";

export type CommandResult =
  | { status: "ok" }
  | { status: "error"; message: string; detail?: string }
  | { status: "cancelled" };

class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

export function cancelGuard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    throw new CancelledError();
  }
  return value;
}

export function defineSamhailCommand(
  options: Omit<Parameters<typeof defineCommand>[0], "run"> & {
    run?: (...args: Parameters<NonNullable<Parameters<typeof defineCommand>[0]["run"]>>) => Promise<CommandResult>;
  },
) {
  const { run: originalRun, ...rest } = options;
  return defineCommand({
    ...rest,
    async run(context) {
      try {
        const result = await originalRun?.(context);

        if (!result || result.status === "ok") return;

        if (result.status === "cancelled") {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }

        if (result.status === "error") {
          if (result.detail) {
            p.log.error(result.message);
            p.outro(result.detail);
          } else {
            p.outro(result.message);
          }
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof CancelledError) {
          p.cancel("Operation cancelled.");
          process.exit(0);
        }
        p.log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    },
  });
}
