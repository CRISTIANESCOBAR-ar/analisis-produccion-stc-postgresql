import { test } from 'node:test';
import assert from 'node:assert';
import { construirQueryTrazabilidadCausaRaiz, construirQueryHVI } from './trazabilidadCausaRaizService.js';

test('construirQueryTrazabilidadCausaRaiz - includes alphanumeric sorting fix', async () => {
  const params = { fechaInicio: '2026-01-01', fechaFin: '2026-01-31', codDefecto: '123', lotes: '140/41' };
  const { sql, values } = construirQueryTrazabilidadCausaRaiz(params);
  
  assert.ok(sql.includes("ORDER BY CAST(NULLIF(regexp_replace(lp.lote, '[^0-9].*$', ''), '') AS INTEGER) ASC NULLS LAST"), 
    'Debe contener la lógica para remover caracteres no numéricos al final antes de castear a INTEGER para ordenar.');
  
  assert.deepStrictEqual(values, ['123', '2026-01-01', '2026-01-31', '140/41']);
});

test('construirQueryHVI - handles alphanumeric lotes by matching first number', async () => {
  const lotes = ['140/41', '104'];
  const { sql, values } = construirQueryHVI(lotes);
  
  assert.ok(sql.includes("SELECT regexp_replace(u, '[^0-9].*$', '') FROM unnest(ARRAY[$1::text, $2::text]) u"), 
    'Debe usar subquery y regexp_replace sobre unnest para parsear el lote con /.');
  
  assert.deepStrictEqual(values, ['140/41', '104']);
});
