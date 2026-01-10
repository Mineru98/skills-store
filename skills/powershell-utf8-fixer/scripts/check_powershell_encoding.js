#!/usr/bin/env node
/**
 * PowerShell UTF-8 BOM Encoding Checker
 *
 * This script checks if PowerShell files (.ps1) have UTF-8 BOM encoding.
 * Useful for diagnosing encoding issues before they cause problems.
 *
 * Usage:
 *     node check_powershell_encoding.js <file_or_directory>
 *     node check_powershell_encoding.js script.ps1
 *     node check_powershell_encoding.js scripts/windows/
 */

const fs = require("fs");
const path = require("path");

/**
 * Check file encoding and return status
 */
function checkEncoding(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const firstBytes = buffer.slice(0, 3);

    // UTF-8 BOM: EF BB BF
    if (
      firstBytes[0] === 0xef &&
      firstBytes[1] === 0xbb &&
      firstBytes[2] === 0xbf
    ) {
      return ["utf8-bom", "✓ UTF-8 with BOM"];
    }
    // UTF-16 LE BOM: FF FE
    else if (firstBytes[0] === 0xff && firstBytes[1] === 0xfe) {
      return ["utf16-le", "⚠ UTF-16 LE"];
    }
    // UTF-16 BE BOM: FE FF
    else if (firstBytes[0] === 0xfe && firstBytes[1] === 0xff) {
      return ["utf16-be", "⚠ UTF-16 BE"];
    } else {
      // Try to detect if it's valid UTF-8
      try {
        const content = fs.readFileSync(filePath, "utf8");
        // If no error, it's valid UTF-8 without BOM
        return ["utf8-no-bom", "⚠ UTF-8 without BOM (may cause issues)"];
      } catch (err) {
        return ["unknown", "✗ Unknown encoding"];
      }
    }
  } catch (err) {
    return ["error", `✗ Error: ${err.message}`];
  }
}

/**
 * Check a single PowerShell file
 */
function checkFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".ps1") {
    return null;
  }

  const [encodingType, status] = checkEncoding(filePath);
  console.log(`${status.padEnd(40)} ${filePath}`);
  return encodingType;
}

/**
 * Check all PowerShell files in directory recursively
 */
function checkDirectory(dirPath) {
  const stats = {
    "utf8-bom": 0,
    "utf8-no-bom": 0,
    "utf16-le": 0,
    "utf16-be": 0,
    unknown: 0,
    error: 0,
  };

  const ps1Files = findPs1Files(dirPath);

  if (ps1Files.length === 0) {
    console.log("No PowerShell files found.");
    return stats;
  }

  for (const ps1File of ps1Files) {
    const result = checkFile(ps1File);
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
    console.log("Usage: bun check_powershell_encoding.js <file_or_directory>");
    process.exit(1);
  }

  const target = process.argv[2];

  if (!fs.existsSync(target)) {
    console.log(`Error: ${target} does not exist`);
    process.exit(1);
  }

  console.log(`Checking: ${target}`);
  console.log("=".repeat(80));

  const stat = fs.statSync(target);

  if (stat.isFile()) {
    checkFile(target);
  } else if (stat.isDirectory()) {
    const stats = checkDirectory(target);
    console.log("=".repeat(80));
    console.log("\nSummary:");
    console.log(`  ✓ UTF-8 with BOM:    ${stats["utf8-bom"]}`);
    console.log(
      `  ⚠ UTF-8 without BOM: ${stats["utf8-no-bom"]} (should be fixed)`
    );
    console.log(`  ⚠ UTF-16 LE:         ${stats["utf16-le"]}`);
    console.log(`  ⚠ UTF-16 BE:         ${stats["utf16-be"]}`);
    console.log(`  ✗ Unknown:           ${stats["unknown"]}`);
    console.log(`  ✗ Errors:            ${stats["error"]}`);

    if (stats["utf8-no-bom"] > 0) {
      console.log(
        "\n💡 Run fix_powershell_encoding.js to add UTF-8 BOM to files without it."
      );
      process.exit(1);
    }
  } else {
    console.log(`Error: ${target} is neither a file nor directory`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkEncoding, checkFile, checkDirectory };
