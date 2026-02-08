import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

const ITEMS = [
  { codigo: 'ESTOPA_AZUL', descripcion: 'Estopa Azul', unidad: 'KG' },
  { codigo: 'URDIDO_TENIDO', descripcion: 'Urdido Tenido', unidad: 'M' },
  { codigo: 'TELA_TERMINADA', descripcion: 'Tela Terminada', unidad: 'M' }
]

const COSTOS = [
  // 2023
  { yyyymm: '2023-01', codigo: 'URDIDO_TENIDO', valor: 252.48 },
  { yyyymm: '2023-02', codigo: 'URDIDO_TENIDO', valor: 232.86 },
  { yyyymm: '2023-03', codigo: 'URDIDO_TENIDO', valor: 238.34 },
  { yyyymm: '2023-04', codigo: 'URDIDO_TENIDO', valor: 270.19 },
  { yyyymm: '2023-05', codigo: 'URDIDO_TENIDO', valor: 274.91 },
  { yyyymm: '2023-06', codigo: 'URDIDO_TENIDO', valor: 295.43 },
  { yyyymm: '2023-07', codigo: 'URDIDO_TENIDO', valor: 298.85 },
  { yyyymm: '2023-08', codigo: 'URDIDO_TENIDO', valor: 336.77 },
  { yyyymm: '2023-09', codigo: 'URDIDO_TENIDO', valor: 317.75 },
  { yyyymm: '2023-10', codigo: 'URDIDO_TENIDO', valor: 347.79 },
  { yyyymm: '2023-11', codigo: 'URDIDO_TENIDO', valor: 375.5 },
  { yyyymm: '2023-12', codigo: 'URDIDO_TENIDO', valor: 525.53 },
  { yyyymm: '2023-01', codigo: 'TELA_TERMINADA', valor: 506.2 },
  { yyyymm: '2023-02', codigo: 'TELA_TERMINADA', valor: 454.65 },
  { yyyymm: '2023-03', codigo: 'TELA_TERMINADA', valor: 456.95 },
  { yyyymm: '2023-04', codigo: 'TELA_TERMINADA', valor: 512.52 },
  { yyyymm: '2023-05', codigo: 'TELA_TERMINADA', valor: 544.02 },
  { yyyymm: '2023-06', codigo: 'TELA_TERMINADA', valor: 625.83 },
  { yyyymm: '2023-07', codigo: 'TELA_TERMINADA', valor: 610.33 },
  { yyyymm: '2023-08', codigo: 'TELA_TERMINADA', valor: 651.29 },
  { yyyymm: '2023-09', codigo: 'TELA_TERMINADA', valor: 656.18 },
  { yyyymm: '2023-10', codigo: 'TELA_TERMINADA', valor: 715.11 },
  { yyyymm: '2023-11', codigo: 'TELA_TERMINADA', valor: 743.87 },
  { yyyymm: '2023-12', codigo: 'TELA_TERMINADA', valor: 1016.41 },

  // 2024
  { yyyymm: '2024-01', codigo: 'URDIDO_TENIDO', valor: 526.16 },
  { yyyymm: '2024-02', codigo: 'URDIDO_TENIDO', valor: 531.46 },
  { yyyymm: '2024-03', codigo: 'URDIDO_TENIDO', valor: 630.99 },
  { yyyymm: '2024-04', codigo: 'URDIDO_TENIDO', valor: 716.75 },
  { yyyymm: '2024-05', codigo: 'URDIDO_TENIDO', valor: 697.17 },
  { yyyymm: '2024-06', codigo: 'URDIDO_TENIDO', valor: 727.22 },
  { yyyymm: '2024-07', codigo: 'URDIDO_TENIDO', valor: 748.7 },
  { yyyymm: '2024-08', codigo: 'URDIDO_TENIDO', valor: 797.31 },
  { yyyymm: '2024-09', codigo: 'URDIDO_TENIDO', valor: 786.14 },
  { yyyymm: '2024-10', codigo: 'URDIDO_TENIDO', valor: 832.49 },
  { yyyymm: '2024-11', codigo: 'URDIDO_TENIDO', valor: 833.43, obs: 'Costo de oct-24.' },
  { yyyymm: '2024-12', codigo: 'URDIDO_TENIDO', valor: 989.03 },
  { yyyymm: '2024-01', codigo: 'TELA_TERMINADA', valor: 1104.14 },
  { yyyymm: '2024-02', codigo: 'TELA_TERMINADA', valor: 1077.16 },
  { yyyymm: '2024-03', codigo: 'TELA_TERMINADA', valor: 1291.66 },
  { yyyymm: '2024-04', codigo: 'TELA_TERMINADA', valor: 1426.87 },
  { yyyymm: '2024-05', codigo: 'TELA_TERMINADA', valor: 1504.82 },
  { yyyymm: '2024-06', codigo: 'TELA_TERMINADA', valor: 1643.52 },
  { yyyymm: '2024-07', codigo: 'TELA_TERMINADA', valor: 1637.77 },
  { yyyymm: '2024-08', codigo: 'TELA_TERMINADA', valor: 1777.46 },
  { yyyymm: '2024-09', codigo: 'TELA_TERMINADA', valor: 1822.38 },
  { yyyymm: '2024-10', codigo: 'TELA_TERMINADA', valor: 1849.98 },
  { yyyymm: '2024-11', codigo: 'TELA_TERMINADA', valor: 1914.93, obs: 'Costo de oct-24.' },
  { yyyymm: '2024-12', codigo: 'TELA_TERMINADA', valor: 2208.08 },

  // 2025
  { yyyymm: '2025-01', codigo: 'URDIDO_TENIDO', valor: 1062.57 },
  { yyyymm: '2025-02', codigo: 'URDIDO_TENIDO', valor: 902.61 },
  { yyyymm: '2025-03', codigo: 'URDIDO_TENIDO', valor: 871.83 },
  { yyyymm: '2025-04', codigo: 'URDIDO_TENIDO', valor: 866.25 },
  { yyyymm: '2025-05', codigo: 'URDIDO_TENIDO', valor: 932.15 },
  { yyyymm: '2025-06', codigo: 'URDIDO_TENIDO', valor: 932.15, obs: 'Costo de may-25.' },
  { yyyymm: '2025-07', codigo: 'URDIDO_TENIDO', valor: 1000 },
  { yyyymm: '2025-08', codigo: 'URDIDO_TENIDO', valor: 1100 },
  { yyyymm: '2025-09', codigo: 'URDIDO_TENIDO', valor: 1300 },
  { yyyymm: '2025-10', codigo: 'URDIDO_TENIDO', valor: 1500 },
  { yyyymm: '2025-11', codigo: 'URDIDO_TENIDO', valor: 2000 },
  { yyyymm: '2025-12', codigo: 'URDIDO_TENIDO', valor: 2500 },
  { yyyymm: '2025-01', codigo: 'TELA_TERMINADA', valor: 2276.66 },
  { yyyymm: '2025-02', codigo: 'TELA_TERMINADA', valor: 2019.03 },
  { yyyymm: '2025-03', codigo: 'TELA_TERMINADA', valor: 1940.12 },
  { yyyymm: '2025-04', codigo: 'TELA_TERMINADA', valor: 1948.84 },
  { yyyymm: '2025-05', codigo: 'TELA_TERMINADA', valor: 2103.07 },
  { yyyymm: '2025-06', codigo: 'TELA_TERMINADA', valor: 2103.07, obs: 'Costo de may-25.' },
  { yyyymm: '2025-07', codigo: 'TELA_TERMINADA', valor: 1500 },
  { yyyymm: '2025-08', codigo: 'TELA_TERMINADA', valor: 1600 },
  { yyyymm: '2025-09', codigo: 'TELA_TERMINADA', valor: 1700 },
  { yyyymm: '2025-10', codigo: 'TELA_TERMINADA', valor: 1800 },
  { yyyymm: '2025-11', codigo: 'TELA_TERMINADA', valor: 3000 },
  { yyyymm: '2025-12', codigo: 'TELA_TERMINADA', valor: 3100 },

  // 2026 (valores de prueba)
  { yyyymm: '2026-01', codigo: 'URDIDO_TENIDO', valor: 2500, obs: 'TEST' },
  { yyyymm: '2026-02', codigo: 'URDIDO_TENIDO', valor: 2500, obs: 'TEST' },
  { yyyymm: '2026-01', codigo: 'TELA_TERMINADA', valor: 3100, obs: 'TEST' },
  { yyyymm: '2026-02', codigo: 'TELA_TERMINADA', valor: 3100, obs: 'TEST' }
]

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tb_costo_items (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'KG',
      activo BOOLEAN NOT NULL DEFAULT TRUE
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS tb_costo_item_alias (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      origen TEXT NOT NULL,
      nombre_en_origen TEXT NOT NULL,
      UNIQUE (origen, nombre_en_origen)
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS tb_costo_mensual (
      id SERIAL PRIMARY KEY,
      yyyymm TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      ars_por_unidad NUMERIC NOT NULL,
      observaciones TEXT,
      UNIQUE (yyyymm, item_id)
    )
  `)
  await client.query('CREATE INDEX IF NOT EXISTS idx_costo_mensual_mes ON tb_costo_mensual(yyyymm)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_costo_alias_item ON tb_costo_item_alias(item_id)')
}

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await ensureSchema(client)

    if (process.env.SEED_TRUNCATE === '1') {
      await client.query('TRUNCATE TABLE tb_costo_mensual RESTART IDENTITY')
    }

    for (const item of ITEMS) {
      await client.query(
        `INSERT INTO tb_costo_items (codigo, descripcion, unidad, activo)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (codigo) DO UPDATE
         SET descripcion = EXCLUDED.descripcion, unidad = EXCLUDED.unidad, activo = TRUE`,
        [item.codigo, item.descripcion, item.unidad]
      )
    }

    await client.query(
      `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
       SELECT id, 'ACCESS', 'URDIDO TEÑIDO' FROM tb_costo_items WHERE codigo = 'URDIDO_TENIDO'
       ON CONFLICT DO NOTHING`
    )
    await client.query(
      `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
       SELECT id, 'ACCESS', 'TELA TERMINADA' FROM tb_costo_items WHERE codigo = 'TELA_TERMINADA'
       ON CONFLICT DO NOTHING`
    )

    const itemRows = await client.query('SELECT id, codigo FROM tb_costo_items')
    const itemMap = new Map(itemRows.rows.map((r) => [r.codigo, r.id]))

    for (const row of COSTOS) {
      const itemId = itemMap.get(row.codigo)
      if (!itemId) continue
      await client.query(
        `INSERT INTO tb_costo_mensual (yyyymm, item_id, ars_por_unidad, observaciones)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (yyyymm, item_id) DO UPDATE
         SET ars_por_unidad = EXCLUDED.ars_por_unidad,
             observaciones = EXCLUDED.observaciones`,
        [row.yyyymm, itemId, row.valor, row.obs || null]
      )
    }

    await client.query('COMMIT')
    console.log(`OK: costos cargados (${COSTOS.length} filas)`) 
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error sembrando costos:', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
