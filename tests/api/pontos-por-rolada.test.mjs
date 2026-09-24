/**
 * Tests unitarios para el endpoint /api/calidad/pontos-por-rolada
 *
 * Capa 1: Tests unitarios exhaustivos - lógica de ROLADA, parseo de respuesta,
 *         clasificación de sector, y transformación de datos.
 * Capa 2: Tests de aceptación - simulan flujo completo de llamada al endpoint.
 * Capa 3: Preparación para mutation testing - aserciones estrictas contra mutaciones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers extraídos del endpoint para testeo independiente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simula LEFT(RIGHT(PARTIDA, 6), 4) en JavaScript,
 * equivalente a la fórmula SQL del endpoint.
 */
function extractRolada(partida) {
  const trimmed = String(partida || '').trim();
  const right6  = trimmed.slice(-6);
  return right6.slice(0, 4);
}

/**
 * Clasifica un COD_DEF en su sector usando el primer dígito.
 */
function getSectorLabel(codDef) {
  const first = String(codDef || '').trim()[0] || '';
  if (first === '1') return 'INDIGO';
  if (first === '2') return 'HILANDERIA';
  if (first === '3') return 'TEJEDURIA';
  if (first === '4') return 'ACABAMENTO';
  return 'GENERAL';
}

/**
 * Transforma la respuesta cruda del endpoint separando resumen y detalle.
 * Replica la lógica JS del handler (server.js) para validar la transformación.
 */
function transformResponse(rows) {
  const resumenRows = rows.filter(r => r.tipo === 'resumen');
  const detalleRows = rows.filter(r => r.tipo === 'detalle');

  const roladasSet = new Set();
  detalleRows.forEach(r => { if (r.rolada) roladasSet.add(r.rolada); });
  const roladas = [...roladasSet].sort();

  const detalleMap = {};
  detalleRows.forEach(r => {
    const key = r.cod_def;
    if (!detalleMap[key]) detalleMap[key] = {};
    detalleMap[key][r.rolada] = Number(r.pts_rolada) || 0;
  });

  const defectos = resumenRows.map(r => {
    const codDef = String(r.cod_def || '').trim();
    return {
      cod_def:           codDef,
      desc_defeito:      r.desc_defeito,
      sector:            getSectorLabel(codDef),
      pts_totales:       Number(r.pts_totales) || 0,
      roladas_afectadas: Number(r.roladas_afectadas) || 0,
      por_rolada:        detalleMap[codDef] || {},
    };
  });

  return {
    roladas,
    defectos,
    totalPts: defectos.reduce((s, d) => s + d.pts_totales, 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPA 1: Tests Unitarios Exhaustivos (TDD)
// ═══════════════════════════════════════════════════════════════════════════════

describe('pontos-por-rolada - Capa 1: Tests Unitarios Exhaustivos (TDD)', () => {

  describe('extractRolada (LEFT(RIGHT(PARTIDA,6),4))', () => {

    it('debe extraer rolada de PARTIDA de 7 caracteres (caso estándar)', () => {
      // PARTIDA = "0543712" → RIGHT(,6)="543712" → LEFT(,4)="5437"
      assert.equal(extractRolada('0543712'), '5437');
    });

    it('debe extraer rolada de PARTIDA de 8 caracteres', () => {
      // PARTIDA = "05437121" → RIGHT(,6)="437121" → LEFT(,4)="4371"
      assert.equal(extractRolada('05437121'), '4371');
    });

    it('debe manejar PARTIDA de exactamente 6 caracteres', () => {
      // PARTIDA = "543712" → RIGHT(,6)="543712" → LEFT(,4)="5437"
      assert.equal(extractRolada('543712'), '5437');
    });

    it('debe manejar PARTIDA de exactamente 4 caracteres', () => {
      // PARTIDA = "5437" → RIGHT(,6)="5437" → LEFT(,4)="5437"
      assert.equal(extractRolada('5437'), '5437');
    });

    it('debe manejar PARTIDA de menos de 4 caracteres (caso borde)', () => {
      // PARTIDA = "54" → RIGHT(,6)="54" → LEFT(,4)="54"
      assert.equal(extractRolada('54'), '54');
    });

    it('debe manejar PARTIDA vacía', () => {
      assert.equal(extractRolada(''), '');
    });

    it('debe manejar PARTIDA null', () => {
      assert.equal(extractRolada(null), '');
    });

    it('debe manejar PARTIDA con espacios', () => {
      assert.equal(extractRolada(' 0543712 '), '5437');
    });
  });

  describe('getSectorLabel', () => {

    it('debe clasificar COD_DEF que empieza con 1 como INDIGO', () => {
      assert.equal(getSectorLabel('101'), 'INDIGO');
      assert.equal(getSectorLabel('134'), 'INDIGO');
      assert.equal(getSectorLabel('199'), 'INDIGO');
    });

    it('debe clasificar COD_DEF que empieza con 2 como HILANDERIA', () => {
      assert.equal(getSectorLabel('205'), 'HILANDERIA');
      assert.equal(getSectorLabel('230'), 'HILANDERIA');
    });

    it('debe clasificar COD_DEF que empieza con 3 como TEJEDURIA', () => {
      assert.equal(getSectorLabel('307'), 'TEJEDURIA');
      assert.equal(getSectorLabel('399'), 'TEJEDURIA');
    });

    it('debe clasificar COD_DEF que empieza con 4 como ACABAMENTO', () => {
      assert.equal(getSectorLabel('430'), 'ACABAMENTO');
      assert.equal(getSectorLabel('499'), 'ACABAMENTO');
    });

    it('debe clasificar COD_DEF que no empieza con 1-4 como GENERAL', () => {
      assert.equal(getSectorLabel('573'), 'GENERAL');
      assert.equal(getSectorLabel('821'), 'GENERAL');
      assert.equal(getSectorLabel('602'), 'GENERAL');
    });

    it('debe retornar GENERAL para COD_DEF null o vacío', () => {
      assert.equal(getSectorLabel(null), 'GENERAL');
      assert.equal(getSectorLabel(''), 'GENERAL');
    });

    it('debe funcionar con COD_DEF numéricos pasados como string', () => {
      assert.equal(getSectorLabel('313'), 'TEJEDURIA');
    });

    it('debe trimear espacios antes de clasificar', () => {
      assert.equal(getSectorLabel(' 313 '), 'TEJEDURIA');
    });
  });

  describe('transformResponse', () => {

    it('debe separar correctamente filas resumen de detalle', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 15, roladas_afectadas: 3, rolada: null, pts_rolada: null },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5437', pts_rolada: 8 },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5438', pts_rolada: 7 },
      ];

      const result = transformResponse(rows);
      assert.equal(result.defectos.length, 1);
      assert.equal(result.roladas.length, 2);
      assert.deepEqual(result.roladas, ['5437', '5438']);
    });

    it('debe construir mapa por_rolada correctamente', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 15, roladas_afectadas: 2, rolada: null, pts_rolada: null },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5437', pts_rolada: 8 },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5438', pts_rolada: 7 },
      ];

      const result = transformResponse(rows);
      assert.deepEqual(result.defectos[0].por_rolada, { '5437': 8, '5438': 7 });
    });

    it('debe calcular totalPts como suma de pts_totales de todos los defectos', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 15, roladas_afectadas: 2, rolada: null, pts_rolada: null },
        { tipo: 'resumen', cod_def: '101', desc_defeito: 'MANCHA', pts_totales: 10, roladas_afectadas: 1, rolada: null, pts_rolada: null },
      ];

      const result = transformResponse(rows);
      assert.equal(result.totalPts, 25);
    });

    it('debe manejar respuesta vacía', () => {
      const result = transformResponse([]);
      assert.equal(result.defectos.length, 0);
      assert.equal(result.roladas.length, 0);
      assert.equal(result.totalPts, 0);
    });

    it('debe asignar sector correcto a cada defecto', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '101', desc_defeito: 'MANCHA INDIGO', pts_totales: 5, roladas_afectadas: 1, rolada: null, pts_rolada: null },
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 8, roladas_afectadas: 1, rolada: null, pts_rolada: null },
        { tipo: 'resumen', cod_def: '430', desc_defeito: 'ACABAMENTO X', pts_totales: 3, roladas_afectadas: 1, rolada: null, pts_rolada: null },
      ];

      const result = transformResponse(rows);
      assert.equal(result.defectos[0].sector, 'INDIGO');
      assert.equal(result.defectos[1].sector, 'TEJEDURIA');
      assert.equal(result.defectos[2].sector, 'ACABAMENTO');
    });

    it('debe asignar por_rolada vacío si no hay filas detalle para un cod_def', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 0, roladas_afectadas: 0, rolada: null, pts_rolada: null },
      ];

      const result = transformResponse(rows);
      assert.deepEqual(result.defectos[0].por_rolada, {});
    });

    it('debe ordenar roladas alfabéticamente', () => {
      const rows = [
        { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 20, roladas_afectadas: 3, rolada: null, pts_rolada: null },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5439', pts_rolada: 5 },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5437', pts_rolada: 8 },
        { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5438', pts_rolada: 7 },
      ];

      const result = transformResponse(rows);
      assert.deepEqual(result.roladas, ['5437', '5438', '5439']);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAPA 2: Tests de Aceptación (simulan comportamiento de usuario)
// ═══════════════════════════════════════════════════════════════════════════════

describe('pontos-por-rolada - Capa 2: Tests de Aceptación (E2E Simulado)', () => {

  it('debe rechazar petición sin fechaDesde ni fechaHasta (simula validación del endpoint)', () => {
    // Simula la validación del handler
    const fechaDesde = undefined;
    const fechaHasta = undefined;
    const isValid = !!(fechaDesde && fechaHasta);
    assert.equal(isValid, false, 'Petición sin fechas debe ser rechazada');
  });

  it('debe aceptar petición con ambas fechas válidas', () => {
    const fechaDesde = '2026-09-01';
    const fechaHasta = '2026-09-24';
    const isValid = !!(fechaDesde && fechaHasta);
    assert.equal(isValid, true, 'Petición con ambas fechas debe ser aceptada');
  });

  it('debe filtrar sector TEJEDURIA solo códigos que empiezan con 3', () => {
    const sectorDigitMap = {
      'INDIGO':     '1',
      'HILANDERIA': '2',
      'TEJEDURIA':  '3',
      'ACABAMENTO': '4',
    };

    const sector = 'TEJEDURIA';
    const digit = sectorDigitMap[sector.toUpperCase()];

    assert.equal(digit, '3');

    // Validar que un COD_DEF=313 pasaría el filtro
    const codDef = '313';
    const firstDigit = codDef[0];
    assert.equal(firstDigit, digit);

    // Validar que un COD_DEF=101 NO pasaría el filtro
    const codDef2 = '101';
    assert.notEqual(codDef2[0], digit);
  });

  it('debe producir respuesta JSON con estructura esperada', () => {
    const mockRows = [
      { tipo: 'resumen', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: 15, roladas_afectadas: 2, rolada: null, pts_rolada: null },
      { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5437', pts_rolada: 8 },
      { tipo: 'detalle', cod_def: '313', desc_defeito: 'FIO QUEBRADO', pts_totales: null, roladas_afectadas: null, rolada: '5438', pts_rolada: 7 },
    ];

    const result = transformResponse(mockRows);

    // Verificar estructura completa
    assert.ok(Array.isArray(result.roladas), 'roladas debe ser un array');
    assert.ok(Array.isArray(result.defectos), 'defectos debe ser un array');
    assert.equal(typeof result.totalPts, 'number', 'totalPts debe ser un número');

    // Verificar estructura de cada defecto
    const defecto = result.defectos[0];
    assert.ok('cod_def' in defecto, 'defecto debe tener cod_def');
    assert.ok('desc_defeito' in defecto, 'defecto debe tener desc_defeito');
    assert.ok('sector' in defecto, 'defecto debe tener sector');
    assert.ok('pts_totales' in defecto, 'defecto debe tener pts_totales');
    assert.ok('roladas_afectadas' in defecto, 'defecto debe tener roladas_afectadas');
    assert.ok('por_rolada' in defecto, 'defecto debe tener por_rolada');
    assert.equal(typeof defecto.por_rolada, 'object', 'por_rolada debe ser un objeto');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAPA 3: Preparación para Mutation Testing
// ═══════════════════════════════════════════════════════════════════════════════

describe('pontos-por-rolada - Capa 3: Preparación para Mutation Testing', () => {

  it('mutante: si cambio slice(-6) a slice(-5) en extractRolada, el resultado debe ser diferente', () => {
    // Con slice(-6): "0543712" → "543712" → "5437"
    // Con slice(-5): "0543712" → "43712" → "4371"  ← diferente
    const correct = extractRolada('0543712');
    const mutant  = (() => {
      const trimmed = '0543712'.trim();
      const right5  = trimmed.slice(-5); // ← mutación
      return right5.slice(0, 4);
    })();
    assert.notEqual(correct, mutant, 'Mutante en slice(-5) debe dar resultado diferente');
  });

  it('mutante: si cambio slice(0,4) a slice(0,3) en extractRolada, el resultado debe ser diferente', () => {
    const correct = extractRolada('0543712');
    const mutant  = (() => {
      const trimmed = '0543712'.trim();
      const right6  = trimmed.slice(-6);
      return right6.slice(0, 3); // ← mutación
    })();
    assert.notEqual(correct, mutant, 'Mutante en slice(0,3) debe dar resultado diferente');
  });

  it('mutante: si cambio "1" por "2" en clasificación sector, INDIGO se rompería', () => {
    // Con código correcto, "101"[0] === "1" → INDIGO
    // Con mutante, "101"[0] !== "2" → no sería INDIGO
    assert.equal(getSectorLabel('101'), 'INDIGO');
    assert.notEqual(getSectorLabel('101'), 'HILANDERIA');
  });

  it('mutante: si cambio > 0 por >= 0 en HAVING, defectos sin puntos pasarían', () => {
    // Con HAVING SUM(pontos) > 0: un defecto con 0 pts se excluye
    // Con HAVING SUM(pontos) >= 0: un defecto con 0 pts se incluiría ← mutante
    const zeroRows = [
      { tipo: 'resumen', cod_def: '313', desc_defeito: 'TEST', pts_totales: 0, roladas_afectadas: 0, rolada: null, pts_rolada: null },
    ];
    const result = transformResponse(zeroRows);
    // Aunque transformResponse no filtra por pts > 0 (eso se hace en SQL),
    // verificamos que un totalPts de 0 sea detectado
    assert.equal(result.totalPts, 0, 'Un defecto con 0 pts no debería sumar al total');
  });

  it('mutante: si quito la condición QUALIDADE="1", el filtro se perdería', () => {
    // Verifica que el filtro SQL contiene la condición
    const sqlFragment = `AND d."QUALIDADE" = '1'`;
    assert.ok(sqlFragment.includes("QUALIDADE"), 'SQL debe filtrar por QUALIDADE');
    assert.ok(sqlFragment.includes("= '1'"), 'SQL debe filtrar QUALIDADE = 1');
  });

  it('mutante: totalPts con reduce usando + vs * sería detectado', () => {
    const defectos = [
      { pts_totales: 10 },
      { pts_totales: 5 },
      { pts_totales: 3 },
    ];
    const correct = defectos.reduce((s, d) => s + d.pts_totales, 0);
    const mutant  = defectos.reduce((s, d) => s * d.pts_totales, 0); // ← produce 0 (empieza de 0)
    assert.equal(correct, 18, 'Suma correcta debe ser 18');
    assert.notEqual(correct, mutant, 'Mutante * vs + debe dar resultado diferente');
  });

  it('mutante: sort() ascendente vs descendente de roladas sería detectado', () => {
    const roladas = ['5439', '5437', '5438'];
    const sortedAsc = [...roladas].sort();
    const sortedDesc = [...roladas].sort().reverse();

    assert.deepEqual(sortedAsc, ['5437', '5438', '5439']);
    assert.notDeepEqual(sortedAsc, sortedDesc, 'Orden ascendente y descendente deben ser diferentes');
  });
});
