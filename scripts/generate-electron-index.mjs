import fs from "node:fs";
import path from "node:path";

/**
 * TanStack Start's production build does not emit a static index.html in dist/client.
 * Electron needs a stable file:// entrypoint, so we generate dist/index.html that
 * bootstraps the built client bundle.
 *
 * This is intentionally lightweight and avoids changing app runtime logic.
 */

const root = process.cwd();
const distDir = path.join(root, "dist");
const clientAssetsDir = path.join(distDir, "client", "assets");

function pickLargestMatching(prefix, ext) {
  if (!fs.existsSync(clientAssetsDir)) return null;
  const files = fs.readdirSync(clientAssetsDir);
  const matches = files.filter((f) => f.startsWith(prefix) && f.endsWith(ext));
  let best = null;
  let bestSize = -1;
  for (const name of matches) {
    try {
      const st = fs.statSync(path.join(clientAssetsDir, name));
      if (st.size > bestSize) {
        bestSize = st.size;
        best = name;
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

/** Vite often emits several `index-*.js` chunks; the real app entry is the largest. */
const mainJs = pickLargestMatching("index-", ".js");
const mainCss = pickLargestMatching("styles-", ".css");

if (!mainJs) {
  console.error(`[electron-index] Could not find dist/client/assets/index-*.js in ${clientAssetsDir}`);
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Al Raziq POS</title>
    <link rel="icon" href="/client/favicon.png" />
    <link rel="manifest" href="/client/manifest.webmanifest" />
    ${mainCss ? `<link rel="stylesheet" href="/client/assets/${mainCss}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/assets/${mainJs}"></script>
  </body>
</html>
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
console.log(`[electron-index] Wrote dist/index.html (js=${mainJs}${mainCss ? ` css=${mainCss}` : ""})`);

