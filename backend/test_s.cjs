const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://stc_user:stc_password_2026@localhost:5433/stc_produccion'
});

async function main() {
  await client.connect();
  const res = await client.query(`SELECT "PARTIDA", "S" FROM tb_produccion WHERE "PARTIDA" IN ('560625', '0560625', '00560625') LIMIT 10`);
  console.log('Results:', res.rows);
  await client.end();
}

main().catch(console.error);
