# Getting Started

## Install

```bash
npm install samhail --save-dev
```

## Add the plugin

::: code-group

```ts [Vite]
// vite.config.ts
import samhail from "samhail/vite";

export default defineConfig({
  plugins: [samhail()],
});
```

```ts [Webpack]
// webpack.config.js
import samhail from "samhail/webpack";

export default {
  plugins: [samhail()],
};
```

```ts [Rspack]
// rspack.config.js
import samhail from "samhail/rspack";

export default {
  plugins: [samhail()],
};
```

```ts [esbuild]
import samhail from "samhail/esbuild";
import esbuild from "esbuild";

esbuild.build({
  plugins: [samhail()],
});
```

```ts [Rollup]
// rollup.config.js
import samhail from "samhail/rollup";

export default {
  plugins: [samhail()],
};
```

:::

## Link a package

```bash
npx samhail link
```

This walks you through picking a dependency from your `package.json`, pointing it at a local directory, and choosing a dev command. samhail looks for matching packages in sibling and nearby directories, so you usually won't need to type a path manually.

The result is a `.samhail.json` file in your project root. Add it and `.samhail.lock` to your `.gitignore`.

## Start

```bash
npx samhail start
```

This spawns the dev command for each linked package. While it's running, the bundler plugin resolves those packages from their local directories instead of `node_modules`.

`Ctrl+C` to stop. The heartbeat file is cleaned up and the plugin goes back to normal behavior.
