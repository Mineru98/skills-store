#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function readJsonSafe(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function findFiles(root, predicate, depth = 2) {
  const hits = [];
  const skip = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "build", ".venv", "venv"]);

  function walk(dir, remaining) {
    if (remaining < 0) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry)) continue;
      const path = join(dir, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (stats.isDirectory()) walk(path, remaining - 1);
      else if (predicate(entry, path)) hits.push(path);
    }
  }

  walk(root, depth);
  return hits;
}

function detect(rootArg) {
  const root = resolve(rootArg || ".");
  const reasons = [];
  const detected = { frameworks: [], tailwind: false, figma: false, rootPackageJson: false };
  const pkg = readJsonSafe(join(root, "package.json"));

  if (pkg) {
    detected.rootPackageJson = true;
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const frameworks = {
      next: "next",
      react: "react",
      "react-native": "react-native",
      expo: "expo",
      vite: "vite",
      "@vitejs/plugin-react": "vite-react",
      "@tauri-apps/api": "tauri",
      "@tauri-apps/cli": "tauri",
      "@remix-run/react": "remix",
      astro: "astro",
      svelte: "svelte",
      "@sveltejs/kit": "sveltekit",
      vue: "vue",
      nuxt: "nuxt",
    };

    for (const [dependency, label] of Object.entries(frameworks)) {
      if (!deps[dependency]) continue;
      if (!detected.frameworks.includes(label)) detected.frameworks.push(label);
      reasons.push(`${dependency}@${deps[dependency]} in dependencies`);
    }
    if (deps.tailwindcss || deps["@tailwindcss/postcss"] || deps["@tailwindcss/vite"]) {
      detected.tailwind = true;
      reasons.push("tailwindcss in dependencies");
    }
  }

  const tailwindConfigs = findFiles(root, (name) => /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(name), 1);
  if (tailwindConfigs.length) {
    detected.tailwind = true;
    reasons.push(`tailwind config: ${tailwindConfigs.map((file) => file.replace(`${root}/`, "")).join(", ")}`);
  }

  const tokenFiles = findFiles(root, (name) => /(^tokens\.json$|\.tokens\.json$|style-dictionary\.config\.)/i.test(name), 2);
  if (tokenFiles.length) {
    detected.figma = true;
    reasons.push(`design token artifact: ${tokenFiles[0].replace(`${root}/`, "")}`);
  }

  const implementationStack = detected.tailwind || detected.frameworks.length > 0;
  let recommendation = "none";
  let confidence = "low";
  if (detected.tailwind && implementationStack) {
    recommendation = "tailwind";
    confidence = "high";
  } else if (implementationStack) {
    recommendation = "tailwind";
    confidence = "medium";
  } else if (detected.figma) {
    recommendation = "dtcg";
    confidence = "high";
  }

  return { recommendation, confidence, reasons, detected, root };
}

process.stdout.write(`${JSON.stringify(detect(process.argv[2] || "."), null, 2)}\n`);
