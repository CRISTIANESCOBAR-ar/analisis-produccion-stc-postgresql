
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
        // 1. Add column
        await pool.query(`
            ALTER TABLE tb_config_tolerancias 
            ADD COLUMN IF NOT EXISTS limite_min_absoluto DECIMAL(5,2);
        `);
        console.log("Column limite_min_absoluto added.");

        // 2. Insert SCI rule
        // Check if exists first to avoid dupes
        const res = await pool.query("SELECT id FROM tb_config_tolerancias WHERE version_nombre = 'Estándar 2026' AND parametro = 'SCI'");
        
        if (res.rows.length === 0) {
            await pool.query(`
                INSERT INTO tb_config_tolerancias 
                (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal, limite_max_absoluto, limite_min_absoluto) 
                VALUES 
                ('Estándar 2026', 'SCI', 110.0, 95.0, 105.0, 90, NULL, 85.0);
            `);
            console.log("SCI rule inserted.");
        } else {
            // Update existing
            await pool.query(`
                UPDATE tb_config_tolerancias
                SET valor_ideal_min = 110.0,
                    limite_min_absoluto = 85.0
                WHERE version_nombre = 'Estándar 2026' AND parametro = 'SCI';
            `);
            console.log("SCI rule updated.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
