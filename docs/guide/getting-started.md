# Getting Started

## Install

```bash
npm install localdev --save-dev
```

## Add the plugin

::: code-group

```ts [Vite]
// vite.config.ts
import localdev from "localdev/vite";

export default defineConfig({
  plugins: [localdev()],
});
```

```ts [Webpack]
// webpack.config.js
import localdev from "localdev/webpack";

export default {
  plugins: [localdev()],
};
```

```ts [Rspack]
// rspack.config.js
import localdev from "localdev/rspack";

export default {
  plugins: [localdev()],
};
```

```ts [esbuild]
import localdev from "localdev/esbuild";
import esbuild from "esbuild";

esbuild.build({
  plugins: [localdev()],
});
```

```ts [Rollup]
// rollup.config.js
import localdev from "localdev/rollup";

export default {
  plugins: [localdev()],
};
```

:::

Vite gets the deepest integration (config watching, cache clearing, HMR). The other adapters handle resolution but don't yet hook into their bundler's dev lifecycle.

## Link a package

```bash
npx localdev link
```

You'll pick a dependency from your `package.json`, point it at a local directory, and choose a dev command. localdev auto-discovers matching packages in sibling and nearby directories so you usually don't have to type a path.

This writes a `.localdev.json` in your project root. Add it and `.localdev.lock` to `.gitignore`.

## Start

```bash
npx localdev start
```

Spawns the dev command for each linked package. Your bundler now resolves those packages from their local directories instead of `node_modules`.

`Ctrl+C` to stop. The heartbeat file is cleaned up and the plugin goes back to being a no-op.
