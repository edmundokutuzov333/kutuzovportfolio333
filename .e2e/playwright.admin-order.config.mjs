import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.mjs";

/** Isolated Admin verification: check Vite process readiness without SSR data loaders. */
const readyServer = {
  ...base.webServer,
  url: undefined,
  port: 5173,
  timeout: 120_000,
};

export default defineConfig(base, {
  webServer: readyServer,
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  }, {
    name: "mobile-webkit",
    use: { ...devices["iPhone 13"] },
  }],
});
