import { IRecordSet } from "mssql";
import { executeQuery } from "../../mssql";

const isRecordSet = (result: any): result is IRecordSet<any> => {
    return Array.isArray(result);
};

export const getRelevantTables = async (userQuery: string): Promise<string[]> => {
    // Normalize user input
    const keywords = userQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(" ")
        .filter(Boolean);

    // Fetch all table names once
    const tablesResult = await executeQuery(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
  `);

    if (!isRecordSet(tablesResult)) {
        throw new Error("Failed to fetch tables");
    }

    const allTables = tablesResult.map((row: any) => ({
        original: row.TABLE_NAME,
        lower: String(row.TABLE_NAME).toLowerCase(),
    }));

    // Match tables by keyword
    const relevantTables = allTables.filter(table =>
        keywords.some(keyword => table.lower.includes(keyword))
    );


    // Fallback: if nothing matches, return a safe subset or all tables
    return relevantTables.length > 0
        ? relevantTables.map(t => t.original)
        : [];
};

export const getDatabaseSchema = async (tables: string[], prompt: string): Promise<string> => {

    if (tables.length === 0) {        
        throw new Error(
            `No matching tables found for prompt: "${prompt}"`
        );
    }
    const tableList = tables.map(t => `'${t}'`).join(",");
    const columns = await executeQuery(`
    SELECT 
      TABLE_NAME,
      COLUMN_NAME,
      DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN (${tableList})
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

    // Format schema in a compact AI-friendly way
    const schemaMap: Record<string, string[]> = {};

    if (!isRecordSet(columns)) {
        throw new Error("Failed to fetch tables");
    }
    columns.forEach((col: any) => {
        const tableName = col?.TABLE_NAME;
        const columnName = col?.COLUMN_NAME;
        const dataType = col?.DATA_TYPE;

        if (!tableName || !columnName || !dataType) return;

        if (!schemaMap[tableName]) {
            schemaMap[tableName] = [];
        }

        schemaMap[tableName].push(
            `${columnName} (${dataType})`
        );
    });

    return Object.entries(schemaMap)
        .map(([table, cols]) => `${table}: ${cols.join(", ")}`)
        .join("\n");
};
