import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";
import { TABLE_ORDER, quoteIdentifier } from "./databaseTransferConfig.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const backupPath = path.join(projectRoot, "migration", "database-backup.json");
const uploadsDir = path.join(projectRoot, "server", "uploads");

function checksum(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function rowsChecksum(rows) {
  const canonicalRows = rows
    .map((row) => JSON.stringify(canonicalize(row)))
    .sort();
  return checksum(JSON.stringify(canonicalRows));
}

async function verifyTransfer() {
  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  const failures = [];

  console.log("Database row counts:");
  for (const table of TABLE_ORDER) {
    const result = await pool.query(`SELECT * FROM ${quoteIdentifier(table)}`);
    const expectedRows = backup.tables?.[table]?.rows || [];
    const countMatches = result.rowCount === expectedRows.length;
    const contentMatches = countMatches && rowsChecksum(result.rows) === rowsChecksum(expectedRows);
    const matches = countMatches && contentMatches;
    console.log(
      `  ${matches ? "OK" : "MISMATCH"} ${table}: expected ${expectedRows.length}, found ${result.rowCount}`
    );
    if (!countMatches) failures.push(`${table} row count`);
    else if (!contentMatches) failures.push(`${table} row contents`);
  }

  console.log("Upload files:");
  for (const file of backup.uploads || []) {
    const fullPath = path.join(uploadsDir, ...file.path.split("/"));
    try {
      const contents = await fs.readFile(fullPath);
      if (contents.length !== file.size || checksum(contents) !== file.sha256) {
        failures.push(`changed upload ${file.path}`);
        console.log(`  MISMATCH ${file.path}`);
      }
    } catch {
      failures.push(`missing upload ${file.path}`);
      console.log(`  MISSING ${file.path}`);
    }
  }
  console.log(`  Checked ${(backup.uploads || []).length} file(s)`);

  if (failures.length > 0) {
    throw new Error(`Transfer verification failed: ${failures.join(", ")}`);
  }
  console.log("\nTransfer verification passed.");
}

verifyTransfer()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
