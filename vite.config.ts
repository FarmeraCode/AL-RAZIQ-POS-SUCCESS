// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

/** Lovable merges a default dev port of 8080; override so docs and `npm run dev:lan` stay consistent. */
const DEV_UI_PORT = Number(process.env.VITE_DEV_PORT || 5173);

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Custom client: static Electron/LAN `index.html` has no SSR `window.$_TSR` bootstrap.
    client: { entry: "src/client.tsx" },
  },
  vite: {
    base: "/",
    server: {
      host: "0.0.0.0",
      port: DEV_UI_PORT,
      strictPort: false,
    },
    plugins: [
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
            {
              src: "icon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^http:\/\/.*:7000\/api\/.*/i,
              handler: "NetworkOnly",
            },
          ],
        },
      }),
    ],
  },
});
