import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProduccionQuery,
  buildCalidadQuery,
  buildMetasRangoQuery,
  buildTramasPeriodoQuery,
  calculateRangos,
  mapCalidadRows
} from '../../backend/services/metricasAnalisisService.mjs';

describe('Metricas Analisis Service - Capa 1: Tests Unitarios Exhaustivos (TDD)', () => {
  describe('buildProduccionQuery', () => {
    it('debe generar consulta sin filtro de trama cuando trama no se especifica', () => {
      const q = buildProduccionQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13' });
      assert.ok(q.sql.includes('$1::date AND $2::date'));
      assert.ok(!q.sql.includes('"TRAMA REDUZIDA 1"'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13']);
    });

    it('debe generar consulta con filtro de trama cuando trama tiene valor', () => {
      const q = buildProduccionQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13', trama: 'CO 10/1' });
      assert.ok(q.sql.includes('AND "TRAMA REDUZIDA 1" = $3'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13', 'CO 10/1']);
    });

    it('debe ignorar trama si es un string vacío o solo espacios', () => {
      const q = buildProduccionQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13', trama: '   ' });
      assert.ok(!q.sql.includes('"TRAMA REDUZIDA 1"'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13']);
    });
  });

  describe('buildCalidadQuery', () => {
    it('debe generar consulta sin filtro de trama cuando trama no se especifica', () => {
      const q = buildCalidadQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13' });
      assert.ok(q.sql.includes('$1::date AND $2::date'));
      assert.ok(!q.sql.includes('"TRAMA" = $3'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13']);
    });

    it('debe generar consulta con filtro de trama cuando trama tiene valor', () => {
      const q = buildCalidadQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13', trama: 'CO 10/1' });
      assert.ok(q.sql.includes('AND "TRAMA" = $3'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13', 'CO 10/1']);
    });

    it('debe normalizar y recortar espacios en el parámetro trama', () => {
      const q = buildCalidadQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13', trama: '  CO 10/1  ' });
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13', 'CO 10/1']);
    });
  });

  describe('buildMetasRangoQuery', () => {
    it('debe generar consulta de tb_metas con rango de fechas ordenado por Dia asc', () => {
      const q = buildMetasRangoQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13' });
      assert.ok(q.sql.includes('FROM tb_metas'));
      assert.ok(q.sql.includes('"Dia" >= $1::date AND "Dia" <= $2::date'));
      assert.ok(q.sql.includes('ORDER BY "Dia" ASC'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13']);
    });
  });

  describe('buildTramasPeriodoQuery', () => {
    it('debe generar consulta DISTINCT de tramas unificando tb_produccion y tb_calidad en el rango', () => {
      const q = buildTramasPeriodoQuery({ fechaInicio: '2026-09-01', fechaFin: '2026-09-13' });
      assert.ok(q.sql.includes('SELECT DISTINCT TRIM(trama) AS trama'));
      assert.ok(q.sql.includes('p."SELETOR" = \'TECELAGEM\''));
      assert.ok(q.sql.includes('c."EMP" = \'STC\''));
      assert.ok(q.sql.includes('ORDER BY trama ASC'));
      assert.deepEqual(q.params, ['2026-09-01', '2026-09-13']);
    });
  });

  describe('mapCalidadRows', () => {
    it('debe calcular CALIDAD_PERCENT y PTS_100M2 correctamente', () => {
      const rows = [
        {
          FECHA_DB: '2026-09-10',
          FECHA: '10/09/2026',
          METROS_TOTAL: 1000,
          METROS_1ERA: 950,
          PONTOS: 50,
          LARGURA: 160
        }
      ];
      const result = mapCalidadRows(rows);
      assert.equal(result.length, 1);
      assert.equal(result[0].CALIDAD_PERCENT, 95);
      // Pts/100m2 = (50 * 100) / (1000 * 160 / 100) = 5000 / 1600 = 3.125
      assert.equal(result[0].PTS_100M2, 3.125);
      assert.equal(result[0].METROS_1ERA, 950);
      assert.equal(result[0].METROS_TOTAL, 1000);
    });

    it('debe retornar null cuando METROS_TOTAL o LARGURA son cero o nulos para evitar división por cero', () => {
      const rows = [
        {
          FECHA_DB: '2026-09-10',
          FECHA: '10/09/2026',
          METROS_TOTAL: 0,
          METROS_1ERA: 0,
          PONTOS: 0,
          LARGURA: 0
        },
        {
          FECHA_DB: '2026-09-11',
          FECHA: '11/09/2026',
          METROS_TOTAL: null,
          METROS_1ERA: null,
          PONTOS: null,
          LARGURA: null
        }
      ];
      const result = mapCalidadRows(rows);
      assert.equal(result[0].CALIDAD_PERCENT, null);
      assert.equal(result[0].PTS_100M2, null);
      assert.equal(result[1].CALIDAD_PERCENT, null);
      assert.equal(result[1].PTS_100M2, null);
    });
  });

  describe('calculateRangos', () => {
    it('debe calcular min, max y promedio para claves numéricas', () => {
      const datos = [
        { val: 10, extra: 'a' },
        { val: 20, extra: 'b' },
        { val: 30, extra: 'c' }
      ];
      const rangos = calculateRangos(datos, ['val']);
      assert.deepEqual(rangos.val, { min: 10, max: 30, avg: 20 });
    });

    it('debe ignorar valores nulos o no numéricos', () => {
      const datos = [
        { val: 10 },
        { val: null },
        { val: 'NaN' },
        { val: 30 }
      ];
      const rangos = calculateRangos(datos, ['val']);
      assert.deepEqual(rangos.val, { min: 10, max: 30, avg: 20 });
    });

    it('debe retornar objeto vacío si no hay valores válidos', () => {
      const datos = [{ val: null }, { val: undefined }];
      const rangos = calculateRangos(datos, ['val']);
      assert.equal(rangos.val, undefined);
    });
  });
});
