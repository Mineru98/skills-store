#!/usr/bin/env node
// Capture a webpage with Playwright and emit dom.json + screenshot.png + meta.json + page.html
// Usage:
//   node capture_page.mjs <url> <workdir> [--viewport-width N] [--viewport-height N]
//                                         [--device-scale F] [--wait MS] [--full-page]
//
// dom.json shape:
//   {
//     meta: { url, viewport, device_scale, captured_at, image_only:false },
//     elements: [ { id, tag, role, accessible_name, bbox:[x,y,w,h],
//                   style:{...}, is_interactive, depth } ],
//     texts:    [ { id, parent_id, bbox, text, style:{...}, orientation } ]
//   }

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// Resolve `playwright` whether it's locally installed or pulled in via
// `npx --yes -p playwright node …`. Mirrors make-[redacted]'s strategy:
// try createRequire from this script's URL first, then walk PATH for an
// npx-provided node_modules.
function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire("playwright");
  } catch {
    // fall through to PATH lookup
  }
  const pathEntries = (process.env.PATH || "").split(":");
  for (const entry of pathEntries) {
    if (!entry.endsWith("node_modules/.bin")) continue;
    const nodeModules = entry.slice(0, -"node_modules/.bin".length) + "node_modules";
    const pkgJson = join(nodeModules, "playwright", "package.json");
    if (!existsSync(pkgJson)) continue;
    const npxRequire = createRequire(pkgJson);
    return npxRequire("playwright");
  }
  return null;
}

function parseArgs(argv) {
  const args = { url: null, work: null, viewportWidth: 1440, viewportHeight: 900,
                 deviceScale: 1, wait: 1500, fullPage: false };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--viewport-width") args.viewportWidth = Number(argv[++i]);
    else if (a === "--viewport-height") args.viewportHeight = Number(argv[++i]);
    else if (a === "--device-scale") args.deviceScale = Number(argv[++i]);
    else if (a === "--wait") args.wait = Number(argv[++i]);
    else if (a === "--full-page") args.fullPage = true;
    else positional.push(a);
  }
  args.url = positional[0];
  args.work = positional[1];
  return args;
}

function die(msg, code = 1) {
  console.error(`[capture_page] ${msg}`);
  process.exit(code);
}

const args = parseArgs(process.argv);
if (!args.url || !args.work) {
  die("Usage: node capture_page.mjs <url> <workdir> [flags]");
}
if (!existsSync(args.work)) mkdirSync(args.work, { recursive: true });

const playwright = loadPlaywright();
if (!playwright) {
  die(
    "Playwright is not installed. Run:\n" +
      "  npx --yes playwright install chromium\n" +
      "or invoke via:\n" +
      "  npx --yes -p playwright node <path-to-this-script> <url> <workdir>\n"
  );
}
const { chromium } = playwright;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: args.viewportWidth, height: args.viewportHeight },
  deviceScaleFactor: args.deviceScale,
});
const page = await context.newPage();

try {
  await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 });
} catch (err) {
  await browser.close();
  die(`navigation failed: ${err.message}`);
}

await page.waitForTimeout(args.wait);

const screenshotPath = join(args.work, "screenshot.png");
await page.screenshot({ path: screenshotPath, fullPage: args.fullPage });

const html = await page.content();
writeFileSync(join(args.work, "page.html"), html, "utf-8");

// In-page evaluation: collect DOM bboxes, computed style, text leaves.
const collected = await page.evaluate(() => {
  const INTERACTIVE_TAGS = new Set([
    "BUTTON", "A", "INPUT", "TEXTAREA", "SELECT", "LABEL", "SUMMARY",
  ]);
  const INTERACTIVE_ROLES = new Set([
    "button", "link", "menuitem", "tab", "checkbox", "radio", "switch",
    "option", "textbox", "combobox", "searchbox",
  ]);
  const CONTAINER_CLASS_HINTS = ["card", "chip", "tag", "pill", "badge",
                                  "btn", "button", "tile", "panel"];

  const elements = [];
  const texts = [];
  let nextElId = 1;
  let nextTxId = 1;

  function pickStyle(cs) {
    return {
      writing_mode: cs.writingMode,
      direction: cs.direction,
      white_space: cs.whiteSpace,
      overflow: cs.overflow,
      overflow_x: cs.overflowX,
      overflow_y: cs.overflowY,
      text_overflow: cs.textOverflow,
      word_break: cs.wordBreak,
      line_height: cs.lineHeight,
      font_size: cs.fontSize,
      font_family: cs.fontFamily,
      padding_top: cs.paddingTop,
      padding_right: cs.paddingRight,
      padding_bottom: cs.paddingBottom,
      padding_left: cs.paddingLeft,
      transform: cs.transform,
      display: cs.display,
    };
  }

  function bbox(el) {
    const r = el.getBoundingClientRect();
    return [r.left + window.scrollX, r.top + window.scrollY, r.width, r.height];
  }

  function isVisible(el, r) {
    if (r.width < 4 || r.height < 4) return false;
    const cs = window.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    return true;
  }

  function inferOrientation(cs, r) {
    if (cs.writingMode && cs.writingMode !== "horizontal-tb") return "vertical";
    if (cs.transform && /matrix\(0,\s*1|matrix\(0,\s*-1/.test(cs.transform)) return "vertical";
    if (r.height > r.width * 2 && r.width < 60) return "vertical_suspected";
    return "horizontal";
  }

  function isContainerCandidate(el, cs) {
    if (INTERACTIVE_TAGS.has(el.tagName)) return true;
    const role = el.getAttribute("role");
    if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true;
    const cls = (el.getAttribute("class") || "").toLowerCase();
    if (CONTAINER_CLASS_HINTS.some(h => cls.includes(h))) return true;
    if (cs.borderTopWidth !== "0px" || cs.borderRadius !== "0px" ||
        cs.boxShadow !== "none") {
      // visual frame — likely a card/button
      return true;
    }
    return false;
  }

  function accessibleName(el) {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const ref = document.getElementById(labelledby);
      if (ref) return (ref.innerText || "").trim();
    }
    if (el.tagName === "INPUT" && el.placeholder) return `[placeholder] ${el.placeholder}`;
    return null;
  }

  function walk(node, depth = 0, parentElId = null) {
    if (!(node instanceof Element)) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE" ||
        node.tagName === "NOSCRIPT") return;

    const r = node.getBoundingClientRect();
    if (!isVisible(node, r)) return;

    const cs = window.getComputedStyle(node);
    const elIdHere = (() => {
      if (isContainerCandidate(node, cs)) {
        const id = `el_${String(nextElId++).padStart(4, "0")}`;
        elements.push({
          id,
          tag: node.tagName.toLowerCase(),
          role: node.getAttribute("role") || null,
          accessible_name: accessibleName(node),
          bbox: bbox(node),
          style: pickStyle(cs),
          is_interactive: INTERACTIVE_TAGS.has(node.tagName) ||
                          INTERACTIVE_ROLES.has((node.getAttribute("role") || "").toLowerCase()),
          depth,
          parent_el_id: parentElId,
        });
        return id;
      }
      return parentElId;
    })();

    // Emit one text entry per direct TEXT_NODE child, using Range bounding
    // rects. This avoids the parent-child duplication that happens when both
    // <h1> and its inner <span> get reported as separate text entries
    // overlapping each other in pixel space.
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const t = child.nodeValue.replace(/\s+/g, " ").trim();
      if (t.length === 0 || t.length > 500) continue;
      const range = document.createRange();
      range.selectNodeContents(child);
      const tr = range.getBoundingClientRect();
      if (tr.width < 2 || tr.height < 2) continue;
      const tbbox = [tr.left + window.scrollX, tr.top + window.scrollY, tr.width, tr.height];
      texts.push({
        id: `tx_${String(nextTxId++).padStart(4, "0")}`,
        parent_id: elIdHere,
        bbox: tbbox,
        text: t,
        style: pickStyle(cs),
        orientation: inferOrientation(cs, tr),
      });
    }

    for (const child of node.children) {
      walk(child, depth + 1, elIdHere);
    }
  }

  walk(document.body, 0, null);
  return { elements, texts };
});

const meta = {
  url: args.url,
  viewport: { width: args.viewportWidth, height: args.viewportHeight },
  device_scale: args.deviceScale,
  full_page: args.fullPage,
  captured_at: new Date().toISOString(),
  image_only: false,
};

const dom = { meta, ...collected };
writeFileSync(join(args.work, "dom.json"), JSON.stringify(dom, null, 2), "utf-8");
writeFileSync(join(args.work, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

await browser.close();

console.log(JSON.stringify({
  ok: true,
  workdir: args.work,
  screenshot: screenshotPath,
  elements: collected.elements.length,
  texts: collected.texts.length,
}, null, 2));
