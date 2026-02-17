
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
        await pool.query(`
            INSERT INTO tb_config_tolerancias 
            (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal, limite_max_absoluto, limite_min_absoluto) 
            VALUES 
            ('Estándar 2026', 'SCI', 110.0, 95.0, 105.0, 80, NULL, 85.0);
        `);
        console.log("SCI rule inserted.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
