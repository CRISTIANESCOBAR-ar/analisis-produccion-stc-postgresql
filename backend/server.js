/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getImportStatus, importCSV, importAll, importSpecificTables, importForceAll, renameduplicateHeaders, getTableColumns, compareColumns, addColumnsToTable } from './import-manager.js'
import configStandardsRouter from './config-standards.js';
import { optimizeBlend } from './services/blendomat-optimizer.js';
import { triggerFullBackup, getFullBackupStatus } from './services/fullBackupTrigger.js';
import { getEficienciasResumen, getEficienciasDetalle } from './routes/eficiencias-tecelaje.mjs';
import { parseNarrativaStructure } from '../shared/narrativaSections.js';

const { Pool } = pg
const app = express()

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rutas de configuración
app.use('/api/config', configStandardsRouter);

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function looksLikeWindowsPath(p) {
  if (!p) return false
  // Drive letter (C:\...) or UNC (\\server\share)
  return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function buildCacheKey({ lotes, fecha, formato, modelo, dataHash, origen }) {
  return sha256(`${lotes}|${fecha || ''}|${formato || 'actual'}|${modelo || ''}|${dataHash}|${origen}`);
}

function hashRowsPayload(dataset) {
  const norm = dataset.map(r => ({
    p: r.partida, a: r.articulo, t: r.indicadores_tejeduria?.telar_asignado, e: r.indicadores_tejeduria?.eficiencia_porcentaje,
    d: r.conteo_defectos_revisadora?.detalle_frecuencia_codigo
  }));
  return sha256(JSON.stringify(norm));
}

function buildNarrativaStructuredFields(narrativaText) {
  const parsed = parseNarrativaStructure(narrativaText)
  return {
    narrativaIntro: parsed.intro || '',
    narrativaSections: Array.isArray(parsed.sections) ? parsed.sections : [],
  }
}

function sanitizeCsvFolder(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  // Si el backend corre en Linux (contenedor/servidor), una ruta Windows no existe.
  if (process.platform !== 'win32' && looksLikeWindowsPath(value)) return ''
  return value
}

function defaultCsvFolder() {
  // Windows dev histórico: C:\STC\CSV
  // Linux/Container: montar volumen en /data/csv
  const envFolder = String(process.env.CSV_FOLDER || '').trim()
  if (envFolder) return envFolder
  return process.platform === 'win32' ? 'C:\\STC\\CSV' : '/data/csv'
}

function resolveCsvFolderFromReq(req) {
  const q = sanitizeCsvFolder(req?.query?.csvFolder)
  if (q) return q
  return defaultCsvFolder()
}

function resolveCsvFolderFromBody(req) {
  const b = sanitizeCsvFolder(req?.body?.csvFolder)
  if (b) return b
  return defaultCsvFolder()
}

// =====================================================
// CONFIGURACIÓN DATABASE
// =====================================================
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

function hrMs() {
  return Number(process.hrtime.bigint()) / 1_000_000
}

// Helper: query wrapper
async function query(text, params, label) {
  const start = hrMs()
  const res = await pool.query(text, params)
  const duration = hrMs() - start
  const tag = label ? ` [${label}]` : ''
  const rows = Array.isArray(res?.rows) ? res.rows.length : res?.rowCount
  console.log(`✓ Query${tag} in ${duration.toFixed(1)}ms (rows=${rows ?? 'n/a'})`)
  return res
}

// Helper: obtener cliente para transacciones
async function getClient() {
  return await pool.connect()
}

// Helper: convertir claves a mayúsculas (compatibilidad Oracle/carga-datos-docker)
function uppercaseKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(uppercaseKeys)
  const result = {}
  for (const key of Object.keys(obj)) {
    result[key.toUpperCase()] = obj[key]
  }
  return result
}

// Helper: formatear números
function formatNumber(val) {
  if (val === null || val === undefined || val === '') return val
  const num = parseFloat(val)
  if (isNaN(num)) return val
  return String(parseFloat(num.toFixed(2)))
}

// Helpers SQL (PostgreSQL): parseo robusto de fechas/números desde TEXT
function sqlParseDate(colIdent) {
  // Soporta DD/MM/YYYY y YYYY-MM-DD (opcional con hora)
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(${colIdent} from 1 for 10), 'DD/MM/YYYY')
      WHEN ${colIdent} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${colIdent} from 1 for 10)::date
      ELSE NULL
    END
  )`
}

function sqlParseNumber(colIdent) {
  // Convierte TEXT numérico con '.' o ',' decimal; ignora valores no numéricos.
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

function sqlParseNumberIntl(colIdent) {
  // Soporta números en formato europeo con separador de miles '.' y decimal ',' (ej: 1.980,00)
  // y también formatos simples (ej: 1980.00 o 1980,00).
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' THEN replace(replace(${colIdent}, '.', ''), ',', '.')::numeric
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function tableExists(tableName) {
  const res = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`])
  return Boolean(res.rows?.[0]?.reg)
}

async function getTableColumnsMap(tableName, label) {
  const res = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
    label
  )
  return new Map((res.rows || []).map((row) => [String(row.column_name).toLowerCase(), row.column_name]))
}

async function ensureCostosSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_items (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'KG',
      activo BOOLEAN NOT NULL DEFAULT TRUE
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_item_alias (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      origen TEXT NOT NULL,
      nombre_en_origen TEXT NOT NULL,
      UNIQUE (origen, nombre_en_origen)
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_mensual (
      id SERIAL PRIMARY KEY,
      yyyymm TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      ars_por_unidad NUMERIC NOT NULL,
      observaciones TEXT,
      UNIQUE (yyyymm, item_id)
    )`
  )

  await query('CREATE INDEX IF NOT EXISTS idx_costo_mensual_mes ON tb_costo_mensual(yyyymm)')
  await query('CREATE INDEX IF NOT EXISTS idx_costo_alias_item ON tb_costo_item_alias(item_id)')

  await query(
    `INSERT INTO tb_costo_items (codigo, descripcion, unidad, activo)
     VALUES
       ('ESTOPA_AZUL', 'Estopa Azul', 'KG', TRUE),
       ('URDIDO_TENIDO', 'Urdido Tenido', 'M', TRUE),
       ('TELA_TERMINADA', 'Tela Terminada', 'M', TRUE)
     ON CONFLICT (codigo) DO NOTHING`
  )

  await query("UPDATE tb_costo_items SET unidad = 'M' WHERE codigo IN ('URDIDO_TENIDO', 'TELA_TERMINADA')")

  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'URDIDO TEÑIDO' FROM tb_costo_items WHERE codigo = 'URDIDO_TENIDO'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'TELA TERMINADA' FROM tb_costo_items WHERE codigo = 'TELA_TERMINADA'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL TEJEDURIA' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
}

// =====================================================
// MIDDLEWARE
// =====================================================
const allowedOriginRegexes = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
]

const allowedOriginList = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isOriginAllowed(origin, host) {
  if (!origin) return true
  if (allowedOriginList.includes(origin)) return true
  if (allowedOriginRegexes.some((re) => re.test(origin))) return true

  // Despliegue típico (Podman + reverse proxy): el frontend sirve desde la misma origin,
  // y /api se proxifica al backend. Permitimos Origin == http(s)://<host>.
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) return true

  return false
}

const corsOptionsDelegate = (req, cb) => {
  const origin = req.header('Origin')
  const host = req.headers.host

  const allowed = isOriginAllowed(origin, host)
  cb(null, {
    origin: allowed,
    credentials: true,
  })
}

app.use(cors(corsOptionsDelegate))
app.options('*', cors(corsOptionsDelegate))
app.use(express.json({ limit: '50mb' }))

// =====================================================
// FRONTEND (PRODUCCIÓN): servir SPA desde el mismo servidor
// =====================================================
if (process.env.NODE_ENV === 'production') {
  const frontendDist = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.resolve(__dirname, '..', 'frontend', 'dist')

  app.use(express.static(frontendDist))
  // SPA fallback: cualquier ruta que no sea /api/... vuelve a index.html
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001

// =====================================================
// PRODUCCION: helpers de diferencias / historial
// =====================================================
function readCsvHeaderLine(csvPath) {
  const fd = fs.openSync(csvPath, 'r')
  try {
    const buffer = Buffer.alloc(64 * 1024)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    const chunk = buffer.toString('utf-8', 0, bytesRead)
    const nl = chunk.indexOf('\n')
    const line = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/\r$/u, '')
    return line
  } finally {
    fs.closeSync(fd)
  }
}

async function ensureSyncHistoryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_column_warnings_history (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      csv_path TEXT,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      extra_columns TEXT[] NOT NULL DEFAULT '{}',
      missing_columns TEXT[] NOT NULL DEFAULT '{}'
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_detected_at
      ON tb_column_warnings_history(detected_at DESC)
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_table
      ON tb_column_warnings_history(table_name)
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS tb_schema_changes_log (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      change_type TEXT NOT NULL DEFAULT 'ADD_COLUMNS',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      columns_added TEXT[] NOT NULL DEFAULT '{}',
      reimported BOOLEAN NOT NULL DEFAULT false,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_schema_changes_log_applied_at
      ON tb_schema_changes_log(applied_at DESC)
  `)
}

function arraysEqualCaseSensitive(a, b) {
  const aa = Array.isArray(a) ? a : []
  const bb = Array.isArray(b) ? b : []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false
  }
  return true
}

function dateVariants(dateStr) {
  const s = String(dateStr || '').trim()
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (iso) {
    const [yyyy, mm, dd] = s.split('-')
    return { iso: s, br: `${dd}/${mm}/${yyyy}` }
  }
  const br = /^\d{2}\/\d{2}\/\d{4}$/.test(s)
  if (br) {
    const [dd, mm, yyyy] = s.split('/')
    return { iso: `${yyyy}-${mm}-${dd}`, br: s }
  }
  return { iso: s, br: s }
}

function dateTextCandidates(dateStr) {
  const v = dateVariants(dateStr)
  const out = new Set([v.iso, v.br])

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v.br)) {
    const [dd, mm, yyyy] = v.br.split('/')
    const ddNo = String(parseInt(dd, 10))
    const mmNo = String(parseInt(mm, 10))
    out.add(`${ddNo}/${mmNo}/${yyyy}`)
  }

  return Array.from(out).filter(Boolean)
}

async function ensureCalidadIndexes() {
  // Índices pensados para acelerar filtros por (EMP, fecha text, revisor/partida)
  // Usamos CONCURRENTLY para minimizar locks en tablas grandes.
  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod
        ON tb_calidad ("EMP", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod_revisor
        ON tb_calidad ("EMP", "DAT_PROD", "REVISOR FINAL")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod_revisor:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_partida_revisor_datprod
        ON tb_calidad ("EMP", "PARTIDA", "REVISOR FINAL", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_partida_revisor_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_produccion_partida_tecelagem
        ON tb_produccion ("PARTIDA")
        WHERE "FILIAL" = '05' AND "SELETOR" = 'TECELAGEM'
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_produccion_partida_tecelagem:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_defectos_etiqueta_trim
          ON tb_defectos ((btrim("ETIQUETA")))
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_defectos_etiqueta_trim:', e.message)
  }

  // Stats: opcional (puede competir con consultas y volver lento el UI)
  if (process.env.PERF_ANALYZE_ON_STARTUP === '1') {
    try {
      await query('ANALYZE tb_calidad')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_calidad:', e.message)
    }
    try {
      await query('ANALYZE tb_produccion')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_produccion:', e.message)
    }
  }
}

async function maybeInsertWarningHistory({ tableName, csvPath, extraColumns, missingColumns }) {
  // Evita spam: solo inserta si cambió respecto al último registro de esa tabla.
  const last = await query(
    `SELECT extra_columns, missing_columns FROM tb_column_warnings_history WHERE table_name = $1 ORDER BY detected_at DESC LIMIT 1`,
    [tableName]
  )

  const prev = last.rows?.[0]
  const sameAsPrev =
    prev &&
    arraysEqualCaseSensitive(prev.extra_columns || [], extraColumns || []) &&
    arraysEqualCaseSensitive(prev.missing_columns || [], missingColumns || [])

  if (sameAsPrev) return

  await query(
    `INSERT INTO tb_column_warnings_history (table_name, csv_path, extra_columns, missing_columns)
     VALUES ($1, $2, $3, $4)`,
    [tableName, csvPath || null, extraColumns || [], missingColumns || []]
  )
}

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// =====================================================
// INVENTARIO
// =====================================================
app.get('/api/inventory/cotton-bales', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tb_est_mp ORDER BY id DESC LIMIT 5000', [], 'Get Cotton Bales')
    res.json(rows)
  } catch (err) {
    console.error(err)
    // Return empty array on error to prevent frontend crash if table missing
    res.json([]) 
  }
})

app.post('/api/inventory/blendomat', async (req, res) => {
  try {
    const { stock, rules, supervisionSettings, blendSize, algorithm } = req.body;

    if (!stock || !rules || !supervisionSettings || !blendSize) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (stock, rules, supervisionSettings, blendSize)' });
    }

    const result = optimizeBlend(stock, rules, supervisionSettings, blendSize, algorithm);
    res.json(result);
  } catch (err) {
    console.error('Error en BlendomatOptimizer:', err);
    res.status(500).json({ error: err.message || 'Error interno al calcular mezclas' });
  }
});

// GET /api/inventory/lote-fiac-reference-summary?limit=3
// Devuelve las últimas N misturas históricas con promedios de variables de calidad
// Ordenadas por número de MISTURA (entero) DESC para evitar problemas con fechas en texto
app.get('/api/inventory/lote-fiac-reference-summary', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 3, 10);

    // Helper para convertir texto con punto/coma a numérico
    const parseNumCol = (col) => `
      CASE
        WHEN ${col} IS NULL OR TRIM(${col}::TEXT) = '' THEN NULL
        ELSE CAST(REPLACE(REPLACE(TRIM(${col}::TEXT), '.', ''), ',', '.') AS NUMERIC)
      END`;

    // Helper: valor numérico de clasificación Argentina a partir de TP + CLASSIFIC
    // C=2.00, C1/4=2.25, C1/2=2.50, C3/4=2.75, D=3.00, D1/4=3.25, D1/2=3.50, D3/4=3.75
    const classifNumeric = `
      CASE
        WHEN "TP" IS NULL OR TRIM("TP") = '' THEN NULL
        WHEN TRIM(COALESCE("CLASSIFIC",'')) = '' OR TRIM(COALESCE("CLASSIFIC",'')) = 'null'
          THEN CASE WHEN TRIM("TP") = 'C' THEN 2.0
                    WHEN TRIM("TP") = 'D' THEN 3.0
                    ELSE NULL END
        WHEN TRIM("TP") = 'C' AND TRIM("CLASSIFIC") = '1/4' THEN 2.25
        WHEN TRIM("TP") = 'C' AND TRIM("CLASSIFIC") = '1/2' THEN 2.50
        WHEN TRIM("TP") = 'C' AND TRIM("CLASSIFIC") = '3/4' THEN 2.75
        WHEN TRIM("TP") = 'D' AND TRIM("CLASSIFIC") = '1/4' THEN 3.25
        WHEN TRIM("TP") = 'D' AND TRIM("CLASSIFIC") = '1/2' THEN 3.50
        WHEN TRIM("TP") = 'D' AND TRIM("CLASSIFIC") = '3/4' THEN 3.75
        ELSE NULL
      END`;

    // Obtener las últimas N misturas agrupando por MISTURA (número entero),
    // ordenando por el número de MISTURA desc para obtener las más recientes correctamente.
    const sql = `
      SELECT
        MAX(TRIM("LOTE_FIAC"))                     AS "lote_fiac",
        TRIM("MISTURA")                            AS "mistura",
        MIN("DT_ENTRADA_PROD")                     AS "primer_ingreso",
        MAX("DT_ENTRADA_PROD")                     AS "ultimo_ingreso",
        COUNT(*)                                   AS "seq_count",
        SUM(${parseNumCol('"PESO"')})              AS "kg_usados",
        AVG(${parseNumCol('"MIC"')})               AS "mic",
        AVG(${parseNumCol('"UHML"')})              AS "uhml",
        AVG(${parseNumCol('"STR"')})               AS "str",
        AVG(${parseNumCol('"ELG"')})               AS "elg",
        AVG(${parseNumCol('"RD"')})                AS "rd",
        AVG(${parseNumCol('"PLUS_B"')})            AS "plus_b",
        AVG(${parseNumCol('"SCI"')})               AS "sci",
        -- Promedio ponderado de clasificación Argentina por peso del fardo
        SUM(${classifNumeric} * ${parseNumCol('"PESO"')})
          / NULLIF(SUM(CASE WHEN ${classifNumeric} IS NOT NULL THEN ${parseNumCol('"PESO"')} END), 0)
                                                   AS "classif_prom"
      FROM tb_calidad_fibra
      WHERE "MISTURA" IS NOT NULL
        AND TRIM("MISTURA") != ''
        AND "TIPO_MOV" = 'MIST'
      GROUP BY TRIM("MISTURA")
      ORDER BY
        CAST(NULLIF(regexp_replace(TRIM("MISTURA"), '[^0-9]', '', 'g'), '') AS INTEGER) DESC NULLS LAST
      LIMIT $1
    `;

    const res2 = await query(sql, [limit], 'lote-fiac-ref-summary');

    const round2 = (v) => (v !== null && v !== undefined) ? Math.round(Number(v) * 100) / 100 : null;
    const round0 = (v) => (v !== null && v !== undefined) ? Math.round(Number(v)) : null;

    // Invertir para mostrar cronológico (la más antigua de las 3 primero)
    const rows = res2.rows.reverse();

    const referencias = rows.map(row => ({
      loteFiac: String(row.lote_fiac || '').replace(/^0+/, '') || String(row.lote_fiac),
      mistura:  String(row.mistura  || '').replace(/^0+/, '') || String(row.mistura),
      primerIngreso: row.primer_ingreso,
      ultimoIngreso: row.ultimo_ingreso,
      kgUsados: round0(row.kg_usados),
      clasificacionProm: row.classif_prom !== null && row.classif_prom !== undefined
        ? Math.round(Number(row.classif_prom) * 100) / 100
        : null,
      averages: {
        MIC:    round2(row.mic),
        UHML:   round2(row.uhml),
        STR:    round2(row.str),
        ELG:    round2(row.elg),
        RD:     round2(row.rd),
        PLUS_B: round2(row.plus_b),
        SCI:    round2(row.sci)
      }
    }));

    res.json({ referencias });
  } catch (err) {
    console.error('[lote-fiac-reference-summary] Error:', err.message);
    res.status(500).json({ referencias: [], error: err.message });
  }
});

// GET /api/inventory/residuos-lote-blendomar?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
// Suma los kg de residuos (tb_residuos_por_sector) y producción de cardas (tb_produccion_carda)
// en el mismo rango de fechas del lote. El % residuos se calcula como:
//   kgResiduos / (kgResiduos + kgCardas) * 100
// Subproductos: 2043336 (CASCAMEN+), 1747388 (TIERRA DE FILTRO), 2075310 (ASPIRACION DE OE)
app.get('/api/inventory/residuos-lote-blendomar', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'Se requieren fecha_inicio y fecha_fin (YYYY-MM-DD)' });
    }
    const isoInicio = dateVariants(fecha_inicio).iso;
    const isoFin   = dateVariants(fecha_fin).iso;
    if (!isoInicio || !isoFin) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    const SUBPRODUCTOS = [2043336, 1747388, 2075310];

    const sqlResiduos = `
      SELECT
        SUM(${sqlParseNumberIntl('"PESO LIQUIDO (KG)"')}) AS kg_residuos
      FROM tb_residuos_por_sector
      WHERE ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
        AND CAST(NULLIF(regexp_replace(TRIM("SUBPRODUTO"::TEXT), '[^0-9]', '', 'g'), '') AS BIGINT) = ANY($3::bigint[])
    `;

    const sqlCardas = `
      SELECT
        SUM(${sqlParseNumberIntl('"PROD INFORM"')}) AS kg_cardas
      FROM tb_produccion_carda
      WHERE data IS NOT NULL
        AND TO_DATE(data, 'DD/MM/YY') BETWEEN $1::date AND $2::date
    `;

    const [resResiduos, resCardas] = await Promise.all([
      query(sqlResiduos, [isoInicio, isoFin, SUBPRODUCTOS], 'residuos-lote-blendomar'),
      query(sqlCardas,   [isoInicio, isoFin],                'cardas-lote-blendomar')
    ]);

    const kgResiduos = Math.round(Number(resResiduos.rows[0]?.kg_residuos || 0));
    const kgCardas   = Math.round(Number(resCardas.rows[0]?.kg_cardas   || 0));
    res.json({ kgResiduos, kgCardas });
  } catch (err) {
    console.error('[residuos-lote-blendomar] Error:', err.message);
    res.status(500).json({ kgResiduos: 0, kgCardas: 0, error: err.message });
  }
});

async function costosTablesReady() {
  await ensureCostosSchema()
  return true
}

// =====================================================
// ENDPOINTS EFICIENCIAS TECELAJE
// Base URL en frontend: /api/produccion/eficiencias
// =====================================================

// GET /api/produccion/eficiencias/resumen
app.get('/api/produccion/eficiencias/resumen', (req, res) => getEficienciasResumen(req, res, query))

// POST /api/produccion/eficiencias/detalle  body: { turno: 'A'|'B'|'C'|'DIA' }
app.post('/api/produccion/eficiencias/detalle', (req, res) => getEficienciasDetalle(req, res, query))

// =====================================================
// ENDPOINTS COSTOS MENSUALES
// Base URL en frontend: /api/produccion
// =====================================================

app.get('/api/produccion/costos/items', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const sql = `
      SELECT
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        i.activo AS activo,
        a.origen AS origen,
        a.nombre_en_origen AS nombre_en_origen
      FROM tb_costo_items i
      LEFT JOIN tb_costo_item_alias a ON a.item_id = i.id
      ORDER BY i.id ASC, a.id ASC
    `
    const result = await query(sql, [], 'costos-items')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/items:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion/costos/mensual', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const limite = Math.max(1, Number.parseInt(String(req.query.limite || ''), 10) || 24)
    const sql = `
      WITH meses AS (
        SELECT DISTINCT yyyymm
        FROM tb_costo_mensual
        ORDER BY yyyymm DESC
        LIMIT $1
      )
      SELECT
        m.yyyymm AS yyyymm,
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        cm.ars_por_unidad AS ars_por_unidad,
        cm.observaciones AS observaciones
      FROM meses m
      CROSS JOIN tb_costo_items i
      LEFT JOIN tb_costo_mensual cm
        ON cm.yyyymm = m.yyyymm AND cm.item_id = i.id
      ORDER BY m.yyyymm DESC, i.id ASC
    `

    const result = await query(sql, [limite], 'costos-mensual')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/mensual:', err)
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/produccion/costos/mensual', async (req, res) => {
  const { rows } = req.body || {}
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows requerido' })

  const ready = await costosTablesReady()
  if (!ready) return res.status(400).json({ error: 'Tablas de costos no configuradas' })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    for (const row of rows) {
      const yyyymm = String(row?.yyyymm || '').trim()
      const itemId = Number(row?.item_id)
      const obs = row?.observaciones ?? null

      if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
        throw new Error(`yyyymm invalido: ${yyyymm}`)
      }
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error('item_id invalido')
      }

      const rawValue = row?.ars_por_unidad
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        await client.query(
          'DELETE FROM tb_costo_mensual WHERE yyyymm = $1 AND item_id = $2',
          [yyyymm, itemId]
        )
        continue
      }

      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('ars_por_unidad invalido')
      }

      await client.query(
        `
          INSERT INTO tb_costo_mensual (yyyymm, item_id, ars_por_unidad, observaciones)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (yyyymm, item_id) DO UPDATE
          SET ars_por_unidad = EXCLUDED.ars_por_unidad,
              observaciones = EXCLUDED.observaciones
        `,
        [yyyymm, itemId, value, obs]
      )
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error en costos/mensual (PUT):', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// =====================================================
// ENDPOINTS CALIDAD (para UI /revision-cq)
// Base URL en frontend: /api/produccion
// =====================================================

// GET /api/produccion/calidad/revision-cq - Reporte agrupado por Revisor
app.get('/api/produccion/calidad/revision-cq', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${datProdDate} BETWEEN $1::date AND $2::date`
    const params = sameDay ? [dateTextCandidates(startDate)] : [startDate, endDate]

    const sql = `
      WITH CAL AS (
        SELECT
          "DAT_PROD",
          "ARTIGO",
          SUM(${metragemNum}) AS METRAGEM,
          AVG(${pontuacaoNum}) AS PONTUACAO,
          AVG(${larguraNum}) AS LARGURA,
          "REVISOR FINAL" AS REVISOR_FINAL,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
        GROUP BY
          "DAT_PROD",
          "ARTIGO",
          "REVISOR FINAL",
          "PEÇA",
          "QUALIDADE",
          "ETIQUETA"
      ),
      RETALHO_METROS AS (
        SELECT
          SUM(${metragemNum}) AS METRAGEM_RETALHO
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      REVISORES AS (
        SELECT
          REVISOR_FINAL AS "Revisor",
          CAST(SUM(METRAGEM) AS INTEGER) AS "Mts_Total",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) AS "Calidad_Perc",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) AS "Pts_100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) AS "Rollos_1era",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) AS "Rollos_Sin_Pts",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) AS "Perc_Sin_Pts"
        FROM CAL
        GROUP BY REVISOR_FINAL
      )
      SELECT * FROM REVISORES
      UNION ALL
      SELECT
        'RETALHO' AS "Revisor",
        ROUND(METRAGEM_RETALHO)::int AS "Mts_Total",
        0::numeric AS "Calidad_Perc",
        0::numeric AS "Pts_100m2",
        0::int AS "Rollos_1era",
        0::int AS "Rollos_Sin_Pts",
        0::numeric AS "Perc_Sin_Pts"
      FROM RETALHO_METROS
      WHERE METRAGEM_RETALHO > 0
      ORDER BY "Mts_Total" DESC
    `

    const result = await query(sql, params, 'calidad/revision-cq')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revision-cq ${startDate}..${endDate} tramas=${tramas} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revision-cq:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/revision-cq-ia - Base por rollo para analisis IA de revision
app.get('/api/produccion/calidad/revision-cq-ia', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumber('"PONTUACAO"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? '"DAT_PROD" = ANY($1::text[])'
      : `${calDatProdDate} BETWEEN $1::date AND $2::date`
    const params = sameDay ? [dateTextCandidates(startDate)] : [startDate, endDate]

    const sql = `
      WITH RAW AS (
        SELECT
          "REVISOR FINAL" AS REVISOR,
          "HORA" AS HORA,
          "PEÇA" AS PECA,
          "ETIQUETA" AS ETIQUETA,
          ${calMetragemNum} AS METRAGEM,
          ${calPontuacaoNum} AS PONTUACAO,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          AND btrim("QUALIDADE") ILIKE 'PRIMEIRA%'
          ${tramasFilter}
      )
      SELECT
        REVISOR AS "Revisor",
        HORA AS "HoraSalida",
        ROUND(SUM(METRAGEM)::numeric, 3) AS "MetrosRollo",
        ROUND(AVG(PONTUACAO)::numeric, 3) AS "PontuacaoRollo"
      FROM RAW
      WHERE REVISOR IS NOT NULL
        AND btrim(REVISOR) <> ''
      GROUP BY REVISOR, HORA, PECA, ETIQUETA
      ORDER BY REVISOR, HORA
    `

    const result = await query(sql, params, 'calidad/revision-cq-ia')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revision-cq-ia ${startDate}..${endDate} tramas=${tramas} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revision-cq-ia:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/desempeno-piezas?fecha=YYYY-MM-DD&revisor=Nombre
// Devuelve piezas (rollos) en secuencia horaria para el grafico de desempeno del revisor.
app.get('/api/produccion/calidad/desempeno-piezas', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha, revisor } = req.query

    if (!fecha || !revisor) {
      return res.status(400).json({ error: 'Se requieren fecha y revisor' })
    }

    const calMetragemNum = sqlParseNumberIntl('C."METRAGEM"')
    const calPontuacaoNum = sqlParseNumber('C."PONTUACAO"')
    const calLarguraNum   = sqlParseNumber('C."LARGURA"')
    const prodPtsLidosNum = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100Num = sqlParseNumber('P."PONTOS_100%"')
    const prodParTraNum = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrdNum = sqlParseNumber('P."PARADA TEC URDUME"')

    const sql = `
      WITH RAW AS (
        SELECT
          C."NM MERC" AS "NombreArticulo",
          C."PARTIDA" AS "Partida",
          C."HORA" AS "Hora",
          C."PEÇA" AS "Peca",
          C."ETIQUETA" AS "Etiqueta",
          btrim(C."QUALIDADE") AS "Qualidade",
          ${calMetragemNum} AS "Metragem",
          ${calPontuacaoNum} AS "Pontuacao",
          ${calLarguraNum}   AS "Largura"
        FROM tb_calidad C
        WHERE
          C."EMP" = 'STC'
          AND C."DAT_PROD" = ANY($1::text[])
          AND C."REVISOR FINAL" = $2
          AND C."QUALIDADE" NOT ILIKE '%RETALHO%'
      ),
      POR_ROLLO AS (
        SELECT
          "NombreArticulo",
          "Partida",
          "Hora",
          "Peca",
          "Etiqueta",
          "Qualidade",
          -- En tb_calidad puede haber varias filas del mismo rollo por defecto;
          -- usar MAX evita inflar metros/puntos por sumatoria duplicada.
          ROUND(MAX("Metragem")::numeric, 3) AS "Metragem",
          ROUND(MAX("Pontuacao")::numeric, 3) AS "Pontuacao",
          MAX("Largura")                       AS "Largura"
        FROM RAW
        GROUP BY "NombreArticulo", "Partida", "Hora", "Peca", "Etiqueta", "Qualidade"
      ),
      PartidaVars AS (
        SELECT
          R.*,
          R."Partida" AS "Var0",
          CASE
            WHEN length(R."Partida") > 1 AND left(R."Partida", 1) ~ '^[0-9]$' AND left(R."Partida", 1)::int > 0
              THEN (left(R."Partida", 1)::int - 1)::text || substring(R."Partida" from 2)
          END AS "Var1",
          CASE
            WHEN length(R."Partida") > 1 AND left(R."Partida", 1) ~ '^[0-9]$' AND left(R."Partida", 1)::int > 1
              THEN (left(R."Partida", 1)::int - 2)::text || substring(R."Partida" from 2)
          END AS "Var2",
          CASE
            WHEN length(R."Partida") > 1 AND left(R."Partida", 1) ~ '^[0-9]$' AND left(R."Partida", 1)::int > 2
              THEN (left(R."Partida", 1)::int - 3)::text || substring(R."Partida" from 2)
          END AS "Var3",
          CASE
            WHEN length(R."Partida") > 1 THEN '0' || substring(R."Partida" from 2)
          END AS "Var4"
        FROM POR_ROLLO R
      ),
      TejPorPartida AS (
        SELECT
          PV."Partida" AS "CalPartida",
          TEJ.*
        FROM PartidaVars PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA" AS "PARTIDA",
            MAX(
              CASE
                WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$' THEN right(P."MAQUINA", 2)::int
                ELSE NULL
              END
            ) AS "Telar",
            SUM(COALESCE(${prodPtsLidosNum}, 0)) AS "PtsLei",
            SUM(COALESCE(${prodPts100Num}, 0)) AS "Pts100",
            SUM(COALESCE(${prodParTraNum}, 0)) AS "ParTra",
            SUM(COALESCE(${prodParUrdNum}, 0)) AS "ParUrd"
          FROM tb_produccion P
          WHERE
            P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0
            WHEN PV."Var1" THEN 1
            WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3
            WHEN PV."Var4" THEN 4
            ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON true
      )
      SELECT
        DISTINCT
        PV."NombreArticulo" AS "NombreArticulo",
        PV."Partida" AS "Partida",
        PV."Hora" AS "Hora",
        PV."Qualidade" AS "Qualidade",
        PV."Metragem" AS "Metragem",
        PV."Pontuacao" AS "Pontuacao",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END AS "EficienciaPct",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RU105",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RT105",
        COALESCE(TEJ."Telar", 0) AS "Telar",
        CASE
          WHEN PV."Pontuacao" IS NULL OR PV."Pontuacao" = 0 THEN NULL
          ELSE ROUND(
            (PV."Pontuacao" * 10000)::numeric
            / NULLIF(PV."Metragem" * COALESCE(PV."Largura", 0), 0)::numeric
          , 1)
        END AS "Pts100m2"
      FROM PartidaVars PV
      LEFT JOIN TejPorPartida TEJ ON TEJ."CalPartida" = PV."Partida"
      ORDER BY PV."Hora" ASC
    `

    const result = await query(sql, [dateTextCandidates(fecha), revisor], 'calidad/desempeno-piezas')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/desempeno-piezas fecha=${fecha} revisor=${revisor} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/desempeno-piezas:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/performance-mensual - Evolución mensual de revisores
app.get('/api/produccion/calidad/performance-mensual', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')

    const sql = `
      WITH CAL AS (
        SELECT
          "DAT_PROD",
          ${datProdDate} AS fecha,
          "ARTIGO",
          SUM(${metragemNum}) AS METRAGEM,
          AVG(${pontuacaoNum}) AS PONTUACAO,
          AVG(${larguraNum}) AS LARGURA,
          "REVISOR FINAL" AS REVISOR_FINAL,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${datProdDate} BETWEEN $1::date AND $2::date
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
        GROUP BY
          "DAT_PROD",
          "ARTIGO",
          "REVISOR FINAL",
          "PEÇA",
          "QUALIDADE",
          "ETIQUETA"
      )
      SELECT
        REVISOR_FINAL AS "Revisor",
        to_char(date_trunc('month', fecha), 'YYYY-MM') AS "Mes",
        CAST(SUM(METRAGEM) AS INTEGER) AS "Mts_Total",
        COUNT(DISTINCT fecha) AS "Dias_Trabajados",
        ROUND(SUM(METRAGEM) / NULLIF(COUNT(DISTINCT fecha), 0)) AS "Media_Diaria_Mts",
        ROUND(
          (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
          /
          NULLIF(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
            / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
            / 100
            * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
          , 0)
        , 1) AS "Pts_100m2",
        COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) AS "Rollos_1era",
        COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) AS "Rollos_Sin_Pts",
        ROUND(
          (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
          / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
        , 1) AS "Perc_Sin_Pts"
      FROM CAL
      GROUP BY REVISOR_FINAL, date_trunc('month', fecha)
      ORDER BY REVISOR_FINAL, "Mes"
    `

    const result = await query(sql, [startDate, endDate], 'calidad/performance-mensual')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/performance-mensual ${startDate}..${endDate} tramas=${tramas} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/performance-mensual:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/revisor-detalle - Detalle por revisor (con partidas)
app.get('/api/produccion/calidad/revisor-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate, revisor } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate || !revisor) {
      return res.status(400).json({ error: 'Se requieren startDate, endDate y revisor' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const calLarguraNum = sqlParseNumber('"LARGURA"')
    const prodPtsLidosNum = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100Num = sqlParseNumber('P."PONTOS_100%"')
    const prodParTraNum = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrdNum = sqlParseNumber('P."PARADA TEC URDUME"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${calDatProdDate} BETWEEN $1::date AND $2::date`
    const revisorParam = sameDay ? '$2' : '$3'
    const params = sameDay ? [dateTextCandidates(startDate), revisor] : [startDate, endDate, revisor]

    const sql = `
      WITH RAW AS (
        SELECT
          "NM MERC" as "NombreArticulo",
          "PARTIDA" as "PARTIDA",
          "DAT_PROD" as "DAT_PROD",
          "ARTIGO" as "ARTIGO",
          "PEÇA" as "PEÇA",
          "ETIQUETA" as "ETIQUETA",
          btrim("QUALIDADE") AS QUALIDADE,
          "HORA" as "HORA",
          ${calMetragemNum} AS METRAGEM,
          ${calPontuacaoNum} AS PONTUACAO,
          ${calLarguraNum} AS LARGURA
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "REVISOR FINAL" = ${revisorParam}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      CAL AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          SUM(METRAGEM) AS METRAGEM,
          AVG(PONTUACAO) AS PONTUACAO,
          AVG(LARGURA) AS LARGURA,
          QUALIDADE
        FROM RAW
        GROUP BY
          "NombreArticulo",
          "PARTIDA",
          "DAT_PROD",
          "ARTIGO",
          "PEÇA",
          QUALIDADE,
          "ETIQUETA"
      ),
      HorasPartida AS (
        SELECT
          "PARTIDA" as PARTIDA,
          MIN("HORA") as "HoraInicio"
        FROM RAW
        GROUP BY "PARTIDA"
      ),
      CalidadPorPartida AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          "PARTIDA" as "Partidas",
          CAST(SUM(METRAGEM) AS INTEGER) as "MetrosRevisados",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) as "CalidadPct",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) as "Pts100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) as "TotalRollos",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) as "SinPuntos",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) as "SinPuntosPct"
        FROM CAL
        GROUP BY "NombreArticulo", "PARTIDA"
      ),
      PartidaVars AS (
        SELECT
          C.*,
          C."PARTIDA" as "Var0",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 0
              THEN (left(C."PARTIDA", 1)::int - 1)::text || substring(C."PARTIDA" from 2)
          END as "Var1",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 1
              THEN (left(C."PARTIDA", 1)::int - 2)::text || substring(C."PARTIDA" from 2)
          END as "Var2",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 2
              THEN (left(C."PARTIDA", 1)::int - 3)::text || substring(C."PARTIDA" from 2)
          END as "Var3",
          CASE
            WHEN length(C."PARTIDA") > 1
              THEN '0' || substring(C."PARTIDA" from 2)
          END as "Var4"
        FROM CalidadPorPartida C
      ),
      TejPorPartida AS (
        SELECT
          PV."PARTIDA" as "CalPartida",
          TEJ.*
        FROM PartidaVars PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA" as "PARTIDA",
            MAX(
              CASE
                WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$' THEN right(P."MAQUINA", 2)::int
                ELSE NULL
              END
            ) as "Telar",
            SUM(COALESCE(${prodPtsLidosNum}, 0)) as "PtsLei",
            SUM(COALESCE(${prodPts100Num}, 0)) as "Pts100",
            SUM(COALESCE(${prodParTraNum}, 0)) as "ParTra",
            SUM(COALESCE(${prodParUrdNum}, 0)) as "ParUrd"
          FROM tb_produccion P
          WHERE
            P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0
            WHEN PV."Var1" THEN 1
            WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3
            WHEN PV."Var4" THEN 4
            ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON true
      )
      SELECT
        HP."HoraInicio" as "HoraInicio",
        PV."NombreArticulo" as "NombreArticulo",
        PV."PARTIDA" as "PARTIDA",
        PV."Partidas" as "Partidas",
        PV."MetrosRevisados" as "MetrosRevisados",
        PV."CalidadPct" as "CalidadPct",
        PV."Pts100m2" as "Pts100m2",
        PV."TotalRollos" as "TotalRollos",
        PV."SinPuntos" as "SinPuntos",
        PV."SinPuntosPct" as "SinPuntosPct",
        COALESCE(TEJ."Telar", 0) as "Telar",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END as "EficienciaPct",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RU105",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RT105"
      FROM PartidaVars PV
      LEFT JOIN HorasPartida HP ON PV."PARTIDA" = HP.PARTIDA
      LEFT JOIN TejPorPartida TEJ ON TEJ."CalPartida" = PV."PARTIDA"
      ORDER BY HP."HoraInicio" ASC
    `

    const result = await query(sql, params, 'calidad/revisor-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revisor-detalle ${startDate}..${endDate} revisor=${revisor} tramas=${tramas} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revisor-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/partida-detalle - Detalle de defectos por partida
app.get('/api/produccion/calidad/partida-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha, partida, revisor } = req.query
    if (!fecha || !partida || !revisor) {
      return res.status(400).json({ error: 'Se requieren fecha, partida y revisor' })
    }

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumber('"METRAGEM"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')

    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DAT_PROD" as "DAT_PROD",
        "ARTIGO" as "ARTIGO",
        "COR" as "COR",
        "NM MERC" as "NM_MERC",
        "TRAMA" as "TRAMA",
        "GRP_DEF" as "GRP_DEF",
        "COD_DE" as "COD_DE",
        "DEFEITO" as "DEFEITO",
        ${metragemNum} as "METRAGEM",
        "QUALIDADE" as "QUALIDADE",
        "HORA" as "HORA",
        "EMENDAS" as "EMENDAS",
        "PEÇA" as "PEÇA",
        "ETIQUETA" as "ETIQUETA",
        ${larguraNum} as "LARGURA",
        ${pontuacaoNum} as "PONTUACAO"
      FROM tb_calidad
      WHERE
        "EMP" = 'STC'
        AND ("DAT_PROD" = ANY($1::text[]) OR ${datProdDate} = $2::date)
        AND "PARTIDA" = $3
        AND "REVISOR FINAL" = $4
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
      ORDER BY "HORA" ASC, "PEÇA" ASC
    `

    const result = await query(sql, [dateTextCandidates(fecha), variants.iso, partida, revisor], 'calidad/partida-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/partida-detalle fecha=${fecha} partida=${partida} revisor=${revisor} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/partida-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/defectos-detalle - Defectos por etiqueta (tb_defectos)
app.get('/api/produccion/calidad/defectos-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const etiqueta = String(req.query.etiqueta || '').trim()
    if (!etiqueta) return res.status(400).json({ error: 'Se requiere la etiqueta' })

    const sql = `
      SELECT
        partida as "PARTIDA",
        peca as "PECA",
        etiqueta as "ETIQUETA",
        cod_def as "COD_DEF",
        desc_defeito as "DESC_DEFEITO",
        pontos as "PONTOS",
        qualidade as "QUALIDADE",
        data_prod as "DATA_PROD"
      FROM tb_defectos
      WHERE btrim(etiqueta) = $1
      ORDER BY peca ASC, cod_def ASC
    `

    const result = await query(sql, [etiqueta], 'calidad/defectos-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/defectos-detalle etiqueta=${etiqueta} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/defectos-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS - MESA DE TEST (AnalisisMesaTest.vue)
// =====================================================

// GET /api/produccion/calidad/articulos-mesa-test?fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/articulos-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha_inicial, fecha_final } = req.query

    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')

    const testesDtProdDate = sqlParseDate('dt_prod')
    const testesMetragemNum = sqlParseNumberIntl('metragem')

    const sql = `
      WITH MetricasCalidad AS (
        SELECT
          "ARTIGO" AS ARTIGO,
          ROUND(SUM(COALESCE(${calMetragemNum}, 0)), 0)::int AS METROS_REV
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${calDatProdDate} BETWEEN $1::date AND $2::date
          AND "TRAMA" IS NOT NULL
          AND btrim("TRAMA") <> ''
        GROUP BY "ARTIGO"
      ),
      MetricasTestesPartida AS (
        SELECT
          artigo AS ARTIGO,
          btrim(partida) AS PARTIDA,
          AVG(COALESCE(${testesMetragemNum}, 0)) AS METRAGEM_AVG
        FROM tb_testes
        WHERE
          ${testesDtProdDate} BETWEEN $1::date AND $2::date
        GROUP BY artigo, btrim(partida)
      ),
      MetricasTestes AS (
        SELECT
          ARTIGO,
          ROUND(SUM(METRAGEM_AVG), 0)::int AS METROS_TEST
        FROM MetricasTestesPartida
        GROUP BY ARTIGO
      ),
      AllArtigos AS (
        SELECT ARTIGO FROM MetricasCalidad
        UNION
        SELECT ARTIGO FROM MetricasTestes
      )
      SELECT
        AU.ARTIGO AS "ARTIGO_COMPLETO",
        substring(AU.ARTIGO from 1 for 10) AS "Articulo",
        substring(AU.ARTIGO from 7 for 2) AS "Id",
        F."COR" AS "Color",
        F."NOME DE MERCADO" AS "Nombre",
        F."TRAMA REDUZIDO" AS "Trama",
        F."PRODUCAO" AS "Prod",
        COALESCE(MT.METROS_TEST, 0) AS "Metros_TEST",
        COALESCE(MC.METROS_REV, 0) AS "Metros_REV"
      FROM AllArtigos AU
      LEFT JOIN MetricasTestes MT ON AU.ARTIGO = MT.ARTIGO
      LEFT JOIN MetricasCalidad MC ON AU.ARTIGO = MC.ARTIGO
      LEFT JOIN tb_fichas F ON AU.ARTIGO = F."ARTIGO CODIGO"
      WHERE F."TRAMA REDUZIDO" IS NOT NULL
      ORDER BY AU.ARTIGO;
    `

    const result = await query(sql, [startDate, endDate], 'calidad/articulos-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/articulos-mesa-test ${startDate}..${endDate} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/articulos-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/analisis-mesa-test?articulo=XXX&fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/analisis-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { articulo, fecha_inicial, fecha_final } = req.query

    if (!articulo) {
      return res.status(400).json({ error: 'Parámetro "articulo" requerido' })
    }
    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const articleCode = String(articulo)
    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const testesDtProdDate = sqlParseDate('dt_prod')
    const calDatProdDate = sqlParseDate('"DAT_PROD"')

    const tMetragemNum = sqlParseNumberIntl('metragem')
    const tLargAlNum = sqlParseNumberIntl('larg_al')
    const tGramatNum = sqlParseNumberIntl('gramat')
    const tPotenNum = sqlParseNumberIntl('poten')
    const tEncUrdNum = sqlParseNumberIntl('"%_ENC_URD"')
    const tEncTramaNum = sqlParseNumberIntl('"%_ENC_TRAMA"')
    const tSk1Num = sqlParseNumberIntl('"%_SK1"')
    const tSk2Num = sqlParseNumberIntl('"%_SK2"')
    const tSk3Num = sqlParseNumberIntl('"%_SK3"')
    const tSk4Num = sqlParseNumberIntl('"%_SK4"')
    const tSkeNum = sqlParseNumberIntl('"%_SKE"')
    const tSttNum = sqlParseNumberIntl('"%_STT"')
    const tSkmNum = sqlParseNumberIntl('"%_SKM"')

    const cMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const cLarguraNum = sqlParseNumberIntl('"LARGURA"')
    const cGrm2Num = sqlParseNumberIntl('"GR/M2"')

    const fLargMinNum = sqlParseNumberIntl('"LARGURA MIN"')
    const fLargStdNum = sqlParseNumberIntl('"LARGURA"')
    const fLargMaxNum = sqlParseNumberIntl('"LARGURA MAX"')
    const fPesoM2Num = sqlParseNumberIntl('"Peso/m2"')
    const fEncAcabUrdNum = sqlParseNumberIntl('"ENC.ACAB URD"')
    const fSkewMinNum = sqlParseNumberIntl('"SKEW MIN"')
    const fSkewMaxNum = sqlParseNumberIntl('"SKEW MAX"')
    const fUrdMinNum = sqlParseNumberIntl('"URD#MIN"')
    const fUrdMaxNum = sqlParseNumberIntl('"URD#MAX"')
    const fTraMinNum = sqlParseNumberIntl('"TRAMA MIN"')
    const fTraMaxNum = sqlParseNumberIntl('"TRAMA MAX"')
    const fVarTrMinNum = sqlParseNumberIntl('"VAR STR#MIN TRAMA"')
    const fVarTrMaxNum = sqlParseNumberIntl('"VAR STR#MAX TRAMA"')
    const fVarUrMinNum = sqlParseNumberIntl('"VAR STR#MIN URD"')
    const fVarUrMaxNum = sqlParseNumberIntl('"VAR STR#MAX URD"')

    const sql = `
      WITH TESTES AS (
        SELECT
          maquina,
          artigo AS art_test,
          btrim(partida) AS partida,
          artigo AS testes,
          dt_prod,
          aprov,
          obs,
          reprocesso,
          ${tMetragemNum} AS metragem_num,
          ${tLargAlNum} AS larg_al_num,
          ${tGramatNum} AS gramat_num,
          ${tPotenNum} AS poten_num,
          ${tEncUrdNum} AS enc_urd_num,
          ${tEncTramaNum} AS enc_trama_num,
          ${tSk1Num} AS sk1_num,
          ${tSk2Num} AS sk2_num,
          ${tSk3Num} AS sk3_num,
          ${tSk4Num} AS sk4_num,
          ${tSkeNum} AS ske_num,
          ${tSttNum} AS stt_num,
          ${tSkmNum} AS skm_num
        FROM tb_testes
        WHERE
          artigo = $1
          AND ${testesDtProdDate} BETWEEN $2::date AND $3::date
      ),
      CALIDAD AS (
        SELECT
          MIN("DAT_PROD") AS dat_prod,
          "ARTIGO" AS art_cal,
          btrim("PARTIDA") AS partida,
          ROUND(SUM(COALESCE(${cMetragemNum}, 0)), 0) AS metragem,
          ROUND(AVG(COALESCE(${cLarguraNum}, 0)), 1) AS largura,
          ROUND(AVG(COALESCE(${cGrm2Num}, 0)), 1) AS grm2
        FROM tb_calidad
        WHERE
          "ARTIGO" = $1
          AND ${calDatProdDate} BETWEEN $2::date AND $3::date
        GROUP BY "ARTIGO", btrim("PARTIDA")
      ),
      TESTES_CALIDAD AS (
        SELECT
          T.*,
          C.dat_prod AS calidad_dat_prod,
          C.metragem AS calidad_metragem,
          C.largura AS calidad_largura,
          C.grm2 AS calidad_grm2
        FROM TESTES T
        LEFT JOIN CALIDAD C ON T.partida = C.partida
      ),
      ESPECIFICACION AS (
        SELECT
          "ARTIGO CODIGO",
          "TRAMA REDUZIDO" AS trama_reducido,
          ${fLargMinNum} AS largura_min_val,
          ${fLargStdNum} AS ancho,
          ${fLargMaxNum} AS largura_max_val,
          ${fPesoM2Num} AS peso_m2,
          ${fEncAcabUrdNum} AS enc_acab_urd,
          ${fSkewMinNum} AS skew_min,
          (${fSkewMinNum} + ${fSkewMaxNum}) / 2.0 AS skew_std,
          ${fSkewMaxNum} AS skew_max,
          ${fUrdMinNum} AS urd_min,
          (${fUrdMinNum} + ${fUrdMaxNum}) / 2.0 AS urd_std,
          ${fUrdMaxNum} AS urd_max,
          ${fTraMinNum} AS trama_min,
          (${fTraMinNum} + ${fTraMaxNum}) / 2.0 AS trama_std,
          ${fTraMaxNum} AS trama_max,
          ${fVarTrMinNum} AS var_str_min_trama,
          (${fVarTrMinNum} + ${fVarTrMaxNum}) / 2.0 AS var_str_std_trama,
          ${fVarTrMaxNum} AS var_str_max_trama,
          ${fVarUrMinNum} AS var_str_min_urd,
          (${fVarUrMinNum} + ${fVarUrMaxNum}) / 2.0 AS var_str_std_urd,
          ${fVarUrMaxNum} AS var_str_max_urd
        FROM tb_fichas
        WHERE "ARTIGO CODIGO" = $1
      )
      SELECT
        CASE WHEN TC.maquina ~ '^[0-9]+$' THEN TC.maquina::int ELSE NULL END AS "Maquina",
        TC.art_test AS "Articulo",
        E.trama_reducido AS "Trama",
        TC.partida AS "Partida",
        TC.testes AS "C",
        TC.dt_prod AS "Fecha",
        TC.aprov AS "Ap",
        TC.obs AS "Obs",
        TC.reprocesso AS "R",
        ROUND(TC.metragem_num, 0) AS "Metros_TEST",
        ROUND(TC.calidad_metragem, 0) AS "Metros_MESA",

        ROUND(TC.calidad_largura, 1) AS "Ancho_MESA",
        ROUND(
          CASE
            WHEN E.largura_min_val < (E.ancho * 0.5) THEN E.ancho - E.largura_min_val
            ELSE E.largura_min_val
          END
        , 1) AS "Ancho_MIN",
        ROUND(E.ancho, 1) AS "Ancho_STD",
        ROUND(
          CASE
            WHEN E.largura_max_val < (E.ancho * 0.5) THEN E.ancho + E.largura_max_val
            ELSE E.largura_max_val
          END
        , 1) AS "Ancho_MAX",
        ROUND(TC.larg_al_num, 1) AS "Ancho_TEST",

        ROUND(TC.calidad_grm2, 1) AS "Peso_MESA",
        ROUND(E.peso_m2 * 0.95, 1) AS "Peso_MIN",
        ROUND(E.peso_m2, 1) AS "Peso_STD",
        ROUND(E.peso_m2 * 1.05, 1) AS "Peso_MAX",
        ROUND(TC.gramat_num, 1) AS "Peso_TEST",

        ROUND(TC.poten_num, 2) AS "Potencial",
        ROUND(E.enc_acab_urd, 2) AS "Potencial_STD",

        ROUND(TC.enc_urd_num, 2) AS "ENC_URD_%",
        ROUND(E.urd_min, 2) AS "ENC_URD_MIN_%",
        ROUND(E.urd_std, 2) AS "ENC_URD_STD_%",
        ROUND(E.urd_max, 2) AS "ENC_URD_MAX_%",
        -1.5::numeric AS "%_ENC_URD_MIN_Meta",
        -1.0::numeric AS "%_ENC_URD_MAX_Meta",

        ROUND(TC.enc_trama_num, 2) AS "ENC_TRA_%",
        ROUND(E.trama_min, 2) AS "ENC_TRA_MIN_%",
        ROUND(E.trama_std, 2) AS "ENC_TRA_STD_%",
        ROUND(E.trama_max, 2) AS "ENC_TRA_MAX_%",

        ROUND(TC.sk1_num, 2) AS "%_SK1",
        ROUND(TC.sk2_num, 2) AS "%_SK2",
        ROUND(TC.sk3_num, 2) AS "%_SK3",
        ROUND(TC.sk4_num, 2) AS "%_SK4",
        ROUND(TC.ske_num, 2) AS "%_SKE",

        ROUND(E.skew_min, 2) AS "Skew_MIN",
        ROUND(E.skew_std, 2) AS "Skew_STD",
        ROUND(E.skew_max, 2) AS "Skew_MAX",

        ROUND(TC.stt_num, 3) AS "%_STT",
        ROUND(E.var_str_min_trama, 3) AS "%_STT_MIN",
        ROUND(E.var_str_std_trama, 3) AS "%_STT_STD",
        ROUND(E.var_str_max_trama, 3) AS "%_STT_MAX",

        ROUND(TC.skm_num, 2) AS "Pasadas_Terminadas",
        ROUND(E.var_str_min_urd, 2) AS "Pasadas_MIN",
        ROUND(E.var_str_std_urd, 2) AS "Pasadas_STD",
        ROUND(E.var_str_max_urd, 2) AS "Pasadas_MAX",

        ROUND(TC.calidad_grm2 * 0.0295, 1) AS "Peso_MESA_OzYd²",
        ROUND(E.peso_m2 * 0.95 * 0.0295, 1) AS "Peso_MIN_OzYd²",
        ROUND(E.peso_m2 * 0.0295, 1) AS "Peso_STD_OzYd²",
        ROUND(E.peso_m2 * 1.05 * 0.0295, 1) AS "Peso_MAX_OzYd²"
      FROM TESTES_CALIDAD TC
      LEFT JOIN ESPECIFICACION E ON TC.art_test = E."ARTIGO CODIGO"
      ORDER BY ${sqlParseDate('TC.dt_prod')} ASC;
    `

    const result = await query(sql, [articleCode, startDate, endDate], 'calidad/analisis-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/analisis-mesa-test articulo=${articleCode} ${startDate}..${endDate} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/analisis-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS CALIDAD/PRODUCCION (Calidad Sectores)
// =====================================================

// GET /api/calidad/defectos-por-tipo - PTS TOTAIS, PTS/100M², % agrupados por tipo de defecto
// Parámetros: date=YYYY-MM-DD, mode=month (default) | day
app.get('/api/calidad/defectos-por-tipo', async (req, res) => {
  try {
    const t0 = hrMs()
    const { date, mode, trama } = req.query
    if (!date) return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })

    const dateStr   = String(date).split('T')[0]
    const isDayMode = String(mode || 'month').toLowerCase() === 'day'

    let tramasFilter = ''
    if (trama === 'ALG 100%')      tramasFilter = `AND left(c."ARTIGO", 1) = 'A'`
    else if (trama === 'P + E')    tramasFilter = `AND left(c."ARTIGO", 1) = 'Y'`
    else if (trama === 'POL 100%') tramasFilter = `AND left(c."ARTIGO", 1) = 'P'`

    // Expresión para parsear DATA_PROD de tb_defectos (DD/MM/YYYY o YYYY-MM-DD)
    const defDataProd     = sqlParseDate('d."DATA_PROD"')
    // Expresión para parsear DAT_PROD de tb_calidad
    const calDatProd      = sqlParseDate('c."DAT_PROD"')
    // Parsers numéricos
    const calMetragemExpr = sqlParseNumberIntl('c."METRAGEM"')
    const calLarguraExpr  = sqlParseNumber('c."LARGURA"')
    const defPontosExpr   = sqlParseNumber('d."PONTOS"')

    let sql

    if (isDayMode) {
      // ── MODO DÍA ──────────────────────────────────────────────────────────
      // Numerador: defectos de las PEÇA revisadas ese día exacto (via tb_calidad.DAT_PROD).
      // No se usa tb_defectos.data_prod porque datos históricos (<2026) solo tienen end-of-month.
      // El DISTINCT en piezas_dia evita duplicar pontos por empalmes (misma PEÇA multi-fila).
      sql = `
        WITH
        piezas_dia AS (
          SELECT DISTINCT c."PEÇA"
          FROM tb_calidad c
          WHERE c."EMP" = 'STC'
            AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
            AND ${calDatProd} = $1::date
            ${tramasFilter}
        ),
        area_dia AS (
          SELECT
            COALESCE(SUM(${calMetragemExpr} * COALESCE(${calLarguraExpr}, 0) / 100.0), 0) AS metros2,
            COALESCE(SUM(${calMetragemExpr}), 0) AS metros_lin
          FROM tb_calidad c
          WHERE c."EMP" = 'STC'
            AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
            AND ${calDatProd} = $1::date
            ${tramasFilter}
        ),
        defectos_dia AS (
          SELECT
            MIN(d."COD_DEF")       AS cod_def,
            btrim(d."DESC_DEFEITO") AS desc_defeito,
            SUM(COALESCE(${defPontosExpr}, 0)) AS pts_totales
          FROM tb_defectos d
          INNER JOIN piezas_dia p ON p."PEÇA" = d."PARTIDA" || d."PECA"
          WHERE d."FILIAL"    = '05'
            AND d."QUALIDADE" = '1'
            AND btrim(d."DESC_DEFEITO") <> ''
            AND btrim(d."DESC_DEFEITO") <> '--'
          GROUP BY btrim(d."DESC_DEFEITO")
          HAVING SUM(COALESCE(${defPontosExpr}, 0)) > 0
        ),
        total_pts AS (
          SELECT COALESCE(SUM(pts_totales), 0) AS total FROM defectos_dia
        )
        SELECT
          dd.cod_def                                                        AS "cod_def",
          dd.desc_defeito                                                   AS "desc_defeito",
          ROUND(dd.pts_totales)::integer                                    AS "pts_totales",
          ROUND(
            CASE WHEN (SELECT metros2 FROM area_dia) > 0
              THEN dd.pts_totales * 100.0 / (SELECT metros2 FROM area_dia)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "pts_100m2",
          ROUND(
            CASE WHEN (SELECT total FROM total_pts) > 0
              THEN dd.pts_totales * 100.0 / (SELECT total FROM total_pts)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "porcentaje",
          (SELECT metros2   FROM area_dia)                                  AS "area_m2_total",
          (SELECT metros_lin FROM area_dia)                                  AS "metros_lin_total"
        FROM defectos_dia dd
        ORDER BY dd.pts_totales DESC
      `
    } else if (tramasFilter) {
      // ── MODO MES con filtro Trama (usa piezas via tb_calidad) ─────────────
      sql = `
        WITH
        piezas_mes AS (
          SELECT DISTINCT c."PEÇA"
          FROM tb_calidad c
          WHERE c."EMP" = 'STC'
            AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
            AND to_char(${calDatProd}, 'YYYY-MM') = to_char($1::date, 'YYYY-MM')
            ${tramasFilter}
        ),
        area_mes AS (
          SELECT
            COALESCE(SUM(${calMetragemExpr} * COALESCE(${calLarguraExpr}, 0) / 100.0), 0) AS metros2,
            COALESCE(SUM(${calMetragemExpr}), 0) AS metros_lin
          FROM tb_calidad c
          WHERE c."EMP" = 'STC'
            AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
            AND to_char(${calDatProd}, 'YYYY-MM') = to_char($1::date, 'YYYY-MM')
            ${tramasFilter}
        ),
        defectos_mes AS (
          SELECT
            btrim(d."DESC_DEFEITO") AS desc_defeito,
            MIN(d."COD_DEF")       AS cod_def,
            SUM(COALESCE(${defPontosExpr}, 0)) AS pts_totales
          FROM tb_defectos d
          INNER JOIN piezas_mes p ON p."PEÇA" = d."PARTIDA" || d."PECA"
          WHERE d."FILIAL"    = '05'
            AND d."QUALIDADE" = '1'
            AND btrim(d."DESC_DEFEITO") <> ''
            AND btrim(d."DESC_DEFEITO") <> '--'
          GROUP BY btrim(d."DESC_DEFEITO")
          HAVING SUM(COALESCE(${defPontosExpr}, 0)) > 0
        ),
        total_pts AS (
          SELECT COALESCE(SUM(pts_totales), 0) AS total FROM defectos_mes
        )
        SELECT
          dm.cod_def                                                        AS "cod_def",
          dm.desc_defeito                                                   AS "desc_defeito",
          ROUND(dm.pts_totales)::integer                                    AS "pts_totales",
          ROUND(
            CASE WHEN (SELECT metros2 FROM area_mes) > 0
              THEN dm.pts_totales * 100.0 / (SELECT metros2 FROM area_mes)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "pts_100m2",
          ROUND(
            CASE WHEN (SELECT total FROM total_pts) > 0
              THEN dm.pts_totales * 100.0 / (SELECT total FROM total_pts)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "porcentaje",
          (SELECT metros2    FROM area_mes)                                 AS "area_m2_total",
          (SELECT metros_lin FROM area_mes)                                 AS "metros_lin_total"
        FROM defectos_mes dm
        ORDER BY dm.pts_totales DESC
      `
    } else {
      // ── MODO MES (sin filtro trama) ────────────────────────────────────────
      sql = `
        WITH
        area_mes AS (
          SELECT
            COALESCE(SUM(${calMetragemExpr} * COALESCE(${calLarguraExpr}, 0) / 100.0), 0) AS metros2,
            COALESCE(SUM(${calMetragemExpr}), 0) AS metros_lin
          FROM tb_calidad c
          WHERE c."EMP" = 'STC'
            AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
            AND to_char(${calDatProd}, 'YYYY-MM') = to_char($1::date, 'YYYY-MM')
        ),
        defectos_mes AS (
          SELECT
            btrim(d."DESC_DEFEITO") AS desc_defeito,
            MIN(d."COD_DEF")       AS cod_def,
            SUM(COALESCE(${defPontosExpr}, 0)) AS pts_totales
          FROM tb_defectos d
          WHERE d."FILIAL"    = '05'
            AND d."QUALIDADE" = '1'
            AND to_char(${defDataProd}, 'YYYY-MM') = to_char($1::date, 'YYYY-MM')
            AND btrim(d."DESC_DEFEITO") <> ''
            AND btrim(d."DESC_DEFEITO") <> '--'
          GROUP BY btrim(d."DESC_DEFEITO")
          HAVING SUM(COALESCE(${defPontosExpr}, 0)) > 0
        ),
        total_pts AS (
          SELECT COALESCE(SUM(pts_totales), 0) AS total FROM defectos_mes
        )
        SELECT
          dm.cod_def                                                        AS "cod_def",
          dm.desc_defeito                                                   AS "desc_defeito",
          ROUND(dm.pts_totales)::integer                                    AS "pts_totales",
          ROUND(
            CASE WHEN (SELECT metros2 FROM area_mes) > 0
              THEN dm.pts_totales * 100.0 / (SELECT metros2 FROM area_mes)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "pts_100m2",
          ROUND(
            CASE WHEN (SELECT total FROM total_pts) > 0
              THEN dm.pts_totales * 100.0 / (SELECT total FROM total_pts)
              ELSE 0
            END::numeric, 2
          )                                                                 AS "porcentaje",
          (SELECT metros2   FROM area_mes)                                  AS "area_m2_total",
          (SELECT metros_lin FROM area_mes)                                  AS "metros_lin_total"
        FROM defectos_mes dm
        ORDER BY dm.pts_totales DESC
      `
    }

    const label  = isDayMode ? 'calidad/defectos-por-tipo[day]' : 'calidad/defectos-por-tipo[month]'
    const result = await query(sql, [dateStr], label)
    const rows   = result.rows || []

    const totPts    = rows.reduce((s, r) => s + (Number(r.pts_totales) || 0), 0)
    const areaM2    = rows.length > 0 ? (Number(rows[0].area_m2_total)   || 0) : 0
    const metrosLin = rows.length > 0 ? (Number(rows[0].metros_lin_total) || 0) : 0
    const totPts100 = areaM2 > 0 ? Math.round(totPts * 100 / areaM2 * 100) / 100 : 0

    res.json({
      rows: rows.map(r => ({
        cod_def:      r.cod_def || '',
        desc_defeito: r.desc_defeito,
        pts_totales:  Number(r.pts_totales),
        pts_100m2:    Number(r.pts_100m2),
        porcentaje:   Number(r.porcentaje),
      })),
      total: {
        pts_totales: totPts,
        pts_100m2:   totPts100,
        area_m2:     Math.round(areaM2 * 100) / 100,
        metros_lin:  Math.round(metrosLin),
      },
    })
    console.log(`[PERF] GET /calidad/defectos-por-tipo?mode=${isDayMode?'day':'month'} ${dateStr} rows=${rows.length} total=${(hrMs()-t0).toFixed(1)}ms`)
  } catch (err) {
    console.error('Error en /api/calidad/defectos-por-tipo:', err)
    res.status(500).json({ error: err.message })
  }
})


// GET /api/calidad/pts-por-partida - Partidas con Pts/100m², métricas de calidad y tejeduría
// Parámetros: date=YYYY-MM-DD, mode=day (default)|month, trama=Todas|ALG 100%|P + E|POL 100%
app.get('/api/calidad/pts-por-partida', async (req, res) => {
  try {
    const t0 = hrMs()
    const { date, mode, trama } = req.query
    if (!date) return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })

    const dateStr  = String(date).split('T')[0]
    const isDayMode = String(mode || 'day').toLowerCase() === 'day'

    let tramasFilter = ''
    if (trama === 'ALG 100%') tramasFilter = `AND left(c."ARTIGO", 1) = 'A'`
    else if (trama === 'P + E') tramasFilter = `AND left(c."ARTIGO", 1) = 'Y'`
    else if (trama === 'POL 100%') tramasFilter = `AND left(c."ARTIGO", 1) = 'P'`

    const calDatProd    = sqlParseDate('c."DAT_PROD"')
    const metragemExpr  = sqlParseNumberIntl('c."METRAGEM"')
    const pontuacaoExpr = sqlParseNumber('c."PONTUACAO"')
    const larguraExpr   = sqlParseNumber('c."LARGURA"')
    const prodPtsLidos  = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100    = sqlParseNumber('P."PONTOS_100%"')
    const prodParTra    = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrd    = sqlParseNumber('P."PARADA TEC URDUME"')

    const [yyyy, mm] = dateStr.split('-')
    const monthStart = `${yyyy}-${mm}-01`

    const dateFilterSql = isDayMode
      ? `c."DAT_PROD" = ANY($1::text[])`
      : `${calDatProd} BETWEEN $1::date AND $2::date`
    const params = isDayMode
      ? [dateTextCandidates(dateStr)]
      : [monthStart, dateStr]

    const sql = `
      WITH
      cal_raw AS (
        SELECT
          c."PARTIDA",
          c."NM MERC"                           AS nome_merc,
          c."ARTIGO"                             AS artigo,
          c."TRAMA"                              AS trama,
          c."HORA"                               AS hora,
          c."PEÇA"                               AS peca,
          c."ETIQUETA"                           AS etiqueta,
          btrim(c."QUALIDADE")                   AS qualidade,
          ${metragemExpr}                        AS metragem,
          ${pontuacaoExpr}                       AS pontuacao,
          ${larguraExpr}                         AS largura
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${dateFilterSql}
          AND c."QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      cal_dedup AS (
        -- Una fila por rollo (deduplica si el mismo rollo aparece con múltiples defectos)
        SELECT
          "PARTIDA", nome_merc, artigo, trama, hora, peca, etiqueta, qualidade,
          MAX(metragem)  AS metragem,
          MAX(pontuacao) AS pontuacao,
          MAX(largura)   AS largura
        FROM cal_raw
        GROUP BY "PARTIDA", nome_merc, artigo, trama, hora, peca, etiqueta, qualidade
      ),
      cal_por_partida AS (
        SELECT
          "PARTIDA",
          MIN(nome_merc)  AS "NombreArticulo",
          MIN(artigo)     AS "ARTIGO",
          MIN(trama)      AS "Trama",
          CAST(SUM(metragem) AS INTEGER) AS "MetrosRevisados",
          ROUND(
            SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem ELSE 0 END)
            / NULLIF(SUM(metragem), 0) * 100
          , 1) AS "CalidadPct",
          ROUND(
            (SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN COALESCE(pontuacao, 0) ELSE 0 END) * 100)
            / NULLIF(
              (SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem * COALESCE(largura, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem ELSE 0 END)
            , 0)
          , 2) AS "Pts100m2",
          COUNT(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN 1 END) AS "TotalRollos",
          COUNT(CASE WHEN qualidade ILIKE 'PRIMEIRA%'
            AND (pontuacao IS NULL OR pontuacao = 0) THEN 1 END) AS "SinPuntos",
          ROUND(
            COUNT(CASE WHEN qualidade ILIKE 'PRIMEIRA%'
              AND (pontuacao IS NULL OR pontuacao = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN 1 END)::numeric, 0) * 100
          , 1) AS "SinPuntosPct"
        FROM cal_dedup
        GROUP BY "PARTIDA"
      ),
      horas_partida AS (
        SELECT "PARTIDA", MIN(hora) AS "HoraInicio"
        FROM cal_raw
        GROUP BY "PARTIDA"
      ),
      partida_vars AS (
        SELECT
          C.*,
          C."PARTIDA" AS "Var0",
          CASE WHEN length(C."PARTIDA") > 1
               AND left(C."PARTIDA", 1) ~ '^[0-9]$'
               AND left(C."PARTIDA", 1)::int > 0
            THEN (left(C."PARTIDA", 1)::int - 1)::text || substring(C."PARTIDA" FROM 2)
          END AS "Var1",
          CASE WHEN length(C."PARTIDA") > 1
               AND left(C."PARTIDA", 1) ~ '^[0-9]$'
               AND left(C."PARTIDA", 1)::int > 1
            THEN (left(C."PARTIDA", 1)::int - 2)::text || substring(C."PARTIDA" FROM 2)
          END AS "Var2",
          CASE WHEN length(C."PARTIDA") > 1
               AND left(C."PARTIDA", 1) ~ '^[0-9]$'
               AND left(C."PARTIDA", 1)::int > 2
            THEN (left(C."PARTIDA", 1)::int - 3)::text || substring(C."PARTIDA" FROM 2)
          END AS "Var3",
          CASE WHEN length(C."PARTIDA") > 1
            THEN '0' || substring(C."PARTIDA" FROM 2)
          END AS "Var4"
        FROM cal_por_partida C
      ),
      tej_por_partida AS (
        SELECT PV."PARTIDA" AS "CalPartida", TEJ.*
        FROM partida_vars PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA",
            MAX(CASE WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$'
              THEN right(P."MAQUINA", 2)::int ELSE NULL END) AS "Telar",
            SUM(COALESCE(${prodPtsLidos}, 0)) AS "PtsLei",
            SUM(COALESCE(${prodPts100},   0)) AS "Pts100",
            SUM(COALESCE(${prodParTra},   0)) AS "ParTra",
            SUM(COALESCE(${prodParUrd},   0)) AS "ParUrd"
          FROM tb_produccion P
          WHERE P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0 WHEN PV."Var1" THEN 1 WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3 WHEN PV."Var4" THEN 4 ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON TRUE
      )
      SELECT
        HP."HoraInicio"            AS "HoraInicio",
        PV."PARTIDA"               AS "Partida",
        PV."NombreArticulo"        AS "NombreArticulo",
        PV."ARTIGO"                AS "ARTIGO",
        PV."Trama"                 AS "Trama",
        PV."MetrosRevisados"       AS "MetrosRevisados",
        PV."CalidadPct"            AS "CalidadPct",
        COALESCE(PV."Pts100m2", 0) AS "Pts100m2",
        PV."TotalRollos"           AS "TotalRollos",
        PV."SinPuntos"             AS "SinPuntos",
        PV."SinPuntosPct"          AS "SinPuntosPct",
        COALESCE(TEJ."Telar", 0)   AS "Telar",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END AS "EficienciaPct",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RU105",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RT105"
      FROM partida_vars PV
      LEFT JOIN horas_partida HP ON PV."PARTIDA" = HP."PARTIDA"
      LEFT JOIN tej_por_partida TEJ ON TEJ."CalPartida" = PV."PARTIDA"
      ORDER BY PV."Pts100m2" DESC NULLS LAST, HP."HoraInicio" ASC
    `

    const result = await query(sql, params, `calidad/pts-por-partida[${isDayMode ? 'day' : 'month'}]`)
    res.json(result.rows || [])
    console.log(`[PERF] GET /calidad/pts-por-partida?mode=${isDayMode ? 'day' : 'month'} ${dateStr} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`)
  } catch (err) {
    console.error('Error en /api/calidad/pts-por-partida:', err)
    res.status(500).json({ error: err.message })
  }
})


// GET /api/calidad/defectos-por-partida - Desglose de defectos para una partida y fecha
// Parámetros: date=YYYY-MM-DD, mode=day (default)|month, partida=string
app.get('/api/calidad/defectos-por-partida', async (req, res) => {
  try {
    const t0 = hrMs()
    const { date, mode, partida } = req.query
    if (!date) return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    if (!partida) return res.status(400).json({ error: 'Se requiere parámetro "partida"' })

    const dateStr   = String(date).split('T')[0]
    const isDayMode = String(mode || 'day').toLowerCase() === 'day'
    const partidaStr = String(partida).trim()

    const calDatProd   = sqlParseDate('c."DAT_PROD"')
    const metragemExpr = sqlParseNumberIntl('c."METRAGEM"')
    const larguraExpr  = sqlParseNumber('c."LARGURA"')
    const pontosExpr   = sqlParseNumber('d."PONTOS"')

    const [yyyy, mm] = dateStr.split('-')
    const monthStart = `${yyyy}-${mm}-01`

    // El filtro de fecha en tb_calidad usa siempre el DAT_PROD parseado
    const dateFilterCal = isDayMode
      ? `c."DAT_PROD" = ANY($1::text[])`
      : `${calDatProd} BETWEEN $1::date AND $2::date`

    const partidaParam = isDayMode ? '$2' : '$3'
    const params = isDayMode
      ? [dateTextCandidates(dateStr), partidaStr]
      : [monthStart, dateStr, partidaStr]

    const sql = `
      WITH
      piezas AS (
        SELECT DISTINCT c."PEÇA"
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND c."PARTIDA"   = ${partidaParam}
          AND ${dateFilterCal}
      ),
      area AS (
        SELECT COALESCE(SUM(${metragemExpr} * COALESCE(${larguraExpr}, 0) / 100.0), 0) AS metros2
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND c."PARTIDA"   = ${partidaParam}
          AND ${dateFilterCal}
      ),
      defectos AS (
        SELECT
          MIN(d."COD_DEF")          AS cod_def,
          btrim(d."DESC_DEFEITO")   AS desc_defeito,
          SUM(COALESCE(${pontosExpr}, 0)) AS pts_totales
        FROM tb_defectos d
        INNER JOIN piezas p ON p."PEÇA" = d."PARTIDA" || d."PECA"
        WHERE d."FILIAL"    = '05'
          AND d."QUALIDADE" = '1'
          AND btrim(d."DESC_DEFEITO") <> ''
          AND btrim(d."DESC_DEFEITO") <> '--'
        GROUP BY btrim(d."DESC_DEFEITO")
        HAVING SUM(COALESCE(${pontosExpr}, 0)) > 0
      ),
      total_pts AS (
        SELECT COALESCE(SUM(pts_totales), 0) AS total FROM defectos
      )
      SELECT
        d.cod_def                                                   AS "cod_def",
        d.desc_defeito                                              AS "desc_defeito",
        ROUND(d.pts_totales)::integer                               AS "pts_totales",
        ROUND(
          CASE WHEN (SELECT metros2 FROM area) > 0
            THEN d.pts_totales * 100.0 / (SELECT metros2 FROM area)
            ELSE 0
          END::numeric, 2
        )                                                           AS "pts_100m2",
        ROUND(
          CASE WHEN (SELECT total FROM total_pts) > 0
            THEN d.pts_totales * 100.0 / (SELECT total FROM total_pts)
            ELSE 0
          END::numeric, 2
        )                                                           AS "porcentaje",
        (SELECT metros2 FROM area)                                  AS "area_m2"
      FROM defectos d
      ORDER BY d.pts_totales DESC
    `

    const result = await query(sql, params, `calidad/defectos-por-partida[${isDayMode ? 'day' : 'month'}]`)
    const rows = result.rows || []

    const areaM2    = rows.length > 0 ? (Number(rows[0].area_m2) || 0) : 0
    const totPts    = rows.reduce((s, r) => s + (Number(r.pts_totales) || 0), 0)
    const totPts100 = areaM2 > 0 ? Math.round(totPts * 100 / areaM2 * 100) / 100 : 0

    res.json({
      rows: rows.map(r => ({
        cod_def:      r.cod_def || '',
        desc_defeito: r.desc_defeito,
        pts_totales:  Number(r.pts_totales),
        pts_100m2:    Number(r.pts_100m2),
        porcentaje:   Number(r.porcentaje),
      })),
      total: { pts_totales: totPts, pts_100m2: totPts100, area_m2: Math.round(areaM2 * 100) / 100 },
    })
    console.log(`[PERF] GET /calidad/defectos-por-partida?mode=${isDayMode ? 'day' : 'month'} ${dateStr} partida=${partidaStr} rows=${rows.length} total=${(hrMs() - t0).toFixed(1)}ms`)
  } catch (err) {
    console.error('Error en /api/calidad/defectos-por-partida:', err)
    res.status(500).json({ error: err.message })
  }
})


// GET /api/calidad/partidas-por-defecto - Partidas que contienen un defecto dado, con métricas de tejeduría
// Parámetros: date=YYYY-MM-DD, mode=day(default)|month, defecto=DESC_DEFEITO, trama=Todas|ALG 100%|P + E|POL 100%
app.get('/api/calidad/partidas-por-defecto', async (req, res) => {
  try {
    const t0 = hrMs()
    const { date, mode, defecto, trama } = req.query
    if (!date)    return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    if (!defecto) return res.status(400).json({ error: 'Se requiere parámetro "defecto"' })

    const dateStr    = String(date).split('T')[0]
    const isDayMode  = String(mode || 'day').toLowerCase() === 'day'
    const defectoStr = String(defecto).trim()

    let tramasFilter = ''
    if (trama === 'ALG 100%')      tramasFilter = `AND left(c."ARTIGO", 1) = 'A'`
    else if (trama === 'P + E')    tramasFilter = `AND left(c."ARTIGO", 1) = 'Y'`
    else if (trama === 'POL 100%') tramasFilter = `AND left(c."ARTIGO", 1) = 'P'`

    const calDatProd  = sqlParseDate('c."DAT_PROD"')
    const metragemExpr  = sqlParseNumberIntl('c."METRAGEM"')
    const larguraExpr   = sqlParseNumber('c."LARGURA"')
    const defPontosExpr = sqlParseNumber('d."PONTOS"')
    const prodPtsLidos  = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100    = sqlParseNumber('P."PONTOS_100%"')
    const prodParTra    = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrd    = sqlParseNumber('P."PARADA TEC URDUME"')

    const dateFilter = isDayMode
      ? `${calDatProd} = $1::date`
      : `to_char(${calDatProd}, 'YYYY-MM') = to_char($1::date, 'YYYY-MM')`

    const sql = `
      WITH
      cal_primeira AS (
        SELECT DISTINCT c."PEÇA", c."PARTIDA"
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND ${dateFilter}
          ${tramasFilter}
      ),
      area_por_partida AS (
        SELECT
          c."PARTIDA",
          COALESCE(SUM(${metragemExpr} * COALESCE(${larguraExpr}, 0) / 100.0), 0) AS area_m2,
          MIN(c."NM MERC") AS nom_merc,
          MIN(c."TRAMA")   AS trama_val
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND ${dateFilter}
          ${tramasFilter}
        GROUP BY c."PARTIDA"
      ),
      pts_totales_por_partida AS (
        SELECT
          cp."PARTIDA",
          SUM(COALESCE(${defPontosExpr}, 0)) AS pts_totales
        FROM tb_defectos d
        INNER JOIN cal_primeira cp ON cp."PEÇA" = d."PARTIDA" || d."PECA"
        WHERE d."FILIAL"    = '05'
          AND d."QUALIDADE" = '1'
        GROUP BY cp."PARTIDA"
      ),
      pts_defecto_por_partida AS (
        SELECT
          cp."PARTIDA",
          SUM(COALESCE(${defPontosExpr}, 0)) AS pts_defecto
        FROM tb_defectos d
        INNER JOIN cal_primeira cp ON cp."PEÇA" = d."PARTIDA" || d."PECA"
        WHERE d."FILIAL"    = '05'
          AND d."QUALIDADE" = '1'
          AND btrim(d."DESC_DEFEITO") = $2
        GROUP BY cp."PARTIDA"
        HAVING SUM(COALESCE(${defPontosExpr}, 0)) > 0
      ),
      partida_vars AS (
        SELECT
          PD."PARTIDA"                                                    AS "PARTIDA",
          PD."PARTIDA"                                                    AS "Var0",
          CASE WHEN length(PD."PARTIDA") > 1
               AND left(PD."PARTIDA", 1) ~ '^[0-9]$'
               AND left(PD."PARTIDA", 1)::int > 0
            THEN (left(PD."PARTIDA", 1)::int - 1)::text || substring(PD."PARTIDA" FROM 2)
          END AS "Var1",
          CASE WHEN length(PD."PARTIDA") > 1
               AND left(PD."PARTIDA", 1) ~ '^[0-9]$'
               AND left(PD."PARTIDA", 1)::int > 1
            THEN (left(PD."PARTIDA", 1)::int - 2)::text || substring(PD."PARTIDA" FROM 2)
          END AS "Var2",
          CASE WHEN length(PD."PARTIDA") > 1
               AND left(PD."PARTIDA", 1) ~ '^[0-9]$'
               AND left(PD."PARTIDA", 1)::int > 2
            THEN (left(PD."PARTIDA", 1)::int - 3)::text || substring(PD."PARTIDA" FROM 2)
          END AS "Var3",
          CASE WHEN length(PD."PARTIDA") > 1
            THEN '0' || substring(PD."PARTIDA" FROM 2)
          END AS "Var4"
        FROM pts_defecto_por_partida PD
      ),
      tej_por_partida AS (
        SELECT PV."PARTIDA" AS "CalPartida", TEJ.*
        FROM partida_vars PV
        LEFT JOIN LATERAL (
          SELECT
            MAX(CASE WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$'
              THEN right(P."MAQUINA", 2)::int ELSE NULL END)      AS "Telar",
            SUM(COALESCE(${prodPtsLidos}, 0))                     AS "PtsLei",
            SUM(COALESCE(${prodPts100},   0))                     AS "Pts100",
            SUM(COALESCE(${prodParTra},   0))                     AS "ParTra",
            SUM(COALESCE(${prodParUrd},   0))                     AS "ParUrd"
          FROM tb_produccion P
          WHERE P."FILIAL"  = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0 WHEN PV."Var1" THEN 1 WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3 WHEN PV."Var4" THEN 4 ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON TRUE
      )
      SELECT
        PD."PARTIDA"                                                        AS "Partida",
        COALESCE(A.nom_merc, '—')                                          AS "NombreArticulo",
        COALESCE(A.trama_val, '—')                                         AS "Trama",
        COALESCE(TEJ."Telar", 0)                                           AS "Telar",
        ROUND(PD.pts_defecto)::integer                                      AS "pts_defecto",
        ROUND(
          CASE WHEN A.area_m2 > 0 THEN PD.pts_defecto * 100.0 / A.area_m2 ELSE 0 END::numeric, 2
        )                                                                   AS "pts_100m2_defecto",
        ROUND(
          CASE WHEN PT.pts_totales > 0 THEN PD.pts_defecto * 100.0 / PT.pts_totales ELSE 0 END::numeric, 1
        )                                                                   AS "pct_del_total",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END                                                                 AS "EficienciaPct",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END                                                                 AS "RU105",
        CASE WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END                                                                 AS "RT105"
      FROM pts_defecto_por_partida PD
      LEFT JOIN area_por_partida A         ON A."PARTIDA"    = PD."PARTIDA"
      LEFT JOIN pts_totales_por_partida PT ON PT."PARTIDA"   = PD."PARTIDA"
      LEFT JOIN tej_por_partida TEJ        ON TEJ."CalPartida" = PD."PARTIDA"
      ORDER BY PD.pts_defecto DESC NULLS LAST
    `

    const result = await query(sql, [dateStr, defectoStr], `calidad/partidas-por-defecto[${isDayMode ? 'day' : 'month'}]`)
    res.json(result.rows || [])
    console.log(`[PERF] GET /calidad/partidas-por-defecto?mode=${isDayMode ? 'day' : 'month'} ${dateStr} defecto="${defectoStr}" rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`)
  } catch (err) {
    console.error('Error en /api/calidad/partidas-por-defecto:', err)
    res.status(500).json({ error: err.message })
  }
})


// GET /api/calidad/heatmap-telar-defecto - Matriz Telar × Defecto con Pts/100m² para un rango de fechas
// Parámetros: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD, trama=Todas|ALG 100%|P + E|POL 100%
app.get('/api/calidad/heatmap-telar-defecto', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate, trama } = req.query
    if (!startDate || !endDate) return res.status(400).json({ error: 'Se requieren "startDate" y "endDate" (YYYY-MM-DD)' })

    const startStr = String(startDate).split('T')[0]
    const endStr   = String(endDate).split('T')[0]

    let tramasFilter = ''
    if (trama === 'ALG 100%')      tramasFilter = `AND left(c."ARTIGO", 1) = 'A'`
    else if (trama === 'P + E')    tramasFilter = `AND left(c."ARTIGO", 1) = 'Y'`
    else if (trama === 'POL 100%') tramasFilter = `AND left(c."ARTIGO", 1) = 'P'`

    const calDatProd    = sqlParseDate('c."DAT_PROD"')
    const metragemExpr  = sqlParseNumberIntl('c."METRAGEM"')
    const larguraExpr   = sqlParseNumber('c."LARGURA"')
    const defPontosExpr = sqlParseNumber('d."PONTOS"')

    const sql = `
      WITH
      cal_primeira AS (
        SELECT DISTINCT c."PEÇA", c."PARTIDA"
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND ${calDatProd} BETWEEN $1::date AND $2::date
          ${tramasFilter}
      ),
      area_por_partida AS (
        SELECT
          c."PARTIDA",
          SUM(${metragemExpr} * COALESCE(${larguraExpr}, 0) / 100.0) AS area_m2
        FROM tb_calidad c
        WHERE c."EMP"       = 'STC'
          AND c."QUALIDADE" ILIKE 'PRIMEIRA%'
          AND ${calDatProd} BETWEEN $1::date AND $2::date
          ${tramasFilter}
        GROUP BY c."PARTIDA"
      ),
      defectos_raw AS (
        SELECT
          cp."PARTIDA",
          btrim(d."DESC_DEFEITO")                    AS desc_defeito,
          MIN(d."COD_DEF")                           AS cod_def,
          SUM(COALESCE(${defPontosExpr}, 0))         AS pts
        FROM tb_defectos d
        INNER JOIN cal_primeira cp ON cp."PEÇA" = d."PARTIDA" || d."PECA"
        WHERE d."FILIAL"    = '05'
          AND d."QUALIDADE" = '1'
          AND btrim(d."DESC_DEFEITO") <> ''
          AND btrim(d."DESC_DEFEITO") <> '--'
        GROUP BY cp."PARTIDA", btrim(d."DESC_DEFEITO")
        HAVING SUM(COALESCE(${defPontosExpr}, 0)) > 0
      ),
      partida_vars AS (
        SELECT
          PD."PARTIDA",
          PD."PARTIDA" AS "Var0",
          CASE WHEN length(PD."PARTIDA") > 1 AND left(PD."PARTIDA", 1) ~ '^[0-9]$' AND left(PD."PARTIDA", 1)::int > 0
            THEN (left(PD."PARTIDA", 1)::int - 1)::text || substring(PD."PARTIDA" FROM 2) END AS "Var1",
          CASE WHEN length(PD."PARTIDA") > 1 AND left(PD."PARTIDA", 1) ~ '^[0-9]$' AND left(PD."PARTIDA", 1)::int > 1
            THEN (left(PD."PARTIDA", 1)::int - 2)::text || substring(PD."PARTIDA" FROM 2) END AS "Var2",
          CASE WHEN length(PD."PARTIDA") > 1 AND left(PD."PARTIDA", 1) ~ '^[0-9]$' AND left(PD."PARTIDA", 1)::int > 2
            THEN (left(PD."PARTIDA", 1)::int - 3)::text || substring(PD."PARTIDA" FROM 2) END AS "Var3",
          CASE WHEN length(PD."PARTIDA") > 1
            THEN '0' || substring(PD."PARTIDA" FROM 2) END AS "Var4"
        FROM (SELECT DISTINCT "PARTIDA" FROM defectos_raw) PD
      ),
      tej_por_partida AS (
        SELECT
          PV."PARTIDA"                                                                        AS "CalPartida",
          MAX(CASE WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$'
            THEN right(P."MAQUINA", 2)::int ELSE NULL END)                                  AS "Telar"
        FROM partida_vars PV
        LEFT JOIN tb_produccion P ON P."FILIAL"  = '05'
          AND P."SELETOR" = 'TECELAGEM'
          AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
        GROUP BY PV."PARTIDA"
      )
      SELECT
        TEJ."Telar"                                                             AS "Telar",
        DR.desc_defeito                                                         AS "desc_defeito",
        MIN(DR.cod_def)                                                         AS "cod_def",
        ROUND(
          SUM(DR.pts) * 100.0 / NULLIF(SUM(A.area_m2), 0)::numeric, 2
        )                                                                       AS "pts_100m2",
        ROUND(SUM(DR.pts))::integer                                             AS "pts_totales"
      FROM defectos_raw DR
      LEFT JOIN  area_por_partida  A   ON A."PARTIDA"     = DR."PARTIDA"
      INNER JOIN tej_por_partida   TEJ ON TEJ."CalPartida" = DR."PARTIDA"
      WHERE TEJ."Telar" IS NOT NULL AND TEJ."Telar" > 0
      GROUP BY TEJ."Telar", DR.desc_defeito
      ORDER BY TEJ."Telar" ASC, SUM(DR.pts) DESC
    `

    const result = await query(sql, [startStr, endStr], 'calidad/heatmap-telar-defecto')
    res.json(result.rows || [])
    console.log(`[PERF] GET /calidad/heatmap-telar-defecto ${startStr}→${endStr} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`)
  } catch (err) {
    console.error('Error en /api/calidad/heatmap-telar-defecto:', err)
    res.status(500).json({ error: err.message })
  }
})


// GET /api/calidad/available-dates - Fechas disponibles en tb_calidad
app.get('/api/calidad/available-dates', async (req, res) => {
  try {
    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const sql = `
      SELECT DISTINCT
        to_char(${datProdDate}, 'YYYY-MM-DD') AS fecha,
        to_char(${datProdDate}, 'YYYY') AS year,
        to_char(${datProdDate}, 'MM') AS month,
        to_char(${datProdDate}, 'DD') AS day
      FROM tb_calidad c
      WHERE c."DAT_PROD" IS NOT NULL
        AND c."DAT_PROD" <> ''
        AND ${datProdDate} IS NOT NULL
      ORDER BY fecha DESC
    `

    const result = await query(sql, [], 'calidad/available-dates')
    const rows = result.rows || []

    const dateStructure = { years: {}, minDate: null, maxDate: null }
    if (rows.length > 0) {
      dateStructure.minDate = rows[rows.length - 1].fecha
      dateStructure.maxDate = rows[0].fecha
      for (const row of rows) {
        const { year, month, day, fecha } = row
        if (!dateStructure.years[year]) dateStructure.years[year] = {}
        if (!dateStructure.years[year][month]) dateStructure.years[year][month] = []
        dateStructure.years[year][month].push({ day, fecha })
      }
    }

    res.json(dateStructure)
  } catch (err) {
    console.error('Error en /api/calidad/available-dates:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/sectores-resumen - Metros revisados por sector
app.get('/api/calidad/sectores-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')

    const sql = `
      WITH sectores(sector, nro, meta_pct) AS (
        VALUES
          ('S/ Def.', 1, 95.5),
          ('FIACAO', 2, 0.15),
          ('INDIGO', 3, 1.4),
          ('TECELAGEM', 4, 2.5),
          ('ACABMTO', 5, 0.3),
          ('GERAL', 6, 0.15)
      ),
      calidad_dia AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} = $1::date
        GROUP BY c."GRP_DEF"
      ),
      calidad_mes AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} >= $2::date
          AND ${datProdDate} <= $3::date
        GROUP BY c."GRP_DEF"
      )
      SELECT
        s.sector AS "SECTOR",
        COALESCE(d.metros, 0) AS "metrosDia",
        COALESCE(m.metros, 0) AS "metrosMes",
        s.meta_pct AS "metaPct"
      FROM sectores s
      LEFT JOIN calidad_dia d ON s.sector = d.sector
      LEFT JOIN calidad_mes m ON s.sector = m.sector
      ORDER BY s.nro
    `

    const result = await query(sql, [datePattern, mesInicio, mesFin], 'calidad/sectores-resumen')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/calidad/sectores-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metas/resumen/:fecha - Meta del dia y acumulado del mes
app.get('/api/metas/resumen/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params
    if (!fecha) {
      return res.status(400).json({ error: 'Se requiere parámetro "fecha" (YYYY-MM-DD)' })
    }

    const datePattern = String(fecha).split('T')[0]
    const [year, month] = datePattern.split('-')
    const monthStart = `${year}-${month}-01`

    const metasExists = await tableExists('tb_metas')
    if (!metasExists) {
      return res.json({ day: 0, month: 0, fecha: datePattern })
    }

    const metaDia = await query(
      `SELECT COALESCE("Revision", 0) AS total
       FROM tb_metas WHERE "Dia" = $1`,
      [datePattern],
      'metas/resumen-dia'
    )
    const metaMes = await query(
      `SELECT COALESCE(SUM("Revision"), 0) AS total
       FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
      [monthStart, datePattern],
      'metas/resumen-mes'
    )

    res.json({
      day: Number(metaDia.rows?.[0]?.total || 0),
      month: Number(metaMes.rows?.[0]?.total || 0),
      fecha: datePattern
    })
  } catch (err) {
    console.error('Error en /api/metas/resumen/:fecha:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metas/mes?fecha=YYYY-MM-DD - Lista todas las metas del mes (Dia, Revision)
app.get('/api/metas/mes', async (req, res) => {
  try {
    const fechaQuery = req.query.fecha || new Date().toISOString().slice(0, 10)
    const datePattern = String(fechaQuery).split('T')[0]
    const [year, month] = datePattern.split('-')
    const monthStart = `${year}-${month}-01`

    // último día del mes
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
    const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

    const metasExists = await tableExists('tb_metas')
    const rows = []
    if (!metasExists) {
      for (let d = 1; d <= lastDay; d++) {
        const dia = `${year}-${month}-${String(d).padStart(2, '0')}`
        rows.push({ Dia: dia, Revision: null })
      }
      return res.json({ rows })
    }

    const result = await query(
      `SELECT to_char("Dia", 'YYYY-MM-DD') AS dia, "Revision" AS revision FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2 ORDER BY "Dia"`,
      [monthStart, monthEnd],
      'metas/mes'
    )

    const map = new Map((result.rows || []).map(r => [r.dia, r.revision == null ? null : Number(r.revision)]))

    for (let d = 1; d <= lastDay; d++) {
      const dia = `${year}-${month}-${String(d).padStart(2, '0')}`
      const revision = map.has(dia) ? map.get(dia) : null
      rows.push({ Dia: dia, Revision: revision })
    }

    res.json({ rows })
  } catch (err) {
    console.error('Error en /api/metas/mes:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/pts100m2 - Puntos por 100m2
app.get('/api/calidad/pts100m2', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')
    const pontuacaoNum = sqlParseNumberIntl('c."PONTUACAO"')
    const larguraNum = sqlParseNumberIntl('c."LARGURA"')

    const sqlDia = `
      WITH pts AS (
        SELECT
          dat_prod,
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} = $1::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
        GROUP BY dat_prod
      ),
      ancho AS (
        SELECT
          ${datProdDate} AS fecha,
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} = $1::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
        GROUP BY ${datProdDate}
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho
      LEFT JOIN pts ON ancho.fecha = pts.dat_prod
    `

    const sqlMes = `
      WITH pts AS (
        SELECT
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} >= $1::date
            AND ${datProdDate} <= $2::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
      ),
      ancho AS (
        SELECT
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} >= $1::date
          AND ${datProdDate} <= $2::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho, pts
    `

    const resultDia = await query(sqlDia, [datePattern], 'calidad/pts100m2-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'calidad/pts100m2-mes')

    res.json({
      day: Number(resultDia.rows?.[0]?.pts1002 || 0),
      month: Number(resultMes.rows?.[0]?.pts1002 || 0),
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/calidad/pts100m2:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/indigo-resumen
app.get('/api/produccion/indigo-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasNum = sqlParseNumberIntl('p."RUPTURAS"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'INDIGO'
    `

    const sqlMes = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."SELETOR" = 'INDIGO'
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/indigo-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/indigo-mes')

    let metaDia = 0
    let metaMes = 0
    let indigoMetaRot = 0
    let indigoMetaEstopa = 0
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        'SELECT "Indigo" AS meta_dia, "Meta_Rotura_INDIGO" AS meta_rot_103, "Meta_Estopa_Azul" AS meta_estopa_azul FROM tb_metas WHERE "Dia" = $1',
        [datePattern],
        'metas/indigo-dia'
      )
      const metaMesRes = await query(
        'SELECT SUM("Indigo") AS total, AVG("Meta_Rotura_INDIGO") AS meta_rot_103, AVG("Meta_Estopa_Azul") AS meta_estopa_azul FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2',
        [mesInicio, mesFin],
        'metas/indigo-mes'
      )
      metaDia = Number(metaDiaRes.rows?.[0]?.meta_dia || 0)
      metaMes = Number(metaMesRes.rows?.[0]?.total || 0)
      indigoMetaRot = Number(metaDiaRes.rows?.[0]?.meta_rot_103 || metaMesRes.rows?.[0]?.meta_rot_103 || 0)
      indigoMetaEstopa = Number(metaDiaRes.rows?.[0]?.meta_estopa_azul || metaMesRes.rows?.[0]?.meta_estopa_azul || 0)
    }

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        rot103: Number(resultDia.rows?.[0]?.rot_103 || 0),
        meta: metaDia,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        rot103: Number(resultMes.rows?.[0]?.rot_103 || 0),
        metaAcumulada: metaMes,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/estopa-azul
app.get('/api/produccion/estopa-azul', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const fichasCols = await getTableColumnsMap('tb_fichas', 'tb-fichas-columns/estopa-azul')
    const consumoKey = ['cons#urd/m', 'cons.urd/m', 'consumo'].find((c) => fichasCols.has(c))
    const urdumeKey = ['urdume', 'base urdume'].find((c) => fichasCols.has(c))
    const consumoCol = consumoKey ? fichasCols.get(consumoKey) : null
    const urdumeCol = urdumeKey ? fichasCols.get(urdumeKey) : null

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const pesoMantaNum = consumoCol ? sqlParseNumberIntl(`f.${quoteIdent(consumoCol)}`) : 'NULL::numeric'
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')
    const urdumeExpr = urdumeCol ? `f.${quoteIdent(urdumeCol)}` : 'NULL::text'

    const sqlDia = `
      WITH bases AS (
        SELECT DISTINCT
          ${urdumeExpr} AS artigo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE ${urdumeExpr} IS NOT NULL
          AND ${urdumeExpr} <> ''
          AND ${pesoMantaNum} IS NOT NULL
          AND ${pesoMantaNum} <> 0
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_dia AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.artigo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} = $2::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pd.suma_producto,
        CASE WHEN pd.suma_producto > 0 THEN (ea.estopa / pd.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_dia pd, estopa_azul ea
    `

    const sqlMes = `
      WITH bases AS (
        SELECT DISTINCT
          ${urdumeExpr} AS articulo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE ${urdumeExpr} IS NOT NULL
          AND ${urdumeExpr} <> ''
          AND ${pesoMantaNum} IS NOT NULL
          AND ${pesoMantaNum} <> 0
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_mes AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.articulo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} >= $3::date
          AND ${dtMovDate} <= $4::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pm.suma_producto,
        CASE WHEN pm.suma_producto > 0 THEN (ea.estopa / pm.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_mes pm, estopa_azul ea
    `

    const resultDia = await query(sqlDia, [datePattern, datePattern], 'produccion/estopa-azul-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin, mesInicio, mesFin], 'produccion/estopa-azul-mes')

    res.json({
      day: {
        estopaKg: Number(resultDia.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultDia.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultDia.rows?.[0]?.porcentaje || 0)
      },
      month: {
        estopaKg: Number(resultMes.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultMes.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultMes.rows?.[0]?.porcentaje || 0)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/estopa-azul:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/tecelagem-resumen
app.get('/api/produccion/tecelagem-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const fichasCols = await getTableColumnsMap('tb_fichas', 'tb-fichas-columns/tecelagem-resumen')
    const consumoKey = ['cons#urd/m', 'cons.urd/m', 'consumo'].find((c) => fichasCols.has(c))
    const encUrdKey = ['enc#tec#urdume', 'enc.tec.urdume', 'sizing'].find((c) => fichasCols.has(c))
    const artigoKey = ['artigo codigo', 'artigo'].find((c) => fichasCols.has(c))
    const consumoCol = consumoKey ? fichasCols.get(consumoKey) : null
    const encUrdCol = encUrdKey ? fichasCols.get(encUrdKey) : null
    const artigoCol = artigoKey ? fichasCols.get(artigoKey) : null

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemEncNum = sqlParseNumberIntl('p."METRAGEM ENCOLH"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('p."PARADA TEC URDUME"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemEncNum}), 0) AS metros,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaTramaNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaUrdNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(${pontos100Num}) > 0 THEN SUM(${pontosLidosNum}) * 100.0 / SUM(${pontos100Num})
          ELSE 0
        END AS eficiencia
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'TECELAGEM'
    `

    const sqlMes = `
      WITH daily AS (
        SELECT
          ${dtBaseDate} AS dia,
          COALESCE(SUM(${metragemEncNum}), 0)   AS metros,
          COALESCE(SUM(${paradaTramaNum}), 0)   AS parada_trama,
          COALESCE(SUM(${paradaUrdNum}), 0)     AS parada_urd,
          COALESCE(SUM(${pontosLidosNum}), 0)   AS pontos_lidos,
          COALESCE(SUM(${pontos100Num}), 0)     AS pontos_100
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY ${dtBaseDate}
      )
      SELECT
        COALESCE(SUM(metros), 0) AS metros,
        CASE
          WHEN SUM(pontos_lidos) > 0 THEN SUM(parada_trama) * 100000.0 /
            (SUM(pontos_lidos) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(pontos_lidos) > 0 THEN SUM(parada_urd) * 100000.0 /
            (SUM(pontos_lidos) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(CASE WHEN pontos_lidos > 0 THEN pontos_100 ELSE 0 END) > 0
          THEN SUM(CASE WHEN pontos_lidos > 0 THEN pontos_lidos ELSE 0 END) * 100.0 /
               SUM(CASE WHEN pontos_lidos > 0 THEN pontos_100 ELSE 0 END)
          ELSE 0
        END AS eficiencia
      FROM daily
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/tecelagem-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/tecelagem-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT
           "Tejeduria" AS meta_dia,
           "EFI_Percent" AS meta_efi,
           "RT105" AS meta_rt105,
           "RU105" AS meta_ru105,
           "Meta_Estopa_Azul_Tejeduria" AS meta_estopa
         FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/tecelagem-dia'
      )
      const metaMesRes = await query(
        `SELECT
           SUM("Tejeduria") AS meta_acumulada,
           AVG("EFI_Percent") AS meta_efi,
           AVG("RT105") AS meta_rt105,
           AVG("RU105") AS meta_ru105,
           AVG("Meta_Estopa_Azul_Tejeduria") AS meta_estopa
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
        [mesInicio, mesFin],
        'metas/tecelagem-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    // Estopa azul tejeduria (residuos por sector)
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const pesoMantaNum = consumoCol ? sqlParseNumberIntl(`f.${quoteIdent(consumoCol)}`) : 'NULL::numeric'
    const encUrdNum = encUrdCol ? sqlParseNumberIntl(`f.${quoteIdent(encUrdCol)}`) : 'NULL::numeric'
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')
    const artigoExpr = artigoCol ? `f.${quoteIdent(artigoCol)}` : 'NULL::text'

    const sqlEstopaDiaPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          ${artigoExpr} AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE ${artigoExpr} IS NOT NULL AND ${artigoExpr} <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaDiaResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} = $1::date
        AND r."SUBPRODUTO" = '1785582'
    `

    const sqlEstopaMesPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          ${artigoExpr} AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE ${artigoExpr} IS NOT NULL AND ${artigoExpr} <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaMesResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} >= $1::date
        AND ${dtMovDate} <= $2::date
        AND r."SUBPRODUTO" = '1785582'
    `

    let pesoProductoDia = 0
    let pesoProductoMes = 0
    let estopaDia = 0
    let estopaMes = 0

    try {
      const estopaDiaPeso = await query(sqlEstopaDiaPeso, [datePattern], 'tecelagem/estopa-peso-dia')
      const estopaDiaRes = await query(sqlEstopaDiaResiduo, [datePattern], 'tecelagem/estopa-residuo-dia')
      const estopaMesPeso = await query(sqlEstopaMesPeso, [mesInicio, mesFin], 'tecelagem/estopa-peso-mes')
      const estopaMesRes = await query(sqlEstopaMesResiduo, [mesInicio, mesFin], 'tecelagem/estopa-residuo-mes')

      pesoProductoDia = Number(estopaDiaPeso.rows?.[0]?.peso_urd || 0)
      pesoProductoMes = Number(estopaMesPeso.rows?.[0]?.peso_urd || 0)
      estopaDia = Number(estopaDiaRes.rows?.[0]?.estopa || 0)
      estopaMes = Number(estopaMesRes.rows?.[0]?.estopa || 0)
    } catch (err) {
      console.warn('No se pudo calcular estopa azul tejeduria:', err.message)
    }

    const estopaAzulPctDia = pesoProductoDia > 0 ? (estopaDia / pesoProductoDia) * 100 : 0
    const estopaAzulPctMes = pesoProductoMes > 0 ? (estopaMes / pesoProductoMes) * 100 : 0

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        eficiencia: Number(resultDia.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultDia.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultDia.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctDia,
        meta: Number(metaDia.meta_dia || 0),
        metaEfi: Number(metaDia.meta_efi || 0),
        metaRt105: Number(metaDia.meta_rt105 || 0),
        metaRu105: Number(metaDia.meta_ru105 || 0),
        metaEstopaAzul: Number(metaDia.meta_estopa || 0)
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        eficiencia: Number(resultMes.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultMes.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultMes.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctMes,
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEfi: Number(metaMes.meta_efi || 0),
        metaRt105: Number(metaMes.meta_rt105 || 0),
        metaRu105: Number(metaMes.meta_ru105 || 0),
        metaEstopaAzul: Number(metaMes.meta_estopa || 0)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/tecelagem-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/acabamento-resumen
app.get('/api/produccion/acabamento-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtProdDate = sqlParseDate('t."DT_PROD"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const testeMetragemNum = sqlParseNumberIntl('t."METRAGEM"')
    const encUrdNum = sqlParseNumberIntl('t."%_ENC_URD"')

    const sqlMetrosDia = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."MAQUINA" = '165001'
    `
    const sqlMetrosMes = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."MAQUINA" = '165001'
    `

    const sqlEncUrdDia = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} = $1::date
        AND t."MAQUINA" = '165001'
        AND t."APROV" = 'A'
    `
    const sqlEncUrdMes = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} >= $1::date
        AND ${dtProdDate} <= $2::date
        AND t."MAQUINA" = '165001'
        AND t."APROV" = 'A'
    `

    const resultMetrosDia = await query(sqlMetrosDia, [datePattern], 'acabamento/metros-dia')
    const resultMetrosMes = await query(sqlMetrosMes, [mesInicio, mesFin], 'acabamento/metros-mes')
    const resultEncUrdDia = await query(sqlEncUrdDia, [datePattern], 'acabamento/enc-urd-dia')
    const resultEncUrdMes = await query(sqlEncUrdMes, [mesInicio, mesFin], 'acabamento/enc-urd-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT "Integrada" AS meta_dia, "Meta_ENC_URD_Integrada" AS meta_enc_urd FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/acabamento-dia'
      )
      const metaMesRes = await query(
        `SELECT SUM("Integrada") AS meta_acumulada, AVG("Meta_ENC_URD_Integrada") AS meta_enc_urd
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
        [mesInicio, mesFin],
        'metas/acabamento-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    res.json({
      day: {
        metros: Number(resultMetrosDia.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdDia.rows?.[0]?.enc_urd_pct || 0),
        meta: Number(metaDia.meta_dia || 0),
        metaEncUrd: Number(metaDia.meta_enc_urd || -1.5)
      },
      month: {
        metros: Number(resultMetrosMes.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdMes.rows?.[0]?.enc_urd_pct || 0),
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEncUrd: Number(metaMes.meta_enc_urd || -1.5)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/acabamento-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/eficiencia-roturas
app.get('/api/produccion/eficiencia-roturas', async (req, res) => {
  try {
    const { date, trama, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const startDate = monthStart || `${year}-${month}-01`
    const endDate = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')

    const tramaFilter = trama ? 'AND p."TRAMA REDUZIDA 1" = $3' : ''
    const params = trama ? [startDate, endDate, trama] : [startDate, endDate]

    const sql = `
      SELECT
        to_char(${dtBaseDate}, 'YYYY-MM-DD') AS fecha,
        p."TRAMA REDUZIDA 1" AS trama,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0)) * 100.0) / NULLIF(SUM(COALESCE(${pontos100Num}, 0)), 0), 1) AS eficiencia,
        ROUND((SUM(COALESCE(${paradaTramaNum}, 0)) * 100000.0) / NULLIF((SUM(COALESCE(${pontosLidosNum}, 0)) * 1000), 0), 1) AS rt105
      FROM tb_produccion p
      WHERE p."FILIAL" = '05'
        AND p."SELETOR" = 'TECELAGEM'
        AND ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        ${tramaFilter}
      GROUP BY fecha, p."TRAMA REDUZIDA 1"
      ORDER BY fecha ASC
    `

    const result = await query(sql, params, 'produccion/eficiencia-roturas')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/produccion/eficiencia-roturas:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS USTER
// =====================================================

// USTER: Check status
app.post('/api/uster/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || testnrs.length === 0) {
    return res.status(400).json({ error: 'testnrs must be a non-empty array' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_uster_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(row => row.testnr) })
  } catch (err) {
    console.error('❌ Error en /api/uster/status:', err.message)
    // Devolver array vacío en lugar de error para no romper la UI
    res.json({ existing: [] })
  }
})

// USTER: Get PAR
app.get('/api/uster/par', async (req, res) => {
  try {
    const result = await query(`SELECT testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs, created_at, updated_at FROM tb_uster_par ORDER BY testnr`)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get TBL
app.get('/api/uster/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno` 
      : `SELECT * FROM tb_uster_tbl ORDER BY testnr, seqno`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get husos
app.post('/api/uster/husos', async (req, res) => {
  const { testnr } = req.body
  if (!testnr) return res.status(400).json({ error: 'testnr is required' })
  try {
    const result = await query(`SELECT no_ FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno`, [testnr])
    res.json({ husos: result.rows.map(r => r.no_).filter(Boolean) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Husos' })
  }
})

// USTER: Upload
app.post('/api/uster/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing PAR data or TESTNR' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (testnr) DO UPDATE SET 
        nomcount=EXCLUDED.nomcount, 
        maschnr=EXCLUDED.maschnr, 
        lote=EXCLUDED.lote, 
        laborant=EXCLUDED.laborant, 
        time_stamp=EXCLUDED.time_stamp, 
        matclass=EXCLUDED.matclass, 
        estiraje=EXCLUDED.estiraje, 
        pasador=EXCLUDED.pasador, 
        obs=EXCLUDED.obs
    `, [par.TESTNR, par.NOMCOUNT, par.MASCHNR, par.LOTE, par.LABORANT, par.TIME_STAMP, par.MATCLASS, par.ESTIRAJE, par.PASADOR, par.OBS])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_uster_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Helper function to convert values to numbers, preserving zeros
    const toNum = (val) => {
      if (val == null || val === '') return null
      const num = parseFloat(val)
      return isNaN(num) ? null : num
    }
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      // DEBUG: Log first row to see what values are arriving
      if (tbl.length > 0) {
        console.log('[DEBUG USTER TBL Row 1]', JSON.stringify(tbl[0], null, 2))
      }
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        const params = [
          par.TESTNR, i+1, r.NO_, 
          toNum(r.U_PERCENT), toNum(r.CVM_PERCENT), toNum(r.INDICE_PERCENT),
          toNum(r.CVM_1M_PERCENT), toNum(r.CVM_3M_PERCENT), toNum(r.CVM_10M_PERCENT),
          toNum(r.TITULO), toNum(r.TITULO_REL_PERC),
          toNum(r.H), toNum(r.SH), toNum(r.SH_1M), toNum(r.SH_3M), toNum(r.SH_10M),
          toNum(r.DELG_MINUS30_KM), toNum(r.DELG_MINUS40_KM),
          toNum(r.DELG_MINUS50_KM), toNum(r.DELG_MINUS60_KM),
          toNum(r.GRUE_35_KM), toNum(r.GRUE_50_KM), toNum(r.GRUE_70_KM),
          toNum(r.GRUE_100_KM),
          toNum(r.NEPS_140_KM), toNum(r.NEPS_200_KM), toNum(r.NEPS_280_KM), toNum(r.NEPS_400_KM)
        ]
        if (i === 0) {
          console.log('[DEBUG INSERT params row 1]', params.slice(0, 10))
        }
        await client.query(`
          INSERT INTO tb_uster_tbl (
            testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo, titulo_rel_perc,
            h, sh, sh_1m, sh_3m, sh_10m, delg_minus30_km, delg_minus40_km,
            delg_minus50_km, delg_minus60_km, grue_35_km, grue_50_km, grue_70_km,
            grue_100_km, neps_140_km, neps_200_km, neps_280_km, neps_400_km
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
          )`,
          params
        )
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR, tblRows: tbl?.length || 0 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading Uster:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// USTER: Delete
app.delete('/api/uster/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_uster_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS USTER CARDAS
// =====================================================

async function ensureUsterCardaSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_uster_carda_par (
      testnr TEXT PRIMARY KEY,
      source_prefix TEXT,
      catalog TEXT,
      sortiment TEXT,
      style TEXT,
      machine_family TEXT,
      nomcount NUMERIC,
      maschnr TEXT,
      lote TEXT,
      laborant TEXT,
      time_stamp TEXT,
      matclass TEXT,
      obs TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS tb_uster_carda_tbl (
      id BIGSERIAL PRIMARY KEY,
      testnr TEXT NOT NULL REFERENCES tb_uster_carda_par(testnr) ON DELETE CASCADE,
      seqno INTEGER NOT NULL,
      no_ NUMERIC,
      u_percent NUMERIC,
      cvm_percent NUMERIC,
      cvm_1m_percent NUMERIC,
      cvm_3m_percent NUMERIC,
      cvm_10m_percent NUMERIC,
      titulo_machine NUMERIC,
      titulo_rel_perc NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(testnr, seqno)
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_uster_carda_par_time ON tb_uster_carda_par(time_stamp)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_uster_carda_tbl_testnr ON tb_uster_carda_tbl(testnr)`)
}

// USTER CARDAS: Status
app.post('/api/uster-cardas/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || !testnrs.length) return res.status(400).json({ error: 'testnrs required' })
  try {
    await ensureUsterCardaSchema()
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_uster_carda_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(r => r.testnr) })
  } catch (err) {
    console.error('❌ Error en /api/uster-cardas/status:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// USTER CARDAS: Get PAR
app.get('/api/uster-cardas/par', async (req, res) => {
  try {
    await ensureUsterCardaSchema()
    const result = await query(`SELECT * FROM tb_uster_carda_par ORDER BY testnr`)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER CARDAS: Get TBL
app.get('/api/uster-cardas/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    await ensureUsterCardaSchema()
    const result = testnr
      ? await query(`SELECT * FROM tb_uster_carda_tbl WHERE testnr = $1 ORDER BY seqno`, [testnr])
      : await query(`SELECT * FROM tb_uster_carda_tbl ORDER BY testnr, seqno`)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER CARDAS: Upload
app.post('/api/uster-cardas/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing PAR data or TESTNR' })
  await ensureUsterCardaSchema()
  const client = await getClient()
  const toNum = (v) => { if (v == null || v === '') return null; const n = parseFloat(v); return Number.isNaN(n) ? null : n }
  try {
    await client.query('BEGIN')
    await client.query(`
      INSERT INTO tb_uster_carda_par
        (testnr, source_prefix, catalog, sortiment, style, machine_family, nomcount, maschnr, lote, laborant, time_stamp, matclass, obs, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (testnr) DO UPDATE SET
        source_prefix=EXCLUDED.source_prefix, catalog=EXCLUDED.catalog,
        sortiment=EXCLUDED.sortiment, style=EXCLUDED.style,
        machine_family=EXCLUDED.machine_family, nomcount=EXCLUDED.nomcount,
        maschnr=EXCLUDED.maschnr, lote=EXCLUDED.lote, laborant=EXCLUDED.laborant,
        time_stamp=EXCLUDED.time_stamp, matclass=EXCLUDED.matclass,
        obs=EXCLUDED.obs, updated_at=NOW()
    `, [
      par.TESTNR, par.SOURCE_PREFIX || null, par.CATALOG || null, par.SORTIMENT || null,
      par.STYLE || null, par.MACHINE_FAMILY || null,
      toNum(par.NOMCOUNT), par.MASCHNR || null,
      par.LOTE || null, par.LABORANT || null, par.TIME_STAMP || null,
      par.MATCLASS || null, par.OBS || null,
    ])

    await client.query('DELETE FROM tb_uster_carda_tbl WHERE testnr = $1', [par.TESTNR])

    if (Array.isArray(tbl) && tbl.length) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tb_uster_carda_tbl
            (testnr, seqno, no_, u_percent, cvm_percent, cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo_machine, titulo_rel_perc)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [
          par.TESTNR, i + 1, toNum(r.NO_),
          toNum(r.U_PERCENT), toNum(r.CVM_PERCENT),
          toNum(r.CVM_1M_PERCENT), toNum(r.CVM_3M_PERCENT), toNum(r.CVM_10M_PERCENT),
          toNum(r.TITULO_MACHINE), toNum(r.TITULO_REL_PERC),
        ])
      }
    }

    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR, tblRows: tbl?.length || 0 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error uploading Uster Carda:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// USTER CARDAS: Delete
app.delete('/api/uster-cardas/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_uster_carda_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS TENSORAPID
// =====================================================

// TENSORAPID: Status
app.post('/api/tensorapid/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || !testnrs.length) {
    return res.status(400).json({ error: 'testnrs required' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_tensorapid_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(r => r.testnr) })
  } catch (err) { 
    res.status(500).json({ error: 'Failed' }) 
  }
})

// TENSORAPID: Get PAR
app.get('/api/tensorapid/par', async (req, res) => {
  try {
    const result = await query(`
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant 
      FROM tb_tensorapid_par 
      ORDER BY testnr
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// TENSORAPID: Get TBL
app.get('/api/tensorapid/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_tensorapid_tbl WHERE testnr = $1 ORDER BY id` 
      : `SELECT * FROM tb_tensorapid_tbl ORDER BY testnr, id`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// CALIDAD FIBRA: Get all
app.get('/api/calidad-fibra', async (req, res) => {
  try {
    const result = await query(`
      SELECT "LOTE_FIAC", "PESO", "MISTURA", "SEQ", "DT_ENTRADA_PROD", "HR_ENTRADA_PROD",
             "SCI", "MST", "MIC", "MAT", "UHML", "UI", "SF", 
             "STR", "ELG", "RD", "PLUS_B", "TIPO", "TrCNT", "TrAR", "TRID"
      FROM tb_CALIDAD_FIBRA
      WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
        AND "TIPO_MOV" = 'MIST'
      ORDER BY "MISTURA", "SEQ"
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Summary
app.get('/api/golden-batch/summary', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Summary...');
  try {
    const result = await query(`
      SELECT 
        CASE 
          WHEN "EFIC_TEJ" >= 90 THEN 'EXITO (>90%)' 
          WHEN "EFIC_TEJ" < 85 THEN 'BAJA (<85%)' 
          ELSE 'NORMAL' 
        END as estado, 
        COUNT(*) as volumen, 
        ROUND(AVG("SCI"), 1) as sci, 
        ROUND(AVG("STR"), 1) as str, 
        ROUND(AVG("MIC"), 2) as mic, 
        ROUND(AVG("RU_105"), 1) as rot_urd 
      FROM view_golden_batch_data 
      GROUP BY 1 
      ORDER BY MIN("EFIC_TEJ") DESC
    `, [], 'GoldenBatchSummary')
    console.log('>>> [GOLDEN BATCH] Summary Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Summary ERROR:', err.message);
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Points
app.get('/api/golden-batch/points', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Points...');
  try {
    const result = await query(`
      SELECT 
        "ROLADA",
        "DATA", 
        "TURNO", 
        "ARTICULO", 
        "TEJIDO_REAL_M", 
        "EFIC_TEJ", 
        "RU_105",
        "RT_105",
        "ROT_URD_URDI",
        "INDIGO_FECHA",
        "INDIGO_BASE",
        "INDIGO_COLOR",
        "INDIGO_R",
        "INDIGO_CAVALOS",
        "INDIGO_VEL_NOM",
        "INDIGO_VEL_REAL",
        "LOTE_FIBRA_TEXT",
        "MISTURA",
        "SCI", 
        "STR", 
        "MIC"
      FROM view_golden_batch_data 
      ORDER BY "DATA" DESC
    `, [], 'GoldenBatchPoints')
    console.log('>>> [GOLDEN BATCH] Points Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Points ERROR:', err.message);
    res.status(500).json({ error: err.message })
  }
})

// TENSORAPID: Upload
app.post('/api/tensorapid/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing data' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) 
      ON CONFLICT (testnr) DO UPDATE SET 
        ne_titulo=EXCLUDED.ne_titulo, 
        titulo=EXCLUDED.titulo, 
        comment_text=EXCLUDED.comment_text, 
        long_prueba=EXCLUDED.long_prueba, 
        time_stamp=EXCLUDED.time_stamp, 
        lote=EXCLUDED.lote, 
        ne_titulo_type=EXCLUDED.ne_titulo_type,
        uster_testnr=EXCLUDED.uster_testnr,
        laborant=EXCLUDED.laborant
    `, [par.TESTNR, par.NE_TITULO, par.TITULO, par.COMMENT_TEXT, par.LONG_PRUEBA, par.TIME_STAMP, par.LOTE, par.NE_TITULO_TYPE, par.USTER_TESTNR, par.LABORANT])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_tensorapid_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tb_tensorapid_tbl (
            testnr, huso_number, tiempo_rotura, fuerza_b, elongacion, tenacidad, trabajo, huso_ensayos
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          par.TESTNR, 
          r.HUSO_NUMBER, 
          parseFloat(r.TIEMPO_ROTURA)||null, 
          parseFloat(r.FUERZA_B)||null, 
          parseFloat(r.ELONGACION)||null, 
          parseFloat(r.TENACIDAD)||null, 
          parseFloat(r.TRABAJO)||null, 
          r.HUSO_ENSAYOS
        ])
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading TensoRapid:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// TENSORAPID: Delete
app.delete('/api/tensorapid/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_tensorapid_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS INDIGO
// =====================================================
app.get('/api/residuos-indigo-tejeduria', async (req, res) => {
  try {
    const requiredTables = [
      'tb_produccion',
      'tb_fichas',
      'tb_residuos_indigo',
      'tb_residuos_por_sector',
      'tb_paradas'
    ]
    const ready = await Promise.all(requiredTables.map(tableExists))
    if (!ready.every(Boolean)) {
      return res.json([])
    }

    const { fecha_inicio, fecha_fin } = req.query
    const fechaInicio = fecha_inicio ? dateVariants(fecha_inicio).iso : null
    const fechaFin = fecha_fin ? dateVariants(fecha_fin).iso : null

    const fichasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_fichas'`,
      [],
      'tb-fichas-columns'
    )
    const fichasCols = new Map(
      (fichasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const consumoKey = ['cons#urd/m', 'cons.urd/m', 'consumo'].find((c) => fichasCols.has(c))
    const sizingKey = ['enc#tec#urdume', 'enc.tec.urdume', 'sizing'].find((c) => fichasCols.has(c))
    const consumoCol = consumoKey ? fichasCols.get(consumoKey) : null
    const sizingCol = sizingKey ? fichasCols.get(sizingKey) : null
    const consumoNum = consumoCol ? sqlParseNumber(quoteIdent(consumoCol)) : 'NULL::numeric'
    const sizingNum = sizingCol ? sqlParseNumber(quoteIdent(sizingCol)) : 'NULL::numeric'

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const urdumeKey = ['urdume', 'base urdume'].find((c) => prodCols.has(c))
    const urdumeCol = urdumeKey ? prodCols.get(urdumeKey) : null
    const urdumeExprProd = urdumeCol ? `P.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const urdumeExprTej = urdumeCol ? `T.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const prodDateKey = ['dt_base_producao', 'data_base'].find((c) => prodCols.has(c))
    const prodDateCol = prodDateKey ? prodCols.get(prodDateKey) : null
    const prodDateExpr = prodDateCol ? `P.${quoteIdent(prodDateCol)}` : 'NULL::text'
    const tejDateExpr = prodDateCol ? `T.${quoteIdent(prodDateCol)}` : 'NULL::text'

    const paradasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_paradas'`,
      [],
      'tb-paradas-columns'
    )
    const parCols = new Map(
      (paradasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const parDateKey = ['dt_base_producao', 'data_base'].find((c) => parCols.has(c))
    const parDateCol = parDateKey ? parCols.get(parDateKey) : null
    const parDateExpr = parDateCol ? `"${parDateCol}"` : 'NULL::text'
    const parMotivoKey = ['motivo', 'motivo1'].find((c) => parCols.has(c))
    const parMotivoCol = parMotivoKey ? parCols.get(parMotivoKey) : null
    const parMotivoExpr = parMotivoCol ? quoteIdent(parMotivoCol) : 'NULL::text'
    const metragemNum = sqlParseNumberIntl('P."METRAGEM"')
    const metragemTejNum = sqlParseNumberIntl('T."METRAGEM"')
    const residuosNum = sqlParseNumber('R."PESO LIQUIDO (KG)"')
    const residuosTejNum = sqlParseNumber('RS."PESO LIQUIDO (KG)"')
    const residuosPrensNum = sqlParseNumber('RP."PESO LIQUIDO (KG)"')

    const dateExpr = sqlParseDate('D.fecha')
    const dateFilter = fechaInicio && fechaFin ? `WHERE ${dateExpr} BETWEEN $1::date AND $2::date` : ''
    const params = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : []

    const sql = `
      WITH FICHAS_UNIQUE AS (
        SELECT
          btrim("URDUME") AS URDUME,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME")
      ),
      FICHAS_ARTIGO AS (
        SELECT
          btrim("URDUME") AS URDUME,
          btrim("ARTIGO") AS ARTIGO,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME"), btrim("ARTIGO")
      ),
      PRODUCCION_IND AS (
        SELECT
          ${prodDateExpr} AS DT_BASE_PRODUCAO,
          SUM(${metragemNum}) AS TotalMetros,
          (SUM(${metragemNum} * FU.CONSUMO) / 1000) * 0.98 AS TotalKg
        FROM tb_produccion P
        JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprProd}) = FU.URDUME
        WHERE P."SELETOR" = 'INDIGO' AND P."FILIAL" = '05'
        GROUP BY ${prodDateExpr}
      ),
      TEJEDURIA_RAW AS (
        SELECT
          ${tejDateExpr} AS DT_BASE_PRODUCAO,
          ${metragemTejNum} AS Metros,
          COALESCE(FA.CONSUMO, FU.CONSUMO) AS Consumo,
          COALESCE(FA.SIZING, FU.SIZING, 0) AS Sizing
        FROM tb_produccion T
        LEFT JOIN FICHAS_ARTIGO FA ON btrim(${urdumeExprTej}) = FA.URDUME AND T."ARTIGO" LIKE FA.ARTIGO || '%'
        LEFT JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprTej}) = FU.URDUME
        WHERE T."SELETOR" = 'TECELAGEM' AND T."FILIAL" = '05'
      ),
      PRODUCCION_TEJ AS (
        SELECT
          DT_BASE_PRODUCAO,
          SUM(Metros) AS TejeduriaMetros,
          SUM(Metros * Consumo / NULLIF(1 - (Sizing / 100), 0)) / 1000 AS TejeduriaKg
        FROM TEJEDURIA_RAW
        GROUP BY DT_BASE_PRODUCAO
      ),
      RES_IND AS (
        SELECT R."DT_MOV" AS DT_MOV, SUM(${residuosNum}) AS ResiduosKg
        FROM tb_residuos_indigo R
        WHERE btrim(R."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY R."DT_MOV"
      ),
      RES_TEJ AS (
        SELECT RS."DT_MOV" AS DT_MOV, SUM(${residuosTejNum}) AS ResiduosTejeduriaKg
        FROM tb_residuos_por_sector RS
        WHERE btrim(RS."DESCRICAO") = 'ESTOPA AZUL TEJEDURÍA'
        GROUP BY RS."DT_MOV"
      ),
      RES_PRENSA AS (
        SELECT RP."DT_MOV" AS DT_MOV, SUM(${residuosPrensNum}) AS ResiduosPrensadaKg
        FROM tb_residuos_por_sector RP
        WHERE btrim(RP."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY RP."DT_MOV"
      ),
      ANUDADOS AS (
        SELECT ${parDateExpr} AS DT_BASE_PRODUCAO, COUNT(*)::int AS AnudadosCount
        FROM tb_paradas
        WHERE ${sqlParseNumber(parMotivoExpr)} = 101
        GROUP BY ${parDateExpr}
      ),
      ALL_DATES AS (
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_IND
        UNION
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_IND
        UNION
        SELECT DT_MOV AS fecha FROM RES_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_PRENSA
      )
      SELECT
        D.fecha AS "DT_BASE_PRODUCAO",
        COALESCE(PI.TotalMetros, 0) AS "TotalMetros",
        COALESCE(PI.TotalKg, 0) AS "TotalKg",
        COALESCE(RI.ResiduosKg, 0) AS "ResiduosKg",
        COALESCE(PT.TejeduriaMetros, 0) AS "TejeduriaMetros",
        COALESCE(PT.TejeduriaKg, 0) AS "TejeduriaKg",
        COALESCE(RT.ResiduosTejeduriaKg, 0) AS "ResiduosTejeduriaKg",
        COALESCE(A.AnudadosCount, 0) AS "AnudadosCount",
        COALESCE(RP.ResiduosPrensadaKg, 0) AS "ResiduosPrensadaKg"
      FROM ALL_DATES D
      LEFT JOIN PRODUCCION_IND PI ON PI.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN PRODUCCION_TEJ PT ON PT.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN RES_IND RI ON RI.DT_MOV = D.fecha
      LEFT JOIN RES_TEJ RT ON RT.DT_MOV = D.fecha
      LEFT JOIN RES_PRENSA RP ON RP.DT_MOV = D.fecha
      LEFT JOIN ANUDADOS A ON A.DT_BASE_PRODUCAO = D.fecha
      ${dateFilter}
      ORDER BY ${dateExpr} ASC NULLS LAST
    `

    const result = await query(sql, params, 'residuos-indigo-tejeduria')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-tejeduria:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "PARTIDA" AS "PARTIDA",
        "ROLADA" AS "ROLADA",
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        "URDUME" AS "URDUME",
        "PE DE ROLO" AS "PE DE ROLO",
        "INDIGO" AS "INDIGO",
        "GAIOLA" AS "GAIOLA",
        "OBS" AS "OBS"
      FROM tb_residuos_indigo
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos-sector', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "OBS" AS "OBS"
      FROM tb_residuos_por_sector
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
        AND btrim("DESC_SETOR") = 'TECELAGEM'
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos-sector')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos-sector:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-analisis', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) AS "TotalKg"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "MOTIVO", "DESC_MOTIVO"
      HAVING SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) > 0
      ORDER BY "TotalKg" DESC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-analisis')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-analisis:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-mes', async (req, res) => {
  try {
    const sql = `
      WITH BASE AS (
        SELECT ${sqlParseDate('"DT_MOV"')} AS DT,
               ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS PESO
        FROM tb_residuos_indigo
        WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
      )
      SELECT
        to_char(DT, 'YYYY-MM') AS "Mes",
        COALESCE(ROUND(SUM(PESO)), 0)::int AS "KgResiduo"
      FROM BASE
      WHERE DT IS NOT NULL
        AND DT >= (date_trunc('month', current_date) - interval '11 months')
      GROUP BY 1
      ORDER BY 1
    `
    const result = await query(sql, [], 'residuos-indigo-estopa-por-mes')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-mes:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-dia', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "DT_MOV" AS "Fecha",
        COALESCE(ROUND(SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')})), 0)::int AS "KgResiduo"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "DT_MOV"
      ORDER BY ${sqlParseDate('"DT_MOV"')} ASC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-estopa-por-dia')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-dia:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion-indigo-resumen', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT "S" AS "S", COUNT(*)::int AS "count"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "S"
      ORDER BY "S"
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'produccion-indigo-resumen')
    res.json({ s_valores: result.rows })
  } catch (err) {
    console.error('Error en produccion-indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-indigo', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "ROLADA" AS "ROLADA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        "S" AS "S",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        ${sqlParseNumberIntl('"CAVALOS"')} AS "CAVALOS",
        "OPERADOR" AS "OPERADOR",
        "NM OPERADOR" AS "NM_OPERADOR"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-indigo:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-urdimbre', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "ARTIGO" AS "ARTIGO",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        ${sqlParseNumberIntl('"NUM_FIOS"')} AS "NUM_FIOS",
        ${sqlParseNumberIntl('"RUP FIACAO"')} AS "RUP_FIACAO",
        ${sqlParseNumberIntl('"RUP URD"')} AS "RUP_URD",
        ${sqlParseNumberIntl('"RUP OPER"')} AS "RUP_OPER",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        "NM OPERADOR" AS "NM_OPERADOR",
        "LOTE FIACAO" AS "LOTE_FIACAO",
        "MAQ FIACAO" AS "MAQ_FIACAO",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA') 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-urdimbre')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-urdimbre:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-tecelagem', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const eficienciaNum = sqlParseNumberIntl('"EFICIENCIA"')
    const paradaTramaNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')
    const rpmNum = sqlParseNumberIntl('"RPM NOMINALTEAR"')
    const batidasNum = sqlParseNumberIntl('"BATIDAS"')

    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MIN("DT_INICIO") AS "FECHA_INICIAL",
        MAX("DT_FINAL") AS "FECHA_FINAL",
        SUM(${metragemNum}) AS "METRAGEM",
        MAX("MAQUINA") AS "MAQUINA",
        AVG(${eficienciaNum}) AS "EFICIENCIA",
        ROUND((SUM(${paradaTramaNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((SUM(${paradaUrdNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_URD_105",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERCADO") AS "NM_MERCADO",
        SUM(${batidasNum}) AS "PASADAS",
        AVG(${rpmNum}) AS "RPM"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      GROUP BY "PARTIDA", "MAQUINA", "ARTIGO", "COR", "NM MERCADO"
      ORDER BY substring("PARTIDA" from '.{6}$') ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-tecelagem', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    const cor = String(req.query.cor || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })

    const sortDir = cor.length === 4 ? 'DESC' : 'ASC'
    const sql = `
      SELECT
        "DT_BASE_PRODUCAO" AS "DT_BASE_PRODUCAO",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"PARADA TEC TRAMA"')} AS "PARADA_TRAMA",
        ${sqlParseNumberIntl('"PARADA TEC URDUME"')} AS "PARADA_URDUME",
        ${sqlParseNumberIntl('"EFICIENCIA"')} AS "EFICIENCIA",
        ROUND((${sqlParseNumberIntl('"PARADA TEC TRAMA"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((${sqlParseNumberIntl('"PARADA TEC URDUME"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_URD_105",
        ${sqlParseNumberIntl('"BATIDAS"')} AS "BATIDAS",
        ${sqlParseNumberIntl('"RPM NOMINALTEAR"')} AS "RPM",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        "NM MERCADO" AS "NM_MERCADO",
        "MAQUINA" AS "MAQUINA",
        "GRUPO TEAR" AS "GRUPO_TEAR",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' AND "PARTIDA" = $1
      ORDER BY ${sqlParseDate('"DT_BASE_PRODUCAO"')} ${sortDir}, "TURNO" ${sortDir}
    `

    const result = await query(sql, [partida], 'consulta-partida-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-calidad', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MAX("ST IND") AS "ST_IND",
        MAX("REPROCESSO") AS "REPROCESSO",
        MAX("TEAR") AS "TEAR",
        SUM(${metragemNum}) AS "METRAGEM_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(CASE WHEN "QUALIDADE" NOT ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA",
        SUM(CASE WHEN "GRP_DEF" = 'HIL' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_HIL",
        SUM(CASE WHEN "GRP_DEF" = 'IND' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_IND",
        SUM(CASE WHEN "GRP_DEF" = 'TE' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TE",
        SUM(CASE WHEN "GRP_DEF" = 'TEF' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TEF",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERC") AS "NM_MERCADO",
        MAX("TRAMA") AS "TRAMA"
      FROM tb_calidad
      WHERE (LTRIM("ROLADA", '0') = LTRIM($1, '0') OR LTRIM(substring(right("PARTIDA", 6) from 1 for 4), '0') = LTRIM($1, '0'))
      GROUP BY "PARTIDA", "TEAR", "ARTIGO", "COR", "NM MERC", "TRAMA"
      ORDER BY "PARTIDA" ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-calidad', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })
    const sql = `
      SELECT
        "GRP_DEF" AS "GRP_DEF",
        "COD_DE" AS "COD_DE",
        "DEFEITO" AS "DEFEITO",
        ${sqlParseNumber('"METRAGEM"')} AS "METRAGEM",
        "QUALIDADE" AS "QUALIDADE",
        "HORA" AS "HORA",
        "EMENDAS" AS "EMENDAS",
        "PEÇA" AS "PECA",
        "ETIQUETA" AS "ETIQUETA",
        ${sqlParseNumber('"LARGURA"')} AS "LARGURA",
        ${sqlParseNumber('"PONTUACAO"')} AS "PONTUACAO",
        "REVISOR FINAL" AS "REVISOR_FINAL"
      FROM tb_calidad
      WHERE "PARTIDA" = $1
      ORDER BY "HORA" ASC
    `
    const result = await query(sql, [partida], 'consulta-partida-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

async function getSeguimientoRoladasData(fechaInicio, fechaFin) {
  // Obtener columnas de tb_produccion para detección dinámica de MAQ y LOTE
  const produccionColumns = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
    [],
    'tb-produccion-columns-seguimiento'
  );
  const prodCols = new Map(
    (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
  );
  
  const maqKey = ['maq  fiacao', 'maq fiacao', 'maquina'].find((c) => prodCols.has(c));
  const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c));
  const maqCol = maqKey ? prodCols.get(maqKey) : null;
  const loteCol = loteKey ? prodCols.get(loteKey) : null;
  const maqExpr = maqCol ? quoteIdent(maqCol) : 'NULL::text';
  const loteExpr = loteCol ? quoteIdent(loteCol) : 'NULL::text';

  const metragemNum = sqlParseNumberIntl('"METRAGEM"')
  const rupturasNum = sqlParseNumberIntl('"RUPTURAS"')
  const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
  const velocNum = sqlParseNumberIntl('"VELOC"')
  const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
  const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
  const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
  const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

  const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
  const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
  const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

  const sql = `
    WITH IND AS (
      SELECT
        "ROLADA" AS ROLADA,
        MAX("DT_BASE_PRODUCAO") AS FECHA,
        MAX("ARTIGO") AS BASE,
        string_agg(DISTINCT "COR", ', ') AS COLOR,
        SUM(${metragemNum}) AS MTS_IND,
        SUM(${rupturasNum}) AS RUPTURAS,
        SUM(${cavalosNum}) AS CAV,
        MAX(${velocNum}) AS VEL_NOM,
        SUM(${metragemNum} * COALESCE(${velocNum}, 0)) / NULLIF(SUM(${metragemNum}), 0) AS VEL_PROM
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND "FILIAL" = '05'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "ROLADA"
    ),
    URD AS (
      SELECT
        "ROLADA" AS ROLADA,
        string_agg(
          DISTINCT CAST(
            NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
          )::text,
          ', '
        ) AS MAQ_OE,
        string_agg(
          DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
          ', '
        ) AS LOTE,
        SUM(${metragemNum}) AS URDIDORA_METROS,
        SUM(${rupturasNum}) AS URDIDORA_ROTURAS,
        MAX(${sqlParseNumberIntl('"NUM_FIOS"')}) AS NUM_FIOS
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    TEC AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${metragemNum}) AS MTS_CRUDOS,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0))::numeric / NULLIF(SUM(COALESCE(${puntos100Num}, 0)), 0)) * 100, 2) AS EFI_TEJ,
        SUM(${parTraNum}) AS PARADA_TRAMA,
        SUM(${parUrdNum}) AS PARADA_URD
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM'
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    CAL AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${calMetragemNum}) AS MTS_CAL,
        SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) AS METROS_1ERA,
        SUM(COALESCE(${calPontuacaoNum}, 0)) AS PONTOS,
        AVG(${calLarguraNum}) AS LARGURA
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    )
    SELECT
      IND.ROLADA AS "ROLADA",
      URD.MAQ_OE AS "MAQ_OE",
      URD.LOTE AS "LOTE",
      URD.URDIDORA_METROS AS "URDIDORA_METROS",
      URD.URDIDORA_ROTURAS AS "URDIDORA_ROTURAS",
      URD.NUM_FIOS AS "NUM_FIOS",
      IND.FECHA AS "FECHA",
      IND.BASE AS "BASE",
      IND.COLOR AS "COLOR",
      IND.MTS_IND AS "MTS_IND",
      ROUND(((IND.RUPTURAS * 1000) / NULLIF(IND.MTS_IND, 0))::numeric, 2) AS "R103",
      IND.CAV AS "CAV",
      IND.VEL_NOM AS "VEL_NOM",
      IND.VEL_PROM AS "VEL_PROM",
      TEC.MTS_CRUDOS AS "MTS_CRUDOS",
      TEC.EFI_TEJ AS "EFI_TEJ",
      ROUND(((TEC.PARADA_URD * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RU105",
      ROUND(((TEC.PARADA_TRAMA * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RT105",
      CAL.MTS_CAL AS "MTS_CAL",
      ROUND(((CAL.METROS_1ERA / NULLIF(CAL.MTS_CAL, 0)) * 100)::numeric, 1) AS "CAL_PERCENT",
      ROUND(((CAL.PONTOS * 100) / NULLIF((CAL.MTS_CAL * NULLIF(CAL.LARGURA, 0) / 100), 0))::numeric, 1) AS "PTS_100M2",
      IND.RUPTURAS AS "RUPTURAS"
    FROM IND
    LEFT JOIN URD ON URD.ROLADA = IND.ROLADA
    LEFT JOIN TEC ON TEC.ROLADA = IND.ROLADA
    LEFT JOIN CAL ON CAL.ROLADA = IND.ROLADA
    ORDER BY IND.ROLADA::int ASC
  `

  const result = await query(sql, [fechaInicio, fechaFin], 'seguimiento-roladas')
  const datos = result.rows || []

  const totales = datos.reduce(
    (acc, row) => {
      const mtsInd = Number(row.MTS_IND) || 0
      const mtsUrd = Number(row.URDIDORA_METROS) || 0
      const mtsTej = Number(row.MTS_CRUDOS) || 0
      const mtsCal = Number(row.MTS_CAL) || 0
      const rupturas = Number(row.RUPTURAS) || 0

      acc.TOTAL_ROLADAS += 1
      acc.MTS_IND += mtsInd
      acc.RUPTURAS += rupturas
      acc.CAV += Number(row.CAV) || 0
      acc.URDIDORA_METROS += mtsUrd
      acc.URDIDORA_ROTURAS += Number(row.URDIDORA_ROTURAS) || 0
      acc.NUM_FIOS_SUM += Number(row.NUM_FIOS) || 0
      acc.NUM_FIOS_COUNT += row.NUM_FIOS ? 1 : 0
      acc.MTS_CRUDOS += mtsTej
      acc.MTS_CAL += mtsCal

      acc.VEL_PROM_NUM += (Number(row.VEL_PROM) || 0) * mtsInd
      acc.EFI_TEJ_NUM += (Number(row.EFI_TEJ) || 0) * mtsTej
      acc.RU105_NUM += (Number(row.RU105) || 0) * mtsTej
      acc.RT105_NUM += (Number(row.RT105) || 0) * mtsTej
      acc.CAL_NUM += (Number(row.CAL_PERCENT) || 0) * mtsCal
      acc.PTS_NUM += (Number(row.PTS_100M2) || 0) * mtsCal
      return acc
    },
    {
      TOTAL_ROLADAS: 0,
      MTS_IND: 0,
      RUPTURAS: 0,
      CAV: 0,
      URDIDORA_METROS: 0,
      URDIDORA_ROTURAS: 0,
      NUM_FIOS_SUM: 0,
      NUM_FIOS_COUNT: 0,
      MTS_CRUDOS: 0,
      MTS_CAL: 0,
      VEL_PROM_NUM: 0,
      EFI_TEJ_NUM: 0,
      RU105_NUM: 0,
      RT105_NUM: 0,
      CAL_NUM: 0,
      PTS_NUM: 0
    }
  )

  const totalesMes = {
    TOTAL_ROLADAS: totales.TOTAL_ROLADAS,
    MTS_IND: totales.MTS_IND,
    R103: totales.MTS_IND ? (totales.RUPTURAS * 1000) / totales.MTS_IND : null,
    CAV: totales.CAV,
    VEL_PROM: totales.MTS_IND ? totales.VEL_PROM_NUM / totales.MTS_IND : null,
    URDIDORA_METROS: totales.URDIDORA_METROS,
    URDIDORA_ROTURAS: totales.URDIDORA_ROTURAS,
    NUM_FIOS: totales.NUM_FIOS_COUNT ? totales.NUM_FIOS_SUM / totales.NUM_FIOS_COUNT : null,
    MTS_CRUDOS: totales.MTS_CRUDOS,
    EFI_TEJ: totales.MTS_CRUDOS ? totales.EFI_TEJ_NUM / totales.MTS_CRUDOS : null,
    RU105: totales.MTS_CRUDOS ? totales.RU105_NUM / totales.MTS_CRUDOS : null,
    RT105: totales.MTS_CRUDOS ? totales.RT105_NUM / totales.MTS_CRUDOS : null,
    MTS_CAL: totales.MTS_CAL,
    CAL_PERCENT: totales.MTS_CAL ? totales.CAL_NUM / totales.MTS_CAL : null,
    PTS_100M2: totales.MTS_CAL ? totales.PTS_NUM / totales.MTS_CAL : null
  }

  return { datos, totales: totalesMes }
}

app.get('/api/seguimiento-roladas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const payload = await getSeguimientoRoladasData(fechaInicio, fechaFin)
    res.json(payload)
  } catch (err) {
    console.error('Error en seguimiento-roladas:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/seguimiento-roladas-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const { datos, totales } = await getSeguimientoRoladasData(fechaInicio, fechaFin)

    const lotes = Array.from(
      new Set(
        (datos || [])
          .map((d) => String(d.LOTE || '').split(',')[0].trim())
          .filter(Boolean)
      )
    )

    let hviMap = {}
    if (lotes.length > 0) {
      // Use logical comparison for LOTE_FIAC (strip leading zeros in DB)
      const sql = `
        SELECT
          "LOTE" AS "LOTE",
          "LOTE_FIAC" AS "LOTE_FIAC",
          "MISTURA" AS "MISTURA",
          "COR" AS "COR",
          "DT_ENTRADA_PROD" AS "FECHA_INGRESO",
          ${sqlParseNumber('"SCI"')} AS "SCI",
          ${sqlParseNumber('"MST"')} AS "MST",
          ${sqlParseNumber('"MIC"')} AS "MIC",
          ${sqlParseNumber('"MAT"')} AS "MAT",
          ${sqlParseNumber('"UHML"')} AS "UHML",
          ${sqlParseNumber('"UI"')} AS "UI",
          ${sqlParseNumber('"SF"')} AS "SF",
          ${sqlParseNumber('"STR"')} AS "STR",
          ${sqlParseNumber('"ELG"')} AS "ELG",
          ${sqlParseNumber('"RD"')} AS "RD",
          ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
          ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
          ${sqlParseNumber('"TrAR"')} AS "TrAR",
          ${sqlParseNumber('"TRID"')} AS "TRID",
          CASE 
            WHEN "PESO" IS NULL OR "PESO" = '' THEN 0
            ELSE CAST(REPLACE(REPLACE("PESO", '.', ''), ',', '.') AS NUMERIC)
          END AS "PESO"
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "MISTURA" IS NOT NULL
          AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)::TEXT = ANY($1::text[])
      `
      
      const hviRows = await query(sql, [lotes], 'seguimiento-roladas-fibra-hvi')
      
      // Use numeric/short string key for map
      hviMap = hviRows.rows.reduce((acc, row) => {
        // Normalize keys to short string (e.g. "104")
        // ONLY use LOTE_FIAC as key, matching legacy system
        const k2 = String(row.LOTE_FIAC || '').replace(/^0+/, '').trim()
        
        // Prefer LOTE_FIAC (normalized) as canonical key
        const primaryKey = k2
        
        if (!primaryKey) return acc


        if (!acc[primaryKey]) {
          acc[primaryKey] = { 
             ...row, 
             MISTURA: [],
             FECHA_INGRESO: [],
             _peso: 0, 
             _sum: {},
             _dist: {},
             _colors: {}
          }
        }
        
        const target = acc[primaryKey]
        
        // Collect Metadata (Set-like behavior) WITH normalization
        if (row.MISTURA) {
          const m = String(row.MISTURA).replace(/^0+/, '')
          if (m && !target.MISTURA.includes(m)) target.MISTURA.push(m)
        }
        if (row.FECHA_INGRESO) {
          const d = row.FECHA_INGRESO instanceof Date
            ? row.FECHA_INGRESO.toISOString().split('T')[0]
            : String(row.FECHA_INGRESO).split('T')[0]
          if (d && !target.FECHA_INGRESO.includes(d)) target.FECHA_INGRESO.push(d)
        }

        const peso = Number(row.PESO) || 0
        target._peso += peso

        // Color weights
        const cor = String(row.COR || '').toUpperCase().trim()
        if (cor) {
             target._colors[cor] = (target._colors[cor] || 0) + peso
        }

        for (const k of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
          const val = Number(row[k])
          if (!isNaN(val)) {
            target._sum[k] = (target._sum[k] || 0) + val * peso
            // Collect distribution for stats
            if (!target._dist[k]) target._dist[k] = []
            target._dist[k].push(val)
          }
        }
        
        // Ensure strictly padded or unpadded lookups work
        // if (k1) acc[k1] = target // Removed to ensure we STRICTLY use LOTE_FIAC
        if (k2) acc[k2] = target
        
        return acc
      }, {})

      // Finalize weighted averages in the map items
      // Note: multiple keys point to the same object, so calculate once per object
      const processedObjects = new Set()
      for (const key of Object.keys(hviMap)) {
        const item = hviMap[key]
        if (processedObjects.has(item)) continue
        processedObjects.add(item)

        const peso = item._peso || 0
        for (const k of Object.keys(item._sum)) {
          item[k] = peso ? item._sum[k] / peso : null

          // Calculate MIN, MAX, SIGMA
          const vals = item._dist ? (item._dist[k] || []) : []
          if (vals.length > 0) {
              item[`${k}_MIN`] = Math.min(...vals)
              item[`${k}_MAX`] = Math.max(...vals)
              const n = vals.length
              const simpleMean = vals.reduce((a,b)=>a+b,0)/n
              const variance = vals.reduce((a,b) => a + Math.pow(b - simpleMean, 2), 0) / (n > 1 ? n - 1 : 1)
              item[`${k}_SIGMA`] = Math.sqrt(variance)
          } else {
              item[`${k}_MIN`] = null
              item[`${k}_MAX`] = null
              item[`${k}_SIGMA`] = null
          }
        }
        
        // Calculate Colors
        if (peso > 0 && item._colors) {
            item.COLOR_BCO_PCT = (item._colors['BCO'] || 0) / peso * 100
            item.COLOR_GRI_PCT = (item._colors['GRI'] || 0) / peso * 100
            item.COLOR_LG_PCT = (item._colors['LG'] || 0) / peso * 100
            item.COLOR_AMA_PCT = (item._colors['AMA'] || 0) / peso * 100
            item.COLOR_LA_PCT = (item._colors['LA'] || 0) / peso * 100
        }
      }
    }

    const datosConFibra = (datos || []).map((row) => {
      // Find all HVI data for comma-separated lotes
      const loteKeys = String(row.LOTE || '').split(',').map(s => s.trim().replace(/^0+/, '')).filter(Boolean)
      
      // Collect valid hvi objects
      const found = loteKeys.map(k => hviMap[k]).filter(item => item && item.SCI !== undefined)
      
      const resultHvi = {
        MISTURA: null, FECHA_INGRESO: null,
        SCI: null, MST: null, MIC: null, MAT: null, UHML: null, UI: null, 
        SF: null, STR: null, ELG: null, RD: null, PLUS_B: null, 
        TrCNT: null, TrAR: null, TRID: null
      }

      if (found.length > 0) {
        // Aggregate metadata from all matched lote items
        const allMisturas = new Set()
        const allFechas = new Set()
        
        found.forEach(item => {
             if (Array.isArray(item.MISTURA)) item.MISTURA.forEach(m => allMisturas.add(m))
             else if (item.MISTURA) allMisturas.add(item.MISTURA)

             if (Array.isArray(item.FECHA_INGRESO)) item.FECHA_INGRESO.forEach(f => allFechas.add(f))
             else if (item.FECHA_INGRESO) allFechas.add(item.FECHA_INGRESO)
        })
        
        resultHvi.MISTURA = Array.from(allMisturas).join(',')
        
        // Sort dates to pick the earliest? Or just join them?
        // Reference uses MIN(FECHA_INGRESO)
        const sortedFechas = Array.from(allFechas).sort((a,b) => {
             const ma = a.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             const mb = b.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             if (ma && mb) {
                 const ka = `${ma[3]}${ma[2]}${ma[1]}`
                 const kb = `${mb[3]}${mb[2]}${mb[1]}`
                 return ka.localeCompare(kb)
             }
             return a.localeCompare(b)
        })
        resultHvi.FECHA_INGRESO = sortedFechas[0] || null

        // Average the numeric fields
        const keys = ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']
        keys.forEach(k => {
          const validValues = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
          if (validValues.length > 0) {
             const sum = validValues.reduce((a,b) => a+b, 0)
             resultHvi[k] = sum / validValues.length
          }

          // Min of Mins
          const mins = found.map(f => f[`${k}_MIN`]).filter(v => v !== null && v !== undefined)
          if (mins.length > 0) resultHvi[`${k}_MIN`] = Math.min(...mins)

          // Max of Maxs
          const maxs = found.map(f => f[`${k}_MAX`]).filter(v => v !== null && v !== undefined)
          if (maxs.length > 0) resultHvi[`${k}_MAX`] = Math.max(...maxs)

          // Avg of Sigmas (Simple approximation)
          const sigmas = found.map(f => f[`${k}_SIGMA`]).filter(v => v !== null && v !== undefined)
          if (sigmas.length > 0) resultHvi[`${k}_SIGMA`] = sigmas.reduce((a,b)=>a+b,0) / sigmas.length
        })

        // Colors
        const colors = ['COLOR_BCO_PCT', 'COLOR_GRI_PCT', 'COLOR_LG_PCT', 'COLOR_AMA_PCT', 'COLOR_LA_PCT']
        colors.forEach(k => {
            const vals = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
            if (vals.length > 0) resultHvi[k] = vals.reduce((a,b) => a+b, 0) / vals.length
        })
      }

      return {
        ...row,
        ...resultHvi
      }
    })

    res.json({ datos: datosConFibra, totales })
  } catch (err) {
    console.error('Error en seguimiento-roladas-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/hvi-estadisticas-mezcla', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'hvi-estadisticas-mezcla')).rows
    const stats = {}

    for (const row of rows) {
      const mistura = String(row.MISTURA || '').trim()
      if (!mistura) continue
      if (!stats[mistura]) stats[mistura] = { N: 0 }
      const target = stats[mistura]
      target.N += 1

      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        const k = key === 'PLUS_B' ? 'PLUS_B' : key
        if (!target[k]) target[k] = { values: [] }
        target[k].values.push(val)
      }
    }

    for (const mistura of Object.keys(stats)) {
      const target = stats[mistura]
      for (const key of Object.keys(target)) {
        if (key === 'N') continue
        const vals = target[key].values || []
        if (!vals.length) {
          target[key] = { MIN: null, MAX: null, DESV: null }
          continue
        }
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        const desv = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length)
        target[key] = { MIN: min, MAX: max, DESV: desv }
      }
    }

    res.json({ stats })
  } catch (err) {
    console.error('Error en hvi-estadisticas-mezcla:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/calidad-fibra-mistura', async (req, res) => {
  try {
    const misturaRaw = String(req.query.mistura || '').trim()
    if (!misturaRaw) return res.status(400).json({ error: 'mistura requerida' })

    const mistura = misturaRaw.padStart(10, '0')
    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        "SEQ" AS SEQ,
        "DT_ENTRADA_PROD" AS "DT_ENTRADA_PROD",
        "HR_ENTRADA_PROD" AS "HR_ENTRADA_PROD",
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST' AND ("MISTURA" = $1 OR "MISTURA" = $2)
    `

    const rows = (await query(sql, [misturaRaw, mistura], 'calidad-fibra-mistura')).rows
    if (!rows.length) return res.json({ mistura: misturaRaw, seqs: [], totales: {} })

    const seqs = {}
    const totales = { sumPeso: 0, sum: {} }

    for (const row of rows) {
      const seq = String(row.SEQ || '').trim()
      if (!seqs[seq]) {
        seqs[seq] = { SEQ: seq, DT_ENTRADA_PROD: row.DT_ENTRADA_PROD, HR_ENTRADA_PROD: row.HR_ENTRADA_PROD, sumPeso: 0, sum: {} }
      }
      const peso = Number(row.PESO) || 0
      seqs[seq].sumPeso += peso
      totales.sumPeso += peso
      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        seqs[seq].sum[key] = (seqs[seq].sum[key] || 0) + val * peso
        totales.sum[key] = (totales.sum[key] || 0) + val * peso
      }
    }


    const seqsOut = Object.values(seqs).map((s) => {
      const out = { SEQ: s.SEQ, DT_ENTRADA_PROD: s.DT_ENTRADA_PROD, HR_ENTRADA_PROD: s.HR_ENTRADA_PROD }
      for (const key of Object.keys(s.sum)) {
        out[key === 'PLUS_B' ? '+b' : key] = s.sumPeso ? s.sum[key] / s.sumPeso : null
      }
      return out
    })

    const totalesOut = {}
    for (const key of Object.keys(totales.sum)) {
      totalesOut[key === 'PLUS_B' ? '+b' : key] = totales.sumPeso ? totales.sum[key] / totales.sumPeso : null
    }

    res.json({ mistura: misturaRaw, seqs: seqsOut, totales: totalesOut })
  } catch (err) {
    console.error('Error en calidad-fibra-mistura:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-calidad', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const sql = `
      SELECT
        ${sqlParseDate('"DAT_PROD"')} AS "FECHA_DB",
        "DAT_PROD" AS "FECHA",
        SUM(${metragemNum}) AS "METROS_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(COALESCE(${pontuacaoNum}, 0)) AS "PONTOS",
        AVG(${larguraNum}) AS "LARGURA"
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND ${sqlParseDate('"DAT_PROD"')} BETWEEN $1::date AND $2::date
      GROUP BY "FECHA_DB", "FECHA"
      ORDER BY "FECHA_DB" ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-calidad')).rows
    const datos = rows.map((r) => {
      const calPct = r.METROS_TOTAL ? (Number(r.METROS_1ERA) / Number(r.METROS_TOTAL)) * 100 : null
      const pts100 = r.METROS_TOTAL && r.LARGURA
        ? (Number(r.PONTOS) * 100) / (Number(r.METROS_TOTAL) * Number(r.LARGURA) / 100)
        : null
      return {
        FECHA_DB: r.FECHA_DB,
        FECHA: r.FECHA,
        CALIDAD_PERCENT: calPct,
        PTS_100M2: pts100,
        METROS_1ERA: r.METROS_1ERA,
        METROS_TOTAL: r.METROS_TOTAL,
        ROLLOS: null
      }
    })

    const rangos = {}
    for (const key of ['CALIDAD_PERCENT', 'PTS_100M2', 'METROS_1ERA', 'METROS_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-produccion', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const rupturasNum = sqlParseNumber('"RUPTURAS"')
    const numFiosNum = sqlParseNumber('"NUM_FIOS"')
    const velocNum = sqlParseNumber('"VELOC"')
    const eficienciaClean = `regexp_replace("EFICIENCIA", '[^0-9,.-]', '', 'g')`
    const eficienciaNum = sqlParseNumberIntl(eficienciaClean)
    const puntosLidosNum = sqlParseNumber('"PONTOS_LIDOS"')
    const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumber('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumber('"PARADA TEC URDUME"')

    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_BASE_PRODUCAO"')} AS FECHA_DB,
          "DT_BASE_PRODUCAO" AS FECHA,
          "SELETOR" AS SELETOR,
          ${metragemNum} AS METRAGEM,
          ${rupturasNum} AS RUPTURAS,
          ${numFiosNum} AS NUM_FIOS,
          ${velocNum} AS VELOC,
          CASE
            WHEN ${eficienciaNum} IS NULL OR ${eficienciaNum} = 0 THEN
              (${puntosLidosNum} * 100) / NULLIF(${puntos100Num}, 0)
            ELSE ${eficienciaNum}
          END AS EFICIENCIA,
          ${parTraNum} AS PARADA_TRAMA,
          ${parUrdNum} AS PARADA_URD
        FROM tb_produccion
        WHERE "FILIAL" = '05'
          AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (RUPTURAS * 1000000) ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (METRAGEM * NUM_FIOS) ELSE 0 END), 0) AS "RU106_URDIDORA",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END) AS "METROS_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN RUPTURAS ELSE 0 END) * 1000
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "R103_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM * VELOC ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "VELOCIDAD_INDIGO",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM * EFICIENCIA ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END), 0) AS "EFICIENCIA_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_URD ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RU105_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_TRAMA ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RT105_TELAR"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-produccion')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      RU106_URDIDORA: r.RU106_URDIDORA,
      METROS_INDIGO: r.METROS_INDIGO,
      R103_INDIGO: r.R103_INDIGO,
      VELOCIDAD_INDIGO: r.VELOCIDAD_INDIGO,
      EFICIENCIA_TELAR: r.EFICIENCIA_TELAR,
      RU105_TELAR: r.RU105_TELAR,
      RT105_TELAR: r.RT105_TELAR
    }))

    const rangos = {}
    for (const key of ['RU106_URDIDORA','METROS_INDIGO','R103_INDIGO','VELOCIDAD_INDIGO','EFICIENCIA_TELAR','RU105_TELAR','RT105_TELAR']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-produccion:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const pesoNum = sqlParseNumber('"PESO"')
    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_ENTRADA_PROD"')} AS FECHA_DB,
          "DT_ENTRADA_PROD" AS FECHA,
          ${pesoNum} AS PESO,
          ${sqlParseNumber('"SCI"')} AS SCI,
          ${sqlParseNumber('"MIC"')} AS MIC,
          ${sqlParseNumber('"MAT"')} AS MAT,
          ${sqlParseNumber('"UHML"')} AS UHML,
          ${sqlParseNumber('"UI"')} AS UI,
          ${sqlParseNumber('"SF"')} AS SF,
          ${sqlParseNumber('"STR"')} AS STR,
          ${sqlParseNumber('"ELG"')} AS ELG,
          ${sqlParseNumber('"RD"')} AS RD,
          ${sqlParseNumber('"PLUS_B"')} AS PLUS_B
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(PESO) AS "PESO_TOTAL",
        SUM(SCI * PESO) / NULLIF(SUM(PESO), 0) AS "SCI",
        SUM(MIC * PESO) / NULLIF(SUM(PESO), 0) AS "MIC",
        SUM(MAT * PESO) / NULLIF(SUM(PESO), 0) AS "MAT",
        SUM(UHML * PESO) / NULLIF(SUM(PESO), 0) AS "UHML",
        SUM(UI * PESO) / NULLIF(SUM(PESO), 0) AS "UI",
        SUM(SF * PESO) / NULLIF(SUM(PESO), 0) AS "SF",
        SUM(STR * PESO) / NULLIF(SUM(PESO), 0) AS "STR",
        SUM(ELG * PESO) / NULLIF(SUM(PESO), 0) AS "ELG",
        SUM(RD * PESO) / NULLIF(SUM(PESO), 0) AS "RD",
        SUM(PLUS_B * PESO) / NULLIF(SUM(PESO), 0) AS "PLUS_B"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-fibra')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      SCI: r.SCI,
      MIC: r.MIC,
      MAT: r.MAT,
      UHML: r.UHML,
      UI: r.UI,
      SF: r.SF,
      STR: r.STR,
      ELG: r.ELG,
      RD: r.RD,
      PLUS_B: r.PLUS_B,
      PESO_TOTAL: r.PESO_TOTAL
    }))

    const rangos = {}
    for (const key of ['SCI','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','PESO_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/informe-produccion-indigo', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns-informe'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const maqKey = ['maq  fiacao', 'maq fiacao'].find((c) => prodCols.has(c))
    const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c))
    const maqCol = maqKey ? prodCols.get(maqKey) : null
    const loteCol = loteKey ? prodCols.get(loteKey) : null
    const maqExpr = maqCol ? `p.${quoteIdent(maqCol)}` : 'NULL::text'
    const loteExpr = loteCol ? `p.${quoteIdent(loteCol)}` : 'NULL::text'
    const maqFilter = maqCol ? `${maqExpr} IS NOT NULL` : '1=1'
    const loteFilter = loteCol ? `${loteExpr} IS NOT NULL` : '1=1'

    const metragemIndNum = sqlParseNumberIntl('"METRAGEM"')
    const metragemUrdNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasIndNum = sqlParseNumberIntl('"RUPTURAS"')
    const rupturasUrdNum = sqlParseNumberIntl('p."RUPTURAS"')
    const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
    const velocNum = sqlParseNumberIntl('"VELOC"')
    const numFiosNum = sqlParseNumberIntl('"NUM_FIOS"')
    const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
    const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

    const makeTimestampExpr = (dateCol, timeCol) => {
      const dateExpr = sqlParseDate(dateCol)
      return `(
        CASE
          WHEN ${dateExpr} IS NULL THEN NULL
          ELSE to_timestamp(
            to_char(${dateExpr}, 'YYYY-MM-DD') || ' ' || COALESCE(
              CASE
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]$' THEN ${timeCol} || ':00'
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$' THEN ${timeCol}
                ELSE NULL
              END,
              '00:00:00'
            ),
            'YYYY-MM-DD HH24:MI:SS'
          )
        END
      )`
    }

    const urdStartTs = makeTimestampExpr('p."DT_INICIO"', 'p."HORA_INICIO"')
    const urdEndTs = makeTimestampExpr('p."DT_FINAL"', 'p."HORA_FINAL"')
    const indStartTs = makeTimestampExpr('"DT_INICIO"', '"HORA_INICIO"')
    const indEndTs = makeTimestampExpr('"DT_FINAL"', '"HORA_FINAL"')

    const sql = `
      WITH RoladaBase AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          MIN(${sqlParseDate('"DT_INICIO"')}) AS FECHA_INICIO,
          "ARTIGO" AS ARTIGO
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR", "ARTIGO"
      ),
      NumFiosPorRolada AS (
        SELECT
          ROLADA,
          SUM(NUM_FIOS_MAX) AS NUM_FIOS_SUM
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            "PARTIDA" AS PARTIDA,
            MAX(${numFiosNum}) AS NUM_FIOS_MAX
          FROM tb_produccion
          WHERE "SELETOR" = 'URDIDEIRA'
            AND "ROLADA" IS NOT NULL
            AND "PARTIDA" IS NOT NULL
            AND "NUM_FIOS" IS NOT NULL
          GROUP BY "ROLADA", "PARTIDA"
        ) AS nf
        GROUP BY ROLADA
      ),
      UrdideiraMetrics AS (
        SELECT
          p."ROLADA" AS ROLADA,
          MIN(${sqlParseDate('p."DT_INICIO"')}) AS FECHA_URDIDORA,
          string_agg(
            DISTINCT CAST(
              NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
            )::text,
            ', '
          ) AS MAQ_OE,
          string_agg(
            DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
            ', '
          ) AS LOTE,
          SUM(${metragemUrdNum}) / NULLIF(COUNT(DISTINCT p."PARTIDA"), 0) AS METRAGEM_AVG,
          SUM(${rupturasUrdNum}) AS RUPTURAS_TOTAL,
          MIN(${urdStartTs}) AS INICIO_MIN,
          MAX(${urdEndTs}) AS FIN_MAX
        FROM tb_produccion p
        WHERE p."SELETOR" = 'URDIDEIRA'
          AND p."ROLADA" IS NOT NULL
          AND p."ROLADA" <> ''
          AND ${maqFilter}
          AND ${loteFilter}
        GROUP BY p."ROLADA"
      ),
      RoladaMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${rupturasIndNum}) AS RUPTURAS_TOTAL,
          SUM(${cavalosNum}) AS CAVALOS_TOTAL,
          SUM(${metragemIndNum} * COALESCE(${velocNum}, 0)) AS VELOC_POND_NUM,
          MIN(${indStartTs}) AS INICIO_MIN,
          MAX(${indEndTs}) AS FIN_MAX
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR"
      ),
      RoladaCalidad AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          COUNT(DISTINCT CASE WHEN "S" = 'N' THEN "PARTIDA" || '_' || "S" END) AS N_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'P' THEN "PARTIDA" || '_' || "S" END) AS P_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'Q' THEN "PARTIDA" || '_' || "S" END) AS Q_COUNT,
          COUNT(DISTINCT "PARTIDA" || '_' || "S") AS TOTAL_COUNT
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
          AND "PARTIDA" IS NOT NULL
          AND "S" IS NOT NULL
        GROUP BY "ROLADA", "COR"
      ),
      TecelagemMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${pontosLidosNum}) AS PONTOS_LIDOS_TOTAL,
          SUM(${pontos100Num}) AS PONTOS_100_TOTAL,
          SUM(${parTraNum}) AS PARADA_TRAMA_TOTAL,
          SUM(${parUrdNum}) AS PARADA_URDUME_TOTAL
        FROM tb_produccion
        WHERE "SELETOR" = 'TECELAGEM'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA"
      ),
      CalidadMetrics AS (
        SELECT
          CAL_M.ROLADA,
          CAL_M.MTS_CAL,
          CAL_M.CAL_PERCENT,
          ROUND(
            ((PTS.PUNTOS * 100.0) / NULLIF((PTS.MTS_1ERA * PTS.ANC_POND), 0))::numeric,
            1
          ) AS PTS_100M2
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_CAL,
            ROUND(
              (SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) * 100.0) /
              NULLIF(SUM(${calMetragemNum}), 0),
              1
            ) AS CAL_PERCENT
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS CAL_M
        LEFT JOIN (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_1ERA,
            SUM(${calPontuacaoNum}) AS PUNTOS,
            SUM(${calMetragemNum} * ${calLarguraNum}) / NULLIF(SUM(${calMetragemNum}), 0) / 100.0 AS ANC_POND
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND btrim("QUALIDADE") = 'PRIMEIRA'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS PTS ON CAL_M.ROLADA = PTS.ROLADA
      )
      SELECT
        rb.ROLADA AS "ROLADA",
        to_char(um.FECHA_URDIDORA, 'DD/MM/YYYY') AS "FECHA_URDIDORA",
        um.MAQ_OE AS "MAQ_OE",
        um.LOTE AS "LOTE",
        ROUND(um.METRAGEM_AVG, 3) AS "URDIDORA_M",
        um.RUPTURAS_TOTAL AS "URDIDORA_ROT_TOT",
        ROUND(
          ((CAST(um.RUPTURAS_TOTAL AS REAL) * 1000000.0) /
          NULLIF((um.METRAGEM_AVG * nf.NUM_FIOS_SUM), 0))::numeric,
          6
        ) AS "URDIDORA_ROT_106",
        CAST(EXTRACT(EPOCH FROM (um.FIN_MAX - um.INICIO_MIN)) / 60 AS INTEGER) AS "URDIDORA_TIEMPO_MIN",
        to_char(rb.FECHA_INICIO, 'DD/MM/YYYY') AS "FECHA_INDIGO",
        rb.COR AS "COR",
        rb.ARTIGO AS "ARTIGO",
        ROUND(rm.METRAGEM_TOTAL, 3) AS "METRAGEM",
        rm.RUPTURAS_TOTAL AS "RUPTURAS",
        ROUND(((CAST(rm.RUPTURAS_TOTAL AS REAL) * 1000.0) / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "ROT_103",
        ROUND(rm.CAVALOS_TOTAL, 1) AS "CAVALOS",
        ROUND((rm.VELOC_POND_NUM / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "VELOC_PROMEDIO",
        CAST(EXTRACT(EPOCH FROM (rm.FIN_MAX - rm.INICIO_MIN)) / 60 AS INTEGER) AS "TIEMPO_MINUTOS",
        COALESCE(rc.N_COUNT, 0) AS "N_COUNT",
        ROUND(((CAST(COALESCE(rc.N_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "N_PERCENT",
        COALESCE(rc.P_COUNT, 0) AS "P_COUNT",
        ROUND(((CAST(COALESCE(rc.P_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "P_PERCENT",
        COALESCE(rc.Q_COUNT, 0) AS "Q_COUNT",
        ROUND(((CAST(COALESCE(rc.Q_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "Q_PERCENT",
        ROUND(tm.METRAGEM_TOTAL, 0) AS "TECELAGEM_METROS",
        ROUND(((tm.PONTOS_LIDOS_TOTAL * 100.0) / NULLIF(tm.PONTOS_100_TOTAL, 0))::numeric, 1) AS "TECELAGEM_EFICIENCIA",
        ROUND(((tm.PARADA_TRAMA_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RT105",
        ROUND(((tm.PARADA_URDUME_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RU105",
        ROUND(cm.MTS_CAL, 0) AS "METROS_CAL",
        cm.CAL_PERCENT AS "CAL_PERCENT",
        cm.PTS_100M2 AS "PTS_100M2"
      FROM RoladaBase rb
      INNER JOIN UrdideiraMetrics um ON rb.ROLADA = um.ROLADA
      INNER JOIN NumFiosPorRolada nf ON rb.ROLADA = nf.ROLADA
      INNER JOIN RoladaMetrics rm ON rb.ROLADA = rm.ROLADA AND rb.COR = rm.COR
      LEFT JOIN RoladaCalidad rc ON rb.ROLADA = rc.ROLADA AND rb.COR = rc.COR
      LEFT JOIN TecelagemMetrics tm ON rb.ROLADA = tm.ROLADA
      LEFT JOIN CalidadMetrics cm ON rb.ROLADA = cm.ROLADA
      WHERE rb.FECHA_INICIO BETWEEN $1::date AND $2::date
      ORDER BY rb.FECHA_INICIO DESC, rb.ROLADA DESC, rb.COR
    `

    const result = await query(sql, [fechaInicio, fechaFin], 'informe-produccion-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en informe-produccion-indigo:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS PRODUCCION (Sistema de importación CSV)
// =====================================================

// PRODUCCION: Import status (estado de todos los CSVs)
app.get('/api/produccion/import-status', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)
    const status = await getImportStatus(pool, csvFolder)
    res.json(status)
  } catch (err) {
    console.error('Error en import-status:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: DB status (información básica de la base de datos)
app.get('/api/produccion/status', async (req, res) => {
  try {
    // Obtener tamaño de la base de datos
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) / (1024 * 1024) as size_mb
    `)
    
    res.json({
      database: process.env.PG_DATABASE || 'stc_produccion',
      sizeMB: Math.round(sizeResult.rows[0].size_mb),
      sizeFormatted: sizeResult.rows[0].size,
      connected: true
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar tablas específicas desactualizadas (llamado por botón "Actualizar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/update-outdated', async (req, res) => {
  try {
    const { tables, csvFolder } = req.body
    
    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: 'Se requiere un array de nombres de tablas' })
    }
    
    const csvPath = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Importando tablas específicas: ${tables.join(', ')}`)
    
    const results = await importSpecificTables(pool, tables, csvPath)
    
    res.json({ 
      success: true,
      results 
    })
  } catch (err) {
    console.error('Error en update-outdated:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de una tabla específica (ignora estado)
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-table', async (req, res) => {
  try {
    const { table, csvPath: csvPathRaw, csvFolder } = req.body
    
    if (!table) {
      return res.status(400).json({ error: 'Se requiere el nombre de la tabla' })
    }
    
    let csvPath = csvPathRaw
    if (!csvPath) {
      // Compatibilidad con la UI: envía { table, csvFolder }
      const folder = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
      const status = await getImportStatus(pool, folder)
      const match = status.find(s => s.table === table)
      csvPath = match?.csvPath
    }

    if (!csvPath) {
      return res.status(400).json({ error: 'No se pudo resolver csvPath para la tabla solicitada' })
    }

    console.log(`[IMPORT] Forzando importación de ${table} desde ${csvPath}`)

    const result = await importCSV(pool, table, csvPath)
    
    res.json(result)
  } catch (err) {
    console.error(`Error forzando importación:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar todos los CSVs desactualizados
app.post('/api/produccion/import-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    const results = await importAll(pool, csvFolder)
    const errors = results.filter((r) => r && r.success === false)
    const successful = results.filter((r) => r && r.success === true)
    const backup = (successful.length > 0 && errors.length === 0)
      ? triggerFullBackup(`csv-import-all:${successful.length}`)
      : { scheduled: false, reason: errors.length ? 'import-errors' : 'nothing-imported', ...getFullBackupStatus() }

    res.json({
      success: errors.length === 0,
      results,
      errors,
      backup,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: errors.length
      }
    })
  } catch (err) {
    console.error('Error en import-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de TODAS las tablas (botón "Forzar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Forzando importación de todas las tablas desde ${csvFolder}`)

    const results = await importForceAll(pool, csvFolder)
    const errors = results.filter((r) => r && r.success === false)
    const successful = results.filter((r) => r && r.success === true)
    const backup = (successful.length > 0 && errors.length === 0)
      ? triggerFullBackup(`csv-force-all:${successful.length}`)
      : { scheduled: false, reason: errors.length ? 'import-errors' : 'nothing-imported', ...getFullBackupStatus() }

    res.json({
      success: errors.length === 0,
      results,
      errors,
      backup,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: errors.length
      }
    })
  } catch (err) {
    console.error('Error en force-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Column warnings (devuelve lista vacía - funcionalidad opcional)
app.get('/api/produccion/import/column-warnings', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)

    await ensureSyncHistoryTables()

    const status = await getImportStatus(pool, csvFolder)
    const client = await pool.connect()

    try {
      const warnings = []
      const nowIso = new Date().toISOString()

      for (const item of status) {
        if (!item?.csvPath) continue
        if (item.status === 'MISSING_FILE' || item.status === 'ERROR') continue
        if (!fs.existsSync(item.csvPath)) continue

        let rawLine
        try {
          rawLine = readCsvHeaderLine(item.csvPath)
        } catch (e) {
          console.warn(`[WARNINGS] No se pudo leer header de ${item.csvPath}: ${e.message}`)
          continue
        }

        const rawHeaders = rawLine.split(',')
        const csvHeaders = renameduplicateHeaders(rawHeaders)

        const pgColumns = await getTableColumns(client, item.table)
        const diff = compareColumns(csvHeaders, pgColumns)

        if (!diff.hasDifferences) continue

        const warning = {
          id: `${item.table}-${Date.now()}`,
          table: item.table,
          csvPath: item.csvPath,
          timestamp: nowIso,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV,
          hasDifferences: true
        }
        warnings.push(warning)

        await maybeInsertWarningHistory({
          tableName: item.table,
          csvPath: item.csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }

      res.json({ warnings })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de diferencias detectadas
app.get('/api/produccion/import/warnings-history', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, csv_path, detected_at, extra_columns, missing_columns
       FROM tb_column_warnings_history
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ history: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar una tabla específica
// IMPORTANTE: Esta ruta con parámetro :table debe estar DESPUÉS de TODAS las rutas específicas
app.post('/api/produccion/import/:table', async (req, res) => {
  try {
    const { table } = req.params
    const { csvPath } = req.body
    
    if (!csvPath) {
      return res.status(400).json({ error: 'csvPath requerido' })
    }
    
    const result = await importCSV(pool, table, csvPath)
    res.json(result)
  } catch (err) {
    console.error(`Error importando ${req.params.table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Pick folder (no implementado - funcionalidad opcional)
app.post('/api/produccion/system/pick-folder', async (req, res) => {
  res.status(501).json({ error: 'Funcionalidad no implementada' })
})

// PRODUCCION: Sync columns (no implementado - funcionalidad opcional)
app.post('/api/produccion/schema/sync-columns', async (req, res) => {
  const { table, csvPath, reimport } = req.body || {}

  if (!table) return res.status(400).json({ error: 'table requerido' })
  if (!csvPath) return res.status(400).json({ error: 'csvPath requerido' })

  try {
    await ensureSyncHistoryTables()

    const client = await pool.connect()
    let addedColumns = []

    try {
      const rawLine = readCsvHeaderLine(csvPath)
      const rawHeaders = rawLine.split(',')
      const csvHeaders = renameduplicateHeaders(rawHeaders)
      const pgColumns = await getTableColumns(client, table)
      const diff = compareColumns(csvHeaders, pgColumns)

      const toAdd = diff.extraInCSV || []
      const addRes = await addColumnsToTable(client, table, toAdd)
      addedColumns = addRes.columns || []

      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [table, 'ADD_COLUMNS', addedColumns, Boolean(reimport), true]
      )

      // Registrar también como diferencia detectada (para historial) si aún había diferencias
      if (diff.hasDifferences) {
        await maybeInsertWarningHistory({
          tableName: table,
          csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }
    } finally {
      client.release()
    }

    let reimportResult = null
    if (reimport) {
      reimportResult = await importCSV(pool, table, csvPath)
    }

    res.json({
      success: true,
      columnsAdded: addedColumns.length,
      addedColumns,
      reimportResult
    })
  } catch (err) {
    try {
      await ensureSyncHistoryTables()
      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [table, 'ADD_COLUMNS', [], Boolean(reimport), false, err.message]
      )
    } catch (e2) {
      console.error('Error registrando tb_schema_changes_log:', e2.message)
    }
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de sincronizaciones aplicadas
app.get('/api/produccion/schema/changes-log', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, change_type, applied_at, columns_added, reimported, success, error_message
       FROM tb_schema_changes_log
       ORDER BY applied_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ changes: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS PARAMETROS HVI (Gestión de rangos de calidad)
// =====================================================

// GET /api/parametros-hvi - Listar todos los parámetros HVI
app.get('/api/parametros-hvi', async (req, res) => {
  try {
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    
    let sql = 'SELECT * FROM tb_parametros_hvi'
    const params = []
    
    if (activo !== undefined) {
      sql += ' WHERE activo = $1'
      params.push(activo)
    }
    
    sql += ' ORDER BY codigo ASC'
    
    const result = await query(sql, params, 'parametros-hvi-list')
    res.json({ 
      success: true,
      parametros: result.rows 
    })
  } catch (err) {
    console.error('Error obteniendo parámetros HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// GET /api/parametros-hvi/:codigo - Obtener un parámetro por código
app.get('/api/parametros-hvi/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params
    
    const result = await query(
      'SELECT * FROM tb_parametros_hvi WHERE codigo = $1',
      [codigo.toUpperCase()],
      'parametros-hvi-get-one'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0] 
    })
  } catch (err) {
    console.error('Error obteniendo parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// POST /api/parametros-hvi - Crear un nuevo parámetro HVI
app.post('/api/parametros-hvi', async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!codigo || !nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: codigo, nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `INSERT INTO tb_parametros_hvi (
        codigo, nombre, descripcion, grupo, unidad, tipo_dato, decimales,
        optimo_min, optimo_max, aceptable_min, aceptable_max,
        critico_min, critico_max, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        codigo.toUpperCase(),
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true
      ],
      'parametros-hvi-create'
    )
    
    res.status(201).json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI creado exitosamente'
    })
  } catch (err) {
    console.error('Error creando parámetro HVI:', err)
    
    // Manejar error de código duplicado
    if (err.code === '23505') {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe un parámetro con ese código' 
      })
    }
    
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// PUT /api/parametros-hvi/:id - Actualizar un parámetro HVI existente
app.put('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `UPDATE tb_parametros_hvi SET
        nombre = $1,
        descripcion = $2,
        grupo = $3,
        unidad = $4,
        tipo_dato = $5,
        decimales = $6,
        optimo_min = $7,
        optimo_max = $8,
        aceptable_min = $9,
        aceptable_max = $10,
        critico_min = $11,
        critico_max = $12,
        activo = $13
      WHERE id = $14
      RETURNING *`,
      [
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true,
        id
      ],
      'parametros-hvi-update'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI actualizado exitosamente'
    })
  } catch (err) {
    console.error('Error actualizando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// DELETE /api/parametros-hvi/:id - Eliminar un parámetro HVI
app.delete('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM tb_parametros_hvi WHERE id = $1 RETURNING codigo, nombre',
      [id],
      'parametros-hvi-delete'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      deleted: result.rows[0],
      message: 'Parámetro HVI eliminado exitosamente'
    })
  } catch (err) {
    console.error('Error eliminando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// =====================================================
// DETALLE MISTURA POR LOTE DE HILANDERÍA
// =====================================================

// GET /api/detalle-mistura/:loteFiac - Obtener detalle de mistura por LOTE_FIAC
app.get('/api/detalle-mistura/:loteFiac', async (req, res) => {
  try {
    const { loteFiac } = req.params
    
    if (!loteFiac) {
      return res.status(400).json({ 
        success: false,
        error: 'LOTE_FIAC es requerido' 
      })
    }

    // Formatear LOTE_FIAC con ceros adelante (10 dígitos)
    const loteFiacFormateado = String(loteFiac).padStart(10, '0')
    
    console.log(`[DetalleMistura] Buscando LOTE_FIAC: ${loteFiac} → Formateado: ${loteFiacFormateado}`)
    
    // Helper para parsear números desde texto
    const sqlParseNumber = (col) => `
      CASE 
        WHEN ${col} IS NULL OR ${col} = '' THEN NULL
        ELSE CAST(REPLACE(REPLACE(${col}, '.', ''), ',', '.') AS NUMERIC)
      END
    `
    
    const sql = `
      SELECT 
        "LOTE_FIAC",
        "MISTURA",
        "PRODUTOR",
        "LOTE",
        ${sqlParseNumber('"QTDE"')} AS "QTDE",
        ${sqlParseNumber('"PESO"')} AS "PESO",
        "TP",
        "CLASSIFIC",
        ${sqlParseNumber('"SCI"')} AS "SCI",
        ${sqlParseNumber('"MST"')} AS "MST",
        ${sqlParseNumber('"MIC"')} AS "MIC",
        ${sqlParseNumber('"MAT"')} AS "MAT",
        ${sqlParseNumber('"UHML"')} AS "UHML",
        ${sqlParseNumber('"UI"')} AS "UI",
        ${sqlParseNumber('"SF"')} AS "SF",
        ${sqlParseNumber('"STR"')} AS "STR",
        ${sqlParseNumber('"ELG"')} AS "ELG",
        ${sqlParseNumber('"RD"')} AS "RD",
        ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID"
      FROM tb_calidad_fibra
      WHERE "LOTE_FIAC" = $1
        AND "TIPO_MOV" = 'MIST'
        AND "PRODUTOR" IS NOT NULL
        AND "PRODUTOR" != ''
      ORDER BY "PRODUTOR", "LOTE"
    `
    
    const result = await query(sql, [loteFiacFormateado], 'detalle-mistura')
    
    console.log(`[DetalleMistura] Filas encontradas: ${result.rows.length}`)
    
    res.json({
      success: true,
      loteFiac: loteFiac,
      loteFiacFormateado: loteFiacFormateado,
      filas: result.rows,
      total: result.rows.length
    })
  } catch (err) {
    console.error('Error obteniendo detalle de mistura:', err)
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

// =====================================================
// HVI: Guardar datos de ensayos en tablas específicas
// =====================================================
app.post('/api/hvi/save', async (req, res) => {
  const { files } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ success: false, error: 'No se enviaron datos de archivos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Asegurar que las tablas existan y tengan las columnas necesarias
    await client.query(`
      CREATE TABLE IF NOT EXISTS tb_hvi_ensayos (
          id SERIAL PRIMARY KEY,
          lote TEXT NOT NULL,
          proveedor TEXT,
          grado TEXT,
          fecha TEXT,
          muestra TEXT,
          archivo_fuente TEXT,
          creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Asegurar columna 'tipo' si no existe
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='tipo') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN tipo TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cantidad') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cantidad INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='color') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN color TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cort') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cort INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='obs') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN obs TEXT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS tb_hvi_detalles (
          id SERIAL PRIMARY KEY,
          ensayo_id INTEGER REFERENCES tb_hvi_ensayos(id) ON DELETE CASCADE,
          fardo TEXT,
          sci NUMERIC, mst NUMERIC, mic NUMERIC, mat NUMERIC, uhml NUMERIC, 
          ui NUMERIC, sf NUMERIC, str NUMERIC, elg NUMERIC, rd NUMERIC, 
          plus_b NUMERIC, tipo TEXT, tr_cnt NUMERIC, tr_ar NUMERIC, trid NUMERIC,
          estado_fardo TEXT DEFAULT 'OK'
      );
    `);

    for (const file of files) {
      const { metadata, details } = file;
      
      // 1. Verificar si ya existe un ensayo para este lote/proveedor/fecha/archivo para evitar duplicados
      const existing = await client.query(
        `SELECT id FROM tb_hvi_ensayos 
         WHERE lote = $1 AND proveedor = $2 AND fecha = $3 AND archivo_fuente = $4`,
        [metadata.loteEntrada, metadata.proveedor, metadata.fecha, metadata.fileName]
      );

      if (existing.rows.length > 0) {
        // Si existe, lo eliminamos (y por CASCADE se borran sus detalles) para re-insertar
        await client.query('DELETE FROM tb_hvi_ensayos WHERE id = $1', [existing.rows[0].id]);
      }

      // 2. Insertar Cabecera
      const headerRes = await client.query(
        `INSERT INTO tb_hvi_ensayos (tipo, lote, proveedor, grado, fecha, muestra, cantidad, color, cort, obs, archivo_fuente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [metadata.tipo, metadata.loteEntrada, metadata.proveedor, metadata.grado, metadata.fecha, metadata.muestra, metadata.cantidad || null, metadata.color || null, metadata.cort || null, metadata.obs || null, metadata.fileName]
      );

      const ensayoId = headerRes.rows[0].id;

      // 3. Insertar Detalles
      for (const row of details) {
        const toNum = (v) => {
          if (v === null || v === undefined || v === '-' || v === '') return null;
          const n = parseFloat(String(v).replace(',', '.'));
          return isNaN(n) ? null : n;
        };

        const sqlDetalle = `
          INSERT INTO tb_hvi_detalles (
            ensayo_id, fardo, sci, mst, mic, mat, uhml, ui, sf, 
            str, elg, rd, plus_b, tipo, tr_cnt, tr_ar, trid
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `;

        const values = [
          ensayoId, row.fardo, 
          toNum(row.sci), toNum(row.mst), toNum(row.mic), toNum(row.mat), 
          toNum(row.uhml), toNum(row.ui), toNum(row.sf), toNum(row.str), 
          toNum(row.elg), toNum(row.rd), toNum(row.plusB), 
          row.tipo, 
          toNum(row.trCnt), toNum(row.trAr), toNum(row.trid)
        ];

        await client.query(sqlDetalle, values);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Se han guardado los datos correctamente.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error guardando datos HVI:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Endpoint para verificar archivos existentes
app.post('/api/hvi/check-files', async (req, res) => {
  const { fileNames } = req.body;
  if (!fileNames || !Array.isArray(fileNames)) {
    return res.status(400).json({ success: false, error: 'Lista de archivos inválida' });
  }

  try {
    // Verificar si la tabla existe antes de consultar
    const tableCheck = await query(`SELECT to_regclass('public.tb_hvi_ensayos') as exists`);
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, existingNames: [] });
    }

    const result = await query(
      `SELECT archivo_fuente FROM tb_hvi_ensayos WHERE archivo_fuente = ANY($1)`,
      [fileNames]
    );
    const existingNames = result.rows.map(r => r.archivo_fuente);
    res.json({ success: true, existingNames });
  } catch (err) {
    console.error('Error checking HVI files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener metadatos guardados de archivos HVI
app.post('/api/hvi/get-metadata', async (req, res) => {
  const { fileNames } = req.body;
  if (!fileNames || !Array.isArray(fileNames)) {
    return res.status(400).json({ success: false, error: 'Lista de archivos inválida' });
  }

  try {
    // Asegurar que las columnas adicionales existan antes de consultar
    await query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cantidad') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cantidad INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='color') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN color TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cort') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cort INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='obs') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN obs TEXT;
        END IF;
      END $$;
    `);

    const result = await query(
      `SELECT archivo_fuente, tipo, lote, proveedor, grado, fecha, muestra, cantidad, color, cort, obs
       FROM tb_hvi_ensayos WHERE archivo_fuente = ANY($1)`,
      [fileNames]
    );

    // Devolver un mapa por nombre de archivo
    const map = {};
    result.rows.forEach(r => {
      map[r.archivo_fuente] = {
        tipo: r.tipo,
        loteEntrada: r.lote,
        proveedor: r.proveedor,
        grado: r.grado,
        fecha: r.fecha,
        muestra: r.muestra,
        cantidad: r.cantidad,
        color: r.color,
        cort: r.cort,
        obs: r.obs
      };
    });

    res.json({ success: true, metadata: map });
  } catch (err) {
    console.error('Error getting HVI metadata:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Comparación Calidad (Muestra vs Entrega)
app.get('/api/hvi/comparacion-muestra', async (req, res) => {
  try {
    const sql = `
      WITH promedios_lote AS (
          SELECT 
              e.id AS ensayo_id,
              e.lote,
              e.tipo,
              e.muestra,
              AVG(d.sci) as sci_avg,
              AVG(d.str) as str_avg,
              AVG(d.sf) as sf_avg,
              COUNT(d.id) as fardos
          FROM tb_hvi_ensayos e
          JOIN tb_hvi_detalles d ON e.id = d.ensayo_id
          GROUP BY e.id, e.lote, e.tipo, e.muestra
      )
      SELECT 
          ent.lote as lote_ent,
          mue.lote as lote_mue,
          
          ent.sci_avg as sci_ent,
          mue.sci_avg as sci_mue,
          ((ent.sci_avg / NULLIF(mue.sci_avg, 0)) - 1) * 100 as var_sci,
          
          ent.str_avg as str_ent,
          mue.str_avg as str_mue,
          ((ent.str_avg / NULLIF(mue.str_avg, 0)) - 1) * 100 as var_str,
          
          ent.sf_avg as sf_ent,
          mue.sf_avg as sf_mue,
          ((ent.sf_avg / NULLIF(mue.sf_avg, 0)) - 1) * 100 as var_sf
      FROM promedios_lote ent
      LEFT JOIN promedios_lote mue ON ent.muestra = mue.lote
      WHERE ent.tipo = 'Ent' AND (mue.tipo = 'Mue' OR mue.tipo IS NULL)
      ORDER BY ent.lote ASC
    `;

    const result = await query(sql, [], 'hvi-comparacion-muestra');
    
    const formatted = result.rows.map(r => {
      const sci_mue = r.sci_mue || 0;
      const sci_ent = r.sci_ent || 0;
      const str_mue = r.str_mue || 0;
      const str_ent = r.str_ent || 0;
      const sf_mue = r.sf_mue || 0;
      const sf_ent = r.sf_ent || 0;

      const var_sci = sci_mue > 0 ? ((sci_ent / sci_mue) - 1) * 100 : 0;
      const var_str = str_mue > 0 ? ((str_ent / str_mue) - 1) * 100 : 0;
      const var_sf = sf_mue > 0 ? ((sf_ent / sf_mue) - 1) * 100 : 0;

      let alerta = '';
      let critico = false;

      if (sci_mue > 0) {
        if (var_str < -5 || var_sci < -5 || var_sf > 5) {
          alerta = '⚠️ ALERTA DE RECLAMO: Calidad inferior a la muestra aprobada';
          critico = true;
        }
      }

      return {
          lote: r.lote_ent,
          muestra: r.lote_mue || 'No vinculada',
          sci_mue: sci_mue > 0 ? parseFloat(sci_mue).toFixed(1) : '---',
          sci_ent: parseFloat(sci_ent).toFixed(1),
          var_sci: sci_mue > 0 ? var_sci.toFixed(1) + '%' : '---',
          str_mue: str_mue > 0 ? parseFloat(str_mue).toFixed(1) : '---',
          str_ent: parseFloat(str_ent).toFixed(1),
          var_str: str_mue > 0 ? var_str.toFixed(1) + '%' : '---',
          sf_mue: sf_mue > 0 ? parseFloat(sf_mue).toFixed(1) : '---',
          sf_ent: parseFloat(sf_ent).toFixed(1),
          var_sf: sf_mue > 0 ? var_sf.toFixed(1) + '%' : '---',
          alerta,
          critico,
          estado: sci_mue === 0 ? 'SIN MUESTRA' : (critico ? 'RECHAZADO' : 'ACEPTADO')
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error en comparación HVI:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hvi/predecir-hilatura', async (req, res) => {
  try {
    const { lote, pacas, metadata, contexto } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_API_KEY no configurada' });
    }

    // Permitir selección de modelo desde el frontend (req.body.model) o usar el default
    // Default actualizamos a Gemini 3 Pro (Preview) a petición del usuario para desarrollo
    const modelName = req.body.model || "gemini-3-pro-preview";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Procesamiento de datos para la estructura requerida por el Prompt
    // Separar Muestras (Mue) y Entradas (Ent)
    const muestras = pacas.filter(p => p.tipo === 'Mue' || p.Tipo === 'Mue');
    const entradas = pacas.filter(p => p.tipo === 'Ent' || p.Tipo === 'Ent');

    // Si no hay distinción clara en el array enviado, asumimos que todo es 'Ent' y buscamos si hay referencia en metadatos
    // O si es un análisis simple de un solo lote.
    
    // Cálculo de promedios auxiliares
    const calcularPromedios = (items) => {
        if (!items.length) return {};
        const sum = items.reduce((acc, curr) => ({
            sci: acc.sci + (parseFloat(curr.sci || curr.SCI) || 0),
            str: acc.str + (parseFloat(curr.str || curr.STR) || 0),
            sf: acc.sf + (parseFloat(curr.sf || curr.SF) || 0),
            rd: acc.rd + (parseFloat(curr.rd || curr.RD) || 0),
            plus_b: acc.plus_b + (parseFloat(curr.plusb || curr['+b']) || 0),
            mic: acc.mic + (parseFloat(curr.mic || curr.MIC) || 0),
            trash: acc.trash + (parseFloat(curr.trash || curr.Trash) || 0)
        }), { sci: 0, str: 0, sf: 0, rd: 0, plus_b: 0, mic: 0, trash: 0 });
        
        return {
            sci: parseFloat((sum.sci / items.length).toFixed(1)),
            str: parseFloat((sum.str / items.length).toFixed(1)),
            sf: parseFloat((sum.sf / items.length).toFixed(1)),
            rd: parseFloat((sum.rd / items.length).toFixed(1)),
            plus_b: parseFloat((sum.plus_b / items.length).toFixed(1)),
            mic: parseFloat((sum.mic / items.length).toFixed(2)),
            trash: parseFloat((sum.trash / items.length).toFixed(2))
        };
    };

    const datosPromedioMue = calcularPromedios(muestras);
    const datosPromedioEnt = calcularPromedios(entradas);

    // Construcción del JSON estructurado para el Prompt
    const datosParaPrompt = {
        referencia_muestra: muestras.length > 0 ? {
            lote: muestras[0].lote || muestras[0].Lote || "Desconocido",
            tot: muestras.length,
            prom: datosPromedioMue
        } : null,
        lote_recibido: entradas.length > 0 ? {
            lote: entradas[0].lote || entradas[0].Lote || lote, 
            tot: entradas.length,
            prom: datosPromedioEnt
        } : {
            lote: lote,
            tot: pacas.length,
            prom: calcularPromedios(pacas)
        },
        // INCORPORAMOS LOS 30 PEORES FARDOS (Reducido drásticamente para evitar quota limits)
        // Minificamos la data antes de enviarla
        fardos_criticos: (entradas.length > 0 ? entradas : pacas)
           .sort((a,b) => (parseFloat(a.sci) || 0) - (parseFloat(b.sci) || 0))
           .slice(0, 30)
           .map(f => ({
               id: f.fardo, 
               sci: Math.round(f.sci||f.SCI), 
               str: parseFloat(f.str||f.STR).toFixed(1), 
               mic: parseFloat(f.mic||f.MIC).toFixed(2)
           }))
    };

    // Si tenemos ambos, es un cruce. Si solo tenemos uno, es análisis individual.
    // El usuario pidió explícitamente lógica de cruce, pero debemos ser robustos.

    const prompt = `Actúa como un Ingeniero Senior de Planta de Denim. Tu misión principal es la Auditoría de Cumplimiento de Compra.
    IMPORTANTE: Responde de manera EJECUTIVA y RÁPIDA.

    LÓGICA DE RELACIÓN (CRUCE DE DATOS):
    Te estoy enviando dos conjuntos de datos o uno según disponibilidad: la Muestra (Tipo: 'Mue') y la Entrada (Tipo: 'Ent').
    
    Debes usar el valor de la columna lote de la Muestra para compararlo con el valor de la columna muestra de la Entrada (si existen).
    
    Es obligatorio calcular la variación porcentual entre ambos: ((Promedio_Ent / Promedio_Mue) - 1) * 100. (Solo si hay datos de referencia).

    REGLAS DE EVALUACIÓN TÉCNICA:
    1. Foco en Denim: Analiza aptitud para 7/1 a 10/1 (Trama), 10/1 Flame y 12.5/1 a 16/1 (Urdimbre).
    2. Penalización por Desviación: Si el STR o el SCI caen más de un 5% respecto a la muestra, califica el lote como 'No Conforme/Reclamo Directo'.
    3. Análisis de Color (Rd y +b): Compara el brillo y la amarillez. Si la entrada es más amarilla (+b mayor) que la muestra, advierte sobre 'Variación de Tono en el Lote Final'.

    ESTRUCTURA DEL REPORTE:
    1. Tabla Comparativa de Desviación: (Mue vs Ent) para SCI, STR, MIC, SF y Trash. Incluye columnas: Muestra, Entrada, Var %, Estado.
    2. Diagnóstico de Procesabilidad: Impacto en paros de rotor y cortes en telar basado en la caída de calidad.
    3. Conclusión de Compra: Dictamen final para el sector adquisiciones (Aceptar, Aceptar con descuento, o Rechazar).

    DATOS DE ENTRADA (JSON):
    ${JSON.stringify(datosParaPrompt, null, 2)}

    NOTA ADICIONAL DE CONTEXTO:
    Si solo recibes 'lote_recibido' sin 'referencia_muestra', realiza la evaluación técnica absoluta basada en estándares de Denim (SCI > 130, STR > 28, etc.) pero indica que falta la muestra para la comparativa contractual.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ success: true, insight: text });
  } catch (error) {
    console.error("Error Gemini:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// CORRELACIÓN MEZCLA (HVI) → HILO (USTER + TENSORAPID)
// =====================================================

// Helpers de estadística
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  );
  return den === 0 ? 0 : parseFloat((num / den).toFixed(4));
}

function linearRegression(x, y) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const ssxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const ssxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const slope = ssxx === 0 ? 0 : ssxy / ssxx;
  const intercept = my - slope * mx;
  const r = pearsonCorrelation(x, y) || 0;
  return {
    slope: parseFloat(slope.toFixed(4)),
    intercept: parseFloat(intercept.toFixed(4)),
    r2: parseFloat((r * r).toFixed(4))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/produccion/partida-tejeduria
// Trazabilidad completa de una partida – sector TEJEDURÍA
// Query params: partida (requerido), filial (opcional, default '05')
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/produccion/partida-tejeduria', async (req, res) => {
  try {
    const { partida, filial = '05' } = req.query;
    if (!partida) return res.status(400).json({ error: 'Se requiere parámetro "partida"' });

    // Construir candidatos: el valor exacto + con 1 ó 2 ceros al frente
    // Ej: '535201' → ['535201', '0535201', '00535201']
    const partidaCandidates = [...new Set([
      partida,
      '0'  + partida,
      '00' + partida
    ])];

    const pNum  = col => sqlParseNumber(col);
    const pNumI = col => sqlParseNumberIntl(col);  // para columnas con separador de miles (3.000,00)
    const pDate = col => sqlParseDate(col);

    // Detectar nombre exacto de columnas variables en tb_produccion
    const colsRes = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_produccion'`,
      [], 'partida-tej/cols'
    );
    const prodCols = new Map((colsRes.rows || []).map(r => [String(r.column_name).toLowerCase(), r.column_name]));
    const maqKey  = ['maq  fiacao', 'maq fiacao'].find(c => prodCols.has(c));
    const loteKey = ['lote fiacao', 'lote  fiacao'].find(c => prodCols.has(c));
    const maqExpr  = maqKey  ? `p.${quoteIdent(prodCols.get(maqKey))}` : 'NULL::text';
    const loteExpr = loteKey ? `p.${quoteIdent(prodCols.get(loteKey))}` : 'NULL::text';

    // ── Q1: registros diario/turno (TECELAGEM) ──────────────────────────────
    const sqlRegistros = `
      SELECT
        ${pDate('p."DT_BASE_PRODUCAO"')}              AS fecha,
        p."TURNO"                                       AS turno,
        p."PARTIDA"                                     AS partida,
        ${pNum('p."METRAGEM"')}                        AS metros_crudos,
        ${pNum('p."PARADA TEC TRAMA"')}                AS paradas_trama,
        ${pNum('p."PARADA TEC URDUME"')}               AS paradas_urdimbre,
        ${pNum('p."PONTOS_LIDOS"')}                    AS pontos_lidos,
        ${pNum('p."PONTOS_100%"')}                     AS pontos_100,
        ${pNum('p."RPM LEITURA"')}                     AS rpm,
        p."ARTIGO"                                      AS artigo,
        p."COR"                                         AS cor,
        p."NM MERCADO"                                  AS nm_mercado,
        p."MAQUINA"                                     AS maquina,
        p."TRAMA REDUZIDA 1"                            AS trama,
        ${pNum('p."BATIDAS"')}                         AS batidas,
        p."GRUPO TEAR"                                  AS grupo_tear,
        p."BASE URDUME"                                 AS base_urdume,
        p."ROLADA"                                      AS rolada
      FROM tb_produccion p
      WHERE p."FILIAL" = $2
        AND p."PARTIDA" = ANY($1::text[])
        AND p."SELETOR" = 'TECELAGEM'
      ORDER BY ${pDate('p."DT_BASE_PRODUCAO"')} ASC NULLS LAST, p."TURNO" ASC
    `;

    // ── Q2: totales/promedios consolidados (TECELAGEM) ──────────────────────
    const sqlTotales = `
      SELECT
        SUM(${pNum('p."METRAGEM"')})                   AS metros_crudos,
        SUM(${pNum('p."PARADA TEC TRAMA"')})           AS paradas_trama,
        SUM(${pNum('p."PARADA TEC URDUME"')})          AS paradas_urdimbre,
        SUM(${pNum('p."PONTOS_LIDOS"')})               AS pontos_lidos,
        SUM(${pNum('p."PONTOS_100%"')})                AS pontos_100,
        AVG(${pNum('p."RPM LEITURA"')})                AS rpm
      FROM tb_produccion p
      WHERE p."FILIAL" = $2
        AND p."PARTIDA" = ANY($1::text[])
        AND p."SELETOR" = 'TECELAGEM'
    `;

    const [resRegistros, resTotales] = await Promise.all([
      query(sqlRegistros, [partidaCandidates, filial], 'partida-tej/registros'),
      query(sqlTotales,   [partidaCandidates, filial], 'partida-tej/totales')
    ]);

    const rows = resRegistros.rows;
    if (rows.length === 0) {
      return res.json({
        success: true,
        encontrada: false,
        encabezado: {},
        registros: [],
        totales: {}
      });
    }

    // ── Encabezado (valores del primer registro no nulo) ──────────────────
    const hdr  = rows[0];
    const art  = (hdr.artigo  || '').substring(0, 10);
    const cor  = hdr.cor  || '';
    const base = hdr.base_urdume || '';
    // Maquina: últimos 2 dígitos como número
    const telar = hdr.maquina ? parseInt(hdr.maquina.replace(/\D+$/, '').slice(-2) || '0', 10) || hdr.maquina : '';

    // ── Cómputos por fila ─────────────────────────────────────────────────
    let acum = 0;
    const registros = rows.map(r => {
      const mc   = parseFloat(r.metros_crudos) || 0;
      const mt   = Math.round(mc * 0.85 * 10) / 10;
      const pt   = parseFloat(r.paradas_trama) || 0;
      const pu   = parseFloat(r.paradas_urdimbre) || 0;
      const pl   = parseFloat(r.pontos_lidos) || 0;
      const p100 = parseFloat(r.pontos_100) || 0;
      const efi  = p100 > 0 ? Math.round((pl / p100 * 100) * 10) / 10 : null;
      const rt   = pl > 0   ? Math.round((pt * 100000 / (pl * 1000)) * 100) / 100 : null;
      const ru   = pl > 0   ? Math.round((pu * 100000 / (pl * 1000)) * 100) / 100 : null;
      acum += mt;
      return {
        fecha:            r.fecha,
        turno:            r.turno,
        partida:          r.partida,
        metros_crudos:    parseFloat(mc.toFixed(1)),
        metros_term:      mt,
        metros_term_acum: Math.round(acum * 10) / 10,
        paradas_trama:    pt,
        paradas_urdimbre: pu,
        total_paradas:    pt + pu,
        eficiencia:       efi,
        rt_105:           rt,
        ru_105:           ru,
        rpm:              r.rpm !== null ? Math.round(parseFloat(r.rpm)) : null
      };
    });

    // ── Totales ────────────────────────────────────────────────────────────
    const tot = resTotales.rows[0] || {};
    const tmc  = parseFloat(tot.metros_crudos) || 0;
    const tpt  = parseFloat(tot.paradas_trama) || 0;
    const tpu  = parseFloat(tot.paradas_urdimbre) || 0;
    const tpl  = parseFloat(tot.pontos_lidos) || 0;
    const tp100 = parseFloat(tot.pontos_100) || 0;
    const totales = {
      metros_crudos:    Math.round(tmc),
      metros_term:      Math.round(tmc * 0.85),
      paradas_trama:    tpt,
      paradas_urdimbre: tpu,
      total_paradas:    tpt + tpu,
      eficiencia:       tp100 > 0 ? Math.round((tpl / tp100 * 100) * 10) / 10 : null,
      rt_105:           tpl > 0   ? Math.round((tpt * 100000 / (tpl * 1000)) * 100) / 100 : null,
      ru_105:           tpl > 0   ? Math.round((tpu * 100000 / (tpl * 1000)) * 100) / 100 : null,
      rpm:              tot.rpm !== null ? Math.round(parseFloat(tot.rpm)) : null
    };

    // ── ROLADAs: del conjunto TECELAGEM (para header) + derivada del string de partida ──
    const roladas = [...new Set(rows.map(r => r.rolada).filter(Boolean))];

    // Usar la partida real de la BD (puede tener ceros al frente que el usuario no ingresó)
    // Derivar ROLADA: Left(Right(partida, 6), 4) → '0535201' → '535201' → '5352'
    const partidaReal    = String(rows[0].partida || partida);
    const roladaDerivada = partidaReal.length >= 6 ? partidaReal.slice(-6, -2) : partidaReal;

    // ── Q3: Roturas URDIDORA (RU106) ──────────────────────────────────────
    // Fórmula per-fila: SUM(RUPTURAS * 1_000_000) / NULLIF(SUM(METRAGEM * NUM_FIOS), 0)
    // SELETOR incluye tanto 'URDIDEIRA' como 'URDIDORA'
    // METRAGEM/NUM_FIOS usan formato europeo (3.000,00) → pNumI
    const sqlRU106 = `
      SELECT
        SUM(${pNum('p."RUPTURAS"')} * 1000000.0)                                          AS numerador,
        NULLIF(SUM(${pNumI('p."METRAGEM"')} * ${pNumI('p."NUM_FIOS"')}), 0)             AS denominador
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
    `;

    // ── Q4: Roturas INDIGO (RI103) ────────────────────────────────────────
    // METRAGEM usa formato europeo → pNumI
    const sqlRI103 = `
      SELECT
        SUM(${pNum('p."RUPTURAS"')}) * 1000.0 / NULLIF(SUM(${pNumI('p."METRAGEM"')}), 0) AS ri103
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" = 'INDIGO'
    `;

    // ── Q5: Lotes de hilo URDIDORA ────────────────────────────────────────
    const sqlLotes = `
      SELECT DISTINCT ${pNum(loteExpr)} AS lote
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND ${loteExpr} IS NOT NULL AND ${loteExpr} <> ''
      ORDER BY ${pNum(loteExpr)} ASC NULLS LAST
    `;

    // ── Q6: Máquinas OE URDIDORA ─────────────────────────────────────────
    const sqlOEs = `
      SELECT DISTINCT RIGHT(${maqExpr}, 2) AS oe_raw
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND ${maqExpr} IS NOT NULL AND ${maqExpr} <> ''
      ORDER BY RIGHT(${maqExpr}, 2) ASC NULLS LAST
    `;

    const [resRU106, resRI103, resLotes, resOEs] = await Promise.all([
      query(sqlRU106, [filial, roladaDerivada], 'partida-tej/ru106'),
      query(sqlRI103, [filial, roladaDerivada], 'partida-tej/ri103'),
      query(sqlLotes, [filial, roladaDerivada], 'partida-tej/lotes'),
      query(sqlOEs,   [filial, roladaDerivada], 'partida-tej/oes')
    ]);

    // ── Calcular RU106 ─────────────────────────────────────────────────────
    let rot_urd_106 = null;
    if (resRU106.rows[0]) {
      const ru = resRU106.rows[0];
      const num = parseFloat(ru.numerador) || 0;
      const den = parseFloat(ru.denominador);
      if (den && den > 0) {
        rot_urd_106 = Math.round((num / den) * 100) / 100;
      }
    }

    // ── Calcular RI103 ─────────────────────────────────────────────────────
    let rot_ind_103 = null;
    if (resRI103.rows[0]) {
      const ri = resRI103.rows[0];
      const val = parseFloat(ri.ri103);
      if (!isNaN(val)) {
        rot_ind_103 = Math.round(val * 100) / 100;
      }
    }

    // ── Lotes y OEs ────────────────────────────────────────────────────────
    const lotesArr = resLotes.rows.map(r => r.lote).filter(Boolean);
    // Extraer número de OE del raw (ej. '06' → 6, ' 8' → 8)
    const oesArr   = [...new Set(
      resOEs.rows.map(r => {
        const raw = String(r.oe_raw || '').trim();
        const n = parseInt(raw, 10);
        return isNaN(n) ? raw : n;
      }).filter(v => v !== '' && v !== null)
    )].sort((a, b) => a - b);

    const encabezado = {
      articulo:    `${art} ${cor}`.trim(),
      nombre:      hdr.nm_mercado || '',
      telar,
      trama:       hdr.trama || '',
      pasadas:     hdr.batidas !== null ? parseFloat(hdr.batidas) : null,
      grupo:       hdr.grupo_tear || '',
      base,
      rot_urd_106,
      rot_ind_103,
      oes:         oesArr.join(', '),
      lote:        lotesArr.join(', '),
      roladas
    };

    // ── Q7: Historial de máquinas por las que pasó la partida ─────────────
    // Agrupa por MAQUINA (todos los SELETOR), mostrando primer inicio / último fin / suma metros
    let historial = [];
    try {
      const sqlHistorial = `
        WITH base AS (
          SELECT
            p."MAQUINA",
            p."SELETOR",
            p."PARTIDA"                          AS partida_rec,
            ${pDate('p."DT_INICIO"')}       AS dt_ini_parsed,
            p."HORA_INICIO",
            ${pDate('p."DT_FINAL"')}        AS dt_fin_parsed,
            p."HORA_FINAL",
            ${pNumI('p."METRAGEM"')}                AS metros_val,
            ${pNum('p."RUPTURAS"')}                 AS rupturas_val,
            ${pNumI('p."NUM_FIOS"')}                AS num_fios_val,
            ${pNumI('p."CAVALOS"')}                 AS cavalos_val,
            ${pNumI('p."VELOC"')}                   AS veloc_val,
            ${pNum('p."PONTOS_LIDOS"')}             AS pontos_lidos_val,
            ${pNum('p."PONTOS_100%"')}              AS pontos_100_val,
            ${pNum('p."PARADA TEC TRAMA"')}         AS par_trama_val,
            ${pNum('p."PARADA TEC URDUME"')}        AS par_urd_val,
            p."ARTIGO",
            p."COR",
            p."NM MERCADO"                          AS nm_mercado
          FROM tb_produccion p
          WHERE p."FILIAL" = $2
            AND (
              -- TECELAGEM, INDIGO, ACABAMENTO: ligados por nro de partida
              p."PARTIDA" = ANY($1::text[])
              OR
              -- URDIDEIRA / URDIDORA: sus registros usan como PARTIDA el nro de haz
              -- (ej. 544401..544416) y se vinculan a la partida de tejeria via ROLADA
              ( p."ROLADA" = $3
                AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA') )
            )
            AND p."MAQUINA" IS NOT NULL
            AND TRIM(p."MAQUINA"::text) <> ''
        ),
        por_maquina AS (
          SELECT
            "MAQUINA",
            MAX("SELETOR")                      AS seletor,
            MIN(dt_ini_parsed)                   AS dt_inicio,
            MAX(dt_fin_parsed)                   AS dt_final,
            ROUND(COALESCE(SUM(metros_val), 0)::numeric, 0) AS metros_raw,
            -- Partida a mostrar: URDIDEIRA usa LEFT(RIGHT(partida,6),4) = nro de orden de urdido
            -- Resto: la partida tal cual
            CASE
              WHEN MAX("SELETOR") IN ('URDIDEIRA', 'URDIDORA')
              THEN LEFT(RIGHT(MIN(partida_rec)::text, 6), 4)
              ELSE MAX(partida_rec)::text
            END                                  AS partida_display,
            MAX("ARTIGO")                        AS artigo,
            MAX("COR")                           AS cor,
            MAX(nm_mercado)                      AS nm_mercado
          FROM base
          GROUP BY "MAQUINA"
        ),
        -- URDIDEIRA: sumar METRAGEM por haz (PARTIDA) individualmente,
        -- luego tomar MAX. Esto da la longitud del haz completo (ej. 60.000m)
        -- independientemente de cuantos haces haya en la ROLADA o si alguno es parcial.
        beam_max AS (
          SELECT
            sub."MAQUINA",
            MAX(sub.haz_total) AS metros_beam
          FROM (
            SELECT "MAQUINA", partida_rec,
                   SUM(metros_val) AS haz_total
            FROM base
            WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
            GROUP BY "MAQUINA", partida_rec
          ) sub
          GROUP BY sub."MAQUINA"
        ),
        -- ROT 106 por maquina (URDIDEIRA/URDIDORA)
        rot106_maq AS (
          SELECT
            "MAQUINA",
            ROUND(
              (SUM(rupturas_val * 1000000.0)
               / NULLIF(SUM(metros_val * num_fios_val), 0))::numeric
            , 2) AS rot_106
          FROM base
          WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
            AND num_fios_val > 0
          GROUP BY "MAQUINA"
        ),
        -- INDIGO: R10³, Cav 10⁵, Vel.Nom
        indigo_vals AS (
          SELECT
            "MAQUINA",
            ROUND(SUM(rupturas_val) * 1000.0   / NULLIF(SUM(metros_val), 0), 2) AS r103,
            ROUND(SUM(cavalos_val) * 100000.0  / NULLIF(SUM(metros_val), 0), 1) AS cav105,
            MAX(veloc_val) AS vel_nom
          FROM base
          WHERE "SELETOR" = 'INDIGO'
          GROUP BY "MAQUINA"
        ),
        -- TECELAGEM: Efic%, RU10⁵, RT10⁵
        tecelagem_vals AS (
          SELECT
            "MAQUINA",
            ROUND(SUM(pontos_lidos_val) * 100.0  / NULLIF(SUM(pontos_100_val), 0), 1) AS efic_pct,
            ROUND(SUM(par_urd_val) * 100000.0    / NULLIF(SUM(pontos_lidos_val) * 1000, 0), 1) AS ru105,
            ROUND(SUM(par_trama_val) * 100000.0  / NULLIF(SUM(pontos_lidos_val) * 1000, 0), 1) AS rt105
          FROM base
          WHERE "SELETOR" = 'TECELAGEM'
          GROUP BY "MAQUINA"
        ),
        -- ACABAMENTO: Velocidad
        acabamento_vals AS (
          SELECT
            "MAQUINA",
            MAX(veloc_val) AS veloc
          FROM base
          WHERE "SELETOR" ILIKE 'ACABAMENTO%'
          GROUP BY "MAQUINA"
        ),
        primera_hora AS (
          SELECT DISTINCT ON ("MAQUINA")
            "MAQUINA",
            "HORA_INICIO"
          FROM base
          ORDER BY "MAQUINA", dt_ini_parsed ASC NULLS LAST
        ),
        ultima_hora AS (
          SELECT DISTINCT ON ("MAQUINA")
            "MAQUINA",
            "HORA_FINAL"
          FROM base
          ORDER BY "MAQUINA", dt_fin_parsed DESC NULLS LAST
        )
        SELECT
          pm."MAQUINA"      AS maquina,
          pm.seletor,
          pm.dt_inicio,
          ph."HORA_INICIO"  AS hora_inicio,
          pm.dt_final,
          uh."HORA_FINAL"   AS hora_final,
          CASE
            WHEN pm.seletor IN ('URDIDEIRA', 'URDIDORA')
            THEN COALESCE(bm.metros_beam, pm.metros_raw)
            ELSE pm.metros_raw
          END               AS metros,
          pm.partida_display,
          rm.rot_106,
          iv.r103,     iv.cav105,  iv.vel_nom,
          tv.efic_pct, tv.ru105,   tv.rt105,
          av.veloc,
          pm.artigo,
          pm.cor,
          pm.nm_mercado
        FROM por_maquina pm
        LEFT JOIN primera_hora   ph ON ph."MAQUINA" = pm."MAQUINA"
        LEFT JOIN ultima_hora    uh ON uh."MAQUINA" = pm."MAQUINA"
        LEFT JOIN beam_max       bm ON bm."MAQUINA" = pm."MAQUINA"
        LEFT JOIN rot106_maq     rm ON rm."MAQUINA" = pm."MAQUINA"
        LEFT JOIN indigo_vals    iv ON iv."MAQUINA" = pm."MAQUINA"
        LEFT JOIN tecelagem_vals tv ON tv."MAQUINA" = pm."MAQUINA"
        LEFT JOIN acabamento_vals av ON av."MAQUINA" = pm."MAQUINA"
        ORDER BY pm.dt_inicio ASC NULLS LAST, pm."MAQUINA" ASC
      `;
      const resHistorial = await query(sqlHistorial, [partidaCandidates, filial, roladaDerivada], 'partida-tej/historial');
      const pf = v => (v !== null && v !== undefined) ? parseFloat(v) : null;
      historial = (resHistorial.rows || []).map(r => ({
        maquina:         r.maquina,
        seletor:         r.seletor,
        dt_inicio:       r.dt_inicio,
        hora_inicio:     r.hora_inicio,
        dt_final:        r.dt_final,
        hora_final:      r.hora_final,
        metros:          pf(r.metros),
        rot_106:         pf(r.rot_106),
        // INDIGO
        r103:            pf(r.r103),
        cav105:          pf(r.cav105),
        vel_nom:         pf(r.vel_nom),
        // TECELAGEM
        efic_pct:        pf(r.efic_pct),
        ru105:           pf(r.ru105),
        rt105:           pf(r.rt105),
        // ACABAMENTO
        veloc:           pf(r.veloc),
        partida_display: r.partida_display || '',
        artigo:          r.artigo,
        cor:             r.cor,
        nm_mercado:      r.nm_mercado
      }));
    } catch (histErr) {
      console.warn('partida-tej/historial: columnas no disponibles -', histErr.message);
      historial = [];
    }

    // ── Q8: tb_calidad agrupada por partida ────────────────────────────
    // REVISOR FINAL = Maquina; MIN/MAX de DAT_PROD+HORA como inicio/fin
    let calidad = [];
    try {
      const sqlCalidad = `
        WITH base_cal AS (
          SELECT
            c."PARTIDA",
            TRIM(c."REVISOR FINAL"::text)              AS revisor,
            ${pDate('c."DAT_PROD"')}                  AS dat_prod_parsed,
            LPAD(TRIM(COALESCE(c."HORA"::text, '0')), 4, '0') AS hora_fmt,
            ${pNum('c."METRAGEM"')}                   AS metros_val,
            ${pNum('c."PONTUACAO"')}                 AS pontuacao_val,
            ${pNum('c."LARGURA"')}                   AS largura_val,
            UPPER(TRIM(COALESCE(c."QUALIDADE"::text, ''))) AS qualidade_val,
            c."ARTIGO",
            c."COR",
            c."NM MERC"                               AS nm_mercado
          FROM tb_calidad c
          WHERE c."PARTIDA" = ANY($1::text[])
            AND TRIM(COALESCE(c."REVISOR FINAL"::text, '')) <> ''
        ),
        min_row AS (
          SELECT DISTINCT ON ("PARTIDA")
            "PARTIDA",
            dat_prod_parsed AS dat_inicio,
            LEFT(hora_fmt, 2) || ':' || RIGHT(hora_fmt, 2) AS hora_inicio
          FROM base_cal
          ORDER BY "PARTIDA", dat_prod_parsed ASC NULLS LAST, hora_fmt ASC NULLS LAST
        ),
        max_row AS (
          SELECT DISTINCT ON ("PARTIDA")
            "PARTIDA",
            dat_prod_parsed AS dat_final,
            LEFT(hora_fmt, 2) || ':' || RIGHT(hora_fmt, 2) AS hora_final
          FROM base_cal
          ORDER BY "PARTIDA", dat_prod_parsed DESC NULLS LAST, hora_fmt DESC NULLS LAST
        )
        SELECT
          STRING_AGG(
            DISTINCT b.revisor, ' / '
            ORDER BY b.revisor
          )                                     AS revisores,
          b."PARTIDA"                           AS partida,
          mn.dat_inicio,
          mn.hora_inicio,
          mx.dat_final,
          mx.hora_final,
          ROUND(SUM(b.metros_val)::numeric, 0)  AS metros,
          ROUND(
            SUM(CASE WHEN b.qualidade_val LIKE 'PRIMEIRA%' THEN b.metros_val ELSE 0 END)
            * 100.0 / NULLIF(SUM(b.metros_val), 0)
          , 1)                                  AS cal_pct,
          ROUND(
            SUM(b.pontuacao_val) * 100.0
            / NULLIF(SUM(b.metros_val * COALESCE(b.largura_val, 0) / 100.0), 0)
          , 1)                                  AS pts_100m2,
          MAX(b."ARTIGO")                       AS artigo,
          MAX(b."COR")                          AS cor,
          MAX(b.nm_mercado)                     AS nm_mercado
        FROM base_cal b
        JOIN min_row mn ON mn."PARTIDA" = b."PARTIDA"
        JOIN max_row mx ON mx."PARTIDA" = b."PARTIDA"
        GROUP BY b."PARTIDA", mn.dat_inicio, mn.hora_inicio, mx.dat_final, mx.hora_final
        ORDER BY mn.dat_inicio ASC NULLS LAST, b."PARTIDA" ASC
      `;
      const resCalidad = await query(sqlCalidad, [partidaCandidates], 'partida-tej/calidad');
      calidad = (resCalidad.rows || []).map(r => ({
        revisores:   r.revisores  || '',
        partida:     r.partida    || '',
        dat_inicio:  r.dat_inicio,
        hora_inicio: r.hora_inicio || '',
        dat_final:   r.dat_final,
        hora_final:  r.hora_final  || '',
        metros:      r.metros !== null ? parseFloat(r.metros) : null,
        cal_pct:     r.cal_pct  !== null && r.cal_pct  !== undefined ? parseFloat(r.cal_pct)  : null,
        pts_100m2:   r.pts_100m2 !== null && r.pts_100m2 !== undefined ? parseFloat(r.pts_100m2) : null,
        artigo:      r.artigo,
        cor:         r.cor,
        nm_mercado:  r.nm_mercado
      }));
    } catch (calErr) {
      console.warn('partida-tej/calidad:', calErr.message);
      calidad = [];
    }

    res.json({
      success: true,
      encontrada: true,
      encabezado,
      registros,
      totales,
      historial,
      calidad
    });

  } catch (err) {
    console.error('Error /api/produccion/partida-tejeduria:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/correlacion/mezcla-hilo
// Query params: fecha_inicio, fecha_fin, ne_titulo (opt)
app.get('/api/correlacion/mezcla-hilo', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, ne_titulo } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ success: false, error: 'Se requieren fecha_inicio y fecha_fin' });
    }

    // Extrae el numero de mistura del campo lote: "HD-91-25", "HD 91-25", etc. → "91"
    const sql = `
      WITH uster_lotes AS (
        SELECT
          u.testnr,
          u.lote AS lote_raw,
          u.nomcount,
          u.time_stamp,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) AS mistura_num
        FROM tb_uster_par u
        WHERE u.time_stamp IS NOT NULL
          AND TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY') BETWEEN $1::date AND $2::date
          AND ($3::text IS NULL OR u.nomcount = SPLIT_PART($3, '/', 1) OR u.nomcount::text ILIKE $3)
      ),
      uster_avg AS (
        SELECT
          testnr,
          ROUND(AVG(cvm_percent)::numeric, 2)       AS cvm,
          ROUND(AVG(h)::numeric, 2)                 AS vellosidad,
          ROUND(AVG(neps_200_km)::numeric, 1)        AS neps_200,
          ROUND(AVG(delg_minus50_km)::numeric, 1)    AS thin_50,
          ROUND(AVG(grue_50_km)::numeric, 1)         AS thick_50
        FROM tb_uster_tbl
        GROUP BY testnr
      ),
      tenso_avg AS (
        SELECT
          p.uster_testnr,
          ROUND(AVG(t.tenacidad)::numeric, 2)   AS tenacidad,
          ROUND(AVG(t.elongacion)::numeric, 2)  AS elongacion
        FROM tb_tensorapid_par p
        JOIN tb_tensorapid_tbl t ON t.testnr = p.testnr
        WHERE p.uster_testnr IS NOT NULL
        GROUP BY p.uster_testnr
      ),
      hvi_avg AS (
        SELECT
          "LOTE_FIAC"::integer                                       AS lote_fiac_num,
          ROUND(AVG(REPLACE("STR",  ',', '.')::numeric), 2)          AS str_avg,
          ROUND(AVG(REPLACE("SCI",  ',', '.')::numeric), 2)          AS sci_avg,
          ROUND(AVG(REPLACE("MIC",  ',', '.')::numeric), 3)          AS mic_avg,
          ROUND(AVG(REPLACE("UHML", ',', '.')::numeric), 2)          AS uhml_avg,
          COUNT(*)                                                   AS fardos
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '^\\d+$'
          AND "STR"  ~ '^[0-9][0-9,\\.]*$'
          AND "SCI"  ~ '^[0-9][0-9,\\.]*$'
          AND "MIC"  ~ '^[0-9][0-9,\\.]*$'
          AND "UHML" ~ '^[0-9][0-9,\\.]*$'
        GROUP BY "LOTE_FIAC"::integer
      )
      SELECT
        ul.lote_raw,
        ul.mistura_num,
        ul.nomcount        AS ne_titulo,
        TO_DATE(SPLIT_PART(ul.time_stamp, ' ', 1), 'DD/MM/YYYY') AS fecha,
        ua.cvm,
        ua.vellosidad,
        ua.neps_200,
        ua.thin_50,
        ua.thick_50,
        ta.tenacidad,
        ta.elongacion,
        ha.str_avg   AS str,
        ha.sci_avg   AS sci,
        ha.mic_avg   AS mic,
        ha.uhml_avg  AS uhml,
        ha.fardos    AS fardos_hvi
      FROM uster_lotes ul
      JOIN uster_avg  ua ON ua.testnr       = ul.testnr
      LEFT JOIN tenso_avg ta ON ta.uster_testnr = ul.testnr
      JOIN hvi_avg    ha ON ha.lote_fiac_num = ul.mistura_num::integer
      ORDER BY ul.time_stamp ASC
    `;

    const result = await query(sql, [fecha_inicio, fecha_fin, ne_titulo || null], 'correlacion-mezcla-hilo');
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({ success: true, datos: [], correlaciones: [], n: 0 });
    }

    // Variables HVI disponibles como causas
    const hviVars   = ['str', 'sci', 'mic', 'uhml'];
    // Variables hilo disponibles como efectos
    const hiloVars  = ['cvm', 'vellosidad', 'neps_200', 'thin_50', 'thick_50', 'tenacidad', 'elongacion'];

    // Filtra pares validos (ambos valores numéricos != null) para cada combinación
    const correlaciones = [];
    for (const hv of hviVars) {
      for (const yv of hiloVars) {
        const pares = rows.filter(r =>
          r[hv] != null && r[yv] != null &&
          !isNaN(parseFloat(r[hv])) && !isNaN(parseFloat(r[yv]))
        );
        if (pares.length < 3) continue;
        const x = pares.map(r => parseFloat(r[hv]));
        const y = pares.map(r => parseFloat(r[yv]));
        const r  = pearsonCorrelation(x, y);
        const lr = linearRegression(x, y);
        correlaciones.push({
          hvi_var:   hv,
          hilo_var:  yv,
          r,
          r2:        lr.r2,
          slope:     lr.slope,
          intercept: lr.intercept,
          n:         pares.length,
          // Para el scatter plot
          puntos: pares.map((row, i) => ({
            x:       x[i],
            y:       y[i],
            lote:    row.lote_raw,
            titulo:  row.ne_titulo,
            fecha:   row.fecha
          }))
        });
      }
    }

    res.json({ success: true, datos: rows, correlaciones, n: rows.length });
  } catch (err) {
    console.error('Error en correlacion mezcla-hilo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/correlacion/narrativa
// Body: { correlaciones, n, fecha_inicio, fecha_fin, ne_titulo, model }
app.post('/api/correlacion/narrativa', async (req, res) => {
  try {
    const { correlaciones, n, fecha_inicio, fecha_fin, ne_titulo, model: modelReq } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_API_KEY no configurada' });
    }

    const modelName = modelReq || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const etiquetas = {
      str: 'STR (Tenacidad Fibra, g/tex)',
      sci: 'SCI (Spinning Consistency Index)',
      mic: 'MIC (Micronaire)',
      uhml: 'UHML (Longitud media fibra, mm)',
      cvm: 'CVm% (Irregularidad de masa)',
      vellosidad: 'H (Vellosidad Uster)',
      neps_200:  'Neps 200%/km',
      thin_50:   'Puntos delgados -50%/km',
      thick_50:  'Puntos gruesos +50%/km',
      tenacidad: 'Tenacidad hilo (cN/tex)',
      elongacion:'Elongación hilo (%)'
    };

    const resumen = correlaciones
      .filter(c => Math.abs(c.r) >= 0.3)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 12)
      .map(c => {
        const dir = c.slope >= 0 ? 'aumenta' : 'disminuye';
        const unidadHvi = c.hvi_var === 'str' ? 'g/tex' : c.hvi_var === 'mic' ? 'unidades' : c.hvi_var === 'uhml' ? 'mm' : 'puntos';
        const unidadHilo = ['cvm','vellosidad','neps_200','thin_50','thick_50'].includes(c.hvi_var) ? 'unidades' : 'cN/tex';
        return `- ${etiquetas[c.hvi_var]} → ${etiquetas[c.hilo_var]}: r=${c.r} (${c.n} muestras). Por cada 1 ${unidadHvi} de aumento en ${c.hvi_var.toUpperCase()}, el ${c.hilo_var.toUpperCase()} ${dir} ${Math.abs(c.slope).toFixed(3)} ${unidadHilo}.`;
      }).join('\n');

    const prompt = `Actúa como un Analista Senior de Control de Calidad Textil especializado en hilatura de Denim.

Recibirás un análisis de correlación estadística entre variables de FIBRA (HVI) y variables de HILO (Uster + Tensorapid) calculado sobre ${n} ensayos históricos de la planta, periodo ${fecha_inicio} a ${fecha_fin}${ne_titulo ? `, título Ne ${ne_titulo}` : ', todos los títulos'}.

CORRELACIONES DETECTADAS (r = coeficiente de Pearson, slope = pendiente de regresión lineal):
${resumen || 'No se detectaron correlaciones significativas (r >= 0.3) con los datos disponibles.'}

TAREA:
Redactá en español un análisis técnico dividido en exactamente 3 secciones usando Markdown:

## 1. Relaciones Causa-Efecto Confirmadas
Explicá en lenguaje claro (para un jefe de planta, no un estadístico) qué variables de la mezcla impactan más en la calidad del hilo y en qué dirección. Cuantificá el impacto ("por cada unidad que sube X, Y cambia en Z").

## 2. Oportunidades de Optimización
Basado en las correlaciones encontradas, indicá qué ajustes en la mezcla podrían mejorar la calidad del hilo o reducir costos sin sacrificar estándares. Sé específico y accionable.

## 3. Veredicto y Recomendación
Un párrafo ejecutivo de 3-4 oraciones que un gerente pueda leer en 20 segundos. Indicá si los datos son suficientes para tomar decisiones o si se necesitan más muestras.

REGLAS:
- No inventes relaciones que no estén en los datos.
- Si el n es bajo (< 10), advierte sobre la limitación estadística.
- Usá terminología textil correcta.
- Formato Markdown.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ success: true, narrativa: text });
  } catch (error) {
    console.error('Error narrativa correlacion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/mezcla-lotes
// Comparativa HVI + Uster + Tensorapid por lotes de mezcla
// Query: lotes (ej: "107,108,109"), ne (opcional, ej: "10/1")
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/dashboard/mezcla-lotes', async (req, res) => {
  try {
    const { lotes, ne } = req.query;
    if (!lotes) return res.status(400).json({ error: 'Se requiere parámetro lotes (ej: 107,108,109)' });

    const loteList = [...new Set(
      lotes.split(',').map(l => parseInt(l.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    )];
    if (loteList.length === 0) return res.status(400).json({ error: 'Sin lotes válidos' });

    const sql = `
      WITH hvi_agg AS (
        -- Filtra por LOTE_FIAC (el número que ingresa el usuario), no por MISTURA.
        -- n_fardos = fardos efectivamente consumidos (DT_ENTRADA_PROD no nulo).
        -- n_secuencias = secuencias (SEQ) ingresadas a blendomat con fecha.
        SELECT
          CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS mistura,
          MAX(CAST(NULLIF(regexp_replace("MISTURA", '[^0-9]', '', 'g'), '') AS INTEGER))::text AS mistura_real,
          ROUND(AVG(CASE WHEN "STR"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("STR",  ',', '.')::numeric END), 2) AS str,
          ROUND(AVG(CASE WHEN "SCI"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SCI",  ',', '.')::numeric END), 1) AS sci,
          ROUND(AVG(CASE WHEN "MIC"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MIC",  ',', '.')::numeric END), 3) AS mic,
          ROUND(AVG(CASE WHEN "UHML" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UHML", ',', '.')::numeric END), 2) AS uhml,
          ROUND(AVG(CASE WHEN "UI"   ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UI",   ',', '.')::numeric END), 2) AS ui,
          ROUND(AVG(CASE WHEN "ELG"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("ELG",  ',', '.')::numeric END), 2) AS elg_fibra,
            (
              SELECT STRING_AGG(grado || ' (' || ROUND((peso_grado / NULLIF(peso_total, 0)) * 100, 1) || '%)', ', ')
              FROM (
                  SELECT 
                      grado, 
                      peso_grado, 
                      SUM(peso_grado) OVER() AS peso_total
                  FROM (
                      SELECT 
                          NULLIF(TRIM(COALESCE(t2."TP", '') || ' ' || COALESCE(t2."CLASSIFIC", '')), '') AS grado,
                          SUM(CAST(REPLACE(REPLACE(COALESCE(t2."PESO", '0'), '.', ''), ',', '.') AS NUMERIC)) AS peso_grado
                      FROM tb_calidad_fibra t2
                      WHERE t2."TIPO_MOV" = 'MIST'
                        AND CAST(NULLIF(regexp_replace(t2."LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)
                        AND NULLIF(TRIM(COALESCE(t2."TP", '') || ' ' || COALESCE(t2."CLASSIFIC", '')), '') IS NOT NULL
                      GROUP BY NULLIF(TRIM(COALESCE(t2."TP", '') || ' ' || COALESCE(t2."CLASSIFIC", '')), '')
                  ) sub
              ) calc
            ) AS clasificacion_argentina,
            (
              SELECT STRING_AGG('Corteza ' || grado || ' (' || ROUND((peso_grado / NULLIF(peso_total, 0)) * 100, 1) || '%)', ', ')
              FROM (
                  SELECT 
                      grado, 
                      peso_grado, 
                      SUM(peso_grado) OVER() AS peso_total
                  FROM (
                      SELECT 
                          NULLIF(TRIM(COALESCE(t2."CORTEZA", '')), '') AS grado,
                          SUM(CAST(REPLACE(REPLACE(COALESCE(t2."PESO", '0'), '.', ''), ',', '.') AS NUMERIC)) AS peso_grado
                      FROM tb_calidad_fibra t2
                      WHERE t2."TIPO_MOV" = 'MIST'
                        AND CAST(NULLIF(regexp_replace(t2."LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)
                        AND NULLIF(TRIM(COALESCE(t2."CORTEZA", '')), '') IS NOT NULL
                      GROUP BY NULLIF(TRIM(COALESCE(t2."CORTEZA", '')), '')
                  ) sub
              ) calc
            ) AS corteza_porcentaje,
          -- Solo fardos con fecha de entrada a producción (consumidos en blendomat)
          SUM(CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> ''
                   THEN ROUND(REPLACE("QTDE"::text, ',', '.')::numeric)::integer
                   ELSE 0 END) AS n_fardos,
          -- Secuencias distintas que ya ingresaron (DT_ENTRADA_PROD no nulo)
          COUNT(DISTINCT CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> '' THEN "SEQ" END) AS n_secuencias
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '[0-9]'
          AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = ANY($1::integer[])
        GROUP BY CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)
      ),
      carda_kgh_agg AS (
        SELECT
          mistura,
          STRING_AGG(machine_family || ': ' || ROUND(avg_kgh, 1) || ' KG/H (' || muestras || ' muestras)', ', ' ORDER BY machine_family) AS cardas_kgh
        FROM (
          SELECT
            COALESCE(
              (regexp_match(p.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(p.lote, '(\\d+)'))[1]
            )::integer AS mistura,
            p.machine_family,
            ROUND(AVG((regexp_match(p.obs, '(\\d+\\.?\\d*)'))[1]::numeric), 1) AS avg_kgh,
            COUNT(*) AS muestras
          FROM tb_uster_carda_par p
          WHERE COALESCE(
              (regexp_match(p.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(p.lote, '(\\d+)'))[1]
            ) IS NOT NULL
            AND p.obs ~ '^\\d'
            AND p.machine_family IS NOT NULL
            AND p.machine_family <> ''
          GROUP BY 1, p.machine_family
        ) sub
        WHERE mistura = ANY($1::integer[])
        GROUP BY mistura
      ),
      uster_base AS (
        SELECT
          u.testnr,
          u.nomcount AS ne,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) AS mistura_str
        FROM tb_uster_par u
        WHERE COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) IS NOT NULL
          AND ($2::text IS NULL OR u.nomcount = SPLIT_PART($2, '/', 1) OR u.nomcount::text ILIKE $2)
      ),
      uster_lotes AS (
        SELECT testnr, ne, mistura_str::integer AS mistura
        FROM uster_base
        WHERE mistura_str ~ '^\\d+$'
          AND mistura_str::integer = ANY($1::integer[])
      ),
      uster_agg AS (
        SELECT
          ul.mistura,
          ul.ne,
          ROUND(AVG(t.cvm_percent)::numeric,    2) AS cvm,
          ROUND(AVG(t.h)::numeric,              2) AS vellosidad,
          ROUND(AVG(t.neps_200_km)::numeric,    1) AS neps_200,
          ROUND(AVG(t.delg_minus30_km)::numeric,1) AS thin_30,
          ROUND(AVG(t.delg_minus40_km)::numeric,1) AS thin_40,
          ROUND(AVG(t.delg_minus50_km)::numeric,1) AS thin_50,
          ROUND(AVG(t.grue_35_km)::numeric,     1) AS thick_35,
          ROUND(AVG(t.grue_50_km)::numeric,     1) AS thick_50,
          ROUND(AVG(t.neps_140_km)::numeric,    1) AS neps_140,
          ROUND(AVG(t.neps_280_km)::numeric,    1) AS neps_280,
          COUNT(DISTINCT ul.testnr)               AS n_uster
        FROM uster_lotes ul
        JOIN tb_uster_tbl t ON t.testnr = ul.testnr
        GROUP BY ul.mistura, ul.ne
      ),
      tenso_agg AS (
        SELECT
          ul.mistura,
          ul.ne,
          ROUND(AVG(tt.tenacidad)::numeric,  2) AS tenacidad,
          ROUND(AVG(tt.elongacion)::numeric, 2) AS elongacion,
          ROUND(AVG(tt.fuerza_b)::numeric,   2) AS fuerza_b,
          ROUND(AVG(tt.trabajo)::numeric,    2) AS trabajo_b
        FROM uster_lotes ul
        JOIN tb_tensorapid_par tp ON tp.uster_testnr = ul.testnr
        JOIN tb_tensorapid_tbl tt ON tt.testnr = tp.testnr
        GROUP BY ul.mistura, ul.ne
      )
      SELECT
        h.mistura,
        h.mistura_real,
        h.str,
        h.sci,
        h.mic,
        h.uhml,
        h.ui,
        h.elg_fibra,
          h.clasificacion_argentina,
          h.corteza_porcentaje,
        h.n_fardos,
        h.n_secuencias,
        ua.ne,
        ua.cvm,
        ua.vellosidad,
        ua.neps_200,
        ua.thin_30,
        ua.thin_40,
        ua.thin_50,
        ua.thick_35,
        ua.thick_50,
        ua.neps_140,
        ua.neps_280,
        ua.n_uster,
        ta.tenacidad,
        ta.elongacion,
        ta.fuerza_b,
        ta.trabajo_b,
        ck.cardas_kgh
      FROM hvi_agg h
      LEFT JOIN uster_agg  ua ON ua.mistura = h.mistura
      LEFT JOIN tenso_agg  ta ON ta.mistura = h.mistura AND ta.ne = ua.ne
      LEFT JOIN carda_kgh_agg ck ON ck.mistura = h.mistura
      ORDER BY h.mistura ASC, ua.ne::numeric ASC NULLS LAST
    `;

    const result = await query(sql, [loteList, ne || null], 'dashboard/mezcla-lotes');

    // ── Contexto Uster Cardas ─────────────────────────────────────────────────
    let cardasCtx = null
    try {
      // Verificar si la tabla existe antes de consultar
      const tblCheck = await query(`SELECT to_regclass('public.tb_uster_carda_par') AS reg`)
      if (tblCheck.rows[0]?.reg) {
        const sqlCardas = `
          WITH ultimo_dia AS (
            SELECT DATE(created_at AT TIME ZONE 'America/Buenos_Aires') AS dia
            FROM tb_uster_carda_par
            ORDER BY created_at DESC
            LIMIT 1
          ),
          ensayos AS (
            SELECT
              p.testnr, p.maschnr, p.machine_family, p.nomcount, p.lote,
              ROUND(AVG(t.cvm_percent)::numeric, 2) AS cvm_avg,
              COUNT(t.id) AS tbl_rows
            FROM tb_uster_carda_par p
            LEFT JOIN tb_uster_carda_tbl t ON t.testnr = p.testnr
            WHERE DATE(p.created_at AT TIME ZONE 'America/Buenos_Aires') = (SELECT dia FROM ultimo_dia)
            GROUP BY p.testnr, p.maschnr, p.machine_family, p.nomcount, p.lote
          ),
          maq_resumen AS (
            SELECT
              maschnr,
              MAX(machine_family) AS machine_family,
              MAX(nomcount) AS nomcount,
              ROUND(AVG(cvm_avg)::numeric, 2) AS cvm_avg,
              COUNT(*) AS ensayos_maq
            FROM ensayos
            GROUP BY maschnr
          )
          SELECT
            TO_CHAR((SELECT dia FROM ultimo_dia), 'DD/MM/YYYY') AS fecha,
            (SELECT COUNT(*) FROM ensayos) AS ensayos,
            COUNT(*) AS maquinas,
            ROUND(AVG(cvm_avg)::numeric, 2) AS cvm_avg_global,
            ROUND(MAX(cvm_avg)::numeric, 2) AS cvm_max,
            ROUND(MIN(cvm_avg)::numeric, 2) AS cvm_min,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'maschnr', maschnr,
                'machine_family', COALESCE(machine_family, 'N/D'),
                'nomcount', nomcount,
                'cvm_avg', cvm_avg,
                'ensayos', ensayos_maq
              ) ORDER BY COALESCE(machine_family, 'N/D'), maschnr::numeric NULLS LAST
            ) AS maquinas_detalle
          FROM maq_resumen
        `
        const resCardas = await query(sqlCardas, [], 'cardas-context')
        const row = resCardas.rows[0]
        if (row?.fecha) {
          const maquinas = (row.maquinas_detalle || [])
          cardasCtx = {
            disponible: true,
            fecha: row.fecha,
            resumen: {
              ensayos: Number(row.ensayos),
              maquinas: Number(row.maquinas),
              cvm_avg: row.cvm_avg_global != null ? Number(row.cvm_avg_global) : null,
              cvm_max: row.cvm_max != null ? Number(row.cvm_max) : null,
              cvm_min: row.cvm_min != null ? Number(row.cvm_min) : null,
            },
            maquinas,
          }
        } else {
          cardasCtx = { disponible: false, motivo: 'No hay ensayos Uster Cardas importados aún.' }
        }
      } else {
        cardasCtx = { disponible: false, motivo: 'Tabla de Uster Cardas pendiente de creación (importar primer ensayo).' }
      }
    } catch (cardaErr) {
      console.warn('cardas-context error (non-blocking):', cardaErr.message)
      cardasCtx = { disponible: false, motivo: `Error al cargar contexto: ${cardaErr.message}` }
    }

    // ── Análisis por proveedor (PRODUTOR) ────────────────────────────────────
    const sqlProv = `
      SELECT
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS mistura,
        "PRODUTOR" AS produtor,
        ROUND(AVG(CASE WHEN "STR"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("STR",  ',', '.')::numeric END), 2) AS str,
        ROUND(AVG(CASE WHEN "SCI"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SCI",  ',', '.')::numeric END), 1) AS sci,
        ROUND(AVG(CASE WHEN "MIC"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MIC",  ',', '.')::numeric END), 3) AS mic,
        ROUND(AVG(CASE WHEN "UHML" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UHML", ',', '.')::numeric END), 2) AS uhml,
        SUM(CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> ''
                 THEN ROUND(REPLACE("QTDE"::text, ',', '.')::numeric)::integer
                 ELSE 0 END) AS fardos_consumidos,
        COUNT(DISTINCT CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> '' THEN "SEQ" END) AS secuencias
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND "LOTE_FIAC" ~ '[0-9]'
        AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = ANY($1::integer[])
      GROUP BY
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER),
        "PRODUTOR"
      ORDER BY mistura, fardos_consumidos DESC
    `;
    const provResult = await query(sqlProv, [loteList], 'dashboard/mezcla-lotes/proveedores');
    res.json({ success: true, rows: result.rows, proveedores: provResult.rows, lotes: loteList, cardas: cardasCtx });
  } catch (err) {
    console.error('Error /api/dashboard/mezcla-lotes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: bloque de Correlación OE para informe local
// ─────────────────────────────────────────────────────────────────────────────
function buildBloqueOE(oeData, lotesSorted) {
  if (!oeData || !oeData.length) return [];
  const numV = (v) => Number(v) || 0;
  const tipos = [
    { key: 'nat_total', label: 'Naturales' },
    { key: 'n_total',   label: 'N (Neps)' },
    { key: 's_total',   label: 'S (Cortos)' },
    { key: 'l_total',   label: 'L (Largos)' },
    { key: 't_total',   label: 'T (Finos)' },
    { key: 'mo_total',  label: 'MO (Moiré)' },
    { key: 'jp_total',  label: 'JP (P+)' },
    { key: 'jm_total',  label: 'JM (P-)' },
  ];
  const machineKeys = [...new Map(
    oeData.map(r => [`${r.maquina}|${r.item}`, { maquina: r.maquina, item: r.item, desc_item: r.desc_item }])
  ).values()];
  const lines = [];
  lines.push('🔗 CORRELACIÓN CON PRODUCCIÓN OE:');
  lines.push('Cortes de purga Open End — totales acumulados por período analizado');
  lines.push('');
  for (const mk of machineKeys) {
    const maqRows = oeData.filter(r => r.maquina === mk.maquina && r.item === mk.item);
    const lotesConDatos = lotesSorted.filter(l => maqRows.some(r => Number(r.lote) === l));
    if (!lotesConDatos.length) continue;
    lines.push(`  Máq. ${mk.maquina} — ${mk.desc_item || mk.item}:`);
    const loteHeader = lotesConDatos.map(l => `L.${l}`.padStart(7)).join(' |');
    lines.push(`    ${'Tipo'.padEnd(12)} |${loteHeader}`);
    for (const ct of tipos) {
      const vals = lotesConDatos.map(l => {
        const row = maqRows.find(r => Number(r.lote) === l);
        return row ? numV(row[ct.key]) : null;
      });
      if (vals.filter(v => v !== null).every(v => v === 0)) continue;
      const valStr = vals.map(v => (v === null ? '      –' : String(v).padStart(7))).join(' |');
      let trend = '';
      const numericVals = vals.filter(v => v !== null);
      if (numericVals.length >= 2) {
        const first = numericVals[0], last = numericVals[numericVals.length - 1];
        if (first > 0) {
          const p = Math.round((last - first) / first * 100);
          trend = last < first ? ` ⬇️ Mejoró (${p}%)` : last > first ? ` ⬆️ Empeoró (+${p}%)` : ' = Sin cambio';
        }
      }
      lines.push(`    ${ct.label.padEnd(12)} |${valStr}${trend}`);
    }
    const eficStr = lotesConDatos.map(l => {
      const row = maqRows.find(r => Number(r.lote) === l);
      return (row && row.efic_avg != null) ? `${row.efic_avg}%`.padStart(7) : '      –';
    }).join(' |');
    lines.push(`    ${'Efic. Prom.'.padEnd(12)} |${eficStr}`);
    lines.push('');
  }
  return lines;
}

function formatOEParaPrompt(oeData, lotesSorted) {
  if (!oeData || !oeData.length) return '';
  const n = (v) => Number(v) || 0;
  const pctStr = (a, b) => n(a) === 0 ? '–' : `${Math.round((n(b) - n(a)) / n(a) * 100)}%`;
  const machineKeys = [...new Map(
    oeData.map(r => [`${r.maquina}|${r.item}`, { maquina: r.maquina, item: r.item, desc_item: r.desc_item }])
  ).values()];
  const lines = [];
  for (const mk of machineKeys) {
    const maqRows = oeData.filter(r => r.maquina === mk.maquina && r.item === mk.item);
    if (maqRows.length < 2) continue;
    const ref = maqRows.find(r => Number(r.lote) === lotesSorted[0]);
    const act = maqRows.find(r => Number(r.lote) === lotesSorted[lotesSorted.length - 1]);
    if (!ref || !act || ref === act) continue;
    lines.push(
      `  Máq.${mk.maquina} (${mk.desc_item}): ` +
      `Nat ${n(ref.nat_total)}→${n(act.nat_total)}(${pctStr(ref.nat_total, act.nat_total)}) ` +
      `N ${n(ref.n_total)}→${n(act.n_total)} S ${n(ref.s_total)}→${n(act.s_total)} ` +
      `L ${n(ref.l_total)}→${n(act.l_total)} T ${n(ref.t_total)}→${n(act.t_total)} ` +
      `MO ${n(ref.mo_total)}→${n(act.mo_total)} ` +
      `JP ${n(ref.jp_total)}→${n(act.jp_total)} JM ${n(ref.jm_total)}→${n(act.jm_total)} ` +
      `Efic.${act.efic_avg ?? '–'}%`
    );
  }
  return lines.length ? `PRODUCCIÓN OE (cortes totales de purga):\n${lines.join('\n')}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Genera el informe de forma local (sin IA externa) — siempre disponible
// ─────────────────────────────────────────────────────────────────────────────
function generarNarrativaLocal(rows, loteActual, proveedores = [], oeData = []) {
  const lotesSorted = [...new Set(rows.map(r => Number(r.mistura)))].sort((a, b) => a - b);
  const actual = loteActual ? Number(loteActual) : Math.max(...lotesSorted);
  const refs   = lotesSorted.filter(l => l !== actual);

  const f = (v, d = 2) => (v == null || isNaN(parseFloat(v))) ? '–' : parseFloat(v).toFixed(d);
  const pct = (a, b) => {
    if (a == null || b == null) return '';
    const d = parseFloat(b) - parseFloat(a);
    const p = (d / Math.abs(parseFloat(a))) * 100;
    return ` (${d >= 0 ? '+' : ''}${p.toFixed(1)}%)`;
  };

  // Agrupa por lote y obtiene primer registro HVI + todos los Ne
  const getLote = (m) => ({ hvi: rows.find(r => Number(r.mistura) === m) || {}, hilos: rows.filter(r => Number(r.mistura) === m && r.ne != null) });
  const dataActual = getLote(actual);
  const dataRefs   = refs.map(getLote);

  // Nivel de semáforo global del lote actual
  let nivelGlobal = 'VERDE';
  const alertas = [];
  for (const h of dataActual.hilos) {
    const ten = parseFloat(h.tenacidad);
    const elo = parseFloat(h.elongacion);
    const nps = parseFloat(h.neps_200);
    const cvm = parseFloat(h.cvm);
    if (!isNaN(ten) && ten < 14.5) { nivelGlobal = 'ROJO'; alertas.push(`Ne${h.ne}: Tenacidad crítica (${f(ten)} cN/tex < 14.5)`); }
    else if (!isNaN(ten) && ten < 16.0) { if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO'; alertas.push(`Ne${h.ne}: Tenacidad en zona de precaución (${f(ten)} cN/tex)`); }
    if (!isNaN(elo) && elo < 7.5) { if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO'; alertas.push(`Ne${h.ne}: Elongación ${f(elo)}% – riesgo rotura en Urdidora`); }
    if (!isNaN(nps) && nps > 700) { nivelGlobal = 'ROJO'; alertas.push(`Ne${h.ne}: Neps ${f(nps,1)}/km – riesgo en Índigo`); }
    if (!isNaN(cvm) && cvm > 13.0) { if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO'; alertas.push(`Ne${h.ne}: CVm% ${f(cvm)} – masa irregular`); }
  }

  const estadoLabel = { VERDE: '✅ APROBADO PARA CONTINUIDAD', AMARILLO: '⚠️ PRECAUCIÓN – REVISAR', ROJO: '🔴 CRÍTICO – DETENER' }[nivelGlobal];
  const conclusionBase = {
    VERDE: `El Lote FIAC ${actual} cumple todos los umbrales críticos de aptitud para tejeduría.${refs.length ? ` Supera o iguala el desempeño de referencia (${refs.join('/')}).` : ''}`,
    AMARILLO: `El Lote FIAC ${actual} presenta valores fuera de rango en algunas variables; se recomienda monitoreo intensivo en los procesos afectados.`,
    ROJO: `El Lote FIAC ${actual} registra valores críticos que requieren acción inmediata antes de continuar la producción.`
  }[nivelGlobal];

  // Genera comparativas por variable
  let numVar = 0;
  const bloques = [];

  const varDefs = [
    { key: 'str',       label: 'STR — Tenacidad Fibra', unit: 'g/tex', src: 'hvi', buenos: 27, bad: 25, inv: false },
    { key: 'sci',       label: 'SCI — Índice Hilabilidad', unit: '',   src: 'hvi', buenos: 145, bad: 130, inv: false },
    { key: 'tenacidad', label: 'Tenacidad Hilo', unit: 'cN/tex',       src: 'hilo', buenos: 16, bad: 14.5, inv: false },
    { key: 'elongacion',label: 'Elongación Hilo', unit: '%',           src: 'hilo', buenos: 8,  bad: 7.5,  inv: false },
    { key: 'cvm',       label: 'CVm% — Irregularidad de Masa', unit: '%', src: 'hilo', buenos: 12, bad: 13, inv: true },
    { key: 'neps_200',  label: 'Neps +200%', unit: '/km',              src: 'hilo', buenos: 500, bad: 700, inv: true },
  ];

  const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

  for (const vd of varDefs) {
    const getVal = (loteData) => {
      if (vd.src === 'hvi') return parseFloat(loteData.hvi[vd.key]);
      // Para hilo: promedio de todos los Ne
      const vals = loteData.hilos.map(h => parseFloat(h[vd.key])).filter(v => !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b) / vals.length : NaN;
    };

    const valActual = getVal(dataActual);
    if (isNaN(valActual)) continue;

    const descriptor = (val, inv) => {
      if (isNaN(val)) return '–';
      const good = vd.buenos, bad2 = vd.bad;
      if (inv) return val <= good ? '✅ Óptimo' : val <= bad2 ? '⚠️ Precaución' : '🔴 Crítico';
      return val >= good ? '✅ Óptimo' : val >= bad2 ? '⚠️ Precaución' : '🔴 Crítico';
    };

    numVar++;
    let bloque = `${emojis[numVar-1] || `${numVar}.`} ${vd.label.toUpperCase()}:\n`;
    for (const rd of dataRefs) {
      const v = getVal(rd);
      bloque += `  • Lote ${refs[dataRefs.indexOf(rd)]}: ${isNaN(v) ? '(sin datos)' : `${f(v)} ${vd.unit} ${descriptor(v, vd.inv)}`}\n`;
    }
    bloque += `  • Lote ${actual}: ${f(valActual)} ${vd.unit} ${descriptor(valActual, vd.inv)}\n`;

    // Trend vs primer ref
    if (dataRefs.length > 0) {
      const vRef = getVal(dataRefs[0]);
      if (!isNaN(vRef)) {
        const diff = valActual - vRef;
        const arrow = diff > 0.001 ? '↑' : diff < -0.001 ? '↓' : '=';
        const mejor = vd.inv ? diff < 0 : diff > 0;
        const cambio = `${arrow} ${Math.abs(diff).toFixed(2)} ${vd.unit}${pct(vRef, valActual)}`;
        const impactoDesc = {
          tenacidad: vd.inv ? `Hilo más débil, mayor riesgo de paradas en Telar.` : diff > 0.5 ? `Hilo significativamente más resistente, menor riesgo de rotura en Telar.` : diff > 0 ? `Leve mejora en resistencia.` : `Leve reducción; monitorear en alta velocidad.`,
          elongacion: diff < 0 ? `Menor absorción de impacto, mayor riesgo de rotura en Urdidora.` : `Mejor elasticidad, más tolerancia a la tensión.`,
          cvm: diff < 0 ? `Masa más uniforme; menos irregularidad visual en la tela.` : `Mayor irregularidad de masa; posible barreado.`,
          neps_200: diff < 0 ? `Hilo más limpio; menos enredos y arrastre de colorante desigual en Índigo.` : `Más impurezas; evaluar ajuste de cardas.`,
          str: diff > 0 ? `Fibra más resistente, impacto positivo directo en tenacidad del hilo.` : `Reducción en tenacidad de fibra.`,
          sci: diff > 0 ? `Mayor consistencia de hilatura, menos paradas de rotura esperadas.` : `Menor índice composite; revisar mezcla.`,
        }[vd.key] || '';
        bloque += `  👉 Variación: ${cambio} (${mejor ? 'mejora' : 'empeora'}). ${impactoDesc}`;
      }
    }
    bloques.push(bloque);
  }

  // Puntos clave adicionales por Ne
  const puntosNe = [];
  const HilosActual = dataActual.hilos;
  for (const h of HilosActual) {
    const ten = parseFloat(h.tenacidad);
    const elo = parseFloat(h.elongacion);
    const nps = parseFloat(h.neps_200);
    if (!isNaN(ten) && ten >= 16.0) puntosNe.push(`🔸 Ne${h.ne}: Tenacidad ${f(ten)} cN/tex — APTO telar alta velocidad.`);
    if (!isNaN(elo) && elo >= 8.0)  puntosNe.push(`🔸 Ne${h.ne}: Elongación ${f(elo)}% — buena absorción de impacto en Urdidora.`);
    if (!isNaN(nps) && nps < 200)   puntosNe.push(`🔸 Ne${h.ne}: Neps ${f(nps,1)}/km — hilo muy limpio para Índigo.`);
  }

  // ── Análisis por proveedor del lote actual ──────────────────────────────
  const provActual = (proveedores || []).filter(p => Number(p.mistura) === actual);
  let bloqueProveedores = [];
  if (provActual.length > 0) {
    const totalFardos = provActual.reduce((s, p) => s + (Number(p.fardos_consumidos) || 0), 0);

    // Listas con valor numérico válido por variable
    const withStr  = provActual.filter(p => p.str  != null && !isNaN(parseFloat(p.str)));
    const withSci  = provActual.filter(p => p.sci  != null && !isNaN(parseFloat(p.sci)));
    const withMic  = provActual.filter(p => p.mic  != null && !isNaN(parseFloat(p.mic)));
    const withUhml = provActual.filter(p => p.uhml != null && !isNaN(parseFloat(p.uhml)));

    // STR / UHML / SCI: mayor = mejor
    const best  = (arr, key) => arr.length ? arr.reduce((a, b) => parseFloat(a[key]) >= parseFloat(b[key]) ? a : b) : null;
    const worst = (arr, key) => arr.length ? arr.reduce((a, b) => parseFloat(a[key]) <= parseFloat(b[key]) ? a : b) : null;
    // MIC: rango óptimo 3.5–4.9; más alejado del centro (4.2) = peor
    const micDist = p => Math.abs(parseFloat(p.mic) - 4.2);
    const bestMic  = withMic.length ? withMic.reduce((a, b) => micDist(a) <= micDist(b) ? a : b) : null;
    const worstMic = withMic.length ? withMic.reduce((a, b) => micDist(a) >= micDist(b) ? a : b) : null;
    const micOutOfRange = withMic.filter(p => { const v = parseFloat(p.mic); return v < 3.5 || v > 4.9; });

    const obs = [];
    if (best(withStr, 'str') && worst(withStr, 'str') && best(withStr, 'str').produtor !== worst(withStr, 'str').produtor) {
      const b = best(withStr, 'str'), w = worst(withStr, 'str');
      obs.push(`  🏆 STR más alto: ${b.produtor} (${f(b.str)} g/tex) — fibra más resistente para hilatura.`);
      obs.push(`  ⚠️  STR más bajo: ${w.produtor} (${f(w.str)} g/tex)${parseFloat(w.str) < 25 ? ' — por debajo del límite crítico (25 g/tex).' : ' — monitorear impacto en tenacidad del hilo.'}`);
    }
    if (best(withSci, 'sci') && worst(withSci, 'sci') && best(withSci, 'sci').produtor !== worst(withSci, 'sci').produtor) {
      const b = best(withSci, 'sci'), w = worst(withSci, 'sci');
      obs.push(`  🏆 SCI más alto: ${b.produtor} (${f(b.sci, 1)}) — mayor índice de hilabilidad, menos paradas esperadas.`);
      obs.push(`  ⚠️  SCI más bajo: ${w.produtor} (${f(w.sci, 1)})${parseFloat(w.sci) < 130 ? ' — riesgo de inestabilidad en hilatura.' : '.'}`);
    }
    if (bestMic && worstMic && bestMic.produtor !== worstMic.produtor) {
      obs.push(`  🏆 MIC óptimo:   ${bestMic.produtor} (${f(bestMic.mic, 3)}) — finura más cercana al rango ideal (3.5–4.9).`);
      if (micOutOfRange.length) {
        obs.push(`  ⚠️  MIC fuera de rango (3.5–4.9): ${micOutOfRange.map(p => `${p.produtor} ${f(p.mic, 3)}`).join(', ')}.`);
      } else {
        obs.push(`  ⚠️  MIC más alejado del centro: ${worstMic.produtor} (${f(worstMic.mic, 3)}).`);
      }
    }
    if (best(withUhml, 'uhml') && worst(withUhml, 'uhml') && best(withUhml, 'uhml').produtor !== worst(withUhml, 'uhml').produtor) {
      const b = best(withUhml, 'uhml'), w = worst(withUhml, 'uhml');
      obs.push(`  🏆 UHML más largo: ${b.produtor} (${f(b.uhml)} mm) — fibra más larga, menor neps y mejor resistencia.`);
      obs.push(`  ⚠️  UHML más corto: ${w.produtor} (${f(w.uhml)} mm)${parseFloat(w.uhml) < 25 ? ' — longitud crítica.' : '.'}`);
    }

    bloqueProveedores = [
      `📦 PROVEEDORES CLAVE`,
      ...provActual.map(p => {
        const fardos = Number(p.fardos_consumidos) || 0;
        const pct    = totalFardos > 0 ? ((fardos / totalFardos) * 100).toFixed(1) : '–';
        const strVal = p.str  != null ? `STR ${f(p.str)} g/tex` : '';
        const sciVal = p.sci  != null ? `SCI ${f(p.sci, 1)}`     : '';
        const micVal = p.mic  != null ? `MIC ${f(p.mic, 3)}`     : '';
        const uhmlVal= p.uhml != null ? `UHML ${f(p.uhml)} mm`   : '';
        const hvi = [strVal, sciVal, micVal, uhmlVal].filter(Boolean).join(' | ');
        return `  • ${String(p.produtor).padEnd(16)} ${String(fardos).padStart(4)} fardos (${String(pct).padStart(5)}%)  ${hvi}`;
      }),
      ...(obs.length ? [``, `  📌 Observaciones:`, ...obs] : []),
      ``,
    ];
  }

  const refStr = refs.length > 0 ? refs.join('/') : 'sin referencia';

  // ── Auditoría de Aptitud por Proceso (texto) ───────────────────────────
  const MATRIZ = {
    '7':    { app: 'Trama',    dest: ['TELAR'],                          sciMin: 115, strMin: 24, umb: { tenacidad: { ok: 14.0, t: 'min' }, cvm: { ok: 13.5, t: 'max' }, neps_200: { ok: 700, t: 'max' } } },
    '9':    { app: 'Trama',    dest: ['TELAR'],                          sciMin: 120, strMin: 25, umb: { tenacidad: { ok: 14.5, t: 'min' }, cvm: { ok: 13.0, t: 'max' }, neps_200: { ok: 600, t: 'max' } } },
    '10':   { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'],      sciMin: 130, strMin: 26, umb: { tenacidad: { ok: 16.0, t: 'min' }, elongacion: { ok: 8.0, t: 'min' }, cvm: { ok: 12.0, t: 'max' }, neps_200: { ok: 500, t: 'max' } } },
    '12.5': { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'],      sciMin: 135, strMin: 27, umb: { tenacidad: { ok: 16.5, t: 'min' }, elongacion: { ok: 8.0, t: 'min' }, cvm: { ok: 11.5, t: 'max' }, neps_200: { ok: 450, t: 'max' } } },
    '14':   { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'],      sciMin: 140, strMin: 28, umb: { tenacidad: { ok: 17.0, t: 'min' }, elongacion: { ok: 8.5, t: 'min' }, cvm: { ok: 11.0, t: 'max' }, neps_200: { ok: 400, t: 'max' } } },
  };
  const bloqueAuditoria = [];
  if (dataActual.hilos.length > 0) {
    bloqueAuditoria.push(`🧵 DETALLE TÉCNICO POR NE:`);
    for (const h of dataActual.hilos) {
      const ne = String(h.ne);
      const nN = parseFloat(ne);
      const mK = Object.keys(MATRIZ).find(k => Math.abs(parseFloat(k) - nN) < 0.1);
      const m = mK ? MATRIZ[mK] : null;
      const app = m?.app || (nN <= 9 ? 'Trama' : 'Urdimbre');
      const dest = m?.dest || (nN <= 9 ? ['TELAR'] : ['URDIDORA','INDIGO','TELAR']);
      const desvios = [];
      if (m?.umb) {
        for (const [k, u] of Object.entries(m.umb)) {
          const v = h[k] != null ? parseFloat(h[k]) : null;
          if (v == null) continue;
          const fail = u.t === 'min' ? v < u.ok : v > u.ok;
          if (fail) desvios.push(`${k === 'cvm' ? 'CVm%' : k === 'neps_200' ? 'Neps' : k === 'tenacidad' ? 'Tenac.' : k === 'elongacion' ? 'Elong.' : k} ${f(v)} ${u.t === 'min' ? '<' : '>'} ${u.ok}`);
        }
      }
      const estado = desvios.length ? '🔴 Rechazado' : '✅ Aprobado';
      const procs = dest.map(p => `${p}${desvios.length ? ' ⚠️' : ' ✅'}`).join(' → ');
      bloqueAuditoria.push(`  Ne ${ne} [${app}] → ${procs} — ${estado}${desvios.length ? ' — Desvío: ' + desvios.join(', ') : ''}`);
      // Comentario de planta
      const ten = h.tenacidad != null ? parseFloat(h.tenacidad) : null;
      const cvm = h.cvm != null ? parseFloat(h.cvm) : null;
      const elo = h.elongacion != null ? parseFloat(h.elongacion) : null;
      if (ten != null) {
        if (ten >= 18) bloqueAuditoria.push(`    💬 "Va sobrado de fuerza (${f(ten)} cN/tex). Sin drama en ningún proceso."`);
        else if (ten < 14.5) bloqueAuditoria.push(`    💬 "Tenacidad crítica. Alta probabilidad de rotura."`);
      }
      if (app === 'Trama' && cvm != null && cvm > 13) bloqueAuditoria.push(`    💬 "La masa viene bailando (CVm ${f(cvm)}%). Riesgo de barras en tela."`);
      if (app === 'Urdimbre' && elo != null && elo < 7.5) bloqueAuditoria.push(`    💬 "Elongación baja. El hilo no perdona en la Urdidora."`);
    }
    bloqueAuditoria.push('');
  }

  const bloqueOE = buildBloqueOE(oeData, lotesSorted);

  const lines = [
    `📋 INFORME DE DESEMPEÑO: LOTE FIAC ${actual} vs ${refStr}`,
    `Análisis Comparativo Fibra ↔️ Hilo`,
    ``,
    `🚦 RESUMEN EJECUTIVO:`,
    conclusionBase,
    ``,
    `📊 COMPARATIVA CONSOLIDADA:`,
    ``,
    ...bloques.flatMap(b => [b, '']),
    ...bloqueProveedores,
    ...bloqueAuditoria,
    ...bloqueOE,
    `🛠 PLAN DE ACCIÓN PRIORIZADO (24h):`,
    ...(alertas.length
      ? alertas.map(a => `  ⚠️ ${a}`)
      : ['  ✓ Sin alertas críticas en el lote actual.']),
    ...(puntosNe.length ? puntosNe : []),
    ``,
    `🚀 ESTADO OPERATIVO:`,
    estadoLabel,
    (() => {
      const lf = actual;
      const mr = dataActual.hvi.n_fardos != null ? `${dataActual.hvi.n_fardos} fardos consumidos` : '– fardos';
      const ms = dataActual.hvi.n_secuencias != null ? `${dataActual.hvi.n_secuencias} secuencias de blendomat` : '';
      const mreal = dataActual.hvi.mistura_real ? ` (Mistura interna ${dataActual.hvi.mistura_real})` : '';
      if (HilosActual.length === 0) return `Solo se disponen de datos HVI para el Lote FIAC ${lf}${mreal}; los datos de ensayos de hilo están pendientes.`;
      return `El Lote FIAC ${lf}${mreal} tiene ${mr}${ms ? ' y ' + ms : ''} asociadas.`;
    })(),
    ``,
    `_Informe generado localmente · ${new Date().toLocaleString('es-AR')}_`,
  ];

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dashboard/narrativa-lotes
// Genera informe comparativo. Intenta Gemini; si falla por quota → local.
// Body: { rows, loteActual, modelo? ('gemini'|'local') }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/dashboard/narrativa-lotes', async (req, res) => {
  try {
    const { rows, loteActual, model: modelReq, modo, proveedores } = req.body;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Sin datos para analizar' });

    // ── Query producción OE para comparativa de cortes ───────────────────────
    const loteNums = [...new Set(rows.map(r => Number(r.mistura)))].filter(n => !isNaN(n) && n > 0);
    let oeData = [];
    try {
      const oeResult = await pool.query(`
        SELECT
          TRIM("LOTE PRODUC")::bigint AS lote,
          maquina,
          item,
          "DESC ITEM" AS desc_item,
          SUM(CASE WHEN "CORT NAT" ~ '^[0-9]' THEN REPLACE("CORT NAT", ',', '.')::numeric ELSE 0 END) AS nat_total,
          SUM(CASE WHEN n ~ '^[0-9]' THEN REPLACE(n, ',', '.')::numeric ELSE 0 END) AS n_total,
          SUM(CASE WHEN s ~ '^[0-9]' THEN REPLACE(s, ',', '.')::numeric ELSE 0 END) AS s_total,
          SUM(CASE WHEN l ~ '^[0-9]' THEN REPLACE(l, ',', '.')::numeric ELSE 0 END) AS l_total,
          SUM(CASE WHEN t ~ '^[0-9]' THEN REPLACE(t, ',', '.')::numeric ELSE 0 END) AS t_total,
          SUM(CASE WHEN mo ~ '^[0-9]' THEN REPLACE(mo, ',', '.')::numeric ELSE 0 END) AS mo_total,
          SUM(CASE WHEN "JP (P+)" ~ '^[0-9]' THEN REPLACE("JP (P+)", ',', '.')::numeric ELSE 0 END) AS jp_total,
          SUM(CASE WHEN "JM (P-)" ~ '^[0-9]' THEN REPLACE("JM (P-)", ',', '.')::numeric ELSE 0 END) AS jm_total,
          ROUND(AVG(CASE WHEN "EFIC CALCULADA" ~ '^[0-9]' THEN REPLACE("EFIC CALCULADA", ',', '.')::numeric END)::numeric, 1) AS efic_avg,
          COUNT(*) AS registros
        FROM tb_produccion_oe
        WHERE TRIM("LOTE PRODUC") ~ '^[0-9]+\$'
          AND TRIM("LOTE PRODUC")::bigint = ANY(\$1)
        GROUP BY TRIM("LOTE PRODUC")::bigint, maquina, item, "DESC ITEM"
        ORDER BY TRIM("LOTE PRODUC")::bigint, maquina
      `, [loteNums]);
      oeData = oeResult.rows;
    } catch (oeErr) {
      console.warn('OE data query failed (non-fatal):', oeErr.message);
    }

    // Si piden explícitamente local, o no hay API key → generación local directa
    if (modo === 'local' || !process.env.GOOGLE_API_KEY) {
      const narrativa = generarNarrativaLocal(rows, loteActual, proveedores || [], oeData);
      return res.json({ success: true, narrativa, fuente: 'local', ...buildNarrativaStructuredFields(narrativa) });
    }

    const lotesSorted = [...new Set(rows.map(r => Number(r.mistura)))].sort((a, b) => a - b);
    const actual = loteActual ? Number(loteActual) : Math.max(...lotesSorted);
    const refs   = lotesSorted.filter(l => l !== actual);

    const resumenLotes = lotesSorted.map(mistura => {
      const filas = rows.filter(r => Number(r.mistura) === mistura);
      const hvi = filas[0] || {};
      const hilos = filas
        .filter(r => r.ne != null)
        .map(r => `   • Ne ${r.ne}/1: Tenacidad=${r.tenacidad ?? '-'} cN/tex | Elongación=${r.elongacion ?? '-'}% | CVm%=${r.cvm ?? '-'} | Neps+200%=${r.neps_200 ?? '-'}/km`)
        .join('\n');
      const misturaLabel = hvi.mistura_real ? `${mistura} (Mistura ${hvi.mistura_real})` : `${mistura}`;
      // Proveedores del lote
      const provLote = (proveedores || []).filter(p => Number(p.mistura) === mistura);
      const totalFardosProv = provLote.reduce((s, p) => s + (Number(p.fardos_consumidos) || 0), 0);
      const provStr = provLote.length
        ? '\n  Proveedores:\n' + provLote.map(p => {
            const pct = totalFardosProv > 0 ? ((Number(p.fardos_consumidos) / totalFardosProv) * 100).toFixed(1) : '–';
            return `   • ${p.produtor}: ${p.fardos_consumidos} fardos (${pct}%) STR=${p.str ?? '-'} SCI=${p.sci ?? '-'} MIC=${p.mic ?? '-'} UHML=${p.uhml ?? '-'}`;
          }).join('\n')
        : '';
      return `LOTE_FIAC ${misturaLabel}${mistura === actual ? ' [ACTUAL]' : ' [REFERENCIA]'}:
  HVI: STR=${hvi.str ?? '-'} g/tex | SCI=${hvi.sci ?? '-'} | MIC=${hvi.mic ?? '-'} | UHML=${hvi.uhml ?? '-'} mm | Grado=${hvi.clasificacion_argentina || 'N/D'} | Corteza=${hvi.corteza_porcentaje || 'N/D'} | Cardas=${hvi.cardas_kgh || 'N/D'} | ${hvi.n_fardos ?? '-'} fardos consumidos | ${hvi.n_secuencias ?? '-'} secuencias blendomat
  Hilo:\n${hilos || '   (sin datos)'}${provStr}`;
    }).join('\n\n');

    const modelName = modelReq || 'gemini-2.5-flash';
    const FALLBACK_MODELS = [modelName, 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const genAI  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    const prompt = `Actúa como Auditor de Calidad Textil y Experto en Tejeduría e Hilandería de denim de alta velocidad.

DATOS COMPARATIVOS:
${resumenLotes}${formatOEParaPrompt(oeData, lotesSorted) ? '\n\n' + formatOEParaPrompt(oeData, lotesSorted) : ''}

UMBRALES: Tenacidad hilo >16.0=APTO, 14.5-16.0=PRECAUCIÓN, <14.5=CRÍTICO | Elongación <7.5%=RIESGO URDIDORA | Neps+200% >700=RIESGO ÍNDIGO | CVm% >13=IRREGULAR | STR fibra >27=ÓPTIMO

MATRIZ DE REQUISITOS MÍNIMOS POR TÍTULO:
Ne 7 (Trama):  Tenac≥14.0, CVm≤13.5%, Neps≤700/km    → solo TELAR
Ne 9 (Trama):  Tenac≥14.5, CVm≤13.0%, Neps≤600/km    → solo TELAR
Ne 10 (Urdimbre): Tenac≥16.0, Elong≥8.0%, CVm≤12.0%, Neps≤500/km → URDIDORA→ÍNDIGO→TELAR
Ne 12.5 (Urdimbre): Tenac≥16.5, Elong≥8.0%, CVm≤11.5%, Neps≤450/km → URDIDORA→ÍNDIGO→TELAR
Ne 14 (Urdimbre): Tenac≥17.0, Elong≥8.5%, CVm≤11.0%, Neps≤400/km → URDIDORA→ÍNDIGO→TELAR

REGLAS DE AUDITORÍA:
- Si es Urdimbre (Ne≥10): ser implacable con Elongación y CVm% (pasa por Urdidora + Índigo).
- Si es Trama (Ne≤9): priorizar estabilidad de masa (CVm%) para evitar barreado.
- Si MIC > 4.7: advertir "cargado al grueso". Si STR supera la matriz por mucho: decir "va sobrado de fuerza".
- Usar vocabulario natural de hilandería.

IMPORTANTE: NO uses markdown. NO uses **, *, ## ni ningún símbolo de formato. Solo texto plano con los emojis indicados.

Generá exactamente este formato en español (500 palabras máx, cuantificá cambios con %):

📋 INFORME DE DESEMPEÑO: LOTE FIAC ${actual} vs ${refs.join('/') || 'sin referencia'}
Análisis Comparativo Fibra ↔️ Hilo

🚦 RESUMEN EJECUTIVO:
[veredicto 1-2 oraciones]

📊 COMPARATIVA CONSOLIDADA:
[bloques numerados 1️⃣ 2️⃣ 3️⃣ para STR, Tenacidad, Neps, CVm%, Elongación con valores por lote y 👉 Impacto]

📦 PROVEEDORES CLAVE
[Para cada proveedor: nombre, fardos consumidos, % participación, STR, SCI, MIC, UHML.]

  📌 Observaciones:
[Identificar proveedor con 🏆 mejor STR, 🏆 mejor SCI, 🏆 MIC más cercano a rango 3.5-4.9, 🏆 UHML más largo. Señalar con ⚠️ el peor en cada variable con impacto práctico.]

🧵 DETALLE TÉCNICO POR NE:
[Para cada Ne: Ne X [Aplicación] → Proceso1 ✅/⚠️ → Proceso2 ✅/⚠️ — Estado (Aprobado/Rechazado) — Desvío si hay.]
[Agregar 💬 comentario de planta con vocabulario de hilandería para cada Ne.]

� CORRELACIÓN CON PRODUCCIÓN OE:
[Comparativa de cortes de purga (Naturales, N, S, L, T, MO) entre lotes por máquina. Destacar variaciones % del lote actual vs referencia. Relacionar impacto en urdidora y estabilidad del proceso.]

�🛠 PLAN DE ACCIÓN PRIORIZADO (24h):
[2-3 bullets accionables]

🚀 ESTADO OPERATIVO:
[APROBADO PARA CONTINUIDAD / PRECAUCIÓN - REVISAR / CRÍTICO - DETENER]
[oración de cierre]`;

    // Intentar con cada modelo en orden; si hay 503/sobrecarga, pasar al siguiente
    let lastGeminiErr = null;
    for (const mName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: mName });
        const result = await model.generateContent(prompt);
        const narrativaCompleta = result.response.text();
        const modelUsado = mName !== modelName ? mName : undefined;
        return res.json({ success: true, narrativa: narrativaCompleta, fuente: 'gemini', modelo: mName, ...(modelUsado && { avisoModelo: `Gemini respondió con modelo alternativo: ${mName}` }), ...buildNarrativaStructuredFields(narrativaCompleta) });
      } catch (geminiErr) {
        const msg = geminiErr.message || String(geminiErr);
        const esTransient = /503|502|overloaded|high demand|unavailable|try again/i.test(msg);
        console.warn(`Gemini [${mName}] falló: ${msg.slice(0, 120)}`);
        lastGeminiErr = msg;
        if (!esTransient) break; // Error no transitorio (quota, auth): no reintenta
        // 503 transitorio: espera 1s antes de probar el siguiente modelo
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Todos los modelos fallaron → fallback local
    const geminiErrMsg = lastGeminiErr || 'Error desconocido';
    const narrativa = generarNarrativaLocal(rows, loteActual, proveedores || [], oeData);
    const esQuota = /quota|429|resource.exhausted/i.test(geminiErrMsg);
    const aviso = esQuota
      ? 'Gemini no disponible – límite de cuota alcanzado. Informe generado localmente.'
      : `Gemini no disponible – informe generado localmente. (${geminiErrMsg.slice(0, 120)})`;
    return res.json({ success: true, narrativa, fuente: 'local', aviso, geminiErrRaw: geminiErrMsg.slice(0, 200), ...buildNarrativaStructuredFields(narrativa) });

  } catch (err) {
    console.error('Error narrativa-lotes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calidad/datos-patrones-teje', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'Se requieren fecha_inicio y fecha_fin (YYYY-MM-DD)' });
    }

    const isoInicio = dateVariants(fecha_inicio).iso;
    const isoFin   = dateVariants(fecha_fin).iso;

    if (!isoInicio || !isoFin) {
      return res.status(400).json({ error: 'Formato de fecha inválido' });
    }

    const querySql = `
      WITH partidas_list AS (
        SELECT DISTINCT TRIM(BOTH FROM "PARTIDA") AS target_partida
        FROM public.tb_calidad
        WHERE "EMP" = 'STC'
          AND "QUALIDADE" IN ('1', 'PRIMEIRA') 
          AND (
            CASE
              WHEN "DAT_PROD" IS NULL OR "DAT_PROD" = '' THEN NULL
              WHEN "DAT_PROD" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DAT_PROD" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DAT_PROD" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DAT_PROD" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
      ),
      partida_prod AS (
        SELECT 
          TRIM(BOTH FROM p."PARTIDA") AS partida,
          COALESCE(
            MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."ARTIGO" END),
            MAX(p."ARTIGO")
          ) AS artigo,
          MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."GRUPO TEAR" END) AS grupo_tear,
          MAX(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."VELOC"), ',', '.'), '') AS NUMERIC) END) AS indigo_velocidad,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."RUPTURAS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_rupturas,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."CAVALOS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_cavalos,
          MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."MAQUINA" END) AS tece_telar,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PONTOS_LIDOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_lidos,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PONTOS_100%"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_100,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PARADA TEC TRAMA"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS suma_paradas_trama,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PARADA TEC URDUME"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS suma_paradas_urdimbre
        FROM public.tb_produccion p
        WHERE TRIM(BOTH FROM p."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM p."PARTIDA")
      ),
      partida_calidad AS (
        SELECT 
          TRIM(BOTH FROM c."PARTIDA") AS partida,
          MIN(c."DT INI TEC") AS dt_ini_tec,
          MIN(c."HR INI TEC") AS hr_ini_tec,
          MAX(c."DT FIM TEC") AS dt_fim_tec,
          MAX(c."HR FIM TEC") AS hr_fim_tec,
          SUM(CASE WHEN TRIM(BOTH FROM c."QUALIDADE") IN ('1', 'PRIMEIRA') THEN CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS metros_primeira,
          SUM(CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC)) AS metros_totales,
          SUM(CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC) * COALESCE(CAST(NULLIF(REPLACE(TRIM(c."LARGURA"::TEXT), ',', '.'), '') AS NUMERIC), 0) / 100.0) AS area_m2_total
        FROM public.tb_calidad c
        WHERE TRIM(BOTH FROM c."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM c."PARTIDA")
      ),
      partida_defectos AS (
        SELECT 
          TRIM(BOTH FROM d."PARTIDA") AS partida,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('340', '382', '387', '333', '319', '328', '386') AND CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) >= 4 THEN 1 END) AS total_defectos_trama_4ptos,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('312', '313', '310', '311') AND CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) >= 4 THEN 1 END) AS total_defectos_urdimbre_4ptos,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('340', '382', '387', '333', '319', '328', '386') THEN 1 END) AS total_defectos_trama,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('312', '313', '310', '311') THEN 1 END) AS total_defectos_urdimbre,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '333' THEN 1 END) AS count_333,
          SUM(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '333' THEN CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_333,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '340' THEN 1 END) AS count_340,
          SUM(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '340' THEN CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_340,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '382' THEN 1 END) AS count_382,
          SUM(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '382' THEN CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_382,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '387' THEN 1 END) AS count_387,
          SUM(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '387' THEN CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_387,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '319' THEN 1 END) AS count_319,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '328' THEN 1 END) AS count_328,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '386' THEN 1 END) AS count_386,
          SUM(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '386' THEN CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_386,
          SUM(CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC)) AS total_pontos
        FROM public.tb_defectos d
        WHERE TRIM(BOTH FROM d."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM d."PARTIDA")
      ),
      partida_ficha AS (
        SELECT 
          f."ARTIGO CODIGO" AS artigo_codigo,
          f."COMPOSIÇÃO" AS composicion,
          f."TRAMA REDUZIDO" AS trama_reducido
        FROM public.tb_fichas f
      )
      SELECT 
        json_build_object(
          'partida', ctx.target_partida,
          'articulo', COALESCE(p.artigo, (SELECT "ARTIGO" FROM public.tb_calidad WHERE TRIM(BOTH FROM "PARTIDA") = ctx.target_partida LIMIT 1)),
          'grupo_tear', p.grupo_tear,
          'cronologia_tejeduria', json_build_object(
             'inicio', COALESCE(c.dt_ini_tec || ' ' || c.hr_ini_tec, ''),
             'fin', COALESCE(c.dt_fim_tec || ' ' || c.hr_fim_tec, '')
          ),
          'caracteristicas_trama', json_build_object(
            'composicion', f.composicion,
            'titulo', f.trama_reducido,
            'tipo_trama_filtro', CASE 
              WHEN REPLACE(REPLACE(UPPER(f.composicion), ' ', ''), 'Ã', 'A') IN ('100%ALGODON', '100%ALGODAO', '100%COTTON') THEN '100% CO - Ne ' || COALESCE(f.trama_reducido, '')
              WHEN (UPPER(f.composicion) LIKE '%ALGOD%' OR UPPER(f.composicion) LIKE '%COTTON%' OR UPPER(f.composicion) LIKE '%CO%') 
                   AND (UPPER(f.composicion) LIKE '%POLYESTER%' OR UPPER(f.composicion) LIKE '%POLIESTER%' OR UPPER(f.composicion) LIKE '%PES%') 
                   AND (UPPER(f.composicion) LIKE '%ELASTAN%' OR UPPER(f.composicion) LIKE '%SPANDEX%' OR UPPER(f.composicion) LIKE '%PUE%' OR UPPER(f.composicion) LIKE '%LYCRA%') THEN 'Mezcla Elástica'
              WHEN (UPPER(f.composicion) LIKE '%ALGOD%' OR UPPER(f.composicion) LIKE '%COTTON%' OR UPPER(f.composicion) LIKE '%CO%') 
                   AND (UPPER(f.composicion) LIKE '%POLYESTER%' OR UPPER(f.composicion) LIKE '%POLIESTER%' OR UPPER(f.composicion) LIKE '%PES%') THEN 'Mezcla Rígida'
              ELSE 'Otros'
            END
          ),
          'indicadores_indigo', json_build_object(
            'seletor', 'INDIGO',
            'velocidad_nominal', COALESCE(p.indigo_velocidad, 0),
            'r103_roturas_absolutas', COALESCE(p.indigo_rupturas, 0),
            'cav105_cavalos_absolutos', COALESCE(p.indigo_cavalos, 0)
          ),
          'indicadores_tejeduria', json_build_object(
            'seletor', 'TECELAGEM',
            'telar_asignado', p.tece_telar,
            'eficiencia_porcentaje', CASE WHEN p.puntos_100 > 0 THEN ROUND((p.puntos_lidos * 100.0 / p.puntos_100), 2) ELSE 0 END,
            'rt105_paradas_trama', CASE WHEN p.puntos_lidos > 0 THEN ROUND((p.suma_paradas_trama * 100000.0) / (p.puntos_lidos * 1000.0), 2) ELSE 0 END,
            'ru105_paradas_urdimbre', CASE WHEN p.puntos_lidos > 0 THEN ROUND((p.suma_paradas_urdimbre * 100000.0) / (p.puntos_lidos * 1000.0), 2) ELSE 0 END,
            'suma_paradas_trama', COALESCE(p.suma_paradas_trama, 0),
            'suma_paradas_urdimbre', COALESCE(p.suma_paradas_urdimbre, 0),
            'metros_primeira', COALESCE(c.metros_primeira, 0)
          ),
          'conteo_defectos_revisadora', json_build_object(
            'origen_tabla', 'tb_defectos',
            'total_defectos_trama', COALESCE(d.total_defectos_trama, 0),
            'total_defectos_urdimbre', COALESCE(d.total_defectos_urdimbre, 0),
            'total_defectos_trama_4ptos', COALESCE(d.total_defectos_trama_4ptos, 0),
            'total_defectos_urdimbre_4ptos', COALESCE(d.total_defectos_urdimbre_4ptos, 0),
            'total_pontos', COALESCE(d.total_pontos, 0),
            'pts_por_100m2', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.total_pontos, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'pts_100m2_333', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.puntos_333, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'pts_100m2_340', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.puntos_340, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'pts_100m2_382', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.puntos_382, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'pts_100m2_387', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.puntos_387, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'pts_100m2_386', CASE WHEN c.area_m2_total > 0 THEN ROUND((COALESCE(d.puntos_386, 0) / c.area_m2_total) * 100, 2) ELSE 0 END,
            'detalle_frecuencia_codigo', json_build_object(
              '333_parada_tear', COALESCE(d.count_333, 0),
              '340_trama_mole', COALESCE(d.count_340, 0),
              '382_trama_curta', COALESCE(d.count_382, 0),
              '387_trama_dobrada', COALESCE(d.count_387, 0),
              '319_trama_quebrada', COALESCE(d.count_319, 0),
              '328_falta_trama', COALESCE(d.count_328, 0),
              '386_trama_dupla', COALESCE(d.count_386, 0)
            )
          )
        ) AS partida_json
      FROM partidas_list ctx
      LEFT JOIN partida_prod p ON p.partida = ctx.target_partida
      LEFT JOIN partida_calidad c ON c.partida = ctx.target_partida
      LEFT JOIN partida_defectos d ON d.partida = ctx.target_partida
      LEFT JOIN partida_ficha f ON f.artigo_codigo = p.artigo
      ORDER BY (CASE WHEN c.metros_primeira > 0 THEN ROUND((COALESCE(d.total_pontos, 0) / c.metros_primeira) * 100, 2) ELSE 0 END) DESC;
    `;

    const metrosQuery = `
      WITH piece_summary AS (
        SELECT 
          TRIM(BOTH FROM "PEÇA") AS peca_clean,
          SUM(CAST(NULLIF(REPLACE(REPLACE(TRIM("METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC)) AS piece_metragem,
          AVG(CAST(NULLIF(REPLACE(TRIM("LARGURA"::TEXT), ',', '.'), '') AS NUMERIC)) AS piece_largura
        FROM public.tb_calidad
        WHERE "EMP" = 'STC'
          AND (
            CASE
              WHEN "DAT_PROD" IS NULL OR "DAT_PROD" = '' THEN NULL
              WHEN "DAT_PROD" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DAT_PROD" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DAT_PROD" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DAT_PROD" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
        GROUP BY TRIM(BOTH FROM "PEÇA")
      )
      SELECT 
        COALESCE(SUM(piece_metragem), 0) AS total_metros,
        COALESCE(SUM(piece_metragem * COALESCE(piece_largura, 0) / 100.0), 0) AS total_area_m2
      FROM piece_summary
    `;

    const defectsQuery = `
      WITH piece_summary AS (
        SELECT DISTINCT
          TRIM(BOTH FROM "PEÇA") AS peca_clean
        FROM public.tb_calidad
        WHERE "EMP" = 'STC'
          AND (
            CASE
              WHEN "DAT_PROD" IS NULL OR "DAT_PROD" = '' THEN NULL
              WHEN "DAT_PROD" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DAT_PROD" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DAT_PROD" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DAT_PROD" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
      )
      SELECT 
        d."COD_DEF" AS cod_def,
        d."DESC_DEFEITO" AS desc_defeito,
        SUM(CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::TEXT), ',', '.'), '') AS NUMERIC)) AS total_puntos
      FROM public.tb_defectos d
      INNER JOIN piece_summary ps ON ps.peca_clean = d."PARTIDA" || d."PECA"
      WHERE d."FILIAL" = '05'
        AND btrim(d."DESC_DEFEITO") <> ''
        AND btrim(d."DESC_DEFEITO") <> '--'
      GROUP BY d."COD_DEF", d."DESC_DEFEITO"
      ORDER BY total_puntos DESC NULLS LAST
    `;

    const [dbResult, metrosResult, defectsResult] = await Promise.all([
      pool.query(querySql, [isoInicio, isoFin]),
      pool.query(metrosQuery, [isoInicio, isoFin]),
      pool.query(defectsQuery, [isoInicio, isoFin])
    ]);

    const dataset = dbResult.rows.map(r => r.partida_json).filter(Boolean);
    const totalMetros = Number(metrosResult.rows[0]?.total_metros || 0);
    const totalAreaM2 = Number(metrosResult.rows[0]?.total_area_m2 || 0);
    const rawDefects = defectsResult.rows;

    const totalPuntosGlobal = rawDefects.reduce((acc, r) => acc + Number(r.total_puntos || 0), 0);
    const defects = rawDefects.map(r => {
      const puntos = Number(r.total_puntos || 0);
      const pts_100m2 = totalAreaM2 > 0 ? (puntos * 100) / totalAreaM2 : 0;
      const porcentaje = totalPuntosGlobal > 0 ? (puntos / totalPuntosGlobal) * 100 : 0;
      return {
        cod_def: r.cod_def,
        desc_defeito: r.desc_defeito,
        total_puntos: puntos,
        pts_100m2: Math.round(pts_100m2 * 100) / 100,
        porcentaje: Math.round(porcentaje * 100) / 100
      };
    });

    return res.json({
      success: true,
      dataset,
      defects,
      total_metros: totalMetros,
      total_area_m2: totalAreaM2
    });
  } catch (err) {
    console.error('Error en /api/calidad/datos-patrones-teje:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calidad/ia-patrones-teje', async (req, res) => {
  try {
    const { dataset, defects, totalMetros, totalAreaM2, fechaInicio, fechaFin } = req.body;
    
    if (!dataset || !defects || !fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para el análisis de IA.' });
    }

    const isoInicio = fechaInicio;
    const isoFin = fechaFin;

    let analisisIA = 'El motor de diagnóstico de IA de Gemini se encuentra temporalmente desactivado durante la fase de alineación de datos de PostgreSQL.';
    if (process.env.GOOGLE_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        
        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.articulo,
          grupo_tear: r.grupo_tear,
          cronologia_tejeduria: r.cronologia_tejeduria,
          matriz_trama: r.caracteristicas_trama?.tipo_trama_filtro,
          indigo: r.indicadores_indigo,
          tejeduria: r.indicadores_tejeduria,
          revision_defectos: r.conteo_defectos_revisadora
        }));

        const cleanDefectsForAI = defects.slice(0, 10);

        const prompt = `Actúa como un Ingeniero de Control de Calidad Textil y Auditor de Planta de Alta Performance. El volumen de metros analizados corresponde estrictamente a los "Metros Revisados de Primera" de tb_calidad. Analiza el siguiente JSON de datos consolidados:

1. RESUMEN GLOBAL DE DEFECTOS DEL PERIODO (Total metros: ${Number(totalMetros).toFixed(1)}m):
${JSON.stringify(cleanDefectsForAI)}

2. DETALLE DE PARTIDAS CRÍTICAS (JSON Consolidados):
${JSON.stringify(cleanDataForAI)}

Instrucciones Críticas de Análisis:

1. Análisis de Correlación Mecánica vs. Revisación (El Núcleo):
Calcula y analiza los ratios por partida crítica:
- Ratio de Traspaso de Trama: Compara las paradas mecánicas de trama (rt105_paradas_trama) contra el conteo físico de defectos (340_trama_mole, 382_trama_curta, 387_trama_dobrada).
- Ratio de Traspaso de Urdimbre: Compara las paradas de urdimbre (ru105_paradas_urdimbre) contra (313_fio_quebrado, 333_parada_tear).
Diagnóstico: Si paradas son altas pero defectos bajos, el operario trabaja bien. Si defectos superan o igualan paradas, detalla la falla en arranque o sensor.

2. Segmentación Física por Matriz de Trama:
Agrupa por tipo_trama_filtro. Da un dictamen sobre tramas 100% Algodón (Ne 9/1 vs Ne 7/1). Cruza esto con Índigo (r103_roturas_absolutas, cav105_cavalos_absolutos, velocidad_nominal) para saber si títulos finos venían penalizados desde la preparación.

3. Análisis Temporal y de Coincidencia (Clusters):
Revisa la cronologia_tejeduria (inicio/fin) de las partidas afectadas. Determina si los picos en ciertos telares fueron simultáneos. Si fueron contemporáneos, dicta si el patrón apunta a materia prima defectuosa (aislando la culpa del telar). Cruza con grupo_tear para identificar si la falla se mueve con el equipo humano o si es estática en la máquina.

Estructura Obligatoria del Output (en Markdown):
Sección 1: Diagnóstico de Correlación Matemática (Ratios de Traspaso por Partida).
Sección 2: Impacto Físico del Hilado (Dictamen de Composición y Títulos cruzado con Índigo).
Sección 3: Análisis Cronológico y Factor Humano (Simultaneidad y Grupo Tear).
Sección 4: Directivas Quirúrgicas de Planta (Acciones directas sin teoría genérica).`;

        const origenStr = 'Tejeduría - Patrones de Defectos';
        const formatoKey = 'patrones-teje';
        const modeloKey = 'gemini-2.5-flash';
        const dataHash = hashRowsPayload(cleanDataForAI);
        const cacheKey = buildCacheKey({ lotes: 'teje_patrones', fecha: `${isoInicio}_${isoFin}`, formato: formatoKey, modelo: modeloKey, dataHash, origen: origenStr });

        try {
            const hit = await pool.query('SELECT narrativa, json_analisis_ia, modelo_usado, token_info FROM tb_narrativa_cache WHERE cache_key = $1 AND origen = $2', [cacheKey, origenStr]);
            if (hit.rows.length) {
                await pool.query('UPDATE tb_narrativa_cache SET hits = hits + 1, last_hit_at = NOW() WHERE cache_key = $1 AND origen = $2', [cacheKey, origenStr]);
                const cached = hit.rows[0];
                return res.json({
                    success: true, narrativa: cached.narrativa, fuente: 'cache', modelo: cached.modelo_usado,
                    tokenInfo: cached.token_info || null,
                    ...buildNarrativaStructuredFields(cached.narrativa)
                });
            }
        } catch (e) { console.warn('Cache check fail:', e.message); }

        const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastErr = null;
        for (const modelName of FALLBACK_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            analisisIA = response.text();

            const usage = result.response.usageMetadata || {};
            const tokensEntrada = usage.promptTokenCount || 0;
            const tokensSalida = usage.candidatesTokenCount || 0;
            const tokensTotal = usage.totalTokenCount || (tokensEntrada + tokensSalida);
            const p = { in: 0.15, out: 0.60 };
            const costoUSD = (tokensEntrada / 1_000_000) * p.in + (tokensSalida / 1_000_000) * p.out;
            const tokenInfo = { tokensEntrada, tokensSalida, tokensTotal, costoUSD: +costoUSD.toFixed(6) };

            try {
                await pool.query(
                    `INSERT INTO tb_narrativa_cache (cache_key, lotes, fecha, formato, modelo, data_hash, narrativa, json_analisis_ia, modelo_usado, token_info, origen)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (cache_key) DO UPDATE SET narrativa=EXCLUDED.narrativa, json_analisis_ia=EXCLUDED.json_analisis_ia, modelo_usado=EXCLUDED.modelo_usado, token_info=EXCLUDED.token_info, last_hit_at=NOW(), origen=EXCLUDED.origen`,
                    [cacheKey, 'teje_patrones', `${isoInicio}_${isoFin}`, formatoKey, modeloKey, dataHash, analisisIA, dataset, modelName, JSON.stringify(tokenInfo), origenStr]
                );
                await pool.query(
                    `INSERT INTO tb_narrativa_log (lotes, fecha_corte, formato, idioma, modelo, tokens_entrada, tokens_salida, tokens_total, costo_usd, fuente, desde_cache, origen)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'gemini',FALSE,$10)`,
                    ['teje_patrones', `${isoInicio}_${isoFin}`, formatoKey, 'es', modelName, tokensEntrada, tokensSalida, tokensTotal, costoUSD.toFixed(6), origenStr]
                );
            } catch (e) { console.warn('Cache/Log insert error:', e.message); }
            
            req.tokenInfoForAI = tokenInfo;
            req.modeloUsado = modelName;

            if (analisisIA) break;
          } catch (err) {
            lastErr = err.message;
            console.warn(`Gemini [${modelName}] falló en análisis de patrones:`, err.message);
          }
        }

        if (!analisisIA) {
          analisisIA = `Análisis de IA no disponible por cuotas o error en el servicio: ${lastErr}.
          
**Resumen Analítico Local (Reglas de Negocio):**
* Defecto principal: **Código ${defects[0]?.cod_def || '—'} - ${defects[0]?.desc_defeito || '—'}** con **${defects[0]?.pts_100m2 || '—'} Pts/100m²** (${defects[0]?.porcentaje || '—'}%).
* Partida más crítica: **Partida ${dataset[0]?.partida}** (Artigo: ${dataset[0]?.articulo}, Telar: ${dataset[0]?.indicadores_tejeduria?.telar_asignado}) con **${dataset[0]?.conteo_defectos_revisadora?.pts_por_100m2} Pts/100m²**.`;
        }
      } catch (aiErr) {
        console.error('Error general de IA en patrones:', aiErr);
        analisisIA = 'Error al invocar el servicio de inteligencia artificial de Gemini.';
      }
    } else {
      analisisIA = '**Servicio de IA desactivado (Falta GOOGLE_API_KEY en configuración).**';
    }

    return res.json({
      success: true,
      narrativa: analisisIA,
      fuente: 'gemini',
      tokenInfo: req.tokenInfoForAI || null,
      modelo: req.modeloUsado || 'gemini-2.5-flash',
      ...buildNarrativaStructuredFields(analisisIA)
    });
  } catch (err) {
    console.error('Error en /api/calidad/ia-patrones-teje:', err);
    res.status(500).json({ error: err.message });
  }
});
// =====================================================
app.get('/api/informe-diario', async (req, res) => {
  try {
    const { fecha } = req.query
    if (!fecha) {
      return res.status(400).json({ error: 'Se requiere parámetro "fecha" (YYYY-MM-DD)' })
    }

    const datePattern = String(fecha).split('T')[0]
    const parts = datePattern.split('-')
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' })
    }
    const yearN = parseInt(parts[0], 10)
    const monthN = parseInt(parts[1], 10)
    if (isNaN(yearN) || isNaN(monthN) || monthN < 1 || monthN > 12) {
      return res.status(400).json({ error: 'Fecha inválida' })
    }

    const monthStr = String(monthN).padStart(2, '0')
    const monthStart = `${yearN}-${monthStr}-01`
    const daysInMonth = new Date(yearN, monthN, 0).getDate()
    const monthEnd = `${yearN}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`

    // --- SQL helpers reutilizados ---
    const dtProd = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtCal = sqlParseDate('c."DAT_PROD"')

    // 1. INDIGO — producción diaria
    const sqlIndigo = `
      SELECT
        to_char(${dtProd}, 'YYYY-MM-DD') AS dia,
        COALESCE(SUM(${sqlParseNumberIntl('p."METRAGEM"')}), 0) AS metros,
        CASE
          WHEN SUM(${sqlParseNumberIntl('p."METRAGEM"')}) > 0
          THEN SUM(${sqlParseNumber('p."EFICIENCIA"')} * ${sqlParseNumberIntl('p."METRAGEM"')})
               / NULLIF(SUM(${sqlParseNumberIntl('p."METRAGEM"')}), 0)
          ELSE NULL
        END AS eficiencia,
        CASE
          WHEN SUM(${sqlParseNumberIntl('p."METRAGEM"')}) > 0
          THEN SUM(${sqlParseNumber('p."VELOC"')} * ${sqlParseNumberIntl('p."METRAGEM"')})
               / NULLIF(SUM(${sqlParseNumberIntl('p."METRAGEM"')}), 0)
          ELSE NULL
        END AS velocidad
      FROM tb_produccion p
      WHERE ${dtProd} >= $1::date
        AND ${dtProd} <= $2::date
        AND p."SELETOR" = 'INDIGO'
      GROUP BY to_char(${dtProd}, 'YYYY-MM-DD')
    `

    // 2. TECELAGEM — producción diaria
    const sqlTecelagem = `
      SELECT
        to_char(${dtProd}, 'YYYY-MM-DD') AS dia,
        COALESCE(SUM(${sqlParseNumberIntl('p."METRAGEM ENCOLH"')}), 0) AS metros,
        CASE
          WHEN SUM(${sqlParseNumberIntl('p."PONTOS_100%"')}) > 0
          THEN SUM(${sqlParseNumberIntl('p."PONTOS_LIDOS"')}) * 100.0
               / NULLIF(SUM(${sqlParseNumberIntl('p."PONTOS_100%"')}), 0)
          ELSE NULL
        END AS eficiencia,
        COUNT(DISTINCT p."MAQUINA") AS telares,
        CASE
          WHEN SUM(${sqlParseNumberIntl('p."METRAGEM ENCOLH"')}) > 0
          THEN SUM(${sqlParseNumberIntl('p."BATIDAS"')} * ${sqlParseNumberIntl('p."METRAGEM ENCOLH"')})
               / NULLIF(SUM(${sqlParseNumberIntl('p."METRAGEM ENCOLH"')}), 0)
          ELSE NULL
        END AS batidas,
        CASE
          WHEN SUM(${sqlParseNumberIntl('p."METRAGEM ENCOLH"')}) > 0
          THEN SUM(${sqlParseNumberIntl('p."RPM NOMINALTEAR"')} * ${sqlParseNumberIntl('p."METRAGEM ENCOLH"')})
               / NULLIF(SUM(${sqlParseNumberIntl('p."METRAGEM ENCOLH"')}), 0)
          ELSE NULL
        END AS rpm
      FROM tb_produccion p
      WHERE ${dtProd} >= $1::date
        AND ${dtProd} <= $2::date
        AND p."SELETOR" = 'TECELAGEM'
      GROUP BY to_char(${dtProd}, 'YYYY-MM-DD')
    `

    // 3. ACABAMENTO — producción por máquina 165001
    const sqlAcabamento = `
      SELECT
        to_char(${dtProd}, 'YYYY-MM-DD') AS dia,
        COALESCE(SUM(${sqlParseNumberIntl('p."METRAGEM"')}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtProd} >= $1::date
        AND ${dtProd} <= $2::date
        AND p."MAQUINA" = '165001'
      GROUP BY to_char(${dtProd}, 'YYYY-MM-DD')
    `

    // 4. CALIDAD — revisión diaria (primera calidad, pts/100m², metros totales)
    const sqlCalidad = `
      SELECT
        to_char(${dtCal}, 'YYYY-MM-DD') AS dia,
        COALESCE(SUM(${sqlParseNumberIntl('c."METRAGEM"')}), 0) AS metros,
        COALESCE(SUM(CASE WHEN btrim(c."QUALIDADE") ILIKE 'PRIMEIRA%'
                     THEN ${sqlParseNumberIntl('c."METRAGEM"')} ELSE 0 END), 0) AS metros_1era,
        COALESCE(SUM(CASE WHEN btrim(c."QUALIDADE") ILIKE 'PRIMEIRA%'
                     THEN ${sqlParseNumberIntl('c."METRAGEM"')} * ${sqlParseNumberIntl('c."LARGURA"')}
                     ELSE 0 END), 0) AS sum_metro_larg,
        COALESCE(SUM(CASE WHEN btrim(c."QUALIDADE") ILIKE 'PRIMEIRA%'
                     THEN ${sqlParseNumber('c."PONTUACAO"')} ELSE 0 END), 0) AS sum_pontuacao
      FROM tb_calidad c
      WHERE ${dtCal} >= $1::date
        AND ${dtCal} <= $2::date
        AND c."EMP" = 'STC'
      GROUP BY to_char(${dtCal}, 'YYYY-MM-DD')
    `

    // 5. METAS — objetivos diarios
    const sqlMetas = `
      SELECT
        "Dia" AS dia,
        COALESCE("Indigo", 0) AS meta_indigo,
        COALESCE("Meta_Eficiencia_INDIGO", 0) AS meta_efic_indigo,
        COALESCE("Tejeduria", 0) AS meta_tecelagem,
        COALESCE("Integrada", 0) AS meta_acabamento,
        COALESCE("Revision", 0) AS meta_revision
      FROM tb_metas
      WHERE "Dia" >= $1
        AND "Dia" <= $2
    `

    // Ejecutar todo en paralelo
    const [rIndigo, rTecelagem, rAcabamento, rCalidad, metasExists] = await Promise.all([
      query(sqlIndigo, [monthStart, monthEnd], 'informe-diario/indigo'),
      query(sqlTecelagem, [monthStart, monthEnd], 'informe-diario/tecelagem'),
      query(sqlAcabamento, [monthStart, monthEnd], 'informe-diario/acabamento'),
      query(sqlCalidad, [monthStart, monthEnd], 'informe-diario/calidad'),
      tableExists('tb_metas')
    ])

    let rMetas = { rows: [] }
    if (metasExists) {
      rMetas = await query(sqlMetas, [monthStart, monthEnd], 'informe-diario/metas')
    }

    // Construir mapas por fecha
    const indigoMap = new Map()
    for (const r of rIndigo.rows) {
      indigoMap.set(r.dia, r)
    }

    const tecMap = new Map()
    for (const r of rTecelagem.rows) {
      tecMap.set(r.dia, r)
    }

    const acabMap = new Map()
    for (const r of rAcabamento.rows) {
      acabMap.set(r.dia, r)
    }

    const calMap = new Map()
    for (const r of rCalidad.rows) {
      calMap.set(r.dia, r)
    }

    const metaMap = new Map()
    for (const r of rMetas.rows) {
      metaMap.set(r.dia, r)
    }

    // Totales mensuales de meta para calcular metaAjustada acumulada
    let totalMetaIndigo = 0
    let totalMetaTecelagem = 0
    let totalMetaAcabamento = 0
    let totalMetaCalidad = 0
    for (const r of rMetas.rows) {
      totalMetaIndigo += Number(r.meta_indigo || 0)
      totalMetaTecelagem += Number(r.meta_tecelagem || 0)
      totalMetaAcabamento += Number(r.meta_acabamento || 0)
      totalMetaCalidad += Number(r.meta_revision || 0)
    }

    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

    let cumIndigoProd = 0
    let cumTecProd = 0
    let cumAcabProd = 0
    let cumCalProd = 0

    const days = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${yearN}-${monthStr}-${String(d).padStart(2, '0')}`
      const weekday = weekdays[new Date(yearN, monthN - 1, d).getDay()]
      const dayLabel = `${d} ${weekday}`

      const ind = indigoMap.get(dayStr)
      const tel = tecMap.get(dayStr)
      const acab = acabMap.get(dayStr)
      const cal = calMap.get(dayStr)
      const meta = metaMap.get(dayStr)

      const hasData = !!(
        (ind && ind.metros > 0) ||
        (tel && tel.metros > 0) ||
        (acab && acab.metros > 0) ||
        (cal && cal.metros > 0)
      )

      // Producción del día
      const indigoProd = ind ? Number(ind.metros) : 0
      const tecProd = tel ? Number(tel.metros) : 0
      const acabProd = acab ? Number(acab.metros) : 0
      const calProd = cal ? Number(cal.metros) : 0

      // Metas del día
      const indigoMeta = meta ? Number(meta.meta_indigo) : 0
      const tecMeta = meta ? Number(meta.meta_tecelagem) : 0
      const acabMeta = meta ? Number(meta.meta_acabamento) : 0
      const calMeta = meta ? Number(meta.meta_revision) : 0

      // metaAjustada = (totalMeta - cumProd_up_to_prev_day) / remainingDays
      const remainingDays = daysInMonth - d + 1
      const indigoMetaAjustada = remainingDays > 0
        ? (totalMetaIndigo - cumIndigoProd) / remainingDays
        : null
      const tecMetaAjustada = remainingDays > 0
        ? (totalMetaTecelagem - cumTecProd) / remainingDays
        : null
      const acabMetaAjustada = remainingDays > 0
        ? (totalMetaAcabamento - cumAcabProd) / remainingDays
        : null
      const calMetaAjustada = remainingDays > 0
        ? (totalMetaCalidad - cumCalProd) / remainingDays
        : null

      // Saldos
      const indigoSaldo = hasData && indigoMeta > 0 ? indigoProd - indigoMeta : null
      const tecSaldo = hasData && tecMeta > 0 ? tecProd - tecMeta : null
      const acabSaldo = hasData && acabMeta > 0 ? acabProd - acabMeta : null
      const calSaldo = hasData && calMeta > 0 ? calProd - calMeta : null

      // Primera calidad %
      let primeraCalidad = null
      if (cal && Number(cal.metros) > 0) {
        primeraCalidad = (Number(cal.metros_1era) * 100.0) / Number(cal.metros)
      }

      // Puntos/100m²
      let puntos100m2 = null
      if (cal && Number(cal.sum_metro_larg) > 0) {
        puntos100m2 = (Number(cal.sum_pontuacao) * 10000.0) / Number(cal.sum_metro_larg)
      }

      days.push({
        dayNumber: d,
        dayLabel,
        hasData,
        indigo: hasData || indigoMeta > 0 ? {
          eficiencia: ind ? (Number(ind.eficiencia) || null) : null,
          produccion: indigoProd || null,
          meta: indigoMeta || null,
          saldo: indigoSaldo,
          metaAjustada: totalMetaIndigo > 0 ? Math.round(indigoMetaAjustada) : null,
          velocidad: ind ? (Number(ind.velocidad) || null) : null
        } : null,
        tecelagem: hasData || tecMeta > 0 ? {
          telares: tel ? (Number(tel.telares) || null) : null,
          batidas: tel ? (Number(tel.batidas) || null) : null,
          rpm: tel ? (Number(tel.rpm) || null) : null,
          eficiencia: tel ? (Number(tel.eficiencia) || null) : null,
          produccion: tecProd || null,
          meta: tecMeta || null,
          saldo: tecSaldo,
          metaAjustada: totalMetaTecelagem > 0 ? Math.round(tecMetaAjustada) : null
        } : null,
        acabamento: hasData || acabMeta > 0 ? {
          produccion: acabProd || null,
          meta: acabMeta || null,
          saldo: acabSaldo,
          primeraCalidad
        } : null,
        calidad: hasData || calMeta > 0 ? {
          puntos100m2,
          produccion: calProd || null,
          meta: calMeta || null,
          saldo: calSaldo,
          metaAjustada: totalMetaCalidad > 0 ? Math.round(calMetaAjustada) : null
        } : null
      })

      // Acumular producción del día
      cumIndigoProd += indigoProd
      cumTecProd += tecProd
      cumAcabProd += acabProd
      cumCalProd += calProd
    }

    res.json({ days })
  } catch (err) {
    console.error('Error en /api/informe-diario:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// HVI — ENSAYOS DETALLES
// =====================================================

// GET /api/hvi/ensayos-detalles
app.get('/api/hvi/ensayos-detalles', async (req, res) => {
  try {
    const tableCheck = await query(`SELECT to_regclass('public.tb_hvi_ensayos') AS reg`, [])
    if (!tableCheck.rows[0]?.reg) {
      return res.json({ rows: [] })
    }

    const ensayosCols = await getTableColumnsMap('tb_hvi_ensayos', 'tb-hvi-ensayos-columns')
    const cantidadExpr = ensayosCols.has('cantidad') ? `e.${quoteIdent(ensayosCols.get('cantidad'))}` : 'NULL::integer'
    const colorExpr = ensayosCols.has('color') ? `e.${quoteIdent(ensayosCols.get('color'))}` : 'NULL::text'
    const cortExpr = ensayosCols.has('cort') ? `e.${quoteIdent(ensayosCols.get('cort'))}` : 'NULL::integer'

    const result = await query(`
      SELECT
        e.lote,
        e.proveedor,
        e.grado,
        e.fecha,
        e.tipo AS ensayo_tipo,
        ${cantidadExpr} AS cantidad,
        ${colorExpr} AS color,
        ${cortExpr} AS cort,
        d.fardo,
        d.sci, d.mst, d.mic, d.mat, d.uhml,
        d.ui, d.sf, d.str, d.elg, d.rd,
        d.plus_b, d.tr_cnt, d.tr_ar, d.trid
      FROM tb_hvi_ensayos e
      JOIN tb_hvi_detalles d ON d.ensayo_id = e.id
      ORDER BY e.fecha DESC NULLS LAST, e.lote, d.fardo
    `, [], 'hvi/ensayos-detalles')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en /api/hvi/ensayos-detalles:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// BENNINGER RTF — GESTIÓN DE ARCHIVOS
// =====================================================

async function ensureBenningerRtfTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_benninger_rtf (
      id SERIAL PRIMARY KEY,
      source_file TEXT NOT NULL UNIQUE,
      partida TEXT,
      rolada TEXT,
      header JSONB,
      raw_rtf_text TEXT,
      plain_text TEXT,
      parse_version TEXT,
      confidence TEXT,
      mode TEXT,
      reason TEXT,
      no_apta JSONB,
      candidates JSONB,
      score_gap NUMERIC,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, [], 'ensure-benninger-rtf-table')
  // Columnas agregadas en v2 del scoring — idempotente
  const extraCols = [
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS seq_index INT`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS score_total NUMERIC`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS score_detail JSONB`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS is_residuo BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS metros_rtf NUMERIC`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS receita TEXT`,
    `ALTER TABLE tb_benninger_rtf ADD COLUMN IF NOT EXISTS batch_id TEXT`,
  ]
  for (const sql of extraCols) {
    await query(sql, [], 'ensure-benninger-rtf-table/alter').catch(() => {})
  }
}

// POST /api/benninger-rtf/status
// Recibe { fileNames: [...] }, devuelve { existing: [...], noMatch: [...] }
app.post('/api/benninger-rtf/status', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const { fileNames } = req.body
    if (!Array.isArray(fileNames) || !fileNames.length) {
      return res.json({ existing: [], noMatch: [] })
    }
    const result = await query(
      `SELECT source_file, partida FROM tb_benninger_rtf WHERE source_file = ANY($1)`,
      [fileNames],
      'benninger-rtf/status'
    )
    const existing = result.rows.map((r) => r.source_file)
    const noMatch = result.rows.filter((r) => !r.partida).map((r) => r.source_file)
    res.json({ existing, noMatch })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/status:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/benninger-rtf/match
// Scoring multi-señal: Receita(40) + Metragem(35) + Comeco(25)
// PARTIDAS agrupadas por turno (SUM metragem, MIN fecha/hora)
app.post('/api/benninger-rtf/match', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const { files = [] } = req.body
    if (!files.length) {
      return res.json({ rows: [], summary: { high: 0, medium: 0, low: 0, residuo: 0, none: 0 } })
    }

    // Diccionario Receita RTF → BASE URDUME en tb_produccion (equivalencias confirmadas)
    const RECEITA_MAP = {
      'U10(561)-4760':      'U10/1-4760561',
      'U12.5(560)-5696':    'U12.5-5696560',
      'U10+10F(561)-4760':  '10+10F4760561',
      'U12(560)-5696':      'U12/1-5696560',
      'U10(920)-4760':      'U10/1-4760920',
      'U12.5(920)-5696':    'U12.5-5696920',
      'U12(561)-4760':      'U12/1-4760560',
      'U10+9,5F(498)-4760': 'U10+9F4760498',
    }

    // Helpers de tiempo: "DD/MM/YYYY" + "HH:MM" → minutos UTC desde epoch
    function dtToMin(dt, hora) {
      if (!dt || !hora) return null
      const dm = String(dt).match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      const tm = String(hora).match(/^(\d{2}):(\d{2})/)
      if (!dm || !tm) return null
      return Date.UTC(+dm[3], +dm[2] - 1, +dm[1], +tm[1], +tm[2]) / 60000
    }

    function comecoToMin(comeco) {
      if (!comeco) return null
      const parts = String(comeco).trim().split(' ')
      return dtToMin(parts[0], parts[1])
    }

    // Parse metros en formato brasileño "2.000,00" → número
    function parseDbMetros(s) {
      if (!s) return null
      const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
      return isFinite(n) && n > 0 ? n : null
    }

    // Parse metros del RTF header "2000 m" → número
    function parseRtfMetros(s) {
      if (!s) return null
      const n = parseFloat(String(s).replace(/[^0-9.,]/g, '').replace(',', '.'))
      return isFinite(n) && n > 0 ? n : null
    }

    // Índice secuencial del nombre del RTF: (000)→1, (001)→2, sin sufijo→0
    function seqIndex(filename) {
      const m = String(filename || '').match(/\((\d{3})\)\.[rR][tT][fF]$/)
      return m ? parseInt(m[1], 10) + 1 : 0
    }

    // Score tiempo: menor diferencia en minutos → más puntos
    function scoreTime(comecoMin, dbStartMin) {
      if (comecoMin == null || dbStartMin == null) return 0
      const diff = Math.abs(comecoMin - dbStartMin)
      if (diff <= 5)   return 25
      if (diff <= 30)  return 20
      if (diff <= 120) return 12
      if (diff <= 360) return 5
      return 0
    }

    // Score metragem: diferencia relativa entre RTF y DB
    function scoreMetros(rtfM, dbM) {
      if (!rtfM || !dbM) return 0
      const pct = Math.abs(rtfM - dbM) / dbM
      if (pct <= 0.03) return 35
      if (pct <= 0.07) return 25
      if (pct <= 0.15) return 15
      if (pct <= 0.25) return 5
      return 0
    }

    // Estado guardado previo
    const sourceFiles = files.map((f) => f.sourceFile).filter(Boolean)
    const savedResult = await query(
      `SELECT source_file, partida, rolada FROM tb_benninger_rtf WHERE source_file = ANY($1)`,
      [sourceFiles], 'benninger-rtf/match/saved'
    )
    const savedMap = new Map(savedResult.rows.map((r) => [r.source_file, r]))

    // Parsear y ordenar archivos por secuencia
    const parsedFiles = files.map((f) => ({
      ...f,
      receita:    String(f.header?.receita || '').trim(),
      baseUrdume: RECEITA_MAP[String(f.header?.receita || '').trim()] || null,
      seqIdx:     seqIndex(f.sourceFile),
      comecoMin:  comecoToMin(f.header?.comeco),
      rtfMetros:  parseRtfMetros(f.header?.metros),
    })).sort((a, b) => a.seqIdx - b.seqIdx)

    // Valores únicos de BASE URDUME en este lote
    const baseUrdumeValues = [...new Set(parsedFiles.map((f) => f.baseUrdume).filter(Boolean))]

    // Consulta batch: PARTIDAS agrupadas por turno (SUM metragem, MIN fecha+hora)
    const partidasMap = new Map() // baseUrdume → [{partida, rolada, dtInicio, horaInicio, metrosTotal, inicioMin}]
    if (baseUrdumeValues.length) {
      const pResult = await query(`
        WITH agg AS (
          SELECT
            TRIM("PARTIDA")       AS partida,
            TRIM("BASE URDUME")   AS "baseUrdume",
            MAX(TRIM("ROLADA"))   AS rolada,
            MIN(
              SUBSTRING(TRIM("DT_INICIO"), 7, 4) ||
              SUBSTRING(TRIM("DT_INICIO"), 4, 2) ||
              SUBSTRING(TRIM("DT_INICIO"), 1, 2) || ' ' ||
              LEFT(TRIM("HORA_INICIO"), 5)
            ) AS "inicioSort",
            SUM(
              CASE
                WHEN TRIM("METRAGEM") ~ '^[0-9.]+,[0-9]+$'
                  THEN REPLACE(REPLACE(TRIM("METRAGEM"), '.', ''), ',', '.')::NUMERIC
                WHEN TRIM("METRAGEM") ~ '^[0-9]+$'
                  THEN TRIM("METRAGEM")::NUMERIC
                ELSE 0
              END
            ) AS "metrosTotal"
          FROM tb_produccion
          WHERE "SELETOR" = 'INDIGO'
            AND TRIM("BASE URDUME") = ANY($1)
          GROUP BY TRIM("PARTIDA"), TRIM("BASE URDUME")
        )
        SELECT
          partida,
          "baseUrdume",
          rolada,
          "inicioSort",
          SUBSTRING("inicioSort", 7, 2) || '/' ||
          SUBSTRING("inicioSort", 5, 2) || '/' ||
          SUBSTRING("inicioSort", 1, 4) AS "dtInicio",
          SUBSTRING("inicioSort", 10, 5) AS "horaInicio",
          "metrosTotal"
        FROM agg
        ORDER BY "inicioSort"
      `, [baseUrdumeValues], 'benninger-rtf/match/partidas')

      for (const row of pResult.rows) {
        const bu = row.baseUrdume
        if (!partidasMap.has(bu)) partidasMap.set(bu, [])
        const dp = String(row.dtInicio || '').split('/')
        const tp = String(row.horaInicio || '00:00').split(':')
        const inicioMin = dp.length === 3
          ? Date.UTC(+dp[2], +dp[1] - 1, +dp[0], +tp[0], +(tp[1] || 0)) / 60000
          : null
        partidasMap.get(bu).push({
          partida:     row.partida,
          rolada:      row.rolada,
          baseUrdume:  row.baseUrdume,
          dtInicio:    row.dtInicio,
          horaInicio:  row.horaInicio,
          metrosTotal: row.metrosTotal ? Number(row.metrosTotal) : null,
          inicioMin,
        })
      }
    }

    const summary = { high: 0, medium: 0, low: 0, residuo: 0, none: 0 }
    const rows = []

    for (const file of parsedFiles) {
      const { sourceFile, header = {}, baseUrdume, comecoMin, rtfMetros, seqIdx } = file
      const saved  = savedMap.has(sourceFile)

      // RTF con muy pocos metros → probable residuo/desperdicio
      const isResiduo = rtfMetros != null && rtfMetros < 300

      let candidates   = []
      let confidence   = 'none'
      let suggested    = null
      let scoreGap     = 0
      let scoreDetail  = null

      if (isResiduo) {
        confidence = 'residuo'
      } else if (baseUrdume) {
        const partidas = partidasMap.get(baseUrdume) || []

        const scored = partidas.map((p) => {
          const sR    = 40  // Receita es filtro duro — si llegamos aquí siempre matchea
          const sM    = scoreMetros(rtfMetros, p.metrosTotal)
          const sT    = scoreTime(comecoMin, p.inicioMin)
          const total = sR + sM + sT
          const diffMin = comecoMin != null && p.inicioMin != null
            ? Math.round(comecoMin - p.inicioMin) : null
          return {
            ...p,
            metragemPartida:        p.metrosTotal,
            velocidadeMediaPartida: null,
            score: total,
            scoreDetail: {
              scoreReceita: sR,
              scoreMetros:  sM,
              scoreTime:    sT,
              total,
              rtfMetros,
              dbMetros:     p.metrosTotal,
              diffMin,
            },
            startDiffSec: diffMin != null ? diffMin * 60 : null,
          }
        }).sort((a, b) => b.score - a.score)

        // Limita cantidad de candidatos para mantener la UI responsiva.
        const MAX_CANDIDATES = 30
        candidates = scored.slice(0, MAX_CANDIDATES)

        if (scored.length >= 1) {
          const best   = scored[0]
          const second = scored[1]
          scoreGap    = second ? best.score - second.score : best.score
          scoreDetail = best.scoreDetail

          // Regla ajustada:
          // - score casi perfecto debe clasificar high aunque el gap sea moderado.
          // - para el resto, usa gap mas realista para secuencias con partidas cercanas.
          if      (best.score >= 95)                   confidence = 'high'
          else if (best.score >= 85 && scoreGap >= 8) confidence = 'high'
          else if (best.score >= 60)                   confidence = 'medium'
          else if (best.score >= 40)                   confidence = 'low'
          else                                         confidence = 'none'

          suggested = best
        }
      }

      const confKey = confidence || 'none'
      summary[confKey] = (summary[confKey] || 0) + 1

      console.log(`[match] file="${sourceFile}" seq=${seqIdx} base="${baseUrdume}" metros=${rtfMetros} conf="${confidence}" score=${scoreDetail?.total ?? '-'}`)

      rows.push({
        sourceFile,
        candidates,
        suggested,
        confidence,
        scoreGap,
        scoreDetail,
        saved,
        decision:  confidence === 'high' ? 'auto' : 'review',
        isResiduo,
        seqIdx,
      })
    }

    res.json({ rows, summary })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/match:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/benninger-rtf/confirm
// Guarda vinculaciones confirmadas en tb_benninger_rtf
app.post('/api/benninger-rtf/confirm', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const { items = [] } = req.body
    if (!items.length) return res.json({ saved: [], savedCount: 0, errors: [] })

    const saved = []
    const errors = []

    for (const item of items) {
      const {
        sourceFile, header, rawRtfText, plainText, parseVersion,
        selected, confidence, mode, reason, noApta, candidates, scoreGap
      } = item

      if (!sourceFile) continue
      const partida = selected?.partida || null
      const rolada = selected?.rolada || null

      try {
        await query(`
          INSERT INTO tb_benninger_rtf (
            source_file, partida, rolada, header, raw_rtf_text, plain_text,
            parse_version, confidence, mode, reason, no_apta, candidates, score_gap
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (source_file) DO UPDATE SET
            partida      = EXCLUDED.partida,
            rolada       = EXCLUDED.rolada,
            header       = EXCLUDED.header,
            raw_rtf_text = EXCLUDED.raw_rtf_text,
            plain_text   = EXCLUDED.plain_text,
            parse_version = EXCLUDED.parse_version,
            confidence   = EXCLUDED.confidence,
            mode         = EXCLUDED.mode,
            reason       = EXCLUDED.reason,
            no_apta      = EXCLUDED.no_apta,
            candidates   = EXCLUDED.candidates,
            score_gap    = EXCLUDED.score_gap,
            saved_at     = CURRENT_TIMESTAMP
        `, [
          sourceFile, partida, rolada,
          header ? JSON.stringify(header) : null,
          rawRtfText || null, plainText || null,
          parseVersion || null, confidence || null,
          mode || null, reason || null,
          noApta ? JSON.stringify(noApta) : null,
          candidates ? JSON.stringify(candidates) : null,
          scoreGap != null ? Number(scoreGap) : null
        ], 'benninger-rtf/confirm/upsert')
        saved.push({ sourceFile })
      } catch (itemErr) {
        errors.push({ sourceFile, error: itemErr.message })
      }
    }

    res.json({ saved, savedCount: saved.length, errors })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/confirm:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/debug-match?comeco=...
// Endpoint de diagnóstico: replica la misma regla usada por /match
app.get('/api/benninger-rtf/debug-match', async (req, res) => {
  try {
    const comeco = String(req.query.comeco || '').trim()

    function extractDate(s) {
      return s ? s.trim().split(' ')[0] : ''
    }

    function extractTime(s) {
      if (!s) return ''
      const parts = s.trim().split(' ')
      if (parts.length >= 2) return parts[1].substring(0, 5)
      if (/^\d{2}:\d{2}/.test(s.trim())) return s.trim().substring(0, 5)
      return ''
    }

    const comecoDate = extractDate(comeco)
    const comecoTime = extractTime(comeco)
    const diagnostics = { comeco, comecoDate, comecoTime, strategy: 'datetime-only', rows: [] }

    if (comecoDate && comecoTime) {
      const result = await query(
        `SELECT DISTINCT
           "PARTIDA" AS partida,
           "ROLADA" AS rolada,
           "DT_INICIO" AS "dtInicio",
           "HORA_INICIO" AS "horaInicio",
           "ARTIGO" AS artigo
         FROM tb_produccion
         WHERE "SELETOR" = 'INDIGO'
           AND TRIM("DT_INICIO") = $1
           AND TRIM(LEFT("HORA_INICIO", 5)) = $2
         ORDER BY "HORA_INICIO"
         LIMIT 5`,
        [comecoDate, comecoTime],
        'debug-match/datetime'
      )
      diagnostics.rows = result.rows
    }

    res.json(diagnostics)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/secuencia-partidas?startPartida=XXXXXXX&limit=300
// Devuelve una secuencia ordenada de PARTIDAS (INDIGO) agregadas por partida/base.
app.get('/api/benninger-rtf/secuencia-partidas', async (req, res) => {
  try {
    const startPartida = String(req.query.startPartida || '').trim()
    const limit = Math.max(50, Math.min(parseInt(req.query.limit || '300', 10), 1000))

    const result = await query(`
      WITH agg AS (
        SELECT
          TRIM("PARTIDA")     AS partida,
          TRIM("BASE URDUME") AS "baseUrdume",
          MIN(
            SUBSTRING(TRIM("DT_INICIO"), 7, 4) ||
            SUBSTRING(TRIM("DT_INICIO"), 4, 2) ||
            SUBSTRING(TRIM("DT_INICIO"), 1, 2) || ' ' ||
            LEFT(TRIM("HORA_INICIO"), 5)
          ) AS "inicioSort",
          SUM(
            CASE
              WHEN TRIM("METRAGEM") ~ '^[0-9.]+,[0-9]+$'
                THEN REPLACE(REPLACE(TRIM("METRAGEM"), '.', ''), ',', '.')::NUMERIC
              WHEN TRIM("METRAGEM") ~ '^[0-9]+$'
                THEN TRIM("METRAGEM")::NUMERIC
              ELSE 0
            END
          ) AS "metragemTotal",
          AVG(
            CASE
              WHEN TRIM("VELOC") ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(TRIM("VELOC"), ',', '.')::NUMERIC
              ELSE NULL
            END
          ) AS "velocMedia"
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
        GROUP BY TRIM("PARTIDA"), TRIM("BASE URDUME")
      ), ordered AS (
        SELECT
          ROW_NUMBER() OVER (ORDER BY "inicioSort", partida) AS rn,
          partida,
          "baseUrdume",
          "inicioSort",
          "metragemTotal",
          "velocMedia"
        FROM agg
      ), anchor AS (
        SELECT COALESCE((SELECT rn FROM ordered WHERE partida = $1 ORDER BY rn LIMIT 1), 1) AS start_rn
      )
      SELECT
        o.rn,
        o.partida,
        o."baseUrdume",
        SUBSTRING(o."inicioSort", 7, 2) || '/' ||
        SUBSTRING(o."inicioSort", 5, 2) || '/' ||
        SUBSTRING(o."inicioSort", 1, 4) AS "dtInicio",
        SUBSTRING(o."inicioSort", 10, 5) AS "horaInicio",
        o."metragemTotal",
        o."velocMedia"
      FROM ordered o
      CROSS JOIN anchor a
      WHERE o.rn >= a.start_rn
      ORDER BY o.rn
      LIMIT $2
    `, [startPartida, limit], 'benninger-rtf/secuencia-partidas')

    res.json({
      startPartida: startPartida || null,
      limit,
      rows: result.rows || []
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/secuencia-partidas:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/secuencia-match-partidas?startPartida=0542101&limit=500
// Devuelve PARTIDAS consecutivas de tb_produccion y, por cada PARTIDA, el mejor match RTF guardado.
// No incluye filas de RTF sin partida; solo la vista PARTIDA -> (match RTF opcional).
app.get('/api/benninger-rtf/secuencia-match-partidas', async (req, res) => {
  try {
    await ensureBenningerRtfTable()

    const startPartida = String(req.query.startPartida || '0542101').trim() || '0542101'
    const limit = Math.max(50, Math.min(parseInt(req.query.limit || '500', 10), 2000))

    const result = await query(`
      WITH agg AS (
        SELECT
          TRIM("PARTIDA")     AS partida,
          TRIM("BASE URDUME") AS "baseUrdume",
          MIN(
            SUBSTRING(TRIM("DT_INICIO"), 7, 4) ||
            SUBSTRING(TRIM("DT_INICIO"), 4, 2) ||
            SUBSTRING(TRIM("DT_INICIO"), 1, 2) || ' ' ||
            LEFT(TRIM("HORA_INICIO"), 5)
          ) AS "inicioSort",
          SUM(
            CASE
              WHEN TRIM("METRAGEM") ~ '^[0-9.]+,[0-9]+$'
                THEN REPLACE(REPLACE(TRIM("METRAGEM"), '.', ''), ',', '.')::NUMERIC
              WHEN TRIM("METRAGEM") ~ '^[0-9]+$'
                THEN TRIM("METRAGEM")::NUMERIC
              ELSE 0
            END
          ) AS "metragemTotal",
          AVG(
            CASE
              WHEN TRIM("VELOC") ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(TRIM("VELOC"), ',', '.')::NUMERIC
              ELSE NULL
            END
          ) AS "velocMedia"
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
        GROUP BY TRIM("PARTIDA"), TRIM("BASE URDUME")
      ), ordered AS (
        SELECT
          ROW_NUMBER() OVER (ORDER BY "inicioSort", partida) AS rn,
          partida,
          "baseUrdume",
          "inicioSort",
          "metragemTotal",
          "velocMedia"
        FROM agg
      ), anchor AS (
        SELECT COALESCE((SELECT rn FROM ordered WHERE partida = $1 ORDER BY rn LIMIT 1), 1) AS start_rn
      )
      SELECT
        o.rn,
        o.partida,
        o."baseUrdume",
        SUBSTRING(o."inicioSort", 7, 2) || '/' ||
        SUBSTRING(o."inicioSort", 5, 2) || '/' ||
        SUBSTRING(o."inicioSort", 1, 4) AS "dtInicio",
        SUBSTRING(o."inicioSort", 10, 5) AS "horaInicio",
        o."metragemTotal",
        o."velocMedia",
        br.source_file AS "sourceFile",
        COALESCE(
          br.seq_index,
          NULLIF(SUBSTRING(br.source_file FROM '\\((\\d{3})\\)'), '')::INT
        ) AS "rtfSeqIndex",
        br.header->>'comeco' AS "rtfComeco",
        br.header->>'receita' AS "rtfReceita",
        br.header->>'metros' AS "rtf1X014",
        br.header->>'velMMin' AS "rtf1S102",
        CASE WHEN br.source_file IS NULL THEN 'SIN_MATCH' ELSE 'MATCH' END AS "matchStatus"
      FROM ordered o
      CROSS JOIN anchor a
      LEFT JOIN LATERAL (
        SELECT
          r.source_file,
          r.seq_index,
          r.header,
          r.confidence,
          r.saved_at
        FROM tb_benninger_rtf r
        WHERE TRIM(COALESCE(r.partida, '')) = o.partida
        ORDER BY
          CASE
            WHEN r.confidence = 'high' THEN 0
            WHEN r.confidence = 'medium' THEN 1
            WHEN r.confidence = 'sugerido' THEN 2
            ELSE 3
          END,
          COALESCE(r.seq_index, 999999),
          r.saved_at DESC
        LIMIT 1
      ) br ON TRUE
      WHERE o.rn >= a.start_rn
      ORDER BY o.rn
      LIMIT $2
    `, [startPartida, limit], 'benninger-rtf/secuencia-match-partidas')

    const rows = (result.rows || []).map((row) => {
      const seqNum = row.rtfSeqIndex == null ? NaN : Number(row.rtfSeqIndex)
      return {
        ...row,
        hasMatch: !!row.sourceFile,
        rtfSeqLabel: Number.isFinite(seqNum) && seqNum >= 0
          ? String(seqNum).padStart(3, '0')
          : ''
      }
    })

    res.json({
      startPartida,
      limit,
      rows
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/secuencia-match-partidas:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/seq-range?from=31&to=58
// Devuelve archivos RTF por secuencia (NNN) para sugerencias visuales en baches SIN MATCH.
app.get('/api/benninger-rtf/seq-range', async (req, res) => {
  try {
    await ensureBenningerRtfTable()

    const from = Math.max(0, parseInt(req.query.from || '0', 10))
    const to = Math.max(from, parseInt(req.query.to || String(from), 10))

    const result = await query(`
      WITH base AS (
        SELECT
          COALESCE(
            seq_index,
            NULLIF(SUBSTRING(source_file FROM '\\((\\d{3})\\)'), '')::INT
          ) AS seq_idx,
          source_file,
          partida,
          confidence,
          header,
          saved_at
        FROM tb_benninger_rtf
      )
      SELECT DISTINCT ON (b.seq_idx)
        b.seq_idx AS "seqIndex",
        b.source_file AS "sourceFile",
        b.partida,
        b.confidence,
        b.header->>'comeco' AS "comeco",
        b.header->>'receita' AS "receita",
        b.header->>'metros' AS "metros",
        b.header->>'velMMin' AS "velMMin"
      FROM base b
      WHERE b.seq_idx IS NOT NULL
        AND b.seq_idx BETWEEN $1 AND $2
      ORDER BY
        b.seq_idx,
        CASE WHEN TRIM(COALESCE(b.partida, '')) = '' THEN 0 ELSE 1 END,
        b.saved_at DESC
    `, [from, to], 'benninger-rtf/seq-range')

    res.json({
      from,
      to,
      rows: result.rows || []
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/seq-range:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/sin-match
// Devuelve archivos en la BD sin partida válida
app.get('/api/benninger-rtf/sin-match', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000)
    const [countResult, rowsResult] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM tb_benninger_rtf WHERE (partida IS NULL OR partida = '') AND (no_apta IS NULL)`,
        [], 'benninger-rtf/sin-match/count'
      ),
      query(
        `SELECT source_file, rolada AS match_rolada, saved_at
         FROM tb_benninger_rtf
         WHERE (partida IS NULL OR partida = '') AND (no_apta IS NULL)
         ORDER BY saved_at DESC
         LIMIT $1`,
        [limit], 'benninger-rtf/sin-match/rows'
      )
    ])
    res.json({ rows: rowsResult.rows, total: parseInt(countResult.rows[0]?.total || '0', 10) })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/sin-match:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/benninger-rtf/relink
// Actualiza partida/rolada para un source_file ya guardado
app.patch('/api/benninger-rtf/relink', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const { items = [] } = req.body
    if (!items.length) return res.json({ saved: [], savedCount: 0, errors: [] })

    const saved = []
    const errors = []

    for (const item of items) {
      const { sourceFile, rolada, partida, reason } = item
      if (!sourceFile) continue
      try {
        const result = await query(
          `UPDATE tb_benninger_rtf
           SET rolada = $1, partida = $2, reason = $3, mode = 'manual_relink', saved_at = CURRENT_TIMESTAMP
           WHERE source_file = $4`,
          [rolada || null, partida || null, reason || 'USER_MANUAL_RELINK', sourceFile],
          'benninger-rtf/relink'
        )
        if (result.rowCount > 0) saved.push({ sourceFile })
      } catch (itemErr) {
        errors.push({ sourceFile, error: itemErr.message })
      }
    }

    res.json({ saved, savedCount: saved.length, errors })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/relink:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Parsea eventos AML del plain_text guardado en BD
// Formato: línea "AML", luego >> DD-MM-YY HH:MM:SS  NNN[m]-CODIGO: TIPO: detalle << ...
function parseAmlCelFromPlainText(plainText) {
  if (!plainText) return { total: 0, aml: 0, cel: 0, riesgo: 'bajo', codigos: [], recurrentes: [], eventos: [] }
  const lines = String(plainText).split('\n').map((l) => l.trim())
  let section = null
  const eventos = []
  // >> DD-MM-YY HH:MM:SS    NNNN[m]-CODIGO: TIPO: detalle <<
  const eventRe = />>\s*(\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+)\[m\]-(\d+):\s*([A-ZÇÃÕÁÉÍÓÚa-z]+)?:?\s*(.*?)\s*<</i
  for (const line of lines) {
    const up = line.toUpperCase()
    if (up === 'AML') { section = 'AML'; continue }
    if (up === 'CEL') { section = 'CEL'; continue }
    if (!section) continue
    const m = line.match(eventRe)
    if (!m) continue
    const [, timestamp, metrosStr, codigoRaw, tipoRaw, detalheRaw] = m
    const codigo = String(codigoRaw || '').padStart(4, '0').toUpperCase()
    const detalle = String(detalheRaw || '').replace(/\.{3,}/g, '').trim() || String(tipoRaw || '').toUpperCase()
    const severidad = String(tipoRaw || '').toUpperCase() === 'FALHA' ? 'alto' : 'medio'
    eventos.push({ tipo: section, codigo, detalle, timestamp, metros: parseInt(metrosStr, 10), severidad })
  }
  const codigos = [...new Set(eventos.map((e) => e.codigo))]
  const recurrentes = codigos
    .map((cod) => ({ codigo: cod, count: eventos.filter((e) => e.codigo === cod).length }))
    .filter((r) => r.count > 1)
    .sort((a, b) => b.count - a.count)
  const amlCount = eventos.filter((e) => e.tipo === 'AML').length
  const celCount = eventos.filter((e) => e.tipo === 'CEL').length
  return {
    total: eventos.length,
    aml: amlCount,
    cel: celCount,
    riesgo: eventos.length > 20 ? 'alto' : eventos.length > 5 ? 'medio' : 'bajo',
    codigos,
    recurrentes,
    eventos
  }
}

// GET /api/benninger-rtf/logs
// Devuelve eventos AML/CEL almacenados en el header JSONB (o parseados desde plain_text)
app.get('/api/benninger-rtf/logs', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const partida = String(req.query.partida || '').trim()
    const section = String(req.query.section || 'AML').toUpperCase()
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 5000)
    if (!partida) return res.json({ rows: [] })

    const result = await query(
      `SELECT header, plain_text FROM tb_benninger_rtf WHERE partida = $1 ORDER BY saved_at DESC LIMIT 10`,
      [partida], 'benninger-rtf/logs'
    )

    const events = []
    for (const row of result.rows) {
      // Primero intentar desde header JSONB (ruta original)
      let eventosSource = row.header?.proceso?.amlCel?.eventos
      // Fallback: parsear desde plain_text si no hay eventos en el header
      if (!Array.isArray(eventosSource) || eventosSource.length === 0) {
        const parsed = parseAmlCelFromPlainText(row.plain_text)
        eventosSource = parsed.eventos
      }
      if (!Array.isArray(eventosSource) || eventosSource.length === 0) continue
      for (const ev of eventosSource) {
        if (section === 'ALL' || String(ev?.tipo || '').toUpperCase() === section) {
          events.push(ev)
        }
        if (events.length >= limit) break
      }
      if (events.length >= limit) break
    }

    res.json({ rows: events.slice(0, limit) })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/logs:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/benninger-rtf/file
// Descarga el texto RTF raw almacenado en la BD
app.get('/api/benninger-rtf/file', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const sourceFile = String(req.query.sourceFile || '').trim()
    if (!sourceFile) return res.status(400).json({ error: 'sourceFile requerido' })

    const result = await query(
      `SELECT raw_rtf_text, source_file FROM tb_benninger_rtf WHERE source_file = $1`,
      [sourceFile], 'benninger-rtf/file'
    )
    if (!result.rows.length || !result.rows[0].raw_rtf_text) {
      return res.status(404).json({ error: 'Archivo no encontrado' })
    }

    const fileName = path.basename(sourceFile).replace(/[^a-zA-Z0-9._\-]/g, '_')
    res.setHeader('Content-Type', 'application/rtf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(result.rows[0].raw_rtf_text)
  } catch (err) {
    console.error('Error en /api/benninger-rtf/file:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// BENNINGER IMPACTO HILO
// =====================================================

// GET /api/benninger-impacto?partida=XXXXXXX
app.get('/api/benninger-impacto', async (req, res) => {
  try {
    await ensureBenningerRtfTable()
    const partida = String(req.query.partida || '').trim()

    // Sin partida: devolver payload vacío (el frontend muestra estado inicial)
    if (!partida) {
      return res.json({
        sourceFile: '', rawRtfText: '', match: null, referencias: null,
        laboratorio: {}, proceso: {}
      })
    }

    // Buscar el registro Benninger más reciente para la partida
    const rtfResult = await query(
      `SELECT source_file, partida, rolada, header, raw_rtf_text, plain_text, confidence, saved_at
       FROM tb_benninger_rtf
       WHERE partida = $1
       ORDER BY saved_at DESC
       LIMIT 1`,
      [partida], 'benninger-impacto/rtf'
    )

    if (!rtfResult.rows.length) {
      return res.json({
        success: false,
        error: `No se encontró análisis Benninger para la partida ${partida}`
      })
    }

    const rtf = rtfResult.rows[0]
    const header = rtf.header || {}

    // Construir proceso: primero desde header.proceso (si existe), luego desde campos flat del header
    const procesoBase = header.proceso && typeof header.proceso === 'object' && Object.keys(header.proceso).length > 0
      ? header.proceso
      : {}
    const proceso = {
      stretchAplicado:  procesoBase.stretchAplicado  ?? header.stretchAplicado  ?? header['1S034'],
      humedadSalida:    procesoBase.humedadSalida    ?? header.humedadSalida    ?? header['1S068'],
      tensionPlegador:  procesoBase.tensionPlegador  ?? header.tensionPlegador  ?? header['1S054'],
      gomaReal:         procesoBase.gomaReal         ?? header.gomaReal         ?? header['1A41'],
      presionExprimido: procesoBase.presionExprimido ?? header.presionExprimido ?? header['1S086'],
      gomaObjetivo:     procesoBase.gomaObjetivo     ?? header.gomaObjetivo,
      velocidad:        procesoBase.velocidad        ?? (() => {
        const v = String(header.velMMin || '').replace(/[^0-9.,]/g, '').replace(',', '.')
        return v ? parseFloat(v) : undefined
      })(),
      tensionTimeline:  procesoBase.tensionTimeline  ?? header.tensionTimeline  ?? [],
      // amlCel: desde header.proceso si disponible, si no parsear desde plain_text
      amlCel: (procesoBase.amlCel && (procesoBase.amlCel.total > 0 || Array.isArray(procesoBase.amlCel.eventos)))
        ? procesoBase.amlCel
        : parseAmlCelFromPlainText(rtf.plain_text)
    }

    // Intentar obtener datos de laboratorio (Uster) para la partida
    // Se busca en tb_uster_par por lote ligado a la partida mediante tb_produccion
    let laboratorio = {}
    let referencias = null

    try {
      // Detectar nombre exacto de la columna 'lote fiacao' (puede tener 1 o 2 espacios)
      const prodColsRes = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_produccion'`,
        [], 'benninger-impacto/cols'
      ).catch(() => null)
      const prodColsMap = new Map((prodColsRes?.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name]))
      const loteColName = ['lote fiacao', 'lote  fiacao'].find((c) => prodColsMap.has(c))
      const loteExprImpacto = loteColName ? `p.${quoteIdent(prodColsMap.get(loteColName))}` : 'NULL::text'

      const hivResult = await query(`
        SELECT
          AVG(d.sci)    AS sci,
          AVG(d.mic)    AS mic,
          AVG(d.str)    AS str,
          AVG(d.uhml)   AS uhml,
          AVG(d.elg)    AS elg,
          AVG(d.rd)     AS rd,
          AVG(d.plus_b) AS plus_b
        FROM tb_hvi_ensayos e
        JOIN tb_hvi_detalles d ON d.ensayo_id = e.id
        WHERE TRIM(UPPER(e.lote)) = ANY(
          SELECT DISTINCT TRIM(UPPER(${loteExprImpacto}))
          FROM tb_produccion p
          WHERE TRIM(p."PARTIDA") = $1 AND p."SELETOR" = 'INDIGO' AND p."FILIAL" = '05'
          LIMIT 20
        )
      `, [partida], 'benninger-impacto/hvi').catch(() => null)

      if (hivResult?.rows?.length) {
        const r = hivResult.rows[0]
        laboratorio = {
          sci:   r.sci   != null ? Number(r.sci)   : undefined,
          mic:   r.mic   != null ? Number(r.mic)   : undefined,
          str:   r.str   != null ? Number(r.str)   : undefined,
          uhml:  r.uhml  != null ? Number(r.uhml)  : undefined,
          elg:   r.elg   != null ? Number(r.elg)   : undefined,
          rd:    r.rd    != null ? Number(r.rd)    : undefined,
          plusB: r.plus_b != null ? Number(r.plus_b) : undefined
        }
      }
    } catch (_) { /* laboratorio queda vacío, no es crítico */ }

    // Intentar obtener testnr de Uster para la partida (referencia)
    try {
      const usterRef = await query(`
        SELECT p.testnr
        FROM tb_uster_par p
        WHERE TRIM(UPPER(p.lote)) = ANY(
          SELECT DISTINCT TRIM(UPPER("ARTIGO"))
          FROM tb_produccion
          WHERE TRIM("PARTIDA") = $1 AND "SELETOR" = 'INDIGO' AND "FILIAL" = '05'
          LIMIT 5
        )
        ORDER BY p.time_stamp DESC NULLS LAST
        LIMIT 1
      `, [partida], 'benninger-impacto/uster-ref').catch(() => null)

      if (usterRef?.rows?.length) {
        referencias = { uster: { testnr: usterRef.rows[0].testnr } }
      }
    } catch (_) { /* referencias queda null */ }

    res.json({
      sourceFile:  rtf.source_file || '',
      rawRtfText:  rtf.raw_rtf_text || '',
      match: {
        partida: rtf.partida,
        rolada:  rtf.rolada,
        confidence: rtf.confidence
      },
      referencias,
      laboratorio,
      proceso
    })
  } catch (err) {
    console.error('Error en /api/benninger-impacto:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function startServer() {
  try {
    // Esperar a PostgreSQL (en Podman/compose puede tardar unos segundos)
    const maxAttempts = Math.max(1, parseInt(process.env.PG_CONNECT_ATTEMPTS || '30', 10))
    const delayMs = Math.max(200, parseInt(process.env.PG_CONNECT_DELAY_MS || '1000', 10))
    let lastErr = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await pool.connect()
        client.release()
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        console.warn(`PostgreSQL no disponible (intento ${attempt}/${maxAttempts}): ${e.message}`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }

    if (lastErr) throw lastErr
    console.log('✓ Conexión a PostgreSQL exitosa')

    // Índices para endpoints de calidad (impacta en performance con muchos datos)
    ensureCalidadIndexes().catch((e) => console.warn('ensureCalidadIndexes falló:', e.message))
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 ========================================')
      console.log(`🚀 STC Backend API v2 - PostgreSQL`)
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
      console.log(`🚀 Database: ${process.env.PG_DATABASE || 'stc_produccion'}`)
      console.log(`🚀 Health check: http://localhost:${PORT}/api/health`)
      console.log('🚀 ========================================')
    })
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message)
    process.exit(1)
  }
}

startServer()










