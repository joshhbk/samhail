# CLI

All commands run via `npx samhail <command>`.

## `link`

Interactive setup for linking a local package. Prompts you to pick a dependency, choose a local path, and select a dev command. Writes the result to `.samhail.json` and saves it to history.

samhail looks for matching packages in sibling directories and one level deeper, so for most project layouts you'll be selecting from a list rather than typing a path.

## `unlink`

Removes a linked package from the active config. The entry is moved to history so `relink` can restore it later. If no packages remain and there's no history, the config file is deleted.

## `relink`

Restores packages from history. Checks that directories still exist and package names still match before restoring. Useful when you've temporarily unlinked something and want it back without going through the interactive `link` flow again.

## `start`

Spawns each linked package's dev command and writes a `.samhail.lock` heartbeat file, refreshed every 5 seconds. The bundler plugin checks this file to decide whether to activate.

One session per project. If a stale lock file exists from a previous crashed session, it's cleaned up automatically.

Runs until `Ctrl+C`. On shutdown, watchers are terminated and the lock file is removed.

## `status`

Shows whether a session is running (with PID and uptime) and lists all linked packages with their paths and dev commands. Flags any missing directories.

## `tsconfig`

Generates `compilerOptions.paths` entries that map linked packages to their TypeScript source files. This gives your editor go-to-definition into the package's `.ts` files rather than compiled output.

Reads each package's `exports` field and derives source paths from dist paths (e.g., `./dist/index.js` becomes `./src/index.ts`). Outputs JSON you can merge into your `tsconfig.json`.
