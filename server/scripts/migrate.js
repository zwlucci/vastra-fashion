import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../migrations");

async function migrate() {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration ${file}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log("Migrations complete");
}

migrate().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
