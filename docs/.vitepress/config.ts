import { defineConfig } from "vitepress";

export default defineConfig({
  title: "samhail",
  description: "Local npm package development across repos",
  base: "/samhail/",
  head: [
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
    ],
  ],
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/" }],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Why samhail", link: "/guide/" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "CLI", link: "/guide/cli" },
          { text: "Config", link: "/guide/config" },
          { text: "How It Works", link: "/guide/how-it-works" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/joshhbk/samhail" },
    ],
  },
});
