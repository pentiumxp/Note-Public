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

async function dragMouse(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
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
    await page.locator("#mobile-create-button").click();
    await page.waitForFunction(() => !document.querySelector("#create-sheet")?.hidden, null, { timeout: 5000 });

    const before = await page.evaluate(() => {
      const sheet = document.querySelector("#create-sheet");
      const panel = document.querySelector(".sheet-panel");
      const panelRect = panel.getBoundingClientRect();
      const messages = window.__notePluginMessages || [];
      const lastNavigation = [...messages].reverse().find((item) => item.type === "note.plugin.navigation");
      return {
        sheetOpen: !sheet.hidden,
        surface: lastNavigation?.route?.surface,
        canGoBack: lastNavigation?.canGoBack,
        gestureStart: {
          x: Math.round(panelRect.left + 24),
          y: Math.round(panelRect.top + 24),
        },
      };
    });

    assert.equal(before.sheetOpen, true, "create sheet should open from mobile plus");
    assert.equal(before.surface, "create_sheet", "create sheet should be the active internal route");
    assert.equal(before.canGoBack, true, "create sheet should report internal back availability");

    await dragMouse(page, before.gestureStart, {
      x: before.gestureStart.x + 150,
      y: before.gestureStart.y + 6,
    });
    await page.waitForFunction(() => document.querySelector("#create-sheet")?.hidden, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const messages = window.__notePluginMessages || [];
      const lastNavigation = [...messages].reverse().find((item) => item.type === "note.plugin.navigation");
      return lastNavigation?.route?.surface === "home";
    }, null, { timeout: 5000 });

    const after = await page.evaluate(() => {
      const messages = window.__notePluginMessages || [];
      const lastNavigation = [...messages].reverse().find((item) => item.type === "note.plugin.navigation");
      return {
        sheetOpen: !document.querySelector("#create-sheet")?.hidden,
        editorOpen: document.querySelector("#editor-panel")?.classList.contains("is-open"),
        backResults: messages.filter((item) => item.type === "note.plugin.back_result").length,
        surface: lastNavigation?.route?.surface,
        canGoBack: lastNavigation?.canGoBack,
      };
    });

    assert.equal(after.sheetOpen, false, "right swipe should close the create sheet");
    assert.equal(after.editorOpen, false, "right swipe should not open an editor note");
    assert.equal(after.backResults, 0, "local right swipe should not ask the host to navigate back");
    assert.equal(after.surface, "home", "navigation should return to the home surface");
    assert.equal(after.canGoBack, false, "home surface should not advertise internal back");

    console.log(JSON.stringify({
      ok: true,
      beforeSurface: before.surface,
      afterSurface: after.surface,
      sheetOpenAfterSwipe: after.sheetOpen,
      hostBackResults: after.backResults,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
