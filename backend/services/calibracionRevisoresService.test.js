import { test, expect } from 'vitest';
import { 
  construirQueryDefectosCatalogo, 
  construirQueryCalibracion, 
  procesarResultadosCalibracion 
} from './calibracionRevisoresService.js';

test('construirQueryDefectosCatalogo genera la consulta correctamente', () => {
  const { sql, values } = construirQueryDefectosCatalogo();
  expect(sql).toContain('SELECT DISTINCT "COD_DEF", "DESC_DEFEITO"');
  expect(values).toEqual([]);
});

test('construirQueryCalibracion genera la consulta correctamente con fechas', () => {
  const params = {
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-31',
    codDefecto: '205'
  };
  const { sql, values } = construirQueryCalibracion(params);
  
  expect(sql).toContain('piezas_por_revisor AS');
  expect(sql).toContain('defectos_por_revisor AS');
  expect(values).toEqual(['205', '2026-01-01', '2026-01-31']);
});

test('construirQueryCalibracion genera la consulta correctamente sin fechas', () => {
  const params = {
    fechaInicio: '',
    fechaFin: '',
    codDefecto: '205'
  };
  const { sql, values } = construirQueryCalibracion(params);
  
  expect(values).toEqual(['205']);
});

test('procesarResultadosCalibracion procesa datos vacíos', () => {
  const result = procesarResultadosCalibracion([]);
  expect(result).toEqual({ revisores: [], promedioGlobal: 0 });
});

test('procesarResultadosCalibracion calcula colores correctamente', () => {
  const rows = [
    {
      revisor: 'Laxo',
      total_piezas_revisadas: '100',
      piezas_con_defecto: '5',
      tasa_deteccion_pct: '5.00',
      puntos_totales: '10',
      severidad: '0.1000',
      promedio_global_severidad: '0.5000'
    },
    {
      revisor: 'Bien',
      total_piezas_revisadas: '100',
      piezas_con_defecto: '15',
      tasa_deteccion_pct: '15.00',
      puntos_totales: '50',
      severidad: '0.5000',
      promedio_global_severidad: '0.5000'
    },
    {
      revisor: 'Estricto',
      total_piezas_revisadas: '100',
      piezas_con_defecto: '30',
      tasa_deteccion_pct: '30.00',
      puntos_totales: '90',
      severidad: '0.9000',
      promedio_global_severidad: '0.5000'
    }
  ];

  const result = procesarResultadosCalibracion(rows);
  
  expect(result.promedioGlobal).toBe(0.5);
  expect(result.revisores.length).toBe(3);
  
  // Laxo: 0.1 < 0.5 * 0.7 (0.35) -> rojo
  expect(result.revisores[0].color).toBe('rojo');
  
  // Bien: 0.5 está entre 0.35 y 0.65 -> verde
  expect(result.revisores[1].color).toBe('verde');
  
  // Estricto: 0.9 > 0.5 * 1.3 (0.65) -> amarillo
  expect(result.revisores[2].color).toBe('amarillo');
});
