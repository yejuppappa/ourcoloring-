import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ourcoloring.com",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "ko",
    locales: ["ko", "en"],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
