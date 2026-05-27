#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire("playwright");
  } catch {
    // Continue and try the npx-provided PATH entry below.
  }

  const pathEntries = (process.env.PATH || "").split(":");
  for (const entry of pathEntries) {
    if (!entry.endsWith("node_modules/.bin")) continue;

    const nodeModules = entry.slice(0, -"node_modules/.bin".length) + "node_modules";
    const packageJson = join(nodeModules, "playwright", "package.json");
    if (!existsSync(packageJson)) continue;

    const npxRequire = createRequire(packageJson);
    return npxRequire("playwright");
  }

  throw new Error(
    "Playwright package not found. Run this script through: npx --yes -p playwright node .codex/skills/make-design-md/scripts/capture_webpage_design.mjs <url> <output-dir>",
  );
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }
  const args = {
    url: argv[0],
    outDir: argv[1],
    viewportWidth: 1440,
    viewportHeight: 900,
    viewports: null,
    maxShots: 12,
    wait: 1500,
    states: ["default"],
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--viewport-width") {
      args.viewportWidth = Number(value);
      index += 1;
    } else if (key === "--viewport-height") {
      args.viewportHeight = Number(value);
      index += 1;
    } else if (key === "--viewports") {
      args.viewports = parseViewports(value);
      index += 1;
    } else if (key === "--max-shots") {
      args.maxShots = Number(value);
      index += 1;
    } else if (key === "--wait") {
      args.wait = Number(value);
      index += 1;
    } else if (key === "--states") {
      args.states = String(value)
        .split(",")
        .map((state) => state.trim())
        .filter(Boolean);
      index += 1;
    } else if (key === "--help" || key === "-h") {
      args.help = true;
    }
  }

  if (!args.viewports) {
    args.viewports = [{ name: "desktop", width: args.viewportWidth, height: args.viewportHeight }];
  }
  if (!args.states.length) args.states = ["default"];

  return args;
}

function parseViewports(value) {
  return String(value)
    .split(",")
    .map((item) => {
      const [namePart, sizePart] = item.split(":");
      const [width, height] = String(sizePart || namePart).split("x").map(Number);
      const name = sizePart ? namePart : `${width}x${height}`;
      if (!name || !Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`Invalid viewport entry: ${item}. Expected name:1440x900.`);
      }
      return { name, width, height };
    });
}

function usage() {
  process.stdout.write(`Capture webpage design evidence for DESIGN.md generation.

Usage:
  npx --yes -p playwright node capture_webpage_design.mjs <url> <output-dir>

Options:
  --viewport-width N    Default: 1440
  --viewport-height N   Default: 900
  --viewports LIST      Comma-separated named sizes, e.g. desktop:1440x900,mobile:390x844
  --max-shots N         Default: 12
  --wait N              Milliseconds to wait after load. Default: 1500
  --states LIST         Comma-separated capture states. Default: default
`);
}

function normalizeCountMap(entries, limit = 30) {
  return [...entries]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function applyCaptureState(page, state) {
  await page.emulateMedia({ reducedMotion: state === "reduced-motion" ? "reduce" : "no-preference" });
  if (state === "default" || state === "reduced-motion") return;

  const selector = "button,a,[role='button'],input,select,textarea,[role='tab'],[aria-selected]";
  const firstInteractive = page.locator(selector).first();
  if (!(await firstInteractive.count())) return;

  if (state === "hover" || state === "active") {
    const box = await firstInteractive.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  } else if (state === "focus") {
    await firstInteractive.focus().catch(() => {});
  } else if (state === "selected") {
    const selectable = page.locator("[role='tab'],[aria-selected],button[aria-pressed]").first();
    if (await selectable.count()) await selectable.click({ trial: false, timeout: 1500 }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return 0;
  }
  if (!args.url || !args.outDir) {
    usage();
    return 2;
  }

  const outDir = resolve(args.outDir);
  const screenshotsDir = join(outDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: args.viewportWidth, height: args.viewportHeight },
    deviceScaleFactor: 1,
  });

  await page.goto(args.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(args.wait);

  const pageEvidence = await page.evaluate(() => {
    const colorCounts = new Map();
    const backgroundCounts = new Map();
    const fontCounts = new Map();
    const radiusCounts = new Map();
    const shadowCounts = new Map();
    const spacingCounts = new Map();
    const transitionCounts = new Map();
    const animationCounts = new Map();
    const decorationCounts = new Map();

    const add = (map, value) => {
      if (!value) return;
      if (value === "rgba(0, 0, 0, 0)" || value === "transparent") return;
      map.set(value, (map.get(value) || 0) + 1);
    };

    const textOf = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
    const rectOf = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const visibleElements = [...document.body.querySelectorAll("*")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      })
      .slice(0, 2500);

    for (const el of visibleElements) {
      const style = window.getComputedStyle(el);
      add(colorCounts, style.color);
      add(backgroundCounts, style.backgroundColor);
      add(fontCounts, `${style.fontFamily} | ${style.fontSize} | ${style.fontWeight} | ${style.lineHeight}`);
      add(radiusCounts, style.borderRadius);
      add(shadowCounts, style.boxShadow);
      add(spacingCounts, style.padding);
      add(spacingCounts, style.margin);
      add(transitionCounts, style.transition);
      add(animationCounts, style.animation);
      add(decorationCounts, style.backgroundImage);
      add(decorationCounts, style.backdropFilter);
    }

    const sample = (selector, limit) => [...document.querySelectorAll(selector)]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, limit)
      .map((el) => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          text: textOf(el),
          rect: rectOf(el),
          styles: {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            padding: style.padding,
            margin: style.margin,
            border: style.border,
          },
          className: typeof el.className === "string" ? el.className.slice(0, 160) : "",
        };
      });

    return {
      url: window.location.href,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      document: {
        width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      },
      headings: sample("h1,h2,h3,h4", 60),
      landmarks: sample("header,nav,main,section,article,aside,footer", 80),
      components: sample("button,a,[role='button'],input,select,textarea,.card,[class*='card'],[class*='button'],[class*='btn'],[class*='badge'],[class*='chip'],[class*='tab']", 140),
      assets: sample("img,picture,video,svg,canvas,[style*='background-image']", 120),
      icons: sample("svg,[class*='icon'],[aria-hidden='true'] svg,i", 120),
      styles: {
        textColors: Array.from(colorCounts.entries()),
        backgroundColors: Array.from(backgroundCounts.entries()),
        fonts: Array.from(fontCounts.entries()),
        radii: Array.from(radiusCounts.entries()),
        shadows: Array.from(shadowCounts.entries()),
        spacing: Array.from(spacingCounts.entries()),
        transitions: Array.from(transitionCounts.entries()),
        animations: Array.from(animationCounts.entries()),
        decorations: Array.from(decorationCounts.entries()),
      },
    };
  });

  const pageHtml = await page.content();
  writeFileSync(join(outDir, "page.html"), pageHtml);

  const screenshotManifest = [];
  const captureSettings = {
    url: pageEvidence.url,
    waitMs: args.wait,
    maxShots: args.maxShots,
    viewports: args.viewports,
    states: args.states,
  };

  for (const viewport of args.viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(350);
    const totalHeight = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    );

    for (const state of args.states) {
      await applyCaptureState(page, state);
      let y = 0;
      for (let index = 0; index < args.maxShots && y < totalHeight; index += 1) {
        const captureHeight = Math.min(viewport.height, totalHeight - y);
        if (captureHeight !== viewport.height) {
          await page.setViewportSize({ width: viewport.width, height: captureHeight });
        }
        await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
        await page.waitForTimeout(350);
        const file = join(
          "screenshots",
          `${viewport.name}-${state}-${String(index + 1).padStart(2, "0")}.png`,
        );
        await page.screenshot({ path: join(outDir, file), fullPage: false });
        screenshotManifest.push({
          file,
          viewportName: viewport.name,
          state,
          yStart: y,
          yEnd: y + captureHeight,
          viewportWidth: viewport.width,
          viewportHeight: captureHeight,
        });
        y += captureHeight;
      }
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    }
  }

  await browser.close();

  const stylesSummary = {
    textColors: normalizeCountMap(pageEvidence.styles.textColors),
    backgroundColors: normalizeCountMap(pageEvidence.styles.backgroundColors),
    fonts: normalizeCountMap(pageEvidence.styles.fonts),
    radii: normalizeCountMap(pageEvidence.styles.radii),
    shadows: normalizeCountMap(pageEvidence.styles.shadows),
    spacing: normalizeCountMap(pageEvidence.styles.spacing),
    transitions: normalizeCountMap(pageEvidence.styles.transitions),
    animations: normalizeCountMap(pageEvidence.styles.animations),
    decorations: normalizeCountMap(pageEvidence.styles.decorations),
  };

  const visualVerification = {
    sourceUrl: pageEvidence.url,
    generatedAt: new Date().toISOString(),
    captureSettings,
    comparisons: args.viewports.flatMap((viewport) =>
      args.states.flatMap((state) =>
        ["codex", "claude"].map((agent) => ({
          page: "source-page",
          agent,
          viewport: viewport.name,
          state,
          baselinePattern: `screenshots/${viewport.name}-${state}-*.png`,
          candidatePattern: `comparison/${agent}/${viewport.name}-${state}-*.png`,
          thresholds: {
            maxDiffRatio: 0.01,
            maxDiffPixels: 2500,
          },
          repairTargets: [
            "DESIGN.md",
            "capture settings",
            "analysis prompts",
            "export templates",
            "comparison fixtures",
          ],
        })),
      ),
    ),
    humanApproval: {
      required: true,
      recordPath: "human-approval.json",
    },
  };

  writeFileSync(join(outDir, "styles-summary.json"), `${JSON.stringify(stylesSummary, null, 2)}\n`);
  writeFileSync(join(outDir, "visual-verification.config.json"), `${JSON.stringify(visualVerification, null, 2)}\n`);
  writeFileSync(
    join(outDir, "analysis.json"),
    `${JSON.stringify({ ...pageEvidence, captureSettings, stylesSummary, screenshots: screenshotManifest }, null, 2)}\n`,
  );

  process.stdout.write(`${JSON.stringify({ status: "ok", outDir, screenshots: screenshotManifest.length }, null, 2)}\n`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message || String(error)}\n`);
    process.exitCode = 1;
  });
