import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 3,
})

const args = process.argv.slice(2)
const partidaArg = args[0]
const artigoArg = args[0] && args[0].startsWith('ART:') ? args[0].slice(4) : null

async function main() {
  try {
    let res
    if (partidaArg && !artigoArg) {
      res = await pool.query(
        `SELECT TRIM("PARTIDA") AS partida, "ARTIGO", "MAQUINA", "RPM LEITURA", "LARG PAD", "QTDE_CAVALO", "TURNO_INDIGO", "SELETOR", "DAT_PROD"
         FROM public.tb_produccion
         WHERE TRIM(BOTH FROM "PARTIDA") = $1
         LIMIT 200`,
        [partidaArg]
      )
    } else if (artigoArg) {
      res = await pool.query(
        `SELECT TRIM("PARTIDA") AS partida, "ARTIGO", "MAQUINA", "RPM LEITURA", "LARG PAD", "QTDE_CAVALO", "TURNO_INDIGO", "SELETOR", "DAT_PROD"
         FROM public.tb_produccion
         WHERE "ARTIGO" ILIKE $1
         LIMIT 200`,
        [`%${artigoArg}%`]
      )
    } else {
      res = await pool.query(
        `SELECT TRIM("PARTIDA") AS partida, "ARTIGO", "MAQUINA", "RPM LEITURA", "LARG PAD", "QTDE_CAVALO", "TURNO_INDIGO", "SELETOR", "DAT_PROD"
         FROM public.tb_produccion
         WHERE "FILIAL" = '05' AND "SELETOR" = 'TECELAGEM'
           AND (COALESCE(NULLIF(TRIM(CAST("RPM LEITURA" AS TEXT)),''),'') <> ''
                OR COALESCE(NULLIF(TRIM(CAST("LARG PAD" AS TEXT)),''),'') <> ''
                OR COALESCE(NULLIF(TRIM(CAST("QTDE_CAVALO" AS TEXT)),''),'') <> '')
         ORDER BY "DAT_PROD" DESC NULLS LAST
         LIMIT 200`
      )
    }

    console.log(JSON.stringify(res.rows, null, 2))
  } catch (err) {
    console.error('ERROR-INSPECT:', err.message || err)
    process.exit(2)
  } finally {
    await pool.end()
  }
}

main()
