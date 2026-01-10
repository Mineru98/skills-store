#!/usr/bin/env node
/**
 * PowerShell UTF-8 BOM Encoding Fixer
 *
 * This script ensures PowerShell files (.ps1) are saved with UTF-8 BOM encoding
 * to prevent Korean (and other non-ASCII) character display issues on Windows.
 *
 * Usage:
 *     node fix_powershell_encoding.js <file_or_directory>
 *     node fix_powershell_encoding.js script.ps1
 *     node fix_powershell_encoding.js scripts/windows/
 */

const fs = require("fs");
const path = require("path");

/**
 * Check if file has UTF-8 BOM (EF BB BF)
 */
function hasUtf8Bom(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const firstBytes = buffer.slice(0, 3);
    return (
      firstBytes[0] === 0xef && firstBytes[1] === 0xbb && firstBytes[2] === 0xbf
    );
  } catch (err) {
    console.log(`Error reading ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Add UTF-8 BOM to file if it doesn't have one
 */
function addUtf8Bom(filePath) {
  try {
    // Read file content as UTF-8
    const content = fs.readFileSync(filePath, "utf8");

    // UTF-8 BOM bytes
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const contentBuffer = Buffer.from(content, "utf8");

    // Write back with UTF-8 BOM
    const finalBuffer = Buffer.concat([bom, contentBuffer]);
    fs.writeFileSync(filePath, finalBuffer);

    return true;
  } catch (err) {
    console.log(`Error processing ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Process a single PowerShell file
 */
function processFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".ps1") {
    return null;
  }

  if (hasUtf8Bom(filePath)) {
    console.log(`✓ ${filePath} - Already has UTF-8 BOM`);
    return "skip";
  } else {
    if (addUtf8Bom(filePath)) {
      console.log(`✓ ${filePath} - Added UTF-8 BOM`);
      return "fixed";
    } else {
      console.log(`✗ ${filePath} - Failed to add BOM`);
      return "error";
    }
  }
}

/**
 * Process all PowerShell files in directory recursively
 */
function processDirectory(dirPath) {
  const stats = {
    fixed: 0,
    skip: 0,
    error: 0,
  };

  const ps1Files = findPs1Files(dirPath);

  for (const ps1File of ps1Files) {
    const result = processFile(ps1File);
    if (result) {
      stats[result]++;
    }
  }

  return stats;
}

/**
 * Recursively find all .ps1 files in directory
 */
function findPs1Files(dirPath) {
  const ps1Files = [];

  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (
        entry.isFile() &&
        path.extname(entry.name).toLowerCase() === ".ps1"
      ) {
        ps1Files.push(fullPath);
      }
    }
  }

  traverse(dirPath);
  return ps1Files;
}

/**
 * Main function
 */
function main() {
  if (process.argv.length !== 3) {
    console.log("Usage: bun fix_powershell_encoding.js <file_or_directory>");
    process.exit(1);
  }

  const target = process.argv[2];

  if (!fs.existsSync(target)) {
    console.log(`Error: ${target} does not exist`);
    process.exit(1);
  }

  console.log(`Processing: ${target}`);
  console.log("-".repeat(60));

  const stat = fs.statSync(target);

  if (stat.isFile()) {
    const result = processFile(target);
    if (result === "error") {
      process.exit(1);
    }
  } else if (stat.isDirectory()) {
    const stats = processDirectory(target);
    console.log("-".repeat(60));
    console.log(
      `Summary: ${stats.fixed} fixed, ${stats.skip} skipped, ${stats.error} errors`
    );
    if (stats.error > 0) {
      process.exit(1);
    }
  } else {
    console.log(`Error: ${target} is neither a file nor directory`);
    process.exit(1);
  }

  console.log("\n✓ Done!");
}

if (require.main === module) {
  main();
}

module.exports = { hasUtf8Bom, addUtf8Bom, processFile, processDirectory };
