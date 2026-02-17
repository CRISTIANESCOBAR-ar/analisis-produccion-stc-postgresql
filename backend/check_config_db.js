
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'stc_produccion',
    user: 'stc_user',
    password: 'stc_password_2026'
});

async function run() {
    try {
        const res = await pool.query("SELECT * FROM tb_config_tolerancias WHERE version_nombre = 'Estándar 2026'");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
