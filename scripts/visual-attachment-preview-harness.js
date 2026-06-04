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

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".note-swipe-row", { timeout: 10000 });
    await page.waitForTimeout(300);

    const list = await page.evaluate(() => ({
      rows: document.querySelectorAll(".note-swipe-row").length,
      inlineChips: document.querySelectorAll(".note-row-image-chip,.note-row-attachment-chip").length,
      rightThumbs: document.querySelectorAll(".note-thumb").length,
      imageChips: document.querySelectorAll(".note-thumb-image").length,
      multiImageThumbs: [...document.querySelectorAll(".note-row-media")]
        .filter((item) => item.querySelector(".note-thumb-image") && item.querySelector(".note-attachment-count"))
        .length,
      attachmentTextVisible: [...document.querySelectorAll(".note-row-meta,.note-row-attachment-chip")]
        .some((item) => item.textContent.includes("附件")),
      attachmentSnippetVisible: [...document.querySelectorAll(".note-row-snippet")]
        .some((item) => item.textContent.trim().replace(/[\s·,，.。;；:：、]+/g, "") === "附件"),
      fileIcons: document.querySelectorAll(".file-type-icon").length,
      pdfIcons: document.querySelectorAll(".file-type-pdf").length,
      wordIcons: document.querySelectorAll(".file-type-word").length,
      imageChipUsesThumbnail: Boolean(document.querySelector(".note-thumb-image img")?.getAttribute("src")?.includes("/thumbnail")),
      imageChipHasFallback: Boolean(document.querySelector(".note-thumb-image img")?.getAttribute("data-fallback-src")?.includes("/api/v1/app/attachments/")),
      brokenImageChips: [...document.querySelectorAll(".note-thumb-image img")]
        .filter((img) => img.complete && img.naturalWidth === 0)
        .length,
    }));
    assert.equal(list.inlineChips, 0, "list should not render attachment chips below note titles");
    assert.ok(list.rightThumbs > 0, "list should render compact right-side thumbnails or file icons");
    assert.ok(list.imageChips > 0, "fixture workspace should expose at least one right-side image thumbnail");
    assert.equal(list.imageChipUsesThumbnail, true, "right-side image thumbnails should load generated thumbnail URLs, not original files");
    assert.equal(list.imageChipHasFallback, true, "right-side image thumbnails should keep the original attachment URL as a fallback");
    assert.equal(list.brokenImageChips, 0, "right-side image thumbnails should resolve to visible images");
    assert.equal(list.attachmentTextVisible, false, "list attachment thumbnails should not show the attachment text label");
    assert.equal(list.attachmentSnippetVisible, false, "list should hide attachment-only placeholder snippets");
    assert.ok(list.fileIcons > 0, "list should render typed file icons for non-image attachments");

    const multiImageThumb = page.locator(".note-row-media:has(.note-thumb-image):has(.note-attachment-count) .note-thumb-image").first();
    if (await multiImageThumb.count()) {
      await multiImageThumb.click();
    } else {
      await page.locator(".note-thumb-image").first().click();
    }
    await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });

    const preview = await page.evaluate(() => ({
      overlay: Boolean(document.querySelector(".image-preview-overlay")),
      headVisible: Boolean(document.querySelector(".image-preview-head:not([hidden])")),
      closeButton: Boolean(document.querySelector(".image-preview-close")),
      inputs: document.querySelectorAll(".image-preview-overlay input, .image-preview-overlay textarea").length,
      editorOpen: document.querySelector("#editor-panel")?.classList.contains("is-open"),
      carouselControls: document.querySelectorAll(".image-preview-nav").length,
      carouselCounter: document.querySelector(".image-preview-counter")?.textContent || "",
    }));
    assert.equal(preview.overlay, true, "clicking an image chip should open image preview");
    assert.equal(preview.headVisible, false, "image preview should not show the old title/input-like header");
    assert.equal(preview.closeButton, true, "image preview should still have a close button");
    assert.equal(preview.inputs, 0, "image preview should not contain inputs");
    assert.equal(preview.editorOpen, false, "clicking an image chip should not open the note editor");
    if (list.multiImageThumbs > 0) {
      assert.equal(preview.carouselControls, 2, "multi-image preview should expose previous and next controls");
      assert.match(preview.carouselCounter, /^\d+\/\d+$/, "multi-image preview should expose a bounded counter");
    }

    await page.locator(".image-preview-close").click();
    await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });

    const pdfChip = page.locator(".note-row-attachment-chip:has(.file-type-pdf)").first();
    if (await pdfChip.count()) {
      await pdfChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const pdfPreview = await page.evaluate(() => {
        const frame = document.querySelector(".pdf-preview-frame");
        const rect = frame?.getBoundingClientRect();
        const panel = document.querySelector(".pdf-preview-panel")?.getBoundingClientRect();
        return {
          frame: Boolean(frame),
          fitFragment: frame?.getAttribute("src")?.includes("view=FitH") || false,
          width: Math.round(rect?.width || 0),
          height: Math.round(rect?.height || 0),
          panelWidth: Math.round(panel?.width || 0),
          panelHeight: Math.round(panel?.height || 0),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });
      assert.equal(pdfPreview.frame, true, "PDF chip should open an embedded PDF preview");
      assert.equal(pdfPreview.fitFragment, true, "PDF preview should request fit-to-width rendering");
      assert.ok(pdfPreview.width <= pdfPreview.viewportWidth, "PDF preview should fit the mobile viewport width");
      assert.ok(Math.abs(pdfPreview.panelWidth - pdfPreview.viewportWidth) <= 2, "PDF preview panel should be full viewport width");
      assert.ok(Math.abs(pdfPreview.panelHeight - pdfPreview.viewportHeight) <= 2, "PDF preview panel should be full viewport height");
      await page.locator(".image-preview-close").click();
      await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });
    }

    const wordChip = page.locator(".note-row-attachment-chip:has(.file-type-word)").first();
    if (await wordChip.count()) {
      await wordChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const wordPreview = await page.evaluate(() => ({
        frame: Boolean(document.querySelector(".word-preview-frame")),
        frameSrc: document.querySelector(".word-preview-frame")?.getAttribute("src") || "",
        openLinks: document.querySelectorAll(".document-preview-panel .file-preview-open").length,
      }));
      assert.equal(wordPreview.frame, true, "Word chip should open an embedded document preview");
      assert.ok(wordPreview.frameSrc.includes("/preview"), "Word preview should use the local preview route");
      assert.ok(wordPreview.openLinks >= 2, "Word preview should expose open and download actions");
      const wordFrame = page.frameLocator(".word-preview-frame");
      await expectFrameText(wordFrame, "Zone");
      await page.locator(".image-preview-close").click();
      await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });
    }

    const fileChip = page.locator(".note-row-attachment-chip").first();
    if (await fileChip.count()) {
      await fileChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const filePreview = await page.evaluate(() => ({
        frame: Boolean(document.querySelector(".file-preview-frame")),
        card: Boolean(document.querySelector(".file-preview-card")),
        openLink: Boolean(document.querySelector(".file-preview-open")),
      }));
      assert.equal(filePreview.frame || filePreview.card, true, "clicking a file icon should open a file preview");
      if (filePreview.card) {
        assert.equal(filePreview.openLink, true, "non-browser-rendered files should provide an open file action");
      }
    }

    console.log(JSON.stringify({
      ok: true,
      inlineChips: list.inlineChips,
      rightThumbs: list.rightThumbs,
      imageChipUsesThumbnail: list.imageChipUsesThumbnail,
      imageChipHasFallback: list.imageChipHasFallback,
      brokenImageChips: list.brokenImageChips,
      previewInputs: preview.inputs,
      previewHeadVisible: preview.headVisible,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function expectFrameText(frameLocator, pattern) {
  const body = frameLocator.locator("body");
  await body.waitFor({ timeout: 5000 });
  const text = await body.textContent();
  assert.ok(String(text || "").includes(pattern), "Word preview iframe should render extracted document text");
}
