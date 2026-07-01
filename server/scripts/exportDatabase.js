import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";
import { BACKUP_VERSION, TABLE_ORDER, quoteIdentifier } from "./databaseTransferConfig.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const backupDir = path.join(projectRoot, "migration");
const backupPath = path.join(backupDir, "database-backup.json");
const uploadsDir = path.join(projectRoot, "server", "uploads");

function checksum(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function listUploadFiles(directory, relativeBase = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listUploadFiles(fullPath, relativeBase));
      continue;
    }
    if (!entry.isFile()) continue;

    const contents = await fs.readFile(fullPath);
    files.push({
      path: path.relative(relativeBase, fullPath).replaceAll(path.sep, "/"),
      size: contents.length,
      sha256: checksum(contents)
    });
  }

  return files;
}

async function exportDatabase() {
  const databaseInfo = await pool.query(
    "SELECT current_database() AS database_name, version() AS postgres_version"
  );
  const tables = {};

  for (const table of TABLE_ORDER) {
    const columnsResult = await pool.query(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    if (columnsResult.rowCount === 0) {
      throw new Error(`Required table is missing: ${table}. Run migrations before exporting.`);
    }

    const rowsResult = await pool.query(`SELECT * FROM ${quoteIdentifier(table)}`);
    tables[table] = {
      columns: columnsResult.rows.map((column) => ({
        name: column.column_name,
        dataType: column.data_type,
        udtName: column.udt_name
      })),
      rows: rowsResult.rows
    };
    console.log(`${table}: ${rowsResult.rowCount} row(s)`);
  }

  const payload = {
    format: "vastra-database-transfer",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    database: databaseInfo.rows[0],
    tableOrder: TABLE_ORDER,
    tables,
    uploads: await listUploadFiles(uploadsDir)
  };
  const serializedPayload = JSON.stringify(payload);
  const backup = { ...payload, checksum: checksum(serializedPayload) };

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

  const rowCount = TABLE_ORDER.reduce((total, table) => total + tables[table].rows.length, 0);
  console.log(`\nBackup written to ${backupPath}`);
  console.log(`${rowCount} database row(s), ${backup.uploads.length} upload file(s)`);
  console.log("This backup contains private account and message data. Keep it secure.");
}

exportDatabase()
  .catch((error) => {
    console.error("Database export failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

