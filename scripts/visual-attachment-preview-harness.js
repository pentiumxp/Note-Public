"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

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
  const baseUrl = await resolveBaseUrl();
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

    const pdfChip = page.locator(".note-thumb-file:has(.file-type-pdf), .note-row-attachment-chip:has(.file-type-pdf)").first();
    if (await pdfChip.count()) {
      await pdfChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const pdfPreview = await page.evaluate(() => {
        const frame = document.querySelector(".pdf-preview-frame");
        const rect = frame?.getBoundingClientRect();
        const panel = document.querySelector(".pdf-preview-panel")?.getBoundingClientRect();
        return {
          frame: Boolean(frame),
          viewerShell: frame?.getAttribute("src")?.includes("pdf-viewer.html") || false,
          embedded: frame?.getAttribute("src")?.includes("embed=1") || false,
          width: Math.round(rect?.width || 0),
          height: Math.round(rect?.height || 0),
          panelWidth: Math.round(panel?.width || 0),
          panelHeight: Math.round(panel?.height || 0),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });
      assert.equal(pdfPreview.frame, true, "PDF chip should open an embedded PDF preview");
      assert.equal(pdfPreview.viewerShell, true, "PDF preview should use the copied Hermes pdf-viewer shell");
      assert.equal(pdfPreview.embedded, true, "PDF preview shell should run in embedded mode");
      assert.ok(pdfPreview.width <= pdfPreview.viewportWidth, "PDF preview should fit the mobile viewport width");
      assert.ok(Math.abs(pdfPreview.panelWidth - pdfPreview.viewportWidth) <= 2, "PDF preview panel should be full viewport width");
      assert.ok(Math.abs(pdfPreview.panelHeight - pdfPreview.viewportHeight) <= 2, "PDF preview panel should be full viewport height");
      await page.locator(".image-preview-close").click();
      await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });
    }

    const wordChip = page.locator(".note-thumb-file:has(.file-type-word), .note-row-attachment-chip:has(.file-type-word)").first();
    if (await wordChip.count()) {
      await wordChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const wordPreview = await page.evaluate(() => ({
        frame: Boolean(document.querySelector(".word-preview-frame")),
        frameSrc: document.querySelector(".word-preview-frame")?.getAttribute("src") || "",
        embedded: document.querySelector(".word-preview-frame")?.getAttribute("src")?.includes("embed=1") || false,
      }));
      assert.equal(wordPreview.frame, true, "Word chip should open an embedded document preview");
      assert.ok(wordPreview.frameSrc.includes("file-viewer.html"), "Word preview should use the copied Hermes file-viewer shell");
      assert.equal(wordPreview.embedded, true, "Word preview shell should run in embedded mode");
      await page.locator(".image-preview-close").click();
      await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });
    }

    const markdownChip = page.locator(".note-thumb-file:has(.file-type-markdown), .note-row-attachment-chip:has(.file-type-markdown)").first();
    if (await markdownChip.count()) {
      await markdownChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const markdownPreview = await page.evaluate(() => ({
        frame: Boolean(document.querySelector(".markdown-preview-frame")),
        frameSrc: document.querySelector(".markdown-preview-frame")?.getAttribute("src") || "",
      }));
      assert.equal(markdownPreview.frame, true, "Markdown chip should open an embedded Markdown preview");
      assert.ok(markdownPreview.frameSrc.includes("markdown-viewer.html"), "Markdown preview should use the copied Hermes markdown-viewer shell");
      await page.locator(".image-preview-close").click();
      await page.waitForSelector(".image-preview-overlay", { state: "detached", timeout: 5000 });
    }

    const fileChip = page.locator(".note-thumb-file, .note-row-attachment-chip").first();
    if (await fileChip.count()) {
      await fileChip.evaluate((element) => element.click());
      await page.waitForSelector(".image-preview-overlay", { timeout: 5000 });
      const filePreview = await page.evaluate(() => ({
        frame: Boolean(document.querySelector(".file-preview-frame")),
        frameSrc: document.querySelector(".file-preview-frame")?.getAttribute("src") || "",
      }));
      assert.equal(filePreview.frame, true, "clicking a file icon should open a file preview shell");
      assert.match(filePreview.frameSrc, /(?:^|\/)(?:file|pdf|markdown)-viewer\.html/);
    }

    const proxyMarkdown = await verifyProxyMarkdownPreview(browser);

    console.log(JSON.stringify({
      ok: true,
      inlineChips: list.inlineChips,
      rightThumbs: list.rightThumbs,
      imageChipUsesThumbnail: list.imageChipUsesThumbnail,
      imageChipHasFallback: list.imageChipHasFallback,
      brokenImageChips: list.brokenImageChips,
      previewInputs: preview.inputs,
      previewHeadVisible: preview.headVisible,
      proxyMarkdownPreview: proxyMarkdown,
    }));
  } finally {
    await browser.close();
  }
}

async function verifyProxyMarkdownPreview(browser) {
  const fixture = await startProxyPreviewFixtureServer();
  const page = await browser.newPage({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const viewerUrl = new URL("/api/hermes-plugins/note/proxy/markdown-viewer.html", fixture.origin);
    viewerUrl.searchParams.set("src", "/api/v1/app/attachments/att-md?launch=fake");
    viewerUrl.searchParams.set("preview", "/api/v1/app/attachments/att-md/preview?launch=fake");
    viewerUrl.searchParams.set("embed", "1");
    await page.goto(viewerUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#preview:not([hidden])", { timeout: 10000 });
    const rendered = await page.evaluate(() => ({
      hasError: Boolean(document.querySelector(".status.error")),
      h1: document.querySelector("#preview h1")?.textContent || "",
      text: (document.querySelector("#preview")?.textContent || "").replace(/\s+/g, " ").trim(),
    }));
    assert.equal(rendered.hasError, false, "proxied Markdown preview should not show an error");
    assert.equal(rendered.h1, "Proxy preview ok", "proxied Markdown preview should render fixture Markdown as HTML");
    assert.ok(
      fixture.requests.includes("/api/hermes-plugins/note/proxy/api/v1/app/attachments/att-md/preview"),
      "proxied Markdown preview should fetch through the Note plugin proxy prefix"
    );
    assert.equal(
      fixture.requests.includes("/api/v1/app/attachments/att-md/preview"),
      false,
      "proxied Markdown preview must not fetch the Hermes root app attachment path"
    );
    return true;
  } finally {
    await page.close().catch(() => {});
    await fixture.close();
  }
}

function startProxyPreviewFixtureServer() {
  const publicRoot = path.join(process.cwd(), "public");
  const requests = [];
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    requests.push(url.pathname);
    if (url.pathname === "/api/hermes-plugins/note/proxy/api/v1/app/attachments/att-md/preview") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ text: "# Proxy preview ok\n\n- rendered through proxy", name: "fixture.md", mime: "text/markdown" }));
      return;
    }
    if (url.pathname === "/api/v1/app/attachments/att-md/preview") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const proxyPrefix = "/api/hermes-plugins/note/proxy/";
    const relativePath = url.pathname.startsWith(proxyPrefix)
      ? url.pathname.slice(proxyPrefix.length)
      : url.pathname.slice(1);
    const filePath = path.resolve(publicRoot, relativePath || "index.html");
    if (!filePath.startsWith(publicRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(content);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function resolveBaseUrl() {
  if (process.env.NOTE_VISUAL_BASE_URL) {
    return process.env.NOTE_VISUAL_BASE_URL;
  }
  const workspaceRoot = process.env.NOTE_VISUAL_WORKSPACE_ROOT || "C:/ProgramData/HermesMobile/data/drive/users/owner";
  const configPath = path.join(workspaceRoot, ".hermes-note", "config.json");
  const config = readJsonIfExists(configPath);
  if (!config) {
    return "http://127.0.0.1:4181/?embed=hermes";
  }
  const keyPath = path.join(path.dirname(configPath), config.access_key_file || "access-key.txt");
  const rawKey = readTextIfExists(keyPath).trim();
  if (!rawKey) {
    return "http://127.0.0.1:4181/?embed=hermes";
  }
  const response = await fetch(`${config.api_base_url}/api/v1/hermes/plugin/launch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rawKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      workspace_id: config.workspace_id,
      target_workspace_id: config.hermes_workspace_id
    })
  });
  if (!response.ok) {
    throw new Error(`visual harness launch failed: ${response.status}`);
  }
  const body = await response.json();
  return new URL(body.entry_path, config.api_base_url).toString();
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
