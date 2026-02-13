import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5433,
  database: process.env.PGDATABASE || 'stc_produccion',
  user: process.env.PGUSER || 'stc_user',
  password: process.env.PGPASSWORD || 'stc_password_2026'
})

async function checkMistura() {
  const misturas = ['10','11','12','13','18','19','20','26','27','33','34','35']
  
  console.log('\n=== VERIFICANDO MISTURA FALTANTES ===\n')
  
  // 1. Ver qué TIPO_MOV tienen estas MISTURA
  const result1 = await pool.query(`
    SELECT "MISTURA", "TIPO_MOV", COUNT(*) as registros
    FROM tb_CALIDAD_FIBRA
    WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
      AND "MISTURA" IN (${misturas.map((_, i) => `$${i+1}`).join(',')})
    GROUP BY "MISTURA", "TIPO_MOV"
    ORDER BY "MISTURA"::INTEGER
  `, misturas)
  
  console.log('📊 MISTURA por TIPO_MOV:')
  console.table(result1.rows)
  
  // 2. Ver si tienen TIPO_MOV = 'MIST'
  const result2 = await pool.query(`
    SELECT "MISTURA", COUNT(*) as registros
    FROM tb_CALIDAD_FIBRA
    WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
      AND "TIPO_MOV" = 'MIST'
      AND "MISTURA" IN (${misturas.map((_, i) => `$${i+1}`).join(',')})
    GROUP BY "MISTURA"
    ORDER BY "MISTURA"::INTEGER
  `, misturas)
  
  console.log('\n📈 MISTURA con TIPO_MOV = MIST:')
  console.table(result2.rows)
  
  // 3. Ver todas las MISTURA únicas con TIPO_MOV = 'MIST'
  const result3 = await pool.query(`
    SELECT "MISTURA", COUNT(*) as registros
    FROM tb_CALIDAD_FIBRA
    WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
      AND "TIPO_MOV" = 'MIST'
      AND "MISTURA" IS NOT NULL
    GROUP BY "MISTURA"
    ORDER BY CAST("MISTURA" AS INTEGER)
  `)
  
  console.log(`\n✅ Total MISTURA únicas con TIPO_MOV=MIST: ${result3.rows.length}`)
  if (result3.rows.length > 0) {
    console.table(result3.rows.slice(0, 20))
    console.log('...')
    console.log('MISTURA disponibles:', result3.rows.map(r => r.MISTURA).join(', '))
  }
  
  // 4. Verificar si las MISTURA faltantes existen sin filtros
  const result4 = await pool.query(`
    SELECT "MISTURA", "TIPO_MOV", 
           COUNT(*) as total,
           SUM(CASE WHEN "LOTE_FIAC" IS NULL OR "LOTE_FIAC" = '' THEN 1 ELSE 0 END) as sin_lote
    FROM tb_CALIDAD_FIBRA
    WHERE "MISTURA" IN (${misturas.map((_, i) => `$${i+1}`).join(',')})
    GROUP BY "MISTURA", "TIPO_MOV"
    ORDER BY CAST("MISTURA" AS INTEGER)
  `, misturas)
  
  console.log('\n🔍 MISTURA faltantes (sin filtros):')
  console.table(result4.rows)
  
  await pool.end()
}

checkMistura().catch(console.error)
