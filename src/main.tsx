import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { registerSW } from "virtual:pwa-register";

import { getRouter } from "./router";
import "./styles.css";

if (typeof window !== "undefined") {
  window.addEventListener("error", (ev) => {
    console.error("[app] window.error", ev.message, ev.error?.stack || ev.error);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("[app] unhandledrejection", ev.reason?.stack || ev.reason);
  });
  registerSW({ immediate: true });
}

const el = document.getElementById("root");
if (!el) throw new Error("[main] #root element not found");

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
