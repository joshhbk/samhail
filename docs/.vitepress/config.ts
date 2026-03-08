import { defineConfig } from "vitepress";

export default defineConfig({
  title: "localdev",
  description:
    "Zero-choreography local npm package development across repos",
  base: "/localdev/",
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/" }],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "What is localdev?", link: "/guide/" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "CLI Reference", link: "/guide/cli" },
          { text: "Config Reference", link: "/guide/config" },
          { text: "How It Works", link: "/guide/how-it-works" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/joshhbk/localdev" },
    ],
  },
});
