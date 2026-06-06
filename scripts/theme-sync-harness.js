"use strict";

const assert = require("node:assert");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/xuxin/Documents/Agent/node_modules/playwright",
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_) {
      // Try the next known local install.
    }
  }
  throw new Error("playwright_unavailable");
}

async function main() {
  const baseUrl = process.env.NOTE_VISUAL_BASE_URL || "http://127.0.0.1:4181/?embed=hermes&theme=dark";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#app", { timeout: 10000 });

    const initial = await themeState(page);
    assert.equal(initial.embed, "hermes", "page should be in Hermes embed mode");
    assert.equal(initial.theme, "dark", "embed URL theme should initialize dark mode");

    await postTheme(page, { type: "hermes:theme", theme: "light" });
    const light = await themeState(page);
    assert.equal(light.theme, "light", "theme string should switch to light");

    await postTheme(page, { type: "hermes:theme", appearance: "dark" });
    const darkAppearance = await themeState(page);
    assert.equal(darkAppearance.theme, "dark", "appearance field should switch to dark");

    await postTheme(page, { type: "hermes:theme", dark: false });
    const lightBoolean = await themeState(page);
    assert.equal(lightBoolean.theme, "light", "boolean dark=false should switch to light");

    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://untrusted.example",
        data: { type: "hermes:theme", theme: "dark" },
      }));
    });
    const untrusted = await themeState(page);
    assert.equal(untrusted.theme, "light", "cross-origin Hermes theme message should be ignored");

    await postTheme(page, { type: "hermes:refresh", theme: "dark" });
    const unrelated = await themeState(page);
    assert.equal(unrelated.theme, "light", "unrelated Hermes messages should not change theme");

    console.log(JSON.stringify({
      ok: true,
      initialTheme: initial.theme,
      finalTheme: unrelated.theme,
      darkBackground: darkAppearance.background,
      lightBackground: lightBoolean.background,
    }));
  } finally {
    await browser.close();
  }
}

async function postTheme(page, data) {
  await page.evaluate((payload) => {
    window.postMessage(payload, window.location.origin);
  }, data);
  await page.waitForTimeout(50);
}

async function themeState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    return {
      embed: root.dataset.embed || "",
      theme: root.dataset.theme || "",
      background: styles.getPropertyValue("--bg").trim(),
      surface: styles.getPropertyValue("--surface").trim(),
    };
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
