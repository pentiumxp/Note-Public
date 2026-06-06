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
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".note-swipe-row", { timeout: 10000 });
    await page.waitForTimeout(300);

    const firstRow = page.locator(".note-swipe-row").first();
    const initial = await firstRow.evaluate((row) => {
      const rect = row.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.right - 28, rect.top + rect.height / 2);
      return {
        open: row.classList.contains("is-open"),
        commit: row.classList.contains("is-commit"),
        hitDelete: Boolean(hit?.closest?.(".note-delete-action")),
        transform: row.querySelector(".note-swipe-content")?.style.transform || "",
      };
    });

    assert.equal(initial.open, false, "initial row should not be open");
    assert.equal(initial.commit, false, "initial row should not be in commit state");
    assert.equal(initial.hitDelete, false, "delete action must not be visually reachable before swiping");

    const box = await firstRow.locator(".note-swipe-content").boundingBox();
    assert.ok(box, "first row content box missing");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 108, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    const opened = await firstRow.evaluate((row) => {
      const rect = row.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.right - 28, rect.top + rect.height / 2);
      const deleteAction = row.querySelector(".note-delete-action");
      const icon = row.querySelector(".trash-icon");
      const actionStyle = deleteAction ? getComputedStyle(deleteAction) : null;
      return {
        open: row.classList.contains("is-open"),
        commit: row.classList.contains("is-commit"),
        hitDelete: Boolean(hit?.closest?.(".note-delete-action")),
        transform: row.querySelector(".note-swipe-content")?.style.transform || "",
        deleteText: deleteAction?.textContent?.trim() || "",
        deleteLabel: deleteAction?.getAttribute("aria-label") || "",
        iconPresent: Boolean(icon),
        actionRadius: actionStyle?.borderRadius || "",
        actionBackground: actionStyle?.backgroundColor || "",
      };
    });

    assert.equal(opened.open, true, "short swipe should reveal the delete action");
    assert.equal(opened.commit, false, "short swipe should not commit deletion");
    assert.equal(opened.hitDelete, true, "delete action should be visually reachable after short swipe");
    assert.match(opened.transform, /translateX\(-104px\)/);
    assert.equal(opened.deleteText, "", "delete action should render as an icon without visible text");
    assert.equal(opened.deleteLabel, "删除", "icon-only delete action should keep an accessible label");
    assert.equal(opened.iconPresent, true, "delete action should show the trash icon");
    assert.match(opened.actionRadius, /50%/);
    assert.notEqual(opened.actionBackground, "rgb(209, 50, 47)", "delete icon should not use the red button background");

    let dialogSeen = false;
    page.once("dialog", async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });
    await firstRow.locator(".note-delete-action").click();
    await page.waitForTimeout(200);
    assert.equal(dialogSeen, true, "short-swipe delete click should require confirmation");

    const density = await page.evaluate(() => {
      const surface = document.querySelector(".home-surface");
      if (surface) surface.scrollTop = 320;
      const navTop = document.querySelector(".mobile-tabs")?.getBoundingClientRect().top || document.documentElement.clientHeight;
      const visibleRows = [...document.querySelectorAll(".note-swipe-row")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < navTop;
      }).length;
      return { visibleRows };
    });
    assert.ok(density.visibleRows >= 6, `expected at least 6 visible note rows after scrolling, got ${density.visibleRows}`);

    console.log(JSON.stringify({
      ok: true,
      initialHitDelete: initial.hitDelete,
      openedHitDelete: opened.hitDelete,
      openedTransform: opened.transform,
      deleteIconOnly: opened.deleteText === "" && opened.iconPresent,
      deleteBackground: opened.actionBackground,
      visibleRowsAfterScroll: density.visibleRows,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
