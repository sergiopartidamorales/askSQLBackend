const CODE_BLOCK_SQL_REGEX = /```sql\n?/gi;
const CODE_BLOCK_REGEX = /```\n?/g;
const BACKTICK_REGEX = /`/g;
const SELECT_REGEX = /^\s*select\b/i;
const SELECT_DISTINCT_REGEX = /^\s*select\s+distinct\b/i;
const TOP_REGEX = /\btop\s+\d+\b/i;
const OFFSET_FETCH_REGEX = /\boffset\s+\d+\s+rows\b/i;
const MULTI_STATEMENT_REGEX = /[;]+/;
const FORBIDDEN_KEYWORDS_REGEX =
  /\b(insert|update|delete|drop|alter|create|truncate|merge|exec|execute|grant|revoke)\b/i;

export function cleanSQL(sql: string): string {
  let cleaned = sql.replace(CODE_BLOCK_SQL_REGEX, "").replace(CODE_BLOCK_REGEX, "");
  cleaned = cleaned.replace(BACKTICK_REGEX, "");
  return cleaned.trim();
}

export function assertSafeSql(sql: string): void {
  const normalized = sql.trim();
  if (!SELECT_REGEX.test(normalized)) {
    throw new Error("Only SELECT queries are allowed");
  }
  // Stops multi-statement queries like: SELECT ...; DROP TABLE ...
  if (MULTI_STATEMENT_REGEX.test(normalized.replace(/\s*;?\s*$/, ""))) {
    throw new Error("Multiple statements are not allowed");
  }
  // Extra safety against DDL/DML keywords.
  if (FORBIDDEN_KEYWORDS_REGEX.test(normalized)) {
    throw new Error("Only SELECT keywords are allowed");
  }
}

export function enforceTopLimit(sql: string, limit: number): string {
  const normalized = sql.trim();
  if (TOP_REGEX.test(normalized) || OFFSET_FETCH_REGEX.test(normalized)) {
    return sql;
  }
  if (SELECT_DISTINCT_REGEX.test(normalized)) {
    return normalized.replace(SELECT_DISTINCT_REGEX, `SELECT DISTINCT TOP ${limit}`);
  }
  return normalized.replace(SELECT_REGEX, `SELECT TOP ${limit}`);
}
