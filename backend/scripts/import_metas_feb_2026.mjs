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
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dic: '12',
}

function parseFechaEs(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return null
  // formato: "domingo 01-feb-26"
  const parts = text.split(' ')
  const datePart = parts.length > 1 ? parts[1] : parts[0]
  const [dd, mon, yy] = datePart.split('-')
  if (!dd || !mon || !yy) return null
  const mm = monthMap[mon]
  if (!mm) return null
  const year = yy.length === 2 ? `20${yy}` : yy
  return `${year}-${mm}-${dd}`
}

function parseNumberEs(value) {
  if (value === undefined || value === null) return null
  const raw = String(value).trim()
  if (!raw) return null
  // handle thousands with dot and decimals with comma
  if (raw.includes(',') && raw.includes('.')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  if (raw.includes(',')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  if (raw.includes('.')) {
    const parts = raw.split('.')
    if (parts[1] && parts[1].length === 3) {
      const normalized = raw.replace(/\./g, '')
      const n = Number(normalized)
      return Number.isFinite(n) ? n : null
    }
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
  const inFile = path.resolve(process.cwd(), 'backend', 'scripts', 'input_metas_feb_2026.txt')
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

  const idx = (name, fallbackIndex = -1) => {
    const i = headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
    return i >= 0 ? i : fallbackIndex
  }

  const colDia = idx('Dia', 0)
  const colIndigo = idx('Indigo', 1)
  const colMetaEfic = idx('Meta_Eficiencia_INDIGO', 2)
  const colTejeduria = idx('Tejeduria', 5)
  // usar el segundo "Meta_Estopa_Azul" (posicion 9) para tecelagem_enc_urd
  const colMetaRotura = idx('Meta_Rotura_INDIGO', 3)
  const colMetaEstopaAzul = idx('Meta_Estopa_Azul', 4)
  const colRu105 = idx('RU105', 6)
  const colRt105 = idx('RT105', 7)
  const colEfiPercent = idx('EFI%', 8)
  const colMetaEstopaTej = 9
  const colIntegrada = idx('Integrada', 10)
  const colVelIntegrada = idx('Meta_Velocidad_Integrada', 11)
  const colEncUrdIntegrada = idx('Meta_ENC_URD_Integrada', 12)
  const colRevision = idx('Revision', 13)
  const colDiaInvertido = idx('Dia_Invertido', 14)

  const insertSql = `
    INSERT INTO tb_metas (
      "Dia",
      fecha,
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
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  `.trim()

  const client = await pool.connect()
  try {
    let inserted = 0
    for (const row of rows) {
      const fecha = parseFechaEs(row[colDia])
      if (!fecha) {
        console.error('Fila sin fecha valida, omitiendo:', row[colDia])
        continue
      }
      const indigo = parseNumberEs(row[colIndigo])
      const metaEfi = parseNumberEs(row[colMetaEfic])
      const metaRot = parseNumberEs(row[colMetaRotura])
      const metaEstopaAzul = parseNumberEs(row[colMetaEstopaAzul])
      const tecelagem = parseNumberEs(row[colTejeduria])
      const ru105 = parseNumberEs(row[colRu105])
      const rt105 = parseNumberEs(row[colRt105])
      const efiPercent = parseNumberEs(row[colEfiPercent])
      const metaEstopaTej = parseNumberEs(row[colMetaEstopaTej])
      const integrada = parseNumberEs(row[colIntegrada])
      const velIntegrada = parseNumberEs(row[colVelIntegrada])
      const encUrdIntegrada = parseNumberEs(row[colEncUrdIntegrada])
      const revision = colRevision >= 0 ? parseNumberEs(row[colRevision]) : null
      const diaInvertido = colDiaInvertido >= 0 ? parseNumberEs(row[colDiaInvertido]) : null

      await client.query('DELETE FROM tb_metas WHERE "Dia" = $1', [fecha])
      await client.query(insertSql, [
        fecha,
        fecha,
        indigo,
        metaEfi,
        metaRot,
        metaEstopaAzul,
        tecelagem,
        ru105,
        rt105,
        efiPercent,
        metaEstopaTej,
        integrada,
        velIntegrada,
        encUrdIntegrada,
        revision,
        diaInvertido,
      ])
      inserted++
    }
    console.log(`✅ Insertadas ${inserted} filas (febrero 2026)`) 
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Error importando febrero 2026:', err)
  process.exit(1)
})
