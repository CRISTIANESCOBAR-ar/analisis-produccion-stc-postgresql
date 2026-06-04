import pg from 'pg';
import 'dotenv/config'; // Load .env
const { Client } = pg;

console.log("=== Environment Variables ===");
console.log("PG_HOST:", process.env.PG_HOST);
console.log("PG_PORT:", process.env.PG_PORT);
console.log("PG_DATABASE:", process.env.PG_DATABASE);
console.log("PG_USER:", process.env.PG_USER);

const client = new Client({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026'
});

async function run() {
  try {
    await client.connect();
    console.log("✓ Connected successfully using environment variables!");

    const isoInicio = '2026-05-31';
    const isoFin = '2026-05-31';

    console.log("=== Running querySql ===");
    const querySql = `
      WITH piece_summary AS (
        SELECT 
          TRIM(BOTH FROM "PARTIDA") AS partida_clean,
          TRIM(BOTH FROM "PEÇA") AS peca_clean,
          SUM(CAST(NULLIF(REPLACE(REPLACE(TRIM("METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC)) AS piece_metragem,
          AVG(CAST(NULLIF(REPLACE(TRIM("PONTUACAO"::TEXT), ',', '.'), '') AS NUMERIC)) AS piece_pontuacion,
          AVG(CAST(NULLIF(REPLACE(TRIM("LARGURA"::TEXT), ',', '.'), '') AS NUMERIC)) AS piece_largura
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
        GROUP BY TRIM(BOTH FROM "PARTIDA"), TRIM(BOTH FROM "PEÇA")
      ),
      cte_calidad AS (
        SELECT 
          partida_clean,
          SUM(piece_metragem) AS metros_revisados,
          COUNT(DISTINCT peca_clean) AS total_piezas,
          SUM(piece_pontuacion) AS total_puntos_calidad,
          SUM(piece_metragem * COALESCE(piece_largura, 0) / 100.0) AS area_m2_revisada
        FROM piece_summary
        GROUP BY partida_clean
      ),
      cte_defectos AS (
        SELECT 
          TRIM(BOTH FROM d."PARTIDA") AS partida_clean,
          d."COD_DEF" AS cod_def,
          d."DESC_DEFEITO" AS desc_defeito,
          SUM(CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::TEXT), ',', '.'), '') AS NUMERIC)) AS total_puntos
        FROM public.tb_defectos d
        INNER JOIN piece_summary ps ON ps.peca_clean = d."PARTIDA" || d."PECA"
        WHERE d."FILIAL" = '05'
          AND d."QUALIDADE" = '1'
          AND btrim(d."DESC_DEFEITO") <> ''
          AND btrim(d."DESC_DEFEITO") <> '--'
        GROUP BY TRIM(BOTH FROM d."PARTIDA"), d."COD_DEF", d."DESC_DEFEITO"
      ),
      cte_produccion AS (
        SELECT 
          TRIM(BOTH FROM "PARTIDA") AS partida_clean,
          "ARTIGO" AS artigo,
          "MAQUINA" AS maquina,
          SUM(CAST(NULLIF(REPLACE(TRIM("PONTOS_LIDOS"::TEXT), ',', '.'), '') AS NUMERIC)) * 100.0 / 
            NULLIF(SUM(CAST(NULLIF(REPLACE(TRIM("PONTOS_100%"::TEXT), ',', '.'), '') AS NUMERIC)), 0) AS eficiencia_avg
        FROM public.tb_produccion
        WHERE "SELETOR" = 'TECELAGEM'
          AND (
            CASE
              WHEN "DT_BASE_PRODUCAO" IS NULL OR "DT_BASE_PRODUCAO" = '' THEN NULL
              WHEN "DT_BASE_PRODUCAO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DT_BASE_PRODUCAO" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DT_BASE_PRODUCAO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DT_BASE_PRODUCAO" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
        GROUP BY TRIM(BOTH FROM "PARTIDA"), "ARTIGO", "MAQUINA"
      )
      SELECT 
        p.partida_clean AS partida,
        p.artigo,
        p.maquina,
        ROUND(p.eficiencia_avg, 1) AS eficiencia,
        c.metros_revisados,
        d.cod_def,
        d.desc_defeito,
        d.total_puntos AS puntos_defecto,
        ROUND(((COALESCE(d.total_puntos, 0) * 100) / NULLIF(c.area_m2_revisada, 0)), 2) AS pts_100m2
      FROM cte_produccion p
      INNER JOIN cte_calidad c ON p.partida_clean = c.partida_clean
      LEFT JOIN cte_defectos d ON p.partida_clean = d.partida_clean
      ORDER BY pts_100m2 DESC NULLS LAST
    `;
    const res = await client.query(querySql, [isoInicio, isoFin]);
    console.log("Success! Rows:", res.rows.length);

  } catch (err) {
    console.error("Error details:", err);
  } finally {
    await client.end();
  }
}
run();
