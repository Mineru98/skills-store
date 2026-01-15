# Excel Data Analysis Report

**File:** {FILE_NAME}
**Analyzed:** {TIMESTAMP}
**File Size:** {FILE_SIZE} MB
**Overall Quality Score:** {OVERALL_SCORE}/100

## Executive Summary

- {SUMMARY_ITEM_1}
- {SUMMARY_ITEM_2}
- {SUMMARY_ITEM_3}

## Sheet: {SHEET_NAME}

**Dimensions:** {ROW_COUNT} rows × {COLUMN_COUNT} columns
**Quality Score:** {QUALITY_SCORE}/100

### Issues Detected

- ⚠️ {ISSUE_1}
- ⚠️ {ISSUE_2}

### Column Analysis

| Column | Type | Distinct | Missing | Issues |
|--------|------|----------|---------|--------|
| {COL_NAME} | {DATA_TYPE} | {DISTINCT_COUNT} | {MISSING_PCT}% | {ISSUE_ICON} {ISSUE_COUNT} |

### Detailed Column Information

#### {COLUMN_NAME}

- **Type:** {DATA_TYPE}
- **Distinct Values:** {DISTINCT_COUNT}
- **Missing Values:** {MISSING_COUNT} ({MISSING_PCT}%)
- **Sample Values:** `{SAMPLE_1}`, `{SAMPLE_2}`, `{SAMPLE_3}`
- **Format Issues:**
  - {FORMAT_ISSUE_1}
  - {FORMAT_ISSUE_2}
- **Statistics:**
  - Min: {MIN_VALUE}
  - Max: {MAX_VALUE}
  - Mean: {MEAN_VALUE}
  - Median: {MEDIAN_VALUE}
  - Std Dev: {STD_DEV}
  - ⚠️ Outliers detected: {OUTLIER_COUNT}
  - Sample outliers: {OUTLIER_1}, {OUTLIER_2}
  - Length range: {MIN_LEN}-{MAX_LEN} (avg: {AVG_LEN})
  - Top values:
    - `{TOP_VALUE_1}`: {COUNT_1} ({PCT_1}%)
    - `{TOP_VALUE_2}`: {COUNT_2} ({PCT_2}%)
    - `{TOP_VALUE_3}`: {COUNT_3} ({PCT_3}%)

---

## Recommendations

1. **High Priority:**
   - Address columns with >50% missing values
   - Fix mixed data type issues
   - Resolve duplicate column names

2. **Medium Priority:**
   - Clean up format inconsistencies (whitespace, casing)
   - Convert numeric strings to proper numbers
   - Investigate outliers for data entry errors

3. **Low Priority:**
   - Standardize date formats
   - Remove empty rows/columns
   - Normalize text formatting

## Next Steps

- Review detailed column information for specific issues
- Decide on handling strategy for missing values (drop, impute, leave as-is)
- Implement data cleaning based on identified issues
- Re-run analysis after cleaning to verify improvements
