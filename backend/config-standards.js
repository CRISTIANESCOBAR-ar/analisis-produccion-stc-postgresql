// backend/config-standards.js
import express from 'express';
import pg from 'pg';
import path from 'path';
import 'dotenv/config';

const { Pool } = pg;
const router = express.Router();

// Configurar pool explícitamente usando las variables del .env (que usan nombres distintos a los default de pg)
const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'stc_produccion',
    user: process.env.PG_USER || 'stc_user',
    password: process.env.PG_PASSWORD || 'stc_password_2026'
});

// GET /api/config/standards
// Obtiene la configuración activa, por defecto la primera que encuentra o un filtro por 'activa'.
router.get('/standards', async (req, res) => {
    try {
        const client = await pool.connect();
        const configHilos = await client.query('SELECT * FROM tb_config_hilos ORDER BY id ASC');
        const configTolerancias = await client.query('SELECT * FROM tb_config_tolerancias ORDER BY id ASC');
        client.release();

        res.json({
            success: true,
            hilos: configHilos.rows,
            tolerancias: configTolerancias.rows,
            version_actual: configHilos.rows.length > 0 ? configHilos.rows[0].version_nombre : 'N/A'
        });
    } catch (err) {
        console.error('Error fetching standards:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/config/standards
// Guarda una nueva versión de estándares.
router.post('/standards', async (req, res) => {
    const { version_nombre, hilos, tolerancias } = req.body;
    
    if (!version_nombre) return res.status(400).json({ success: false, error: 'version_nombre required' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Desactivar versiones anteriores si se marca esta como activa (opcional, por ahora solo insertamos nueva version)
        // await client.query('UPDATE tb_config_hilos SET activa = false WHERE version_nombre != $1', [version_nombre]);

        // Insertar Hilos
        for (const hilo of hilos) {
            await client.query(
                `INSERT INTO tb_config_hilos (version_nombre, titulo_ne, aplicacion, sci_min, str_min, mic_min, mic_max, sf_max)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [version_nombre, hilo.titulo_ne, hilo.aplicacion, hilo.sci_min, hilo.str_min, hilo.mic_min, hilo.mic_max, hilo.sf_max]
            );
        }

        // Insertar Tolerancias
        for (const tol of tolerancias) {
            await client.query(
                `INSERT INTO tb_config_tolerancias (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [version_nombre, tol.parametro, tol.valor_ideal_min, tol.rango_tol_min, tol.rango_tol_max, tol.porcentaje_min_ideal]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Configuración guardada exitosamente' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving standards:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

export default router;
