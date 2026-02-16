// backend/config-standards.js
import express from 'express';
import pg from 'pg';
import path from 'path';
import 'dotenv/config';
import { auditMix } from './services/audit-service.js';

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

// Auto-migración al iniciar (asegura columnas y tablas nuevas)
async function ensureSchema() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE tb_config_tolerancias 
            ADD COLUMN IF NOT EXISTS limite_max_absoluto DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS limite_min_absoluto DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS promedio_objetivo_max DECIMAL(5,2);
            
            ALTER TABLE tb_config_tolerancias
            ALTER COLUMN valor_ideal_min TYPE DECIMAL(5,2);

            CREATE TABLE IF NOT EXISTS tb_historico_configuraciones (
                id SERIAL PRIMARY KEY,
                version_nombre VARCHAR(50) NOT NULL,
                fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                snapshot_json JSONB NOT NULL,
                usuario_responsable VARCHAR(100)
            );
        `);
        console.log('✓ Config Schema Updated');
    } catch (e) {
        console.error('Migration error (Config):', e);
    } finally {
        client.release();
    }
}
// Ejecutar migración en segundo plano al cargar módulo
ensureSchema();

// GET /api/config/standards
// Obtiene la configuración más reciente.
router.get('/standards', async (req, res) => {
    try {
        const client = await pool.connect();

        // 1. Identificar la versión más reciente (por fecha de creación de hilos)
        const versionResult = await client.query(`
            SELECT version_nombre 
            FROM tb_config_hilos 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        let activeVersion = 'Estándar 2026';
        if (versionResult.rows.length > 0) {
            activeVersion = versionResult.rows[0].version_nombre;
        }

        // 2. Obtener datos de esa versión
        const configHilos = await client.query(
            'SELECT * FROM tb_config_hilos WHERE version_nombre = $1 ORDER BY id ASC',
            [activeVersion]
        );
        const configTolerancias = await client.query(
            'SELECT * FROM tb_config_tolerancias WHERE version_nombre = $1 ORDER BY id ASC',
            [activeVersion]
        );
        client.release();

        // Limpieza básica de duplicados en memoria si la base de datos está sucia
        // Esto ayuda a recuperarse de estados inconsistentes previos.
        const uniqueHilos = configHilos.rows.reduce((acc, current) => {
            const x = acc.find(item => item.titulo_ne === current.titulo_ne);
            if (!x) return acc.concat([current]);
            else return acc;
        }, []);

        const uniqueTolerancias = configTolerancias.rows.reduce((acc, current) => {
            const x = acc.find(item => item.parametro === current.parametro);
            if (!x) return acc.concat([current]);
            else return acc; // Si ya existe uno con ese parámetro, ignoramos duplicados
        }, []);

        res.json({
            success: true,
            hilos: uniqueHilos,
            tolerancias: uniqueTolerancias,
            version_actual: activeVersion
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

        // 1. Eliminar datos previos de esta misma versión para evitar duplicados
        await client.query('DELETE FROM tb_config_hilos WHERE version_nombre = $1', [version_nombre]);
        await client.query('DELETE FROM tb_config_tolerancias WHERE version_nombre = $1', [version_nombre]);

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
                `INSERT INTO tb_config_tolerancias (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal, limite_max_absoluto, promedio_objetivo_max)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [version_nombre, tol.parametro, tol.valor_ideal_min, tol.rango_tol_min, tol.rango_tol_max, tol.porcentaje_min_ideal, tol.limite_max_absoluto, tol.promedio_objetivo_max]
            );
        }

        // Guardar Snapshot Histórico
        const snapshot = {
            version: version_nombre,
            fecha: new Date(),
            hilos,
            tolerancias
        };
        await client.query('INSERT INTO tb_historico_configuraciones (version_nombre, snapshot_json) VALUES ($1, $2)', [version_nombre, JSON.stringify(snapshot)]);

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

// POST /api/config/audit
// Recibe un array de pacas (objetos) y la configuración a aplicar.
// Retorna el análisis de calidad.
router.post('/audit', async (req, res) => {
    try {
        const { bales, config, version_nombre } = req.body;
        
        let configToUse = config;

        // Si no envían config, buscamos la versión activa o la especificada
        if (!configToUse) {
            const client = await pool.connect();
            try {
                let version = version_nombre;
                if (!version) {
                     const vRes = await client.query('SELECT version_nombre FROM tb_config_hilos ORDER BY created_at DESC LIMIT 1');
                     if (vRes.rows.length > 0) version = vRes.rows[0].version_nombre;
                }
                
                if (version) {
                    const tolRes = await client.query('SELECT * FROM tb_config_tolerancias WHERE version_nombre = $1', [version]);
                    configToUse = { tolerancias: tolRes.rows };
                }
            } finally {
                client.release();
            }
        }

        const auditResult = auditMix(bales || [], configToUse);
        res.json({ success: true, data: auditResult });

    } catch (err) {
        console.error('Error auditing:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
