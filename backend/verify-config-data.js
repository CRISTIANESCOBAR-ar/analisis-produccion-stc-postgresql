// verify-config-data.js
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'stc_produccion',
    user: process.env.PG_USER || 'stc_user',
    password: process.env.PG_PASSWORD || 'stc_password_2026'
});

async function checkData() {
    try {
        const client = await pool.connect();
        console.log("Conexión exitosa a la DB.");
        
        const resHilos = await client.query('SELECT * FROM tb_config_hilos');
        console.log(`Hilos encontrados: ${resHilos.rowCount}`);
        if(resHilos.rowCount > 0) {
            console.table(resHilos.rows.map(h => ({
                id: h.id,
                titulo: h.titulo_ne,
                app: h.aplicacion,
                sci: h.sci_min
            })));
        } else {
            console.log("⚠️ No hay datos en tb_config_hilos!");
        }

        const resTol = await client.query('SELECT * FROM tb_config_tolerancias');
        console.log(`Tolerancias encontradas: ${resTol.rowCount}`);
        
        client.release();
    } catch (err) {
        console.error("Error conectando a DB:", err);
    } finally {
        pool.end();
    }
}

checkData();
