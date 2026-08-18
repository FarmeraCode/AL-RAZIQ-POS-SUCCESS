import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

import { devApi } from "./vite-plugin-dev-api";

/**
 * Plain Vite SPA — builds a static `dist/` that any host can serve.
 * `api/` is deployed alongside it as serverless functions (see vercel.json);
 * in dev those same handlers run through the devApi() middleware below.
 */
export default defineConfig({
  base: "/",
  plugins: [
    // Generates src/routeTree.gen.ts from src/routes/** (must run before React).
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: {
        name: "Al Raziq POS",
        short_name: "POS",
        description: "Professional Restaurant Point of Sale System",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Client-side routing: unknown paths fall back to the app shell,
        // but API calls must always hit the network.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /^.*\/api\/.*$/i, handler: "NetworkOnly" }],
      },
    }),
    devApi(),
  ],
  server: {
    // 5173 is often taken by another Vite project on this machine.
    port: 5174,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
