#!/usr/bin/env python3
"""
Python script to consolidate structured JSON objects per PARTIDA for AI analysis.
Requires psycopg2 or similar library. To run:
  python backend/scripts/consolidate-partidas.py --partida 0551805
  python backend/scripts/consolidate-partidas.py --days 30
  python backend/scripts/consolidate-partidas.py --all
"""

import os
import sys
import json
import argparse
from psycopg2 import connect
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_connection():
    return connect(
        host=os.getenv('PG_HOST', 'localhost'),
        port=int(os.getenv('PG_PORT', 5433)),
        database=os.getenv('PG_DATABASE', 'stc_produccion'),
        user=os.getenv('PG_USER', 'stc_user'),
        password=os.getenv('PG_PASSWORD', 'stc_password_2026')
    )

def main():
    parser = argparse.ArgumentParser(description="Consolidate active Partida metrics into flat JSON for AI processing.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--partida', type=str, help="Specific PARTIDA code to extract (e.g. 0551805)")
    group.add_argument('--days', type=int, default=30, help="Get active partidas from the last N days (default: 30)")
    group.add_argument('--all', action='store_true', help="Retrieve all partidas in database")
    
    args = parser.parse_args()

    # Determine command arguments
    filter_partida = args.partida
    filter_days = args.days if not args.all and not args.partida else None

    # SQL filters
    selection_clause = ''
    params = []

    if filter_partida:
        selection_clause = 'WHERE TRIM(BOTH FROM "PARTIDA") = %s'
        params.append(filter_partida)
        print(f"🔍 Filtering by active PARTIDA: '{filter_partida}'")
    elif filter_days:
        selection_clause = """
            WHERE (
              CASE
                WHEN "DT_BASE_PRODUCAO" IS NULL OR "DT_BASE_PRODUCAO" = '' THEN NULL
                WHEN "DT_BASE_PRODUCAO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DT_BASE_PRODUCAO" from 1 for 10), 'DD/MM/YYYY')
                WHEN "DT_BASE_PRODUCAO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DT_BASE_PRODUCAO" from 1 for 10)::date
                ELSE NULL
              END
            ) >= CURRENT_DATE - %s
        """
        params.append(filter_days)
        print(f"📅 Selecting active partidas from the last {filter_days} days.")
    else:
        print("🚀 Selecting ALL partidas in database.")

    query_sql = f"""
      WITH partidas_list AS (
        SELECT DISTINCT TRIM(BOTH FROM "PARTIDA") AS target_partida
        FROM public.tb_produccion
        {selection_clause}
      ),
      partida_prod AS (
        SELECT 
          TRIM(BOTH FROM p."PARTIDA") AS partida,
          COALESCE(
            MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."ARTIGO" END),
            MAX(CASE WHEN p."SELETOR" = 'ACABAMENTO' THEN p."ARTIGO" END),
            MAX(p."ARTIGO")
          ) AS artigo,
          MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."GRUPO TEAR" END) AS grupo_tear,
          -- INDIGO Indicators (from SELETOR = 'INDIGO')
          MAX(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."VELOC"), ',', '.'), '') AS NUMERIC) END) AS indigo_velocidad,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."RUPTURAS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_rupturas,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."CAVALOS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_cavalos,
          
          -- TECELAGEM Indicators (from SELETOR = 'TECELAGEM')
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
          SUM(CASE WHEN TRIM(BOTH FROM c."QUALIDADE") IN ('1', 'PRIMEIRA') THEN CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS metros_primeira
        FROM public.tb_calidad c
        WHERE TRIM(BOTH FROM c."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM c."PARTIDA")
      ),
      partida_defectos AS (
        SELECT 
          TRIM(BOTH FROM d."PARTIDA") AS partida,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('340', '382', '387', '333', '319', '328', '386') THEN 1 END) AS total_defectos_trama_4ptos,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('312', '313', '310', '311') THEN 1 END) AS total_defectos_urdimbre,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '333' THEN 1 END) AS count_333,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '340' THEN 1 END) AS count_340,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '382' THEN 1 END) AS count_382,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '387' THEN 1 END) AS count_387
        FROM public.tb_defectos d
        WHERE TRIM(BOTH FROM d."PARTIDA") IN (SELECT target_partida FROM partidas_list)
          AND d."QUALIDADE" = '1'
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
          'caracteristicas_trama', json_build_object(
            'composicion', f.composicion,
            'titulo', f.trama_reducido,
            'tipo_trama_filtro', CASE 
              WHEN REPLACE(REPLACE(UPPER(f.composicion), ' ', ''), 'Ã', 'A') IN ('100%ALGODON', '100%ALGODAO', '100%COTTON') THEN '100% CO - Ne ' || COALESCE(f.trama_reducido, '')
              WHEN (UPPER(f.composicion) LIKE '%%ALGOD%%' OR UPPER(f.composicion) LIKE '%%COTTON%%' OR UPPER(f.composicion) LIKE '%%CO%%') 
                   AND (UPPER(f.composicion) LIKE '%%POLYESTER%%' OR UPPER(f.composicion) LIKE '%%POLIESTER%%' OR UPPER(f.composicion) LIKE '%%PES%%') 
                   AND (UPPER(f.composicion) LIKE '%%ELASTAN%%' OR UPPER(f.composicion) LIKE '%%SPANDEX%%' OR UPPER(f.composicion) LIKE '%%PUE%%' OR UPPER(f.composicion) LIKE '%%LYCRA%%') THEN 'Mezcla Elástica'
              WHEN (UPPER(f.composicion) LIKE '%%ALGOD%%' OR UPPER(f.composicion) LIKE '%%COTTON%%' OR UPPER(f.composicion) LIKE '%%CO%%') 
                   AND (UPPER(f.composicion) LIKE '%%POLYESTER%%' OR UPPER(f.composicion) LIKE '%%POLIESTER%%' OR UPPER(f.composicion) LIKE '%%PES%%') THEN 'Mezcla Rígida'
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
            'rt105_paradas_trama', COALESCE(p.suma_paradas_trama, 0),
            'ru105_paradas_urdimbre', COALESCE(p.suma_paradas_urdimbre, 0),
            'metros_primeira', COALESCE(c.metros_primeira, 0)
          ),
          'conteo_defectos_revisadora', json_build_object(
            'origen_tabla', 'tb_defectos',
            'total_defectos_trama_4ptos', COALESCE(d.total_defectos_trama_4ptos, 0),
            'total_defectos_urdimbre', COALESCE(d.total_defectos_urdimbre, 0),
            'detalle_frecuencia_codigo', json_build_object(
              '333_parada_tear', COALESCE(d.count_333, 0),
              '340_trama_mole', COALESCE(d.count_340, 0),
              '382_trama_curta', COALESCE(d.count_382, 0),
              '387_trama_dobrada', COALESCE(d.count_387, 0)
            )
          )
        ) AS partida_json
      FROM partidas_list ctx
      LEFT JOIN partida_prod p ON p.partida = ctx.target_partida
      LEFT JOIN partida_calidad c ON c.partida = ctx.target_partida
      LEFT JOIN partida_defectos d ON d.partida = ctx.target_partida
      LEFT JOIN partida_ficha f ON f.artigo_codigo = p.artigo;
    """

    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Execute query
        cursor.execute(query_sql, params)
        rows = cursor.fetchall()
        
        consolidated_list = [row['partida_json'] for row in rows]
        print(f"📊 Successfully consolidated {len(consolidated_list)} partidas.")

        if filter_partida:
            # Print single result
            print("\n--- CONSOLIDATED DATA OBJECT FOR THE ACTIVE PARTIDA ---")
            print(json.dumps(consolidated_list[0], indent=2, ensure_ascii=False))
        else:
            # Export to json file
            export_path = os.path.join(os.path.dirname(__file__), '..', '..', 'exports', 'partidas_consolidadas_ia.json')
            os.makedirs(os.path.dirname(export_path), exist_ok=True)
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(consolidated_list, f, indent=2, ensure_ascii=False)
            print(f"💾 Massive JSON dataset saved to: {export_path}")
            
    except Exception as e:
        print(f"❌ Error executing python consolidation: {e}", file=sys.stderr)
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
            print("🔌 Database connection closed.")

if __name__ == '__main__':
    main()
