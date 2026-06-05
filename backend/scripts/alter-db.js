import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'c:/stc-produccion-v2/backend/.env' });

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

async function run() {
  try {
    console.log("Altering tb_narrativa_log...");
    await pool.query(`ALTER TABLE tb_narrativa_log ADD COLUMN IF NOT EXISTS origen VARCHAR(100) DEFAULT 'Relato IA (HVI)';`);
    
    console.log("Altering tb_narrativa_cache...");
    await pool.query(`ALTER TABLE tb_narrativa_cache ADD COLUMN IF NOT EXISTS origen VARCHAR(100) DEFAULT 'Relato IA (HVI)';`);
    
    console.log("Success!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
