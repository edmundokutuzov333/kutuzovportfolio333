import { defineConfig, devices } from "@playwright/test";
import chromiumConfig from "./playwright.config.mjs";

/** Opt-in Safari-engine regression for mobile icon rendering; standard CI stays Chromium-only. */
export default defineConfig(chromiumConfig, {
  projects: [{
    name: "mobile-webkit",
    use: { ...devices["iPhone 13"] },
  }],
});
