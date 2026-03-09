# How It Works

The CLI and the bundler plugin communicate through two files on disk:

```
 CLI                                Plugin
 ───                                ──────
 writes .samhail.json ──────────▶  reads config
 writes .samhail.lock ──────────▶  checks heartbeat
```

The plugin reads; the CLI writes. There's no shared runtime state between them.

## Resolution

When the bundler encounters an import of a linked package, the plugin:

1. Checks the heartbeat: is the lock file fresh and is the PID still alive?
2. Looks up the package name in `.samhail.json`
3. Reads the package's `exports` field from its local `package.json`
4. Resolves the import to the corresponding local file path

Subpath exports are supported. `@myorg/shared/utils` resolves through the package's `exports["./utils"]` entry. The plugin uses `import`, `module`, and `default` conditions by default, matching standard ESM resolution order.

## Why the heartbeat

The heartbeat solves a specific problem: if `samhail start` crashes, the config file still points at local directories, but nothing is rebuilding them. Without a liveness check, the bundler would silently resolve stale files.

The lock file is written on start and refreshed every 5 seconds. The plugin checks both the timestamp and whether the process is still alive. If either check fails, resolution falls back to `node_modules`.
