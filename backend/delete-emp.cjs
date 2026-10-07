require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
});
pool.query(`DELETE FROM tb_calidad WHERE "EMP" != 'STC' RETURNING "EMP"`)
  .then(res => console.log(`Se eliminaron ${res.rowCount} registros en total.`))
  .catch(console.error)
  .finally(() => pool.end());
