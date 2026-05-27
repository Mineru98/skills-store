#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2] || "DESIGN.md";

function print(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function section(markdown, names) {
  const lines = markdown.split(/\r?\n/);
  let collecting = false;
  const collected = [];
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (collecting) break;
      collecting = names.map((name) => name.toLowerCase()).includes(heading[1].toLowerCase());
      continue;
    }
    if (collecting) collected.push(line);
  }
  return collected.join("\n");
}

function hasAll(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((group) => group.every((term) => lower.includes(term)));
}

if (!existsSync(file)) {
  print({ status: "fail", file, error: `File not found: ${file}` });
  process.exit(2);
}

const markdown = readFileSync(file, "utf8");
const frontMatter = markdown.match(/^---\n([\s\S]*?)\n---/);
const yaml = frontMatter ? frontMatter[1] : "";
const body = frontMatter ? markdown.slice(frontMatter[0].length) : markdown;

const checks = [
  {
    id: "tokens-colors",
    area: "tokens",
    pass: /colors:\s*\n/i.test(yaml) && /#[0-9a-f]{6}/i.test(yaml),
    fix: "Define semantic colors with concrete #RRGGBB values.",
  },
  {
    id: "tokens-typography",
    area: "tokens",
    pass: /typography:\s*\n/i.test(yaml) && /fontFamily:/i.test(yaml) && /fontSize:/i.test(yaml),
    fix: "Define typography tokens with fontFamily and fontSize.",
  },
  {
    id: "tokens-spacing-radius",
    area: "tokens",
    pass: /spacing:\s*\n/i.test(yaml) && /rounded:\s*\n/i.test(yaml),
    fix: "Define spacing and rounded scales.",
  },
  {
    id: "component-states",
    area: "components",
    pass: /components:\s*\n/i.test(yaml) && /-(hover|active|focus|disabled|selected):/i.test(yaml + body),
    fix: "Document interactive component states such as hover, focus, active, disabled, or selected.",
  },
  {
    id: "layout-responsive",
    area: "layout",
    pass: hasAll(section(body, ["Layout", "Layout & Spacing"]), [
      ["responsive", "viewport"],
      ["breakpoint", "mobile"],
      ["desktop", "mobile"],
    ]),
    fix: "Add viewport-specific responsive layout rules.",
  },
  {
    id: "assets-images",
    area: "assets",
    pass: hasAll(body, [
      ["image", "aspect"],
      ["asset", "object-fit"],
      ["media", "crop"],
      ["image", "focal"],
    ]),
    fix: "Specify image/asset aspect ratios, crop/focal point, object-fit, or media treatment.",
  },
  {
    id: "icons",
    area: "icons",
    pass: hasAll(body, [
      ["icon", "stroke"],
      ["icon", "fill"],
      ["icon", "size"],
      ["icon", "library"],
    ]),
    fix: "Specify icon source/style, stroke or fill behavior, size, and color role.",
  },
  {
    id: "motion",
    area: "motion",
    pass: hasAll(body, [
      ["motion", "duration"],
      ["transition", "easing"],
      ["animation", "reduced-motion"],
      ["hover", "transition"],
    ]),
    fix: "Specify motion timing, easing, interaction transitions, and reduced-motion behavior.",
  },
  {
    id: "decoration",
    area: "decoration",
    pass: hasAll(body, [
      ["decoration", "background"],
      ["gradient", "avoid"],
      ["divider", "border"],
      ["shadow", "blur"],
    ]),
    fix: "Specify decoration/background/divider/shadow rules and anti-patterns.",
  },
  {
    id: "visual-diff-thresholds",
    area: "verification",
    pass: hasAll(body, [
      ["pixel", "threshold"],
      ["diff", "viewport", "state"],
      ["maxdiff", "page"],
    ]),
    fix: "Document pixel diff thresholds per page, viewport, and state.",
  },
  {
    id: "repair-loop",
    area: "verification",
    pass: hasAll(body, [
      ["repair", "revalidate"],
      ["failed", "diff", "repair"],
      ["pipeline", "repair"],
    ]),
    fix: "Document that failed static or pixel gates trigger repair and revalidation.",
  },
  {
    id: "human-approval",
    area: "verification",
    pass: hasAll(body, [
      ["human", "approval"],
      ["reviewer", "decision"],
      ["visual approval"],
    ]),
    fix: "Document the human visual approval record and decision criteria.",
  },
];

const failed = checks.filter((check) => !check.pass);
const output = {
  status: failed.length ? "fail" : "pass",
  file,
  summary: {
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  findings: failed.map(({ id, area, fix }) => ({ id, area, severity: "error", fix })),
};

print(output);
process.exit(failed.length ? 1 : 0);
