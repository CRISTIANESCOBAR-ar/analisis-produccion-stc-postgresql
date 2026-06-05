import pg from 'pg';
const { Client } = pg;
const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT DISTINCT TRIM(BOTH FROM "COD_DEF") as cod, TRIM(BOTH FROM "DESC_DEFEITO") as def 
    FROM tb_defectos 
    WHERE TRIM(BOTH FROM "COD_DEF") IN ('319', '328', '386', '333', '340', '382', '387')
  `);
  console.log('Defects:', res.rows);
  await client.end();
}
run();
