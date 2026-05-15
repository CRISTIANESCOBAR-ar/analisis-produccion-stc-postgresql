const { Client } = require('pg');
const config = { host: '127.0.0.1', port: 5434, database: 'stc_produccion', user: 'stc_user', password: 'stc_password_2026' };
async function run() {
  const client = new Client(config);
  await client.connect();
  const queryMay = (field) => `SELECT "SELETOR", "FILIAL", COUNT(*) FROM tb_produccion WHERE TO_DATE("${field}", 'DD/MM/YYYY') >= '2026-05-01' AND TO_DATE("${field}", 'DD/MM/YYYY') <= '2026-05-31' GROUP BY "SELETOR", "FILIAL" ORDER BY COUNT(*) DESC`;
  console.log('--- 1) DT_BASE_PRODUCAO ---');
  const resBase = await client.query(queryMay('DT_BASE_PRODUCAO'));
  console.table(resBase.rows);
  if (resBase.rows.length === 0) {
    console.log('--- 2) DT_INICIO ---');
    const resInicio = await client.query(queryMay('DT_INICIO'));
    console.table(resInicio.rows);
    console.log('--- DT_FINAL ---');
    const resFinal = await client.query(queryMay('DT_FINAL'));
    console.table(resFinal.rows);
  }
  console.log('--- 3) Examples ---');
  const queryEx = `SELECT "SELETOR", "FILIAL", "DT_BASE_PRODUCAO", "DT_INICIO", "DT_FINAL", "BASE URDUME", "METRAGEM" FROM tb_produccion WHERE ((TO_DATE("DT_BASE_PRODUCAO", 'DD/MM/YYYY') BETWEEN '2026-05-01' AND '2026-05-31') OR (TO_DATE("DT_INICIO", 'DD/MM/YYYY') BETWEEN '2026-05-01' AND '2026-05-31') OR (TO_DATE("DT_FINAL", 'DD/MM/YYYY') BETWEEN '2026-05-01' AND '2026-05-31')) AND ("SELETOR" ILIKE '%ind%' OR "SELETOR" ILIKE '%urd%' OR "SELETOR" ILIKE '%ten%') LIMIT 10`;
  const resEx = await client.query(queryEx);
  console.table(resEx.rows);
  await client.end();
}
run().catch(err => { console.error(err); process.exit(1); });
