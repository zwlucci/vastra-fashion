import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";
import { BACKUP_VERSION, TABLE_ORDER, quoteIdentifier } from "./databaseTransferConfig.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupPath = path.resolve(__dirname, "../../migration/database-backup.json");
const force = process.argv.includes("--force");

function checksum(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validateBackup(backup) {
  const { checksum: expectedChecksum, ...payload } = backup;
  const actualChecksum = checksum(JSON.stringify(payload));

  if (!expectedChecksum || expectedChecksum !== actualChecksum) {
    throw new Error("Backup checksum does not match. The file may be incomplete or modified.");
  }
  if (payload.format !== "vastra-database-transfer" || payload.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup format or version: ${payload.version ?? "unknown"}`);
  }
  for (const table of TABLE_ORDER) {
    if (!payload.tables?.[table]?.columns || !Array.isArray(payload.tables[table].rows)) {
      throw new Error(`Backup is missing table data for ${table}.`);
    }
  }

  return payload;
}

function prepareValue(value, column) {
  if (value === null || value === undefined) return null;
  if (column.dataType === "json" || column.dataType === "jsonb") {
    return JSON.stringify(value);
  }
  if (column.dataType === "bytea" && value?.type === "Buffer" && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return value;
}

async function ensureSchemaExists(client) {
  for (const table of TABLE_ORDER) {
    const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
    if (!result.rows[0].table_name) {
      throw new Error(`Table ${table} does not exist. Run \"pnpm migrate\" first.`);
    }
  }
}

async function importDatabase() {
  const backup = validateBackup(JSON.parse(await fs.readFile(backupPath, "utf8")));
  const client = await pool.connect();

  try {
    await ensureSchemaExists(client);
    const currentDatabase = await client.query("SELECT current_database() AS name");
    const existingCounts = [];

    for (const table of TABLE_ORDER) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`);
      if (result.rows[0].count > 0) existingCounts.push(`${table}=${result.rows[0].count}`);
    }

    if (existingCounts.length > 0 && !force) {
      throw new Error(
        `Target database ${currentDatabase.rows[0].name} is not empty (${existingCounts.join(", ")}). ` +
        "Use a new empty database, or rerun with --force only if replacing it is intentional."
      );
    }

    console.log(`Restoring into database: ${currentDatabase.rows[0].name}`);
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE TABLE ${[...TABLE_ORDER].reverse().map(quoteIdentifier).join(", ")} RESTART IDENTITY CASCADE`
    );

    for (const table of TABLE_ORDER) {
      const { columns, rows } = backup.tables[table];
      const names = columns.map((column) => column.name);
      const columnSql = names.map(quoteIdentifier).join(", ");
      const parameterSql = names.map((_, index) => `$${index + 1}`).join(", ");
      const insertSql = `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${parameterSql})`;

      for (const row of rows) {
        const values = columns.map((column) => prepareValue(row[column.name], column));
        await client.query(insertSql, values);
      }
      console.log(`${table}: restored ${rows.length} row(s)`);
    }

    await client.query("COMMIT");
    console.log("\nDatabase restore completed successfully.");
    console.log("Run \"pnpm transfer:verify\" before starting VASTRA.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

importDatabase()
  .catch((error) => {
    console.error("Database import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

