import { defineCommand } from "citty";
import * as p from "@clack/prompts";

export function cancelGuard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  return value;
}

export function defineLocaldevCommand(
  options: Parameters<typeof defineCommand>[0],
) {
  const { run: originalRun, ...rest } = options;
  return defineCommand({
    ...rest,
    async run(context) {
      try {
        await originalRun?.(context);
      } catch (error) {
        p.log.error(
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    },
  });
}
