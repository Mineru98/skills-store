# Excel Data Analysis Patterns

Common data quality issues and their detection patterns.

## Data Type Issues

### Mixed Data Types
**Pattern:** Column contains multiple data types (numbers, strings, dates)
**Detection:** Check `typeof` for each value in column
**Impact:** High - prevents proper analysis and calculations
**Example:** Column with values: `123`, `"abc"`, `456.78`

### Numeric Values as Text
**Pattern:** Numbers stored as strings (often from CSV imports)
**Detection:** String values that parse successfully to numbers (>80% of values)
**Impact:** Medium - prevents numeric operations
**Example:** `"123"`, `"456"` instead of `123`, `456`

### Date Format Inconsistency
**Pattern:** Dates in multiple formats within same column
**Detection:** Multiple regex patterns match within single column
**Impact:** High - prevents chronological sorting and analysis
**Example:** `"2023-01-15"`, `"01/15/2023"`, `"15-Jan-2023"`

## Missing Data Issues

### High Missing Value Percentage
**Pattern:** Column with >50% null/empty values
**Detection:** Count nulls divided by total rows
**Impact:** High - insufficient data for meaningful analysis
**Recommendation:** Consider dropping column or imputing values

### Sparse Data
**Pattern:** Column with 20-50% missing values
**Detection:** Null percentage in range
**Impact:** Medium - may need imputation strategy
**Recommendation:** Analyze pattern of missingness (random vs systematic)

### Placeholder Values
**Pattern:** Values like "N/A", "-", "NULL", "None" used instead of actual nulls
**Detection:** Check for common placeholder strings
**Impact:** Medium - masks true missing data
**Example:** `"N/A"`, `"-"`, `"NULL"`, `"unknown"`

## Format Inconsistencies

### Leading/Trailing Whitespace
**Pattern:** String values with extra spaces
**Detection:** `value !== value.trim()`
**Impact:** Low - prevents exact matching
**Example:** `" value "`, `"value "`, `" value"`

### Inconsistent Casing
**Pattern:** Mixed uppercase/lowercase in same column
**Detection:** Compare lowercase count vs uppercase count
**Impact:** Low-Medium - prevents proper grouping
**Example:** `"john"`, `"JOHN"`, `"John"` treated as different values

### Inconsistent Delimiters
**Pattern:** Multiple delimiter styles in multi-value fields
**Detection:** Check for mix of `,`, `;`, `|` in string values
**Impact:** Medium - complicates parsing
**Example:** `"apple,banana"`, `"apple;orange"`, `"apple|grape"`

### Number Format Variations
**Pattern:** Numbers with inconsistent formatting
**Detection:** Check for currency symbols, thousand separators, decimal variations
**Impact:** Medium - prevents parsing
**Example:** `"$1,234.56"`, `"1234.56"`, `"1.234,56"` (EU format)

## Statistical Anomalies

### Outliers
**Pattern:** Values beyond 3 standard deviations from mean
**Detection:** `|value - mean| > 3 * stdDev`
**Impact:** Medium - may indicate errors or special cases
**Recommendation:** Investigate if outliers are errors or legitimate extreme values

### Skewed Distribution
**Pattern:** Mean significantly different from median
**Detection:** `|mean - median| > stdDev`
**Impact:** Low - indicates non-normal distribution
**Recommendation:** Consider median instead of mean for central tendency

### Low Cardinality in Text Columns
**Pattern:** Very few distinct values in large dataset
**Detection:** `distinctValues / totalRows < 0.01`
**Impact:** Low - might be better as categorical
**Recommendation:** Consider treating as category/enum

### High Cardinality in Expected Categories
**Pattern:** Too many distinct values for expected categorical data
**Detection:** Heuristic based on column name and value count
**Impact:** Medium - may indicate typos or format inconsistencies
**Example:** Country column with 300 distinct values (should be ~200)

## Structural Issues

### Duplicate Column Names
**Pattern:** Multiple columns with same header
**Detection:** Find duplicate entries in header row
**Impact:** High - creates ambiguity
**Recommendation:** Rename columns with unique identifiers

### Missing Column Headers
**Pattern:** Blank or empty column headers
**Detection:** Empty string or null in first row
**Impact:** High - prevents column identification
**Recommendation:** Generate systematic names (Column_1, Column_2)

### Empty Rows
**Pattern:** Rows with all null/empty values
**Detection:** Check if all cells in row are null
**Impact:** Low - adds noise to dataset
**Recommendation:** Remove empty rows

### Empty Columns
**Pattern:** Columns with all null/empty values
**Detection:** Check if all cells in column are null
**Impact:** Low - wastes space
**Recommendation:** Remove empty columns

## Domain-Specific Patterns

### Invalid Email Addresses
**Pattern:** Email-like column with invalid formats
**Detection:** Regex match for email pattern
**Impact:** Medium - prevents communication
**Example:** `"user@"`, `"@domain.com"`, `"user domain.com"`

### Invalid Phone Numbers
**Pattern:** Phone column with inconsistent formats
**Detection:** Check for expected digit count and formatting
**Impact:** Medium - prevents contact
**Example:** `"123-456-7890"`, `"1234567890"`, `"(123) 456-7890"`

### Invalid Dates
**Pattern:** Date column with impossible values
**Detection:** Parse date and validate ranges
**Impact:** High - corrupts temporal analysis
**Example:** `"2023-13-45"`, `"02/31/2023"`

## Data Relationships

### Referential Integrity Issues
**Pattern:** Foreign key values without matching primary keys
**Detection:** Check if values exist in referenced table
**Impact:** High - breaks relationships
**Recommendation:** Identify orphaned records

### Unexpected Duplicates
**Pattern:** Duplicate rows in table expected to have unique records
**Detection:** Check for duplicate combinations of key columns
**Impact:** High - may indicate data entry errors
**Recommendation:** Investigate and deduplicate

## Encoding Issues

### Character Encoding Problems
**Pattern:** Garbled characters from encoding mismatches
**Detection:** Look for replacement characters (�) or unusual byte sequences
**Impact:** High - data loss
**Example:** `"caf�"` instead of `"café"`

### Unicode Normalization
**Pattern:** Same characters in different Unicode representations
**Detection:** Visually identical strings that don't match
**Impact:** Medium - prevents exact matching
**Example:** `"café"` (NFC) vs `"café"` (NFD)
