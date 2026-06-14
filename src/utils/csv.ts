/**
 * Tiny, dependency-free CSV helpers (RFC-4180). Used by the admin Import /
 * Export page and by `subscribersToCsv`. We don't pull in papaparse — the
 * quoting rules are a dozen lines and the storefront bundle stays lean.
 *
 * Engine-safe: no `next/*`, no browser globals — importable from anywhere.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** Serialize a matrix of rows to an RFC-4180 CSV string (CRLF line endings). */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Parse an RFC-4180 CSV string into a matrix of strings. Handles quoted
 * fields, escaped quotes (`""`), embedded commas/newlines, CRLF or LF line
 * endings, a leading UTF-8 BOM, and a trailing newline.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // skip BOM
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush the final field/row unless the input ended exactly on a line break.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Turn a parsed matrix into header-keyed records. The first row is the header
 * (trimmed); blank lines are dropped; every value is trimmed.
 */
export function csvToRecords(matrix: string[][]): Record<string, string>[] {
  const [header, ...body] = matrix;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const rec: Record<string, string> = {};
      keys.forEach((k, idx) => {
        rec[k] = (r[idx] ?? '').trim();
      });
      return rec;
    });
}
