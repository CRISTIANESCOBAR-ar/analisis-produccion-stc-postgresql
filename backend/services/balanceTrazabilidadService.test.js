import { describe, it, expect } from 'vitest';
import {
  parseNumberPtBr,
  calcularMetricasPartida,
  procesarConsolidado,
  construirQueryBalance
} from './balanceTrazabilidadService.js';

describe('balanceTrazabilidadService', () => {
  describe('parseNumberPtBr', () => {
    it('debe parsear correctamente números con formato brasilero/latinoamericano (punto miles, coma decimal)', () => {
      expect(parseNumberPtBr('1.521,00')).toBe(1521.0);
      expect(parseNumberPtBr('207,27')).toBe(207.27);
      expect(parseNumberPtBr('10.234,56')).toBe(10234.56);
      expect(parseNumberPtBr('0,00')).toBe(0);
    });

    it('debe manejar enteros y números ya formateados con punto', () => {
      expect(parseNumberPtBr('1500')).toBe(1500);
      expect(parseNumberPtBr('1500.50')).toBe(1500.5);
      expect(parseNumberPtBr(1200)).toBe(1200);
    });

    it('debe retornar 0 en casos de valores nulos, vacíos o no numéricos', () => {
      expect(parseNumberPtBr(null)).toBe(0);
      expect(parseNumberPtBr(undefined)).toBe(0);
      expect(parseNumberPtBr('')).toBe(0);
      expect(parseNumberPtBr('  ')).toBe(0);
      expect(parseNumberPtBr('-')).toBe(0);
      expect(parseNumberPtBr('N/A')).toBe(0);
    });
  });

  describe('calcularMetricasPartida', () => {
    it('debe calcular rendimientos y diferencias correctamente cuando todos los sectores tienen datos', () => {
      const row = {
        partida: '0559204',
        artigo: 'AI311201G5561',
        metros_tecelagem: 1000,
        metros_tecelagem_encolh: 850,
        metros_acabamento_integrada: 840,
        metros_calidad_revisados: 835
      };

      const res = calcularMetricasPartida(row);

      expect(res.partida).toBe('0559204');
      expect(res.metros_tecelagem).toBe(1000);
      expect(res.metros_tecelagem_encolh).toBe(850);
      expect(res.metros_acabamento_integrada).toBe(840);
      expect(res.metros_calidad_revisados).toBe(835);

      // Diferencias
      expect(res.diff_integrada_vs_encolh).toBe(-10); // 840 - 850
      expect(res.diff_calidad_vs_integrada).toBe(-5);  // 835 - 840
      expect(res.diff_global_calidad_vs_encolh).toBe(-15); // 835 - 850

      // Rendimientos en porcentaje
      // (840 / 850) * 100 = 98.8235... -> 98.82
      expect(res.rend_telar_integrada_pct).toBe(98.82);
      // (835 / 840) * 100 = 99.4047... -> 99.4
      expect(res.rend_integrada_calidad_pct).toBe(99.4);
      // (835 / 850) * 100 = 98.2352... -> 98.24
      expect(res.rend_global_pct).toBe(98.24);
    });

    it('debe manejar división por cero retornando null cuando los denominadores son 0 o nulos', () => {
      const row = {
        partida: '0559999',
        artigo: 'ART001',
        metros_tecelagem: 0,
        metros_tecelagem_encolh: 0,
        metros_acabamento_integrada: 500,
        metros_calidad_revisados: 0
      };

      const res = calcularMetricasPartida(row);
      expect(res.rend_telar_integrada_pct).toBeNull();
      expect(res.rend_global_pct).toBeNull();
      expect(res.rend_integrada_calidad_pct).toBe(0); // 0 / 500 = 0%
    });

    it('debe manejar casos donde la integrada es 0 y calidad tiene datos', () => {
      const row = {
        partida: '0559998',
        metros_tecelagem_encolh: 100,
        metros_acabamento_integrada: 0,
        metros_calidad_revisados: 95
      };

      const res = calcularMetricasPartida(row);
      expect(res.rend_telar_integrada_pct).toBe(0);
      expect(res.rend_integrada_calidad_pct).toBeNull(); // divisor es 0
      expect(res.rend_global_pct).toBe(95); // 95 / 100 = 95%
    });
  });

  describe('procesarConsolidado', () => {
    it('debe acumular KPIs totales y promedios ponderados globales correctamente', () => {
      const rows = [
        {
          partida: 'P1',
          artigo: 'A1',
          metros_tecelagem: 1000,
          metros_tecelagem_encolh: 900,
          metros_acabamento_integrada: 890,
          metros_calidad_revisados: 880
        },
        {
          partida: 'P2',
          artigo: 'A2',
          metros_tecelagem: 2000,
          metros_tecelagem_encolh: 1800,
          metros_acabamento_integrada: 1750,
          metros_calidad_revisados: 1720
        }
      ];

      const { partidas, kpis } = procesarConsolidado(rows);

      expect(partidas.length).toBe(2);
      expect(kpis.total_partidas).toBe(2);
      expect(kpis.total_metros_tecelagem).toBe(3000);
      expect(kpis.total_metros_tecelagem_encolh).toBe(2700);
      expect(kpis.total_metros_acabamento_integrada).toBe(2640);
      expect(kpis.total_metros_calidad_revisados).toBe(2600);

      // Rendimiento ponderado global:
      // (2640 / 2700) * 100 = 97.7777... -> 97.78%
      expect(kpis.rend_global_telar_integrada_pct).toBe(97.78);
      // (2600 / 2640) * 100 = 98.4848... -> 98.48%
      expect(kpis.rend_global_integrada_calidad_pct).toBe(98.48);
      // (2600 / 2700) * 100 = 96.2962... -> 96.3%
      expect(kpis.rend_global_total_pct).toBe(96.3);
    });

    it('debe manejar lista vacía sin fallar ni arrojar errores de NaN', () => {
      const { partidas, kpis } = procesarConsolidado([]);
      expect(partidas).toEqual([]);
      expect(kpis.total_partidas).toBe(0);
      expect(kpis.total_metros_tecelagem).toBe(0);
      expect(kpis.rend_global_telar_integrada_pct).toBeNull();
      expect(kpis.rend_global_integrada_calidad_pct).toBeNull();
      expect(kpis.rend_global_total_pct).toBeNull();
    });
  });

  describe('construirQueryBalance', () => {
    it('debe generar SQL con sector matriz INTEGRADA por defecto', () => {
      const { sql, values } = construirQueryBalance({
        sectorMatriz: 'INTEGRADA',
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-31',
        search: ''
      });

      expect(sql).toContain('"SELETOR" = \'ACABAMENTO\'');
      expect(sql).toContain('"MAQUINA" = \'165001\'');
      expect(values).toContain('2026-07-01');
      expect(values).toContain('2026-07-31');
    });

    it('debe generar SQL con sector matriz TECELAGEM cuando se solicita', () => {
      const { sql, values } = construirQueryBalance({
        sectorMatriz: 'TECELAGEM',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-15'
      });

      expect(sql).toContain('"SELETOR" = \'TECELAGEM\'');
      expect(values).toContain('2026-08-01');
      expect(values).toContain('2026-08-15');
    });

    it('debe generar SQL con sector matriz CALIDAD cuando se solicita', () => {
      const { sql, values } = construirQueryBalance({
        sectorMatriz: 'CALIDAD',
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-30'
      });

      expect(sql).toContain('tb_calidad');
      expect(values).toContain('2026-09-01');
      expect(values).toContain('2026-09-30');
    });

    it('debe incluir filtro de búsqueda de partida o artículo si se provee', () => {
      const { sql, values } = construirQueryBalance({
        sectorMatriz: 'INTEGRADA',
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-31',
        search: '0559204'
      });

      expect(sql).toContain('ILIKE');
      expect(values).toContain('%0559204%');
    });

    it('debe prevenir inyecciones y sanitizar sectorMatriz inválido cayendo al default INTEGRADA', () => {
      const { sql } = construirQueryBalance({
        sectorMatriz: 'DROP TABLE tb_produccion; --',
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-31'
      });

      expect(sql).toContain('"MAQUINA" = \'165001\'');
      expect(sql).not.toContain('DROP TABLE');
    });
  });
});
