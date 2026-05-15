import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

// Register PWA service worker
if (typeof window !== "undefined") {
  registerSW({ immediate: true });
}

import { POSStartClient } from "./pos-start-client";

if (typeof window !== "undefined") {
  window.addEventListener("error", (ev) => {
    console.error("[app] window.error", ev.message, ev.error?.stack || ev.error);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("[app] unhandledrejection", ev.reason?.stack || ev.reason);
  });
}

const app = (
  <StrictMode>
    <POSStartClient />
  </StrictMode>
);

function ErrorDisplay({ error }: { error: any }) {
  return (
    <div style={{ padding: '20px', background: '#fff', color: '#000', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: 'red' }}>App Crash Detected</h1>
      <pre style={{ background: '#eee', padding: '10px', overflow: 'auto' }}>
        {String(error?.message || error)}
      </pre>
      <pre style={{ fontSize: '12px' }}>
        {error?.stack}
      </pre>
    </div>
  );
}

startTransition(() => {
  const el = document.getElementById("root");
  if (!el) {
    console.error("[client] #root element not found!");
    return;
  }

  try {
    createRoot(el).render(app);
  } catch (err) {
    console.error("[client] Fatal render error:", err);
    createRoot(el).render(<ErrorDisplay error={err} />);
  }
});
