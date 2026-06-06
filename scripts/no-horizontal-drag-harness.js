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

async function measure(page) {
  return page.evaluate(() => {
    const read = (selector) => {
      const node = selector === "document" ? document.documentElement : document.querySelector(selector);
      if (!node) return null;
      return {
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflowX: getComputedStyle(node).overflowX,
      };
    };
    return {
      document: read("document"),
      body: read("body"),
      app: read("#app"),
      workspace: read(".workspace"),
      homeSurface: read(".home-surface"),
      editorPanel: read(".editor-panel"),
    };
  });
}

function assertNoPageOverflow(metrics, label) {
  for (const key of ["document", "body", "app", "workspace"]) {
    const item = metrics[key];
    assert.ok(item, `${label}: missing ${key}`);
    assert.ok(
      item.scrollWidth <= item.clientWidth + 1,
      `${label}: ${key} has horizontal overflow ${item.scrollWidth} > ${item.clientWidth}`
    );
  }
}

async function main() {
  const baseUrl = process.env.NOTE_VISUAL_BASE_URL || "http://127.0.0.1:4181/?embed=hermes";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".note-swipe-row", { timeout: 10000 });
    await page.waitForTimeout(250);
    const home = await measure(page);
    assertNoPageOverflow(home, "home");

    await page.locator(".note-swipe-row .note-swipe-content").first().click();
    await page.waitForSelector("#editor-panel.is-open", { timeout: 5000 });
    await page.waitForTimeout(250);
    const editor = await measure(page);
    assertNoPageOverflow(editor, "editor");

    console.log(JSON.stringify({
      ok: true,
      viewportWidth: home.document.clientWidth,
      homeDocumentScrollWidth: home.document.scrollWidth,
      editorDocumentScrollWidth: editor.document.scrollWidth,
      bodyOverflowX: home.body.overflowX,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
