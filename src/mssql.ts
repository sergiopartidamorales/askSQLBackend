import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const DB_PORT = parseInt(process.env.DATABASE_PORT || "1433");

const config: sql.config = {
  server: process.env.DATABASE_SERVER || "localhost",
  port: DB_PORT,
  database: process.env.DATABASE_NAME || "analytics",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

export async function executeQuery(query: string) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err: any) {
    console.error("my sql error:" + err);
    throw new Error(err?.message ?? "Database query failed");
  }
}
