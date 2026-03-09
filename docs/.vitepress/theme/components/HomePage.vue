<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'

const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function copyCommand() {
  navigator.clipboard.writeText('npx samhail link')
  copied.value = true
  if (copyTimeout) clearTimeout(copyTimeout)
  copyTimeout = setTimeout(() => { copied.value = false }, 2000)
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer?.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  )
  document.querySelectorAll('.reveal').forEach((el) => observer?.observe(el))
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="home-page">
    <!-- ───────── Hero ───────── -->
    <section class="hero-section">
      <div class="hero-bg" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-text">
          <span class="hero-badge">npm package development</span>
          <h1 class="hero-title">
            <span>Develop packages</span>
            <span class="accent">locally.</span>
          </h1>
          <p class="hero-tagline">
            Link local npm packages to real consumer apps at the bundler level.
            No symlinks. No monorepo. No lockfile changes.
          </p>
          <div class="hero-actions">
            <a :href="withBase('/guide/getting-started')" class="action-btn primary">
              Get started
            </a>
            <a :href="withBase('/guide/how-it-works')" class="action-btn secondary">
              How it works
            </a>
          </div>
        </div>
        <div class="hero-visual">
          <div class="window-glow" aria-hidden="true"></div>
          <div class="window-frame terminal">
            <div class="window-chrome">
              <span class="dot close"></span>
              <span class="dot minimize"></span>
              <span class="dot expand"></span>
            </div>
            <div class="window-body">
              <pre class="window-code"><code><span class="tok-prompt">$</span> samhail start

  Starting watcher: <span class="tok-pkg">@depot/ui</span> → tsc --watch
  Starting watcher: <span class="tok-pkg">@depot/core</span> → bun dev

  <span class="tok-dim">[</span><span class="tok-pkg">@depot/ui</span><span class="tok-dim">]</span> watching for changes...
  <span class="tok-dim">[</span><span class="tok-pkg">@depot/core</span><span class="tok-dim">]</span> built successfully

  <span class="tok-ok">Watching 2 packages.</span> Press Ctrl+C to stop.</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── Steps ───────── -->
    <section class="steps-section">
      <div class="section-inner">
        <span class="section-label">How it works</span>
        <div class="steps-row">
          <div class="step reveal">
            <span class="step-num">01</span>
            <h3 class="step-title">Link</h3>
            <p class="step-desc">
              Point samhail at your local package directory with an interactive
              CLI prompt.
            </p>
          </div>
          <div class="step-connector" aria-hidden="true"><span></span></div>
          <div class="step reveal" style="transition-delay: 0.1s">
            <span class="step-num">02</span>
            <h3 class="step-title">Start</h3>
            <p class="step-desc">
              Run <code>samhail start</code> to spawn watchers and write a
              heartbeat file.
            </p>
          </div>
          <div class="step-connector" aria-hidden="true"><span></span></div>
          <div class="step reveal" style="transition-delay: 0.2s">
            <span class="step-num">03</span>
            <h3 class="step-title">Develop</h3>
            <p class="step-desc">
              Your bundler resolves linked packages from disk. Changes reflect
              instantly.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── Showcase ───────── -->
    <section class="showcase-section">
      <div class="section-inner">
        <div class="showcase-row">
          <div class="showcase-text">
            <span class="section-label peach">Configuration</span>
            <h2>One file. Zero ceremony.</h2>
            <p>
              <code>samhail link</code> writes a <code>.samhail.json</code>
              with your package mappings. The bundler plugin reads it
              automatically — no import map, no aliases, no manual wiring.
            </p>
          </div>
          <div class="showcase-visual">
            <div class="window-frame editor">
              <div class="window-chrome">
                <span class="dot close"></span>
                <span class="dot minimize"></span>
                <span class="dot expand"></span>
                <span class="window-title">.samhail.json</span>
              </div>
              <div class="window-body">
                <pre class="window-code"><code>{
  <span class="tok-key">"links"</span>: {
    <span class="tok-key">"@depot/ui"</span>: {
      <span class="tok-key">"path"</span>: <span class="tok-str">"../ui"</span>,
      <span class="tok-key">"dev"</span>: <span class="tok-str">"tsc --watch"</span>
    },
    <span class="tok-key">"@depot/core"</span>: {
      <span class="tok-key">"path"</span>: <span class="tok-str">"../core"</span>,
      <span class="tok-key">"dev"</span>: <span class="tok-str">"bun dev"</span>
    }
  }
}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <div class="showcase-row reverse">
          <div class="showcase-text">
            <span class="section-label">Bundler plugin</span>
            <h2>Works with your stack.</h2>
            <p>
              Drop in a plugin for Vite, Webpack, Rspack, esbuild, or Rollup.
              Each adapter is thin — the resolution logic is shared and tested
              once.
            </p>
          </div>
          <div class="showcase-visual">
            <div class="window-frame editor">
              <div class="window-chrome">
                <span class="dot close"></span>
                <span class="dot minimize"></span>
                <span class="dot expand"></span>
                <span class="window-title">vite.config.ts</span>
              </div>
              <div class="window-body">
                <pre class="window-code"><code><span class="tok-kw">import</span> { defineConfig } <span class="tok-kw">from</span> <span class="tok-str">"vite"</span>;
<span class="tok-kw">import</span> samhail <span class="tok-kw">from</span> <span class="tok-str">"samhail/vite"</span>;

<span class="tok-kw">export default</span> <span class="tok-fn">defineConfig</span>({
  plugins: [<span class="tok-fn">samhail</span>()],
});</code></pre>
              </div>
            </div>
          </div>
        </div>

        <div class="showcase-row">
          <div class="showcase-text">
            <span class="section-label peach">Safety</span>
            <h2>Safe when you're not using it.</h2>
            <p>
              No heartbeat file? The plugin is a no-op. Your production builds
              are never affected. Crash recovery is built in — stale heartbeats
              are detected and ignored.
            </p>
          </div>
          <div class="showcase-visual">
            <div class="window-frame terminal">
              <div class="window-chrome">
                <span class="dot close"></span>
                <span class="dot minimize"></span>
                <span class="dot expand"></span>
              </div>
              <div class="window-body">
                <pre class="window-code"><code><span class="tok-prompt">$</span> samhail status

  Session: <span class="tok-dim">not running</span>

  <span class="tok-pkg">@depot/ui</span>
  Path:    ../ui
  Command: tsc --watch

  <span class="tok-dim">1 package linked</span></code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── Bundlers ───────── -->
    <section class="bundlers-section">
      <div class="section-inner">
        <span class="section-label">Supported bundlers</span>
        <div class="bundler-row">
          <div class="bundler-pill">
            <span class="bundler-name">Vite</span>
          </div>
          <div class="bundler-pill">
            <span class="bundler-name">Webpack</span>
          </div>
          <div class="bundler-pill">
            <span class="bundler-name">Rspack</span>
          </div>
          <div class="bundler-pill">
            <span class="bundler-name">esbuild</span>
          </div>
          <div class="bundler-pill">
            <span class="bundler-name">Rollup</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── CTA ───────── -->
    <section class="cta-section">
      <div class="section-inner cta-inner">
        <h2 class="cta-heading">Start developing locally.</h2>
        <button class="cta-command" :class="{ copied }" @click="copyCommand" title="Copy to clipboard">
          <code>npx samhail link</code>
          <span class="copy-icon">
            <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
        </button>
        <a
          :href="withBase('/guide/getting-started')"
          class="action-btn primary"
        >
          Read the guide
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.home-page {
  --content-max: 1120px;
  --section-px: max(1.5rem, calc((100vw - var(--content-max)) / 2));
  width: 100%;
}

.section-inner {
  max-width: var(--content-max);
  margin: 0 auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

/* ── Section label ── */
.section-label {
  display: inline-block;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--vp-c-brand-1);
  margin-bottom: 1.25rem;
}

.section-label.peach {
  color: var(--c-peach);
}

/* ── Hero ── */
.hero-section {
  position: relative;
  padding: 6rem var(--section-px) 5rem;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse 50% 60% at 75% 10%,
      rgba(200, 238, 68, 0.08) 0%,
      transparent 70%
    ),
    radial-gradient(
      ellipse 35% 45% at 15% 85%,
      rgba(251, 146, 60, 0.06) 0%,
      transparent 70%
    );
  pointer-events: none;
}

:root:not(.dark) .hero-bg {
  background:
    radial-gradient(
      ellipse 50% 60% at 75% 10%,
      rgba(90, 122, 0, 0.06) 0%,
      transparent 70%
    ),
    radial-gradient(
      ellipse 35% 45% at 15% 85%,
      rgba(194, 65, 12, 0.04) 0%,
      transparent 70%
    );
}

.hero-inner {
  position: relative;
  max-width: var(--content-max);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

/* ── Hero text ── */
.hero-badge {
  display: inline-block;
  font-family: var(--vp-font-family-mono);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 0.35rem 0.9rem;
  border-radius: 100px;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
  margin-bottom: 1.5rem;
  animation: fadeUp 0.6s ease both;
}

.hero-title {
  font-size: clamp(2.6rem, 5vw, 4.2rem);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: -0.04em;
  margin: 0 0 1.5rem;
  animation: fadeUp 0.6s ease 0.08s both;
}

.hero-title span {
  display: block;
}

.hero-title .accent {
  background: linear-gradient(
    135deg,
    var(--vp-c-brand-1) 30%,
    var(--c-peach) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-tagline {
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  max-width: 420px;
  margin: 0 0 2rem;
  animation: fadeUp 0.6s ease 0.16s both;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  animation: fadeUp 0.6s ease 0.24s both;
}

.hero-visual {
  position: relative;
  animation: fadeUp 0.7s ease 0.32s both;
}

/* ── Buttons ── */
.action-btn {
  display: inline-flex;
  align-items: center;
  font-family: var(--vp-font-family-base);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.65rem 1.5rem;
  border-radius: 6px;
  text-decoration: none;
  transition:
    filter 0.2s ease,
    transform 0.15s ease,
    background 0.2s ease;
}

.action-btn.primary {
  background: var(--vp-c-brand-1);
  color: #0a0a0a;
}

:root:not(.dark) .action-btn.primary {
  color: #fff;
}

.action-btn.primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-btn.secondary {
  border: 1px solid var(--c-peach);
  color: var(--c-peach);
  background: transparent;
}

.action-btn.secondary:hover {
  background: var(--c-peach-soft);
  transform: translateY(-1px);
}

/* ── Window frames ── */
.window-frame {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  transition:
    transform 0.35s ease,
    box-shadow 0.35s ease;
}

.window-frame:hover {
  transform: translateY(-4px);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.15),
    0 0 0 1px var(--vp-c-divider);
}

/* Terminal variant — always dark chrome */
.window-frame.terminal {
  background: #0d0d10;
  border-color: #1e1e22;
}

.window-frame.terminal .window-chrome {
  background: #161619;
  border-bottom-color: #1e1e22;
}

.window-chrome {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 16px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.dot.close {
  background: #ff5f57;
}

.dot.minimize {
  background: #febc2e;
}

.dot.expand {
  background: #28c840;
}

.window-title {
  margin-left: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--vp-c-text-3);
}

.window-frame.terminal .window-title {
  color: #555;
}

/* ── Window code blocks ── */
.window-code {
  margin: 0;
  padding: 1.25rem 1.5rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.7;
  white-space: pre;
  overflow-x: auto;
  color: var(--vp-c-text-2);
  border: none;
  border-radius: 0;
  background: none;
}

.window-code code {
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  line-height: inherit;
}

.window-frame.terminal .window-code {
  color: #a0a0a0;
}

.tok-prompt {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.tok-kw {
  color: var(--c-peach);
}

.tok-str {
  color: var(--vp-c-brand-1);
}

.tok-fn {
  color: var(--c-peach);
}

.tok-key {
  color: var(--c-peach);
}

.tok-pkg {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.tok-ok {
  color: var(--vp-c-brand-1);
}

.tok-dim {
  color: var(--vp-c-text-3);
}

.window-frame.terminal .tok-dim {
  color: #555;
}

/* ── Hero window glow ── */
.window-glow {
  position: absolute;
  width: 75%;
  height: 65%;
  top: 18%;
  left: 12%;
  background: radial-gradient(
    ellipse at center,
    rgba(200, 238, 68, 0.1) 0%,
    transparent 70%
  );
  filter: blur(50px);
  pointer-events: none;
  z-index: -1;
}

:root:not(.dark) .window-glow {
  background: radial-gradient(
    ellipse at center,
    rgba(90, 122, 0, 0.08) 0%,
    transparent 70%
  );
}

/* ── Steps ── */
.steps-section {
  padding: 5rem var(--section-px);
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}

.steps-row {
  display: flex;
  align-items: flex-start;
  margin-top: 2.5rem;
}

.step {
  flex: 1;
  padding: 0 0.75rem;
}

.step-num {
  display: block;
  font-family: var(--vp-font-family-mono);
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1;
  color: var(--vp-c-brand-1);
  margin-bottom: 1rem;
  letter-spacing: -0.05em;
}

.step:nth-child(3) .step-num {
  background: linear-gradient(
    135deg,
    var(--vp-c-brand-1) 40%,
    var(--c-peach)
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.step:nth-child(5) .step-num {
  color: var(--c-peach);
}

.step-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  letter-spacing: -0.02em;
}

.step-desc {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  margin: 0;
}

.step-desc code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--c-peach-soft);
  color: var(--c-peach);
  font-weight: 500;
}

.step-connector {
  display: flex;
  align-items: center;
  padding-top: 1.5rem;
  flex-shrink: 0;
  width: 48px;
}

.step-connector span {
  display: block;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--c-peach));
  border-radius: 1px;
  opacity: 0.5;
}

/* ── Showcase ── */
.showcase-section {
  padding: 6rem var(--section-px) 2rem;
}

.showcase-row {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: center;
  margin-bottom: 6rem;
}

.showcase-row:last-child {
  margin-bottom: 2rem;
}

.showcase-row.reverse {
  grid-template-columns: 1.15fr 1fr;
}

.showcase-row.reverse .showcase-visual {
  order: -1;
}

.showcase-text h2 {
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.03em;
  margin: 0 0 1rem;
}

.showcase-text p {
  font-size: 0.95rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
  margin: 0;
}

.showcase-text code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.84em;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--c-peach-soft);
  color: var(--c-peach);
  font-weight: 500;
}

/* ── Bundlers ── */
.bundlers-section {
  padding: 4.5rem var(--section-px);
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.bundler-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.bundler-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1rem 1.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.bundler-pill:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.bundler-name {
  font-family: var(--vp-font-family-mono);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* ── CTA ── */
.cta-section {
  padding: 6rem var(--section-px);
  background: var(--vp-c-bg-alt);
}

.cta-inner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cta-heading {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 0 0 2rem;
}

.cta-command {
  margin-bottom: 2rem;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 1.2rem 0.8rem 1.6rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.cta-command:hover {
  border-color: var(--c-peach);
}

.cta-command code {
  font-family: var(--vp-font-family-mono);
  font-size: 1rem;
  font-weight: 500;
  color: var(--c-peach);
  background: none;
  border: none;
  padding: 0;
}

.copy-icon {
  display: flex;
  color: var(--vp-c-text-3);
  transition: color 0.2s ease;
}

.cta-command:hover .copy-icon {
  color: var(--vp-c-text-2);
}

.cta-command.copied .copy-icon {
  color: var(--vp-c-brand-1);
}

.copy-icon svg {
  width: 16px;
  height: 16px;
}

/* ── Animations ── */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition:
    opacity 0.7s ease,
    transform 0.7s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Responsive ── */
@media (max-width: 959px) {
  .hero-section {
    padding: 4rem 1.5rem 3.5rem;
  }

  .hero-inner {
    grid-template-columns: 1fr;
    gap: 3rem;
  }

  .hero-visual {
    max-width: 520px;
  }

  .showcase-row,
  .showcase-row.reverse {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .showcase-row.reverse .showcase-visual {
    order: 0;
  }

  .showcase-row {
    margin-bottom: 4.5rem;
  }
}

@media (max-width: 639px) {
  .hero-section {
    padding: 3rem 1.25rem 2.5rem;
  }

  .hero-title {
    font-size: 2.4rem;
  }

  .steps-section {
    padding: 3.5rem 1.25rem;
  }

  .steps-row {
    flex-direction: column;
    gap: 1.5rem;
  }

  .step {
    padding: 0;
  }

  .step-num {
    font-size: 2.4rem;
  }

  .step-connector {
    width: 2px;
    height: 28px;
    padding: 0;
    margin-left: 1.2rem;
  }

  .step-connector span {
    width: 2px;
    height: 100%;
    background: linear-gradient(180deg, var(--vp-c-brand-1), var(--c-peach));
  }

  .showcase-section {
    padding: 4rem 1.25rem 1rem;
  }

  .showcase-row {
    margin-bottom: 3.5rem;
  }

  .bundlers-section {
    padding: 3rem 1.25rem;
  }

  .bundler-row {
    gap: 0.5rem;
  }

  .bundler-pill {
    padding: 0.75rem 1.1rem;
  }

  .cta-section {
    padding: 4rem 1.25rem;
  }

  .cta-heading {
    font-size: 1.8rem;
  }
}
</style>
