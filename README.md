# localdev

Zero-choreography local npm package development across repos.

`localdev` lets you develop npm packages locally against a consumer app without symlinks, lockfile churn, or `node_modules` mutation. It works by resolving linked packages at the bundler level and orchestrating dev watchers from the CLI.

## Install

```bash
npm install localdev --save-dev
```

## Quick start

### 1. Add the plugin to your bundler

```ts
// vite.config.ts
import localdev from "localdev/vite";

export default defineConfig({
  plugins: [localdev()],
});
```

Also available for Webpack, Rspack, esbuild, and Rollup:

```ts
import localdev from "localdev/webpack";
import localdev from "localdev/rspack";
import localdev from "localdev/esbuild";
import localdev from "localdev/rollup";
```

### 2. Link a local package

```bash
npx localdev link
```

This walks you through picking a dependency, pointing it at a local directory, and choosing a dev command. The result is a `.localdev.json` file in your project root.

### 3. Start dev watchers

```bash
npx localdev start
```

This spawns the dev command for each linked package and keeps a heartbeat file (`.localdev.lock`) so the bundler plugin knows the session is active. Your bundler will resolve linked packages from their local directories instead of `node_modules`.

Press `Ctrl+C` to stop.

## CLI commands

| Command             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `localdev link`     | Link a dependency to a local directory                 |
| `localdev unlink`   | Remove a linked package                                |
| `localdev relink`   | Restore previously linked packages from history        |
| `localdev start`    | Start dev watchers for all linked packages             |
| `localdev status`   | Show linked packages and session state                 |
| `localdev tsconfig` | Print tsconfig paths mapping linked packages to source |

## How it works

The system has two halves that communicate through a small filesystem contract:

- **CLI** manages config (`.localdev.json`), watcher processes, and session state (`.localdev.lock`)
- **Bundler plugin** reads the config, checks if a session is active, and rewrites module resolution for linked packages

When `localdev start` is running, the plugin resolves imports of linked packages to their local directories. When it's not running, the plugin is a no-op and your bundler behaves normally.

## Config

`localdev link` generates a `.localdev.json` file:

```json
{
  "links": {
    "@myorg/shared": {
      "path": "../shared",
      "dev": "tsup --watch"
    }
  }
}
```

Add `.localdev.json` and `.localdev.lock` to your `.gitignore`.

## License

MIT
