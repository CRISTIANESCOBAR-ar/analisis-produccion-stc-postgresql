import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultDateRange,
  extractDistinctTramas,
  mergeMetricasPorFecha,
  calculateResumenStats,
  buildEChartsOption
} from '../../frontend/src/utils/analisisEficienciaCalidadHelper.js';

describe('Analisis Eficiencia vs Calidad Helper - Tests Unitarios Exhaustivos (TDD)', () => {
  describe('getDefaultDateRange', () => {
    it('debe devolver 1° del mes hasta el día anterior cuando el día es posterior al 1°', () => {
      const refDate = new Date('2026-09-14T12:00:00Z');
      const { fechaInicio, fechaFin } = getDefaultDateRange(refDate);
      assert.equal(fechaInicio, '2026-09-01');
      assert.equal(fechaFin, '2026-09-13');
    });

    it('debe manejar el día 1° del mes retrocediendo la fecha de inicio al 1° del mes anterior para no tener fechaInicio > fechaFin', () => {
      const refDate = new Date('2026-10-01T12:00:00Z');
      const { fechaInicio, fechaFin } = getDefaultDateRange(refDate);
      assert.equal(fechaInicio, '2026-09-01');
      assert.equal(fechaFin, '2026-09-30');
    });

    it('debe manejar cambio de año en el día 1 de enero', () => {
      const refDate = new Date('2027-01-01T12:00:00Z');
      const { fechaInicio, fechaFin } = getDefaultDateRange(refDate);
      assert.equal(fechaInicio, '2026-12-01');
      assert.equal(fechaFin, '2026-12-31');
    });
  });

  describe('extractDistinctTramas', () => {
    it('debe extraer tramas únicas, limpias y ordenadas alfabéticamente', () => {
      const raw = [
        { trama: 'CO 10/1 OE' },
        { trama: 'PES/CO 16/1' },
        { trama: 'CO 10/1 OE' },
        { trama: '  CO 10/1 OE  ' },
        { trama: null },
        { trama: '' }
      ];
      const result = extractDistinctTramas(raw);
      assert.deepEqual(result, ['CO 10/1 OE', 'PES/CO 16/1']);
    });

    it('debe extraer tramas únicas cuando recibe un array simple de strings', () => {
      const raw = ['PES/CO 16/1', 'CO 10/1 OE', 'PES/CO 16/1', '  CO 10/1 OE  ', '', null];
      const result = extractDistinctTramas(raw);
      assert.deepEqual(result, ['CO 10/1 OE', 'PES/CO 16/1']);
    });

    it('debe devolver array vacío si la entrada es nula o vacía', () => {
      assert.deepEqual(extractDistinctTramas(null), []);
      assert.deepEqual(extractDistinctTramas([]), []);
    });
  });

  describe('mergeMetricasPorFecha', () => {
    it('debe consolidar métricas de producción, calidad y metas por fecha cronológica', () => {
      const produccion = [
        { FECHA_DB: '2026-09-02', EFICIENCIA_TELAR: 85.5, RU105_TELAR: 1.2, RT105_TELAR: 3.1 },
        { FECHA_DB: '2026-09-01', EFICIENCIA_TELAR: 82.0, RU105_TELAR: 1.5, RT105_TELAR: 4.0 }
      ];
      const calidad = [
        { FECHA_DB: '2026-09-01', CALIDAD_PERCENT: 91.0, PTS_100M2: 12.5 },
        { FECHA_DB: '2026-09-02', CALIDAD_PERCENT: 93.5, PTS_100M2: 10.2 }
      ];
      const metas = [
        { dia: '2026-09-01', meta_efi: 85, meta_ru105: 1.5, meta_rt105: 2.5 },
        { dia: '2026-09-02', meta_efi: 85, meta_ru105: 1.5, meta_rt105: 2.5 }
      ];

      const merged = mergeMetricasPorFecha({ produccion, calidad, metas });
      assert.equal(merged.length, 2);
      assert.equal(merged[0].fecha, '2026-09-01');
      assert.equal(merged[0].eficiencia, 82.0);
      assert.equal(merged[0].calidad, 91.0);
      assert.equal(merged[0].metaEfi, 85);
      assert.equal(merged[1].fecha, '2026-09-02');
      assert.equal(merged[1].eficiencia, 85.5);
      assert.equal(merged[1].calidad, 93.5);
    });

    it('debe tolerar días que existen en producción pero no en calidad o viceversa', () => {
      const produccion = [
        { FECHA_DB: '2026-09-01', EFICIENCIA_TELAR: 80.0, RU105_TELAR: 2.0, RT105_TELAR: 5.0 }
      ];
      const calidad = [
        { FECHA_DB: '2026-09-02', CALIDAD_PERCENT: 88.0, PTS_100M2: 15.0 }
      ];
      const metas = [];

      const merged = mergeMetricasPorFecha({ produccion, calidad, metas });
      assert.equal(merged.length, 2);
      assert.equal(merged[0].fecha, '2026-09-01');
      assert.equal(merged[0].eficiencia, 80.0);
      assert.equal(merged[0].calidad, null);
      assert.equal(merged[1].fecha, '2026-09-02');
      assert.equal(merged[1].eficiencia, null);
      assert.equal(merged[1].calidad, 88.0);
    });
  });

  describe('calculateResumenStats (Capa 3: Preparado para Mutation Testing)', () => {
    it('debe calcular promedios, min, max, meta promedio y desvíos correctamente', () => {
      const data = [
        {
          fecha: '2026-09-01',
          eficiencia: 80,
          ru105: 1.0,
          rt105: 4.0,
          calidad: 90,
          pts100: 12,
          metaEfi: 85,
          metaRu105: 1.5,
          metaRt105: 3.0
        },
        {
          fecha: '2026-09-02',
          eficiencia: 84,
          ru105: 2.0,
          rt105: 6.0,
          calidad: 92,
          pts100: 10,
          metaEfi: 85,
          metaRu105: 1.5,
          metaRt105: 3.0
        }
      ];

      const stats = calculateResumenStats(data);
      // EFI: avg = 82, min = 80, max = 84, metaAvg = 85, desvio = 82 - 85 = -3.0
      // Alerta: EFI < meta -> 82 < 85 -> true
      assert.equal(stats.eficiencia.avg, 82);
      assert.equal(stats.eficiencia.min, 80);
      assert.equal(stats.eficiencia.max, 84);
      assert.equal(stats.eficiencia.metaAvg, 85);
      assert.equal(stats.eficiencia.desvio, -3);
      assert.equal(stats.eficiencia.isAlert, true);

      // RU105: avg = 1.5, min = 1.0, max = 2.0, metaAvg = 1.5, desvio = 0
      // Alerta: RU105 > meta -> 1.5 > 1.5 -> false (prueba de mutante > vs >=)
      assert.equal(stats.ru105.avg, 1.5);
      assert.equal(stats.ru105.isAlert, false);

      // RT105: avg = 5.0, min = 4.0, max = 6.0, metaAvg = 3.0, desvio = +2.0
      // Alerta: RT105 > meta -> 5.0 > 3.0 -> true
      assert.equal(stats.rt105.avg, 5.0);
      assert.equal(stats.rt105.desvio, 2.0);
      assert.equal(stats.rt105.isAlert, true);

      // Calidad: avg = 91, sin meta
      assert.equal(stats.calidad.avg, 91);
      assert.equal(stats.calidad.metaAvg, null);
      assert.equal(stats.calidad.isAlert, false);
    });

    it('mutante RU105 > meta: si avg excede meta debe ser alert=true', () => {
      const data = [
        { fecha: '2026-09-01', ru105: 1.51, metaRu105: 1.5 }
      ];
      const stats = calculateResumenStats(data);
      assert.equal(stats.ru105.isAlert, true);
    });

    it('mutante EFI < meta: si avg es exactamente igual o mayor a meta debe ser alert=false', () => {
      const data = [
        { fecha: '2026-09-01', eficiencia: 85, metaEfi: 85 }
      ];
      const stats = calculateResumenStats(data);
      assert.equal(stats.eficiencia.isAlert, false);

      const data2 = [
        { fecha: '2026-09-01', eficiencia: 86, metaEfi: 85 }
      ];
      const stats2 = calculateResumenStats(data2);
      assert.equal(stats2.eficiencia.isAlert, false);
    });

    it('debe manejar dataset vacío sin lanzar excepción', () => {
      const stats = calculateResumenStats([]);
      assert.equal(stats.eficiencia.avg, null);
      assert.equal(stats.eficiencia.isAlert, false);
    });
  });

  describe('buildEChartsOption', () => {
    it('debe construir la configuración de ECharts con 2 ejes Y y 8 series', () => {
      const data = [
        { fecha: '2026-09-01', eficiencia: 82, ru105: 1.2, rt105: 3.4, calidad: 92, pts100: 11, metaEfi: 85, metaRu105: 1.5, metaRt105: 2.5 }
      ];
      const option = buildEChartsOption(data);
      assert.equal(option.xAxis.data.length, 1);
      assert.equal(option.xAxis.data[0], '01/09');
      assert.equal(option.yAxis.length, 2);
      assert.equal(option.series.length, 8);

      // Metas deben estar apagadas por defecto en legend.selected
      assert.equal(option.legend.selected['Meta EFI %'], false);
      assert.equal(option.legend.selected['Meta RU105'], false);
      assert.equal(option.legend.selected['Meta RT105'], false);

      // Series principales encendidas por defecto
      assert.equal(option.legend.selected['Eficiencia %'], true);
      assert.equal(option.legend.selected['Calidad %'], true);
      assert.equal(option.legend.selected['RU105'], true);
      assert.equal(option.legend.selected['RT105'], true);
      assert.equal(option.legend.selected['Pts/100m²'], true);
    });
  });
});
