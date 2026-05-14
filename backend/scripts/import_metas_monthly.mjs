/**
 * import_metas_monthly.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Rutina reutilizable para cargar metas mensuales en tb_metas.
 *
 * USO:
 *   node backend/scripts/import_metas_monthly.mjs <archivo_input>
 *
 * Ejemplo:
 *   node backend/scripts/import_metas_monthly.mjs backend/scripts/input_metas_may_2026.txt
 *
 * FLUJO MENSUAL:
 *   1. Crear el archivo TSV del mes con los datos de la planilla (ver formato abajo).
 *   2. Nombrarlo  input_metas_<mes>_<año>.txt  (ej: input_metas_jun_2026.txt)
 *   3. Ejecutar este script pasando la ruta del archivo como argumento.
 *   4. Verificar en la salida que todas las filas dicen ✓ y ninguna ✗.
 *
 * FORMATO DEL ARCHIVO TSV:
 *   - Separador: tabulaciones (\t)
 *   - Primera fila: cabecera con los nombres de columna exactos
 *   - Columna Dia acepta dos formatos:
 *       · DD/MM/YYYY            (ej: 01/05/2026)
 *       · <diaNombre> DD-mon-YY (ej: miércoles 01-may-26)
 *   - Números: separador decimal con coma (ej: 1,8) o con punto (ej: 1.8)
 *             separador de miles con punto (ej: 44.828 → 44828)
 *   - Celdas vacías quedan como NULL en la BD
 *
 * COLUMNAS ESPERADAS (orden no importa, se buscan por nombre):
 *   Dia, Indigo, Meta_Eficiencia_INDIGO, Meta_Rotura_INDIGO, Meta_Estopa_Azul,
 *   Tejeduria, RU105, RT105, EFI_Percent (o EFI%), Meta_Estopa_Azul_Tejeduria,
 *   Integrada, Meta_Velocidad_Integrada, Meta_ENC_URD_Integrada, Revision, Dia_Invertido
 *
 * COMPORTAMIENTO:
 *   - INSERT … ON CONFLICT ("Dia") DO UPDATE: si ya existe la fecha, la actualiza.
 *   - Requiere índice único en tb_metas("Dia") — ya creado por
 *     add_unique_index_tb_metas_dia.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     process.env.PG_PORT     || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user:     process.env.PG_USER     || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
})

// ── Mapeo de abreviaturas de mes en español ───────────────────────────────────
const MONTH_MAP = {
  ene: '01', feb: '02', mar: '03', abr: '04',
  may: '05', jun: '06', jul: '07', ago: '08',
  sep: '09', oct: '10', nov: '11', dic: '12',
}

/**
 * Parsea la columna Dia.
 * Acepta:
 *   · "DD/MM/YYYY"             → "2026-05-01"
 *   · "<diaNombre> DD-mon-YY"  → "2026-05-01"
 */
function parseFecha(value) {
  const text = String(value || '').trim()
  if (!text) return null

  // Formato DD/MM/YYYY
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // Formato "diaNombre DD-mon-YY" (el nombre del día es opcional)
  const parts = text.toLowerCase().split(/\s+/)
  const datePart = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const dashMatch = datePart.match(/^(\d{1,2})-([a-záéíóú]+)-(\d{2,4})$/)
  if (dashMatch) {
    const [, dd, mon, yy] = dashMatch
    const mm = MONTH_MAP[mon.slice(0, 3)]
    if (!mm) return null
    const year = yy.length === 2 ? `20${yy}` : yy
    return `${year}-${mm}-${dd.padStart(2, '0')}`
  }

  return null
}

/**
 * Parsea un número en formato europeo (coma decimal, punto de miles).
 * Ejemplos:
 *   "1,8"    → 1.8
 *   "44.828" → 44828   (punto como separador de miles si hay 3 decimales)
 *   "44000"  → 44000
 *   ""       → null
 */
function parseNum(value) {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw) return null

  // Coma decimal y punto de miles: "1.234,56" → 1234.56
  if (raw.includes(',') && raw.includes('.')) {
    const n = Number(raw.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  // Solo coma decimal: "1,8" → 1.8
  if (raw.includes(',')) {
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  // Solo punto: podría ser miles ("44.828") o decimal ("1.5")
  if (raw.includes('.')) {
    const parts = raw.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      // Punto de miles → quitar el punto
      const n = Number(raw.replace('.', ''))
      return Number.isFinite(n) ? n : null
    }
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  // Sin separadores
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Parsea un archivo TSV y devuelve { headers, rows } */
function parseTSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split('\t').map(h => h.trim())
  const rows = lines.slice(1).map(l => l.split('\t').map(c => c.trim()))
  return { headers, rows }
}

/** Devuelve el índice de una columna buscando por varios alias (case-insensitive) */
function findCol(headers, ...aliases) {
  for (const alias of aliases) {
    const i = headers.findIndex(h => h.toLowerCase() === alias.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

// ── SQL de upsert ─────────────────────────────────────────────────────────────
const INSERT_SQL = `
  INSERT INTO tb_metas (
    "Dia",
    "Indigo",
    "Meta_Eficiencia_INDIGO",
    "Meta_Rotura_INDIGO",
    "Meta_Estopa_Azul",
    "Tejeduria",
    "RU105",
    "RT105",
    "EFI_Percent",
    "Meta_Estopa_Azul_Tejeduria",
    "Integrada",
    "Meta_Velocidad_Integrada",
    "Meta_ENC_URD_Integrada",
    "Revision",
    "Dia_Invertido"
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  ON CONFLICT ("Dia") DO UPDATE SET
    "Indigo"                     = EXCLUDED."Indigo",
    "Meta_Eficiencia_INDIGO"     = EXCLUDED."Meta_Eficiencia_INDIGO",
    "Meta_Rotura_INDIGO"         = EXCLUDED."Meta_Rotura_INDIGO",
    "Meta_Estopa_Azul"           = EXCLUDED."Meta_Estopa_Azul",
    "Tejeduria"                  = EXCLUDED."Tejeduria",
    "RU105"                      = EXCLUDED."RU105",
    "RT105"                      = EXCLUDED."RT105",
    "EFI_Percent"                = EXCLUDED."EFI_Percent",
    "Meta_Estopa_Azul_Tejeduria" = EXCLUDED."Meta_Estopa_Azul_Tejeduria",
    "Integrada"                  = EXCLUDED."Integrada",
    "Meta_Velocidad_Integrada"   = EXCLUDED."Meta_Velocidad_Integrada",
    "Meta_ENC_URD_Integrada"     = EXCLUDED."Meta_ENC_URD_Integrada",
    "Revision"                   = EXCLUDED."Revision",
    "Dia_Invertido"              = EXCLUDED."Dia_Invertido"
`.trim()

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const inputArg = process.argv[2]
  if (!inputArg) {
    console.error('❌ Debes indicar el archivo de entrada como argumento.')
    console.error('   Uso: node backend/scripts/import_metas_monthly.mjs <ruta_archivo>')
    process.exit(1)
  }

  // Resolver ruta relativa al directorio donde se ejecuta el comando (cwd)
  const inFile = path.isAbsolute(inputArg)
    ? inputArg
    : path.resolve(process.cwd(), inputArg)

  if (!fs.existsSync(inFile)) {
    console.error('❌ No se encuentra el archivo:', inFile)
    process.exit(2)
  }

  const content = fs.readFileSync(inFile, 'utf8')
  const { headers, rows } = parseTSV(content)

  if (!headers.length) {
    console.error('❌ No se detectaron encabezados en el archivo.')
    process.exit(2)
  }

  console.log(`\n📄 Archivo: ${path.basename(inFile)}`)
  console.log(`   Columnas detectadas: ${headers.join(', ')}`)
  console.log(`   Filas de datos:      ${rows.length}\n`)

  // Mapeo de columnas (con soporte para alias alternativos)
  const C = {
    dia:           findCol(headers, 'Dia'),
    indigo:        findCol(headers, 'Indigo'),
    metaEfic:      findCol(headers, 'Meta_Eficiencia_INDIGO'),
    metaRot:       findCol(headers, 'Meta_Rotura_INDIGO'),
    metaEstopaAzul:findCol(headers, 'Meta_Estopa_Azul'),
    tejeduria:     findCol(headers, 'Tejeduria'),
    ru105:         findCol(headers, 'RU105'),
    rt105:         findCol(headers, 'RT105'),
    efiPct:        findCol(headers, 'EFI_Percent', 'EFI%'),
    metaEstopaTej: findCol(headers, 'Meta_Estopa_Azul_Tejeduria'),
    integrada:     findCol(headers, 'Integrada'),
    velIntegrada:  findCol(headers, 'Meta_Velocidad_Integrada'),
    encUrdInteg:   findCol(headers, 'Meta_ENC_URD_Integrada'),
    revision:      findCol(headers, 'Revision'),
    diaInv:        findCol(headers, 'Dia_Invertido'),
  }

  if (C.dia < 0) {
    console.error('❌ No se encontró la columna "Dia" en el archivo.')
    process.exit(2)
  }

  const v = (row, colIdx) => colIdx >= 0 ? parseNum(row[colIdx]) : null

  const client = await pool.connect()
  let inserted = 0
  let skipped  = 0

  try {
    for (const row of rows) {
      const fecha = parseFecha(row[C.dia])
      if (!fecha) {
        console.warn(`  ⚠ Fila sin fecha válida, omitida: "${row[C.dia]}"`)
        skipped++
        continue
      }

      const values = [
        fecha,              // $1  Dia
        v(row, C.indigo),   // $2
        v(row, C.metaEfic), // $3
        v(row, C.metaRot),  // $4
        v(row, C.metaEstopaAzul), // $5
        v(row, C.tejeduria),      // $6
        v(row, C.ru105),          // $7
        v(row, C.rt105),          // $8
        v(row, C.efiPct),         // $9
        v(row, C.metaEstopaTej),  // $10
        v(row, C.integrada),      // $11
        v(row, C.velIntegrada),   // $12
        v(row, C.encUrdInteg),    // $13
        v(row, C.revision),       // $14
        v(row, C.diaInv),         // $15
      ]

      try {
        await client.query(INSERT_SQL, values)
        console.log(`  ✓ ${fecha}`)
        inserted++
      } catch (err) {
        console.error(`  ✗ Error en ${fecha}: ${err.message}`)
        skipped++
      }
    }

    console.log(`\n✅ Completado: ${inserted} filas insertadas/actualizadas, ${skipped} omitidas.\n`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ Error inesperado:', err)
  process.exit(1)
})
