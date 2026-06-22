import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnvFile() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const { rows } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock'
      AND column_name = 'variant_id'
  `);
  if (!rows.length) {
    console.log("NOT_APPLIED");
    process.exit(2);
  }
  const count = await client.query(`
    SELECT COUNT(*)::int AS variants, COUNT(DISTINCT product_id)::int AS products
    FROM public.stock
    WHERE variant_id IS NOT NULL
  `);
  console.log("APPLIED", count.rows[0]);
} catch (err) {
  console.error("CHECK_FAILED", err.message);
  process.exit(1);
} finally {
  await client.end();
}
