import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PG_USER || 'stc_user',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'stc_produccion',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  port: process.env.PG_PORT || 5433,
});

async function run() {
  const client = await pool.connect();
  try {
    const sqlPath = path.resolve(process.cwd(), '../init-db/17-update-config-tables-v2.sql');
    console.log('Execute SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Success!');
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
