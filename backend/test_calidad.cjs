const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
});

(async () => {
  try {
    // Uster lote format: HD-NNN-NN -> extract numeric part
    const r1 = await pool.query(`SELECT DISTINCT lote FROM tb_uster_par ORDER BY lote LIMIT 20`);
    console.log('=== All uster_par lotes ===');
    console.log(JSON.stringify(r1.rows.map(r => r.lote)));

    // Lote fiacao numbers
    const r2 = await pool.query(`SELECT DISTINCT "LOTE FIACAO" FROM tb_produccion WHERE "LOTE FIACAO" IS NOT NULL AND "LOTE FIACAO" <> '' ORDER BY "LOTE FIACAO" LIMIT 20`);
    console.log('\n=== LOTE FIACAO values ===');
    console.log(JSON.stringify(r2.rows.map(r => r['LOTE FIACAO'])));

    // OE lote vs fibra MISTURA
    const r3 = await pool.query(`SELECT cf."MISTURA", oe."LOTE PRODUC" FROM tb_calidad_fibra cf INNER JOIN tb_produccion_oe oe ON cf."MISTURA" = oe."LOTE PRODUC" LIMIT 5`);
    console.log('\n=== Fibra-OE direct match ===');
    console.log(JSON.stringify(r3.rows, null, 2));

    // Existing seguimiento-roladas endpoint reference
    const r4 = await pool.query(`SELECT "PARTIDA", "ROLADA", "LOTE FIACAO", "MAQUINA" FROM tb_produccion WHERE "LOTE FIACAO" IS NOT NULL AND "LOTE FIACAO" <> '' LIMIT 3`);
    console.log('\n=== Produccion with LOTE FIACAO ===');
    console.log(JSON.stringify(r4.rows, null, 2));

    // OE LOTE PRODUC format matches MISTURA format?
    const r5 = await pool.query(`SELECT DISTINCT "LOTE PRODUC" FROM tb_produccion_oe ORDER BY "LOTE PRODUC" LIMIT 15`);
    console.log('\n=== OE LOTE PRODUC values ===');
    console.log(JSON.stringify(r5.rows.map(r => r['LOTE PRODUC'])));

    // MISTURA format
    const r6 = await pool.query(`SELECT DISTINCT "MISTURA" FROM tb_calidad_fibra ORDER BY "MISTURA" LIMIT 15`);
    console.log('\n=== MISTURA values ===');
    console.log(JSON.stringify(r6.rows.map(r => r.MISTURA)));

  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
})();
