import { test, expect } from 'vitest'
import {
  construirQueryRevisores,
  construirQueryRankingMetros,
  procesarResultadosRanking,
  construirQueryIA,
  procesarResultadosIA,
} from './calibracionRevisoresService.js'

test('catálogo obtiene revisores únicos y omite identificadores vacíos', () => {
  const { sql, values } = construirQueryRevisores()
  expect(sql).toContain('SELECT DISTINCT "REVISOR FINAL"')
  expect(sql).toContain('"REVISOR FINAL" IS NOT NULL')
  expect(sql).toContain('"REVISOR FINAL" <> \'\'')
  expect(values).toEqual([])
})

test('ranking diario y mensual parametriza fecha y separa ambos períodos', () => {
  const fecha = '2026-01-15'
  const dia = construirQueryRankingMetros({ fecha, tipo: 'dia' })
  const mes = construirQueryRankingMetros({ fecha, tipo: 'mes' })
  expect(dia.values).toEqual([fecha])
  expect(mes.values).toEqual([fecha])
  expect(dia.sql).toContain('= $1::date')
  expect(dia.sql).not.toContain('EXTRACT(MONTH')
  expect(mes.sql).toContain('EXTRACT(MONTH')
  expect(mes.sql).toContain('EXTRACT(YEAR')
  expect(mes.sql).not.toContain(fecha)
})

test('ranking calcula métricas, respeta selección y ordena por metros', () => {
  const rows = [
    { revisor: 'A', total_metros: '100', total_puntos: '30', total_area: '150', piezas_limpias: '2', piezas_primera: '4', total_reproceso: '10', cant_partidas_dif: '3' },
    { revisor: 'B', total_metros: '200', total_puntos: '60', total_area: '300', piezas_limpias: '3', piezas_primera: '3', total_reproceso: '0', cant_partidas_dif: '2' },
    { revisor: 'NO_SELECCIONADO', total_metros: '1000' },
  ]
  const result = procesarResultadosRanking(rows, ['A', 'B', 'SIN_DATOS'])
  expect(result.map(r => r.revisor)).toEqual(['B', 'A', 'SIN_DATOS'])
  expect(result[1]).toEqual({ revisor: 'A', metros_totales: 100, pts_100m: 20, pct_sin_defecto: 50, metros_repro: 10, partidas_no_n: 3, ord: 2 })
  expect(result[2].pts_100m).toBe(0)
  expect(result[2].pct_sin_defecto).toBe(0)
})

test('ranking sin revisores seleccionados no devuelve datos', () => {
  expect(procesarResultadosRanking([], [])).toEqual([])
  expect(procesarResultadosRanking(null, null)).toEqual([])
})

test('consulta IA parametriza rango completo y permite consulta sin rango', () => {
  const range = construirQueryIA({ fechaInicio: '2026-01-01', fechaFin: '2026-01-31' })
  expect(range.values).toEqual(['2026-01-01', '2026-01-31'])
  expect(range.sql).toContain('BETWEEN $1 AND $2')
  expect(construirQueryIA({}).values).toEqual([])
  expect(construirQueryIA({}).sql).not.toContain('BETWEEN $1 AND $2')
})

test('datos IA agrupa por rolada, calcula puntos por 100m y tolera cero metros', () => {
  const result = procesarResultadosIA([
    { rolada: 'R1', revisor: 'A', metros_totales: '200', pts_totales: '30', pts_205: '10', cortes_naturales: '2' },
    { rolada: 'R1', revisor: 'B', metros_totales: '0', pts_totales: '5', pts_205: '2', cortes_naturales: '0' },
    { rolada: 'R2', revisor: 'A', metros_totales: '100', pts_totales: '10', pts_205: '0', cortes_naturales: '1' },
  ])
  expect(result).toHaveLength(2)
  expect(result[0].desempeño_revisores[0]).toEqual({ revisor: 'A', pts_100m: 15, pts_205_100m: 5, cortes_naturales: 2, metros_totales: 200 })
  expect(result[0].desempeño_revisores[1].pts_100m).toBe(0)
  expect(procesarResultadosIA(null)).toEqual([])
})
