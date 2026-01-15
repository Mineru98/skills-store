#!/usr/bin/env bun
/**
 * Excel Data Analyzer - Main Entry Point
 * Analyzes Excel files for structure, quality issues, and statistics
 * Usage: bun run analyze_excel.ts <excel-file-path> [--output <output-path>]
 */

import * as XLSX from 'xlsx';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename } from 'path';

interface ColumnInfo {
  name: string;
  index: number;
  dataType: string;
  distinctValues: number;
  nullCount: number;
  nullPercentage: number;
  sampleValues: any[];
  formatIssues: string[];
}

interface SheetAnalysis {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnInfo[];
  qualityScore: number;
  issues: string[];
  statistics: Record<string, any>;
}

interface AnalysisReport {
  fileName: string;
  analyzedAt: string;
  fileSize: number;
  sheets: SheetAnalysis[];
  overallScore: number;
  summary: string[];
}

function detectDataType(values: any[]): string {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'empty';

  const types = new Set(nonNullValues.map(v => typeof v));

  if (types.size > 1) return 'mixed';

  const firstType = Array.from(types)[0];
  if (firstType === 'number') {
    // Check if all numbers are integers
    const allIntegers = nonNullValues.every(v => Number.isInteger(v));
    return allIntegers ? 'integer' : 'float';
  }

  if (firstType === 'string') {
    // Check for date patterns
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/;
    if (nonNullValues.every(v => datePattern.test(v))) return 'date';

    // Check for email patterns
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (nonNullValues.every(v => emailPattern.test(v))) return 'email';

    // Check for boolean-like strings
    const booleanValues = new Set(['true', 'false', 'yes', 'no', '1', '0']);
    if (nonNullValues.every(v => booleanValues.has(v.toLowerCase()))) return 'boolean';

    return 'string';
  }

  if (firstType === 'boolean') return 'boolean';

  return 'unknown';
}

function detectFormatIssues(values: any[], dataType: string): string[] {
  const issues: string[] = [];
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

  if (dataType === 'mixed') {
    issues.push('Mixed data types detected - inconsistent formatting');
  }

  // Check for leading/trailing spaces in strings
  if (dataType === 'string') {
    const hasWhitespace = nonNullValues.some(v =>
      typeof v === 'string' && (v !== v.trim())
    );
    if (hasWhitespace) {
      issues.push('Leading or trailing whitespace detected');
    }

    // Check for inconsistent casing
    const lowerCount = nonNullValues.filter(v =>
      typeof v === 'string' && v === v.toLowerCase()
    ).length;
    const upperCount = nonNullValues.filter(v =>
      typeof v === 'string' && v === v.toUpperCase()
    ).length;
    if (lowerCount > 0 && upperCount > 0 && lowerCount < nonNullValues.length && upperCount < nonNullValues.length) {
      issues.push('Inconsistent casing (mixed upper/lower)');
    }
  }

  // Check for numeric values stored as strings
  if (dataType === 'string') {
    const numericStrings = nonNullValues.filter(v =>
      typeof v === 'string' && !isNaN(Number(v))
    ).length;
    if (numericStrings > nonNullValues.length * 0.8) {
      issues.push('Numeric values stored as text');
    }
  }

  return issues;
}

function calculateStatistics(values: any[], dataType: string): Record<string, any> {
  const stats: Record<string, any> = {};
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

  if (dataType === 'integer' || dataType === 'float' || dataType === 'mixed') {
    const numericValues = nonNullValues.filter(v => typeof v === 'number').sort((a, b) => a - b);
    if (numericValues.length > 0) {
      stats.min = Math.min(...numericValues);
      stats.max = Math.max(...numericValues);
      stats.mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      stats.median = numericValues[Math.floor(numericValues.length / 2)];

      // Calculate standard deviation
      const variance = numericValues.reduce((acc, val) =>
        acc + Math.pow(val - stats.mean, 2), 0
      ) / numericValues.length;
      stats.stdDev = Math.sqrt(variance);

      // Detect outliers (values beyond 3 standard deviations)
      const outliers = numericValues.filter(v =>
        Math.abs(v - stats.mean) > 3 * stats.stdDev
      );
      stats.outlierCount = outliers.length;
      if (outliers.length > 0) {
        stats.outliers = outliers.slice(0, 5); // Sample up to 5 outliers
      }
    }
  }

  if (dataType === 'string') {
    const lengths = nonNullValues.map(v => String(v).length);
    stats.minLength = Math.min(...lengths);
    stats.maxLength = Math.max(...lengths);
    stats.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  // Value distribution
  const valueCounts = new Map<any, number>();
  nonNullValues.forEach(v => {
    valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
  });
  const sortedCounts = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  stats.topValues = sortedCounts.map(([value, count]) => ({
    value,
    count,
    percentage: (count / nonNullValues.length * 100).toFixed(2)
  }));

  return stats;
}

function analyzeColumn(data: any[][], colIndex: number, header: string): ColumnInfo {
  const values = data.map(row => row[colIndex]);
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

  const dataType = detectDataType(values);
  const formatIssues = detectFormatIssues(values, dataType);

  const distinctValues = new Set(nonNullValues).size;
  const nullCount = values.length - nonNullValues.length;
  const nullPercentage = (nullCount / values.length) * 100;

  // Get sample values (up to 5 unique values)
  const sampleValues = Array.from(new Set(nonNullValues)).slice(0, 5);

  return {
    name: header || `Column_${colIndex + 1}`,
    index: colIndex,
    dataType,
    distinctValues,
    nullCount,
    nullPercentage,
    sampleValues,
    formatIssues
  };
}

function analyzeSheet(sheet: XLSX.WorkSheet, sheetName: string): SheetAnalysis {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

  if (data.length === 0) {
    return {
      sheetName,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      qualityScore: 0,
      issues: ['Sheet is empty'],
      statistics: {}
    };
  }

  const headers = data[0] as string[];
  const dataRows = data.slice(1);
  const rowCount = dataRows.length;
  const columnCount = headers.length;

  // Analyze each column
  const columns = headers.map((header, index) =>
    analyzeColumn(dataRows, index, header)
  );

  // Calculate quality score
  const issues: string[] = [];
  let qualityScore = 100;

  // Check for missing headers
  const missingHeaders = columns.filter(col => !col.name || col.name.trim() === '');
  if (missingHeaders.length > 0) {
    issues.push(`${missingHeaders.length} columns have missing headers`);
    qualityScore -= 10;
  }

  // Check for high null percentage
  const highNullColumns = columns.filter(col => col.nullPercentage > 50);
  if (highNullColumns.length > 0) {
    issues.push(`${highNullColumns.length} columns have >50% missing values`);
    qualityScore -= 15;
  }

  // Check for format issues
  const columnsWithIssues = columns.filter(col => col.formatIssues.length > 0);
  if (columnsWithIssues.length > 0) {
    issues.push(`${columnsWithIssues.length} columns have format inconsistencies`);
    qualityScore -= 10;
  }

  // Check for duplicate column names
  const columnNames = columns.map(col => col.name);
  const duplicates = columnNames.filter((name, index) =>
    columnNames.indexOf(name) !== index
  );
  if (duplicates.length > 0) {
    issues.push(`Duplicate column names found: ${[...new Set(duplicates)].join(', ')}`);
    qualityScore -= 15;
  }

  // Generate statistics for each column
  const statistics: Record<string, any> = {};
  columns.forEach(col => {
    const colData = dataRows.map(row => row[col.index]);
    statistics[col.name] = calculateStatistics(colData, col.dataType);
  });

  qualityScore = Math.max(0, qualityScore);

  return {
    sheetName,
    rowCount,
    columnCount,
    columns,
    qualityScore,
    issues,
    statistics
  };
}

function generateMarkdownReport(report: AnalysisReport): string {
  let md = `# Excel Data Analysis Report\n\n`;
  md += `**File:** ${report.fileName}\n`;
  md += `**Analyzed:** ${report.analyzedAt}\n`;
  md += `**File Size:** ${(report.fileSize / 1024 / 1024).toFixed(2)} MB\n`;
  md += `**Overall Quality Score:** ${report.overallScore}/100\n\n`;

  md += `## Executive Summary\n\n`;
  report.summary.forEach(item => {
    md += `- ${item}\n`;
  });
  md += `\n`;

  report.sheets.forEach(sheet => {
    md += `## Sheet: ${sheet.sheetName}\n\n`;
    md += `**Dimensions:** ${sheet.rowCount} rows × ${sheet.columnCount} columns\n`;
    md += `**Quality Score:** ${sheet.qualityScore}/100\n\n`;

    if (sheet.issues.length > 0) {
      md += `### Issues Detected\n\n`;
      sheet.issues.forEach(issue => {
        md += `- ⚠️ ${issue}\n`;
      });
      md += `\n`;
    }

    md += `### Column Analysis\n\n`;
    md += `| Column | Type | Distinct | Missing | Issues |\n`;
    md += `|--------|------|----------|---------|--------|\n`;

    sheet.columns.forEach(col => {
      const issueCount = col.formatIssues.length;
      const issueIcon = issueCount > 0 ? '⚠️' : '✓';
      md += `| ${col.name} | ${col.dataType} | ${col.distinctValues} | ${col.nullPercentage.toFixed(1)}% | ${issueIcon} ${issueCount} |\n`;
    });
    md += `\n`;

    // Detailed column information
    md += `### Detailed Column Information\n\n`;
    sheet.columns.forEach(col => {
      md += `#### ${col.name}\n\n`;
      md += `- **Type:** ${col.dataType}\n`;
      md += `- **Distinct Values:** ${col.distinctValues}\n`;
      md += `- **Missing Values:** ${col.nullCount} (${col.nullPercentage.toFixed(2)}%)\n`;

      if (col.sampleValues.length > 0) {
        md += `- **Sample Values:** ${col.sampleValues.slice(0, 3).map(v => `\`${v}\``).join(', ')}\n`;
      }

      if (col.formatIssues.length > 0) {
        md += `- **Format Issues:**\n`;
        col.formatIssues.forEach(issue => {
          md += `  - ${issue}\n`;
        });
      }

      // Add statistics if available
      const stats = sheet.statistics[col.name];
      if (stats && Object.keys(stats).length > 0) {
        md += `- **Statistics:**\n`;
        if (stats.min !== undefined) md += `  - Min: ${stats.min}\n`;
        if (stats.max !== undefined) md += `  - Max: ${stats.max}\n`;
        if (stats.mean !== undefined) md += `  - Mean: ${stats.mean.toFixed(2)}\n`;
        if (stats.median !== undefined) md += `  - Median: ${stats.median}\n`;
        if (stats.stdDev !== undefined) md += `  - Std Dev: ${stats.stdDev.toFixed(2)}\n`;
        if (stats.outlierCount !== undefined && stats.outlierCount > 0) {
          md += `  - ⚠️ Outliers detected: ${stats.outlierCount}\n`;
          if (stats.outliers) {
            md += `  - Sample outliers: ${stats.outliers.slice(0, 3).join(', ')}\n`;
          }
        }
        if (stats.minLength !== undefined) {
          md += `  - Length range: ${stats.minLength}-${stats.maxLength} (avg: ${stats.avgLength.toFixed(1)})\n`;
        }
        if (stats.topValues && stats.topValues.length > 0) {
          md += `  - Top values:\n`;
          stats.topValues.slice(0, 5).forEach((tv: any) => {
            md += `    - \`${tv.value}\`: ${tv.count} (${tv.percentage}%)\n`;
          });
        }
      }

      md += `\n`;
    });
  });

  return md;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Excel Data Analyzer

Usage: bun run analyze_excel.ts <excel-file-path> [options]

Options:
  --output <path>    Output path for the markdown report (default: <filename>_analysis.md)
  --help             Show this help message

Example:
  bun run analyze_excel.ts data.xlsx
  bun run analyze_excel.ts data.xlsx --output report.md
    `);
    process.exit(0);
  }

  let filePath = '';
  let outputPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      outputPath = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }

  if (!filePath) {
    console.error('Error: Excel file path is required');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  if (!outputPath) {
    const fileBasename = basename(filePath, '.xlsx');
    outputPath = `${fileBasename}_analysis.md`;
  }

  console.log(`Analyzing: ${filePath}`);
  console.log(`Reading Excel file...`);

  const workbook = XLSX.readFile(filePath);
  const fileStats = Bun.file(filePath);
  const fileSize = fileStats.size;

  console.log(`Found ${workbook.SheetNames.length} sheet(s)`);

  const sheets: SheetAnalysis[] = [];
  for (const sheetName of workbook.SheetNames) {
    console.log(`Analyzing sheet: ${sheetName}...`);
    const sheet = workbook.Sheets[sheetName];
    const analysis = analyzeSheet(sheet, sheetName);
    sheets.push(analysis);
  }

  // Calculate overall score
  const overallScore = sheets.reduce((sum, sheet) => sum + sheet.qualityScore, 0) / sheets.length;

  // Generate summary
  const summary: string[] = [];
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0);
  const totalColumns = sheets.reduce((sum, sheet) => sum + sheet.columnCount, 0);
  summary.push(`${workbook.SheetNames.length} sheet(s) analyzed`);
  summary.push(`Total: ${totalRows} rows, ${totalColumns} columns`);

  const allIssues = sheets.flatMap(sheet => sheet.issues);
  if (allIssues.length > 0) {
    summary.push(`${allIssues.length} issue(s) detected`);
  } else {
    summary.push(`No major issues detected`);
  }

  const report: AnalysisReport = {
    fileName: basename(filePath),
    analyzedAt: new Date().toISOString(),
    fileSize,
    sheets,
    overallScore,
    summary
  };

  console.log(`Generating report...`);
  const markdown = generateMarkdownReport(report);

  await writeFile(outputPath, markdown, 'utf-8');

  console.log(`\n✅ Analysis complete!`);
  console.log(`📊 Overall Quality Score: ${overallScore.toFixed(1)}/100`);
  console.log(`📄 Report saved to: ${outputPath}`);

  if (overallScore < 70) {
    console.log(`\n  Data quality issues detected. Review the report for details.`);
  }
}

main().catch(console.error);
