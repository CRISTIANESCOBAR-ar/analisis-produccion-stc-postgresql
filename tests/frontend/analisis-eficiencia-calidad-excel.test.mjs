import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareExcelExportData
} from '../../frontend/src/utils/analisisEficienciaCalidadExcel.js';

describe('Excel Export Helper - Tests Unitarios Exhaustivos (TDD)', () => {
  it('debe preparar la estructura de datos para las hojas Datos Diarios y Resumen', () => {
    const datos = [
      {
        fecha: '2026-09-01',
        eficiencia: 82.5,
        ru105: 1.4,
        rt105: 3.8,
        calidad: 92.0,
        pts100: 11.2,
        metaEfi: 85.0,
        metaRu105: 1.5,
        metaRt105: 2.5
      }
    ];

    const resumenStats = {
      eficiencia: { label: 'Eficiencia %', avg: 82.5, min: 82.5, max: 82.5, metaAvg: 85.0, desvio: -2.5, isAlert: true },
      ru105: { label: 'RU105 (Urd.)', avg: 1.4, min: 1.4, max: 1.4, metaAvg: 1.5, desvio: -0.1, isAlert: false },
      rt105: { label: 'RT105 (Trama)', avg: 3.8, min: 3.8, max: 3.8, metaAvg: 2.5, desvio: 1.3, isAlert: true },
      calidad: { label: 'Calidad %', avg: 92.0, min: 92.0, max: 92.0, metaAvg: null, desvio: null, isAlert: false },
      pts100: { label: 'Pts / 100m²', avg: 11.2, min: 11.2, max: 11.2, metaAvg: null, desvio: null, isAlert: false }
    };

    const exportData = prepareExcelExportData({
      datos,
      resumenStats,
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-13',
      trama: 'CO 10/1'
    });

    assert.equal(exportData.meta.fechaInicio, '2026-09-01');
    assert.equal(exportData.meta.fechaFin, '2026-09-13');
    assert.equal(exportData.meta.trama, 'CO 10/1');

    assert.equal(exportData.filasDiarias.length, 1);
    assert.equal(exportData.filasDiarias[0].fecha, '2026-09-01');
    assert.equal(exportData.filasDiarias[0].eficiencia, 82.5);

    assert.equal(exportData.filasResumen.length, 5);
    assert.equal(exportData.filasResumen[0].metrica, 'Eficiencia %');
    assert.equal(exportData.filasResumen[0].estado, '⚠️ Desvío desfavorable');
    assert.equal(exportData.filasResumen[1].estado, '✅ Conforme');
  });

  it('debe manejar trama no seleccionada mostrando "Todas"', () => {
    const exportData = prepareExcelExportData({
      datos: [],
      resumenStats: {},
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-13',
      trama: ''
    });

    assert.equal(exportData.meta.trama, 'Todas las tramas');
  });
});
