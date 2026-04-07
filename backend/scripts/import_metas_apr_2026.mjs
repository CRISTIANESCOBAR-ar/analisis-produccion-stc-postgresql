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

const monthMap = {
  ene: '01', feb: '02', mar: '03', abr: '04',
  may: '05', jun: '06', jul: '07', ago: '08',
  sep: '09', oct: '10', nov: '11', dic: '12',
}

function parseFechaEs(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return null
  // formato: "miércoles 01-abr-26"
  const parts = text.split(' ')
  const datePart = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const [dd, mon, yy] = datePart.split('-')
  if (!dd || !mon || !yy) return null
  const mm = monthMap[mon]
  if (!mm) return null
  const year = yy.length === 2 ? `20${yy}` : yy
  return `${year}-${mm}-${String(dd).padStart(2, '0')}`
}

function parseNumberEs(value) {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw || raw === '') return null
  // Formato europeo: miles con punto, decimal con coma  ej: 44.828 → 44828
  if (raw.includes('.') && !raw.includes(',')) {
    const parts = raw.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      // miles con punto: 44.828 → 44828
      const n = Number(raw.replace(/\./g, ''))
      return Number.isFinite(n) ? n : null
    }
    // decimal con punto normal
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  if (raw.includes(',') && raw.includes('.')) {
    // 1.234,56 → 1234.56
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  if (raw.includes(',')) {
    // 1,6 → 1.6
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseTSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split('\t').map(h => h.trim())
  const rows = lines.slice(1).map(l => l.split('\t'))
  return { headers, rows }
}

async function main() {
  const inFile = path.resolve(process.cwd(), 'backend', 'scripts', 'input_metas_apr_2026.txt')
  if (!fs.existsSync(inFile)) {
    console.error('No se encuentra el archivo:', inFile)
    process.exit(2)
  }
  const content = fs.readFileSync(inFile, 'utf8')
  const { headers, rows } = parseTSV(content)
  if (!headers.length) {
    console.error('No se detectaron encabezados')
    process.exit(2)
  }

  console.log('Columnas detectadas en el archivo:', headers)

  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

  // Índices de columnas — acorde a input_metas_apr_2026.txt
  const colDia               = idx('Dia')                       // 0
  const colIndigo            = idx('Indigo')                    // 1
  const colMetaEfic          = idx('Meta_Eficiencia_INDIGO')    // 2
  const colMetaRot           = idx('Meta_Rotura_INDIGO')        // 3
  const colMetaEstopaAzul    = idx('Meta_Estopa_Azul')          // 4
  const colTejeduria         = idx('Tejeduria')                 // 5
  const colRU105             = idx('RU105')                     // 6
  const colRT105             = idx('RT105')                     // 7
  const colEfiPercent        = idx('EFI%')                      // 8
  const colMetaEstopaTej     = idx('Meta_Estopa_Azul_Tejeduria')// 9
  const colIntegrada         = idx('Integrada')                 // 10
  const colVelIntegrada      = idx('Meta_Velocidad_Integrada')  // 11
  const colEncUrdIntegrada   = idx('Meta_ENC_URD_Integrada')    // 12
  const colRevision          = idx('Revision')                  // 13
  const colDiaInvertido      = idx('Dia_Invertido')             // 14

  const insertSql = `
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
      "Indigo"                    = EXCLUDED."Indigo",
      "Meta_Eficiencia_INDIGO"    = EXCLUDED."Meta_Eficiencia_INDIGO",
      "Meta_Rotura_INDIGO"        = EXCLUDED."Meta_Rotura_INDIGO",
      "Meta_Estopa_Azul"          = EXCLUDED."Meta_Estopa_Azul",
      "Tejeduria"                 = EXCLUDED."Tejeduria",
      "RU105"                     = EXCLUDED."RU105",
      "RT105"                     = EXCLUDED."RT105",
      "EFI_Percent"               = EXCLUDED."EFI_Percent",
      "Meta_Estopa_Azul_Tejeduria"= EXCLUDED."Meta_Estopa_Azul_Tejeduria",
      "Integrada"                 = EXCLUDED."Integrada",
      "Meta_Velocidad_Integrada"  = EXCLUDED."Meta_Velocidad_Integrada",
      "Meta_ENC_URD_Integrada"    = EXCLUDED."Meta_ENC_URD_Integrada",
      "Revision"                  = EXCLUDED."Revision",
      "Dia_Invertido"             = EXCLUDED."Dia_Invertido"
  `.trim()

  const client = await pool.connect()
  try {
    let inserted = 0
    let skipped = 0
    for (const row of rows) {
      const fecha = parseFechaEs(row[colDia])
      if (!fecha) {
        console.error('Fila sin fecha válida, omitiendo:', row[colDia])
        skipped++
        continue
      }

      const values = [
        fecha,                                                               // $1  Dia
        colIndigo       >= 0 ? parseNumberEs(row[colIndigo])            : null,  // $2
        colMetaEfic     >= 0 ? parseNumberEs(row[colMetaEfic])          : null,  // $3
        colMetaRot      >= 0 ? parseNumberEs(row[colMetaRot])           : null,  // $4
        colMetaEstopaAzul >= 0 ? parseNumberEs(row[colMetaEstopaAzul])  : null,  // $5
        colTejeduria    >= 0 ? parseNumberEs(row[colTejeduria])         : null,  // $6
        colRU105        >= 0 ? parseNumberEs(row[colRU105])             : null,  // $7
        colRT105        >= 0 ? parseNumberEs(row[colRT105])             : null,  // $8
        colEfiPercent   >= 0 ? parseNumberEs(row[colEfiPercent])        : null,  // $9
        colMetaEstopaTej >= 0 ? parseNumberEs(row[colMetaEstopaTej])    : null,  // $10
        colIntegrada    >= 0 ? parseNumberEs(row[colIntegrada])         : null,  // $11
        colVelIntegrada >= 0 ? parseNumberEs(row[colVelIntegrada])      : null,  // $12
        colEncUrdIntegrada >= 0 ? parseNumberEs(row[colEncUrdIntegrada]): null,  // $13
        colRevision     >= 0 ? parseNumberEs(row[colRevision])          : null,  // $14
        colDiaInvertido >= 0 ? parseNumberEs(row[colDiaInvertido])      : null,  // $15
      ]

      try {
        await client.query(insertSql, values)
        console.log(`  ✓ ${fecha}`)
        inserted++
      } catch (err) {
        console.error(`  ✗ Error en ${fecha}:`, err.message)
        skipped++
      }
    }
    console.log(`\n✅ Completado: ${inserted} filas insertadas/actualizadas, ${skipped} omitidas`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
