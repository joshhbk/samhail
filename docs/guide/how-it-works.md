# Under the Hood

## The two halves

The CLI and the bundler plugin never talk to each other directly. They communicate through two files:

```
 CLI                                Plugin
 ───                                ──────
 writes .localdev.json ──────────▶  reads config
 writes .localdev.lock ──────────▶  checks heartbeat
```

No sockets, no IPC, no shared memory. The plugin reads files; the CLI writes them. That's the entire contract.

## Resolution

When your bundler hits an import of a linked package, the plugin:

1. Checks the heartbeat (is the lock file fresh? is the PID alive?)
2. Looks up the package in `.localdev.json`
3. Reads the package's `exports` field from its local `package.json`
4. Resolves the import to the local file path

So `import { thing } from "@myorg/shared"` resolves to something like `../shared/dist/index.js` — the real file on disk, not whatever's in `node_modules`.

Subpath exports work too. `@myorg/shared/utils` resolves through the package's `exports["./utils"]` entry.

## Export conditions

The plugin resolves using `import`, `module`, and `default` conditions by default, matching standard ESM resolution order. It uses the `resolve.exports` library for the actual resolution logic, so edge cases in the `exports` spec are handled correctly.

## The heartbeat

The heartbeat exists to solve one specific problem: what happens when `localdev start` crashes?

Without it, a crashed session leaves `.localdev.json` pointing at local directories while nothing is rebuilding them. Your bundler resolves stale files and you get confusing errors that have nothing to do with your code.

The lock file is written on start and refreshed every 5 seconds. The plugin checks both the timestamp and whether the PID is alive. If either check fails, resolution falls back to normal `node_modules` behavior.

## Vite-specific behavior

Vite gets more than just resolution rewriting:

- **Config watching** — the dev server restarts when `.localdev.json` or `.localdev.lock` changes, so starting/stopping a session or linking a new package takes effect immediately.
- **Cache clearing** — Vite's module graph cache is cleared on restart to avoid serving stale resolutions.
- **Watch roots** — linked package directories are added to Vite's file watcher, so changes in the linked package trigger HMR in the consumer app.

The other bundler adapters (Webpack, Rspack, esbuild, Rollup) handle resolution but don't hook into their dev server lifecycle yet.
