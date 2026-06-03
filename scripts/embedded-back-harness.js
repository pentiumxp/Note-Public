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
  const baseUrl = process.env.NOTE_VISUAL_BASE_URL || "http://127.0.0.1:4173/?embed=hermes";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => {
    window.__notePluginMessages = [];
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "note.plugin.navigation" || data.type === "note.plugin.back_result") {
        window.__notePluginMessages.push(data);
      }
    });
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".note-swipe-row", { timeout: 10000 });
    await page.locator(".note-swipe-row .note-swipe-content").first().click();
    await page.waitForSelector("#editor-panel.is-open", { timeout: 5000 });
    await page.waitForFunction(() => window.__notePluginMessages.some((item) => (
      item.type === "note.plugin.navigation" && item.canGoBack === true
    )), null, { timeout: 5000 });

    const beforeBack = await page.evaluate(() => ({
      editorOpen: document.querySelector("#editor-panel")?.classList.contains("is-open"),
      canGoBack: window.__notePluginMessages.some((item) => item.type === "note.plugin.navigation" && item.canGoBack === true),
    }));
    assert.equal(beforeBack.editorOpen, true, "editor should be open before host back");
    assert.equal(beforeBack.canGoBack, true, "plugin should report internal canGoBack=true");

    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "hermes.plugin.back", version: 1 },
        origin: window.location.origin,
      }));
    });
    await page.waitForFunction(() => !document.querySelector("#editor-panel")?.classList.contains("is-open"), null, { timeout: 5000 });

    const afterBack = await page.evaluate(() => {
      const messages = window.__notePluginMessages;
      const lastBack = [...messages].reverse().find((item) => item.type === "note.plugin.back_result");
      const lastNavigation = [...messages].reverse().find((item) => item.type === "note.plugin.navigation");
      return {
        editorOpen: document.querySelector("#editor-panel")?.classList.contains("is-open"),
        handled: lastBack?.handled,
        surface: lastNavigation?.route?.surface,
        canGoBack: lastNavigation?.canGoBack,
      };
    });

    assert.equal(afterBack.editorOpen, false, "host back should close the internal editor first");
    assert.equal(afterBack.handled, true, "plugin should report handled back");
    assert.equal(afterBack.surface, "home", "navigation should return to home surface");
    assert.equal(afterBack.canGoBack, false, "home surface should report canGoBack=false");

    console.log(JSON.stringify({
      ok: true,
      handled: afterBack.handled,
      surfaceAfterBack: afterBack.surface,
      canGoBackAfterBack: afterBack.canGoBack,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
