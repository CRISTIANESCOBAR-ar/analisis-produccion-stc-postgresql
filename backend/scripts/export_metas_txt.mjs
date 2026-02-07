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

async function main() {
  const outDir = path.resolve(process.cwd(), 'exports')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'tb_metas.txt')

  // Verificar existencia de la tabla
  const existsRes = await pool.query('SELECT to_regclass($1) AS reg', ['public.tb_metas'])
  if (!existsRes.rows?.[0]?.reg) {
    console.error('La tabla "tb_metas" no existe en la base de datos.')
    process.exit(2)
  }

  const res = await pool.query('SELECT * FROM tb_metas ORDER BY fecha DESC NULLS LAST')

  const cols = res.fields.map(f => f.name)
  const header = cols.join('\t')

  const lines = res.rows.map(row => cols.map(c => {
    const v = row[c]
    if (v === null || v === undefined) return ''
    if (v instanceof Date) return v.toISOString().slice(0,10)
    return String(v).replace(/\t/g, ' ')
  }).join('\t'))

  const content = header + '\n' + lines.join('\n') + '\n'
  fs.writeFileSync(outFile, content, 'utf8')

  console.log(`✅ Exportadas ${res.rowCount} filas a: ${outFile}`)
  await pool.end()
}

main().catch(err => {
  console.error('Error exportando tb_metas:', err)
  process.exit(1)
})
