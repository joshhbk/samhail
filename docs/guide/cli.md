# CLI

All commands run via `npx localdev <command>`.

## `link`

Interactive. Prompts you to pick a dependency, choose a local path, and select a dev command. Writes the result to `.localdev.json` and saves it to history.

Auto-discovers matching packages in sibling directories and one level deeper, so for most project layouts you're just confirming a path rather than typing one.

## `unlink`

Removes a linked package. The entry gets moved to history (not deleted) so `relink` can restore it later. If nothing remains and there's no history, the config file is deleted entirely.

## `relink`

Restores packages from history. Validates that directories still exist and package names still match before restoring. Useful when you unlinked something temporarily and want it back without re-running the interactive `link` flow.

## `start`

Spawns each linked package's dev command and writes a `.localdev.lock` heartbeat file, refreshed every 5 seconds. The bundler plugin uses this to know whether to activate.

One session per project. If a stale lock file exists from a crashed session, it's cleaned up automatically.

Runs until `Ctrl+C`. On shutdown, watchers are killed and the lock file is removed.

## `status`

Shows whether a session is running (with PID and uptime) and lists all linked packages. Flags missing directories.

## `tsconfig`

Generates `compilerOptions.paths` entries that map linked packages to their source files. This gives your editor go-to-definition into the linked package's actual `.ts` files instead of compiled output.

Reads each package's `exports` field and derives source paths from dist paths (e.g., `./dist/index.js` → `./src/index.ts`). Outputs JSON you can merge into your `tsconfig.json`.
