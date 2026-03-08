---
layout: home
hero:
  name: localdev
  tagline: Develop local npm packages against real consumer apps. No symlinks, no lockfile churn, no ceremony.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Under the Hood
      link: /guide/how-it-works
features:
  - title: Bundler-level resolution
    details: Your bundler resolves linked packages directly from local directories. No npm link, no node_modules mutation, no phantom dependency issues.
  - title: Works with your stack
    details: Vite, Webpack, Rspack, esbuild, Rollup. One plugin core, thin adapter per bundler.
  - title: Safe no-op
    details: Not running localdev? The plugin does nothing. Your builds are unaffected.
---
