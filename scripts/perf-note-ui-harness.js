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
  const baseUrl = process.env.NOTE_VISUAL_BASE_URL || "http://127.0.0.1:4181/?embed=hermes";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  });

  try {
    const start = Date.now();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".note-swipe-row", { timeout: 10000 });
    const firstRowsMs = Date.now() - start;
    await page.waitForTimeout(200);

    const initial = await page.evaluate(() => ({
      rowCount: document.querySelectorAll(".note-swipe-row").length,
      totalText: document.querySelector("#sync-status")?.textContent || "",
      surfaceScrollHeight: document.querySelector(".home-surface")?.scrollHeight || 0,
    }));
    assert.ok(initial.rowCount <= 130, `initial DOM should be windowed, got ${initial.rowCount}`);

    const openStart = Date.now();
    await page.locator(".note-swipe-row .note-swipe-content").first().click();
    await page.waitForSelector("#editor-panel.is-open", { timeout: 5000 });
    const openMs = Date.now() - openStart;
    const afterOpen = await page.evaluate(() => ({
      rowCount: document.querySelectorAll(".note-swipe-row").length,
      editorOpen: document.querySelector("#editor-panel")?.classList.contains("is-open"),
    }));
    assert.equal(afterOpen.editorOpen, true, "editor should open");
    assert.ok(afterOpen.rowCount <= 130, `opening a note should not re-render all rows, got ${afterOpen.rowCount}`);
    assert.ok(openMs < 1000, `opening a note took too long: ${openMs}ms`);

    await page.evaluate(() => {
      const surface = document.querySelector(".home-surface");
      if (surface) surface.scrollTop = surface.scrollHeight;
    });
    await page.waitForTimeout(250);
    const afterScroll = await page.evaluate(() => ({
      rowCount: document.querySelectorAll(".note-swipe-row").length,
    }));
    assert.ok(afterScroll.rowCount > initial.rowCount, "scrolling near the bottom should append another note batch");
    assert.ok(afterScroll.rowCount <= 220, `one scroll extension should stay bounded, got ${afterScroll.rowCount}`);

    console.log(JSON.stringify({
      ok: true,
      firstRowsMs,
      openMs,
      initialRows: initial.rowCount,
      rowsAfterScroll: afterScroll.rowCount,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
