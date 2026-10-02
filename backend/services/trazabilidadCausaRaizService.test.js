import { test, expect } from 'vitest';
import { 
  construirQueryTrazabilidadCausaRaiz,
  procesarConsolidadoCausaRaiz
} from './trazabilidadCausaRaizService.js';

test('construirQueryTrazabilidadCausaRaiz genera la consulta correctamente sin lotes', () => {
  const params = {
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-31',
    codDefecto: '205'
  };
  const { sql, values } = construirQueryTrazabilidadCausaRaiz(params);
  
  expect(sql).toContain('lotes_periodo AS');
  expect(sql).toContain('oe_lote AS');
  expect(values).toEqual(['205', '2026-01-01', '2026-01-31']);
});

test('construirQueryTrazabilidadCausaRaiz filtra por lotes', () => {
  const params = {
    fechaInicio: '',
    fechaFin: '',
    codDefecto: '205',
    lotes: '129, 130'
  };
  const { sql, values } = construirQueryTrazabilidadCausaRaiz(params);
  
  expect(sql).toContain('LTRIM("LOTE FIACAO", \'0\') IN ($2, $3)');
  expect(values).toEqual(['205', '129', '130']);
});

test('procesarConsolidadoCausaRaiz procesa datos vacíos', () => {
  const result = procesarConsolidadoCausaRaiz([]);
  expect(result.data).toEqual([]);
  expect(result.kpis).toEqual({});
});

test('procesarConsolidadoCausaRaiz agrupa múltiples máquinas OE por lote', () => {
  const rows = [
    {
      lote: '129',
      total_partidas: '5',
      total_roladas: '2',
      puntos_defecto: '10',
      ocurrencias_defecto: '2',
      avg_ui: '81.5',
      avg_sf: '9.2',
      avg_mic: '4.1',
      avg_trcnt: '50',
      avg_neps_140: '150',
      avg_grue_50: '10',
      avg_cvm: '13',
      avg_tenacidad: '18',
      avg_elongacion: '6',
      oe_maquina: '3A',
      avg_cortes_oe: '0.40'
    },
    {
      lote: '129',
      total_partidas: '5',
      total_roladas: '2',
      puntos_defecto: '10',
      ocurrencias_defecto: '2',
      avg_ui: '81.5',
      avg_sf: '9.2',
      avg_mic: '4.1',
      avg_trcnt: '50',
      avg_neps_140: '150',
      avg_grue_50: '10',
      avg_cvm: '13',
      avg_tenacidad: '18',
      avg_elongacion: '6',
      oe_maquina: '3B',
      avg_cortes_oe: '0.60'
    }
  ];

  const result = procesarConsolidadoCausaRaiz(rows);
  
  expect(result.data.length).toBe(1);
  const loteData = result.data[0];
  
  expect(loteData.lote).toBe('129');
  expect(loteData.maquinas_oe.length).toBe(2);
  expect(loteData.cortes_oe_promedio).toBe(0.50);
  
  expect(result.kpis.avg_cortes_oe).toBe(0.50);
  expect(result.kpis.total_puntos_defecto).toBe(10);
});
