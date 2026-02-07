import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
})

async function getTableColumns(tableName) {
  const res = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  return res.rows.reduce((acc, r) => {
    const key = r.column_name.toLowerCase()
    acc.typeByLower[key] = r.data_type
    acc.actualByLower[key] = r.column_name
    return acc
  }, { typeByLower: {}, actualByLower: {} })
}

function parseTSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split('\t').map(h => h.trim())
  const rows = lines.slice(1).map(l => l.split('\t'))
  return { headers, rows }
}

function convertValue(val, dataType) {
  if (val === undefined || val === null) return null
  const v = String(val).trim()
  if (v === '') return null
  if (!dataType) return v
  const dt = dataType.toLowerCase()
  if (dt.includes('int') || dt.includes('numeric') || dt.includes('double') || dt.includes('real') || dt.includes('decimal')) {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  if (dt.includes('date') || dt.includes('timestamp')) {
    // try to normalize yyyy-mm-dd if possible
    return v
  }
  return v
}

async function main() {
  const inFile = path.resolve(process.cwd(), 'backend', 'scripts', 'input_metas_pg.tsv')
  if (!fs.existsSync(inFile)) {
    console.error('Archivo de entrada no encontrado:', inFile)
    process.exit(2)
  }
  const content = fs.readFileSync(inFile, 'utf8')
  const { headers, rows } = parseTSV(content)
  if (headers.length === 0) {
    console.error('No se detectaron encabezados en el TSV')
    process.exit(2)
  }

  const tableName = 'tb_metas'
  const tableCols = await getTableColumns(tableName)
  if (!Object.keys(tableCols.typeByLower).length) {
    console.error('La tabla', tableName, 'no existe o no tiene columnas en public schema')
    process.exit(2)
  }

  // Map headers to existing columns (case-insensitive). Ignore 'id' if it's serial.
  const headerLower = headers.map(h => h.toLowerCase())
  const headerIndexMap = headerLower.reduce((acc, h, idx) => {
    acc[h] = idx
    return acc
  }, {})

  const mappedColsLower = headerLower.filter(h => h in tableCols.typeByLower && h !== 'id')
  const mappedActualCols = mappedColsLower.map(h => tableCols.actualByLower[h])
  if (mappedActualCols.length === 0) {
    console.error('No se encontraron columnas coincidentes entre el TSV y la tabla tb_metas')
    process.exit(2)
  }

  const colPlaceholders = mappedActualCols.map((_, i) => `$${i + 1}`).join(', ')
  const quotedCols = mappedActualCols.map(c => `"${c}"`).join(', ')
  const insertSql = `INSERT INTO ${tableName} (${quotedCols}) VALUES (${colPlaceholders})`

  const diaIndex = headerIndexMap.dia
  const fechaIndex = headerIndexMap.fecha
  if (diaIndex === undefined && fechaIndex === undefined) {
    console.error('No se encontro columna "Dia" ni "fecha" en el TSV exportado. Revise el archivo de entrada.')
    process.exit(2)
  }

  console.log('Columnas a insertar:', mappedActualCols.join(', '))
  console.log('Preparando para insertar', rows.length, 'filas')

  const client = await pool.connect()
  try {
    let inserted = 0
    for (const r of rows) {
      // pad r to headers length
      const values = mappedColsLower.map(colLower => {
        const idx = headerIndexMap[colLower]
        const raw = idx >= 0 && idx < r.length ? r[idx] : ''
        return convertValue(raw, tableCols.typeByLower[colLower])
      })

      const diaRaw = diaIndex !== undefined ? r[diaIndex] : null
      const fechaRaw = fechaIndex !== undefined ? r[fechaIndex] : null
      const dia = diaIndex !== undefined ? convertValue(diaRaw, tableCols.typeByLower.dia) : null
      const fecha = fechaIndex !== undefined ? convertValue(fechaRaw, tableCols.typeByLower.fecha) : null

      const keyFecha = dia || fecha
      if (!keyFecha) {
        console.error('Fila sin fecha valida, omitiendo.')
        continue
      }
      try {
        if (dia) {
          await client.query('DELETE FROM tb_metas WHERE "Dia" = $1', [dia])
        } else {
          await client.query('DELETE FROM tb_metas WHERE fecha = $1', [fecha])
        }
        await client.query(insertSql, values)
        inserted++
      } catch (err) {
        console.error('Error insertando fila, continuando. Error:', err.message)
      }
    }
    console.log(`✅ Insertadas aprox ${inserted} filas en ${tableName}`)
  } catch (err) {
    console.error('Error durante importación:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
