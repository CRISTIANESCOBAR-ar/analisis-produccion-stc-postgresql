import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFilename,
  classifyBatch,
  cleanBaleId,
  parseHviDataLine,
  processHviFileContent,
  formatTsv,
  HVI_HEADERS
} from '../../scripts/hvi/parser.mjs';

describe('HVI Parser - Capa 1: Tests Unitarios Exhaustivos (TDD)', () => {
  describe('parseFilename', () => {
    it('debe parsear un nombre estándar con fecha, proveedor y lote', () => {
      const result = parseFilename('03-09-26 snaider lote 34.txt');
      assert.deepEqual(result, {
        fecha: '03/09/2026',
        proveedor: 'SNAIDER',
        lote: '34'
      });
    });

    it('debe formatear días y meses con ceros a la izquierda (ej. 2-08-26)', () => {
      const result = parseFilename('2-08-26 snaider lote 32.txt');
      assert.deepEqual(result, {
        fecha: '02/08/2026',
        proveedor: 'SNAIDER',
        lote: '32'
      });
    });

    it('debe manejar proveedores compuestos en mayúsculas (ej. don victor)', () => {
      const result = parseFilename('15-07-26  don victor lote  633.txt');
      assert.deepEqual(result, {
        fecha: '15/07/2026',
        proveedor: 'DON VICTOR',
        lote: '633'
      });
    });

    it('debe normalizar automáticamente SNIDER a SNAIDER', () => {
      const result = parseFilename('21-07-26  snider lote  25.txt');
      assert.deepEqual(result, {
        fecha: '21/07/2026',
        proveedor: 'SNAIDER',
        lote: '25'
      });
    });

    it('debe extraer el número de lote puro cuando dice "entr."', () => {
      const result = parseFilename('13-08-26 caram entr. 762.txt');
      assert.deepEqual(result, {
        fecha: '13/08/2026',
        proveedor: 'CARAM',
        lote: '762'
      });
    });

    it('debe lanzar error o retornar null si el nombre no tiene el formato esperado', () => {
      assert.equal(parseFilename('archivo_invalido.txt'), null);
      assert.equal(parseFilename('HVI_Consolidado.txt'), null);
    });
  });

  describe('classifyBatch', () => {
    it('debe clasificar como ENTRADA cuando la cantidad supera 25 (> 25)', () => {
      assert.equal(classifyBatch(26), 'ENTRADA');
      assert.equal(classifyBatch(144), 'ENTRADA');
      assert.equal(classifyBatch(100), 'ENTRADA');
    });

    it('debe clasificar como MUESTRA cuando la cantidad es 25 o menor (<= 25)', () => {
      assert.equal(classifyBatch(25), 'MUESTRA');
      assert.equal(classifyBatch(24), 'MUESTRA');
      assert.equal(classifyBatch(14), 'MUESTRA');
      assert.equal(classifyBatch(10), 'MUESTRA');
      assert.equal(classifyBatch(0), 'MUESTRA');
    });
  });

  describe('cleanBaleId', () => {
    it('debe limpiar puntos iniciales de error tipográfico (ej. .3708 -> 3708)', () => {
      assert.equal(cleanBaleId('.3708'), '3708');
    });

    it('debe limpiar puntos finales de error tipográfico (ej. 110. -> 110)', () => {
      assert.equal(cleanBaleId('110.'), '110');
    });

    it('debe mantener intacto un Bale ID limpio', () => {
      assert.equal(cleanBaleId('7143'), '7143');
    });
  });

  describe('parseHviDataLine', () => {
    it('debe parsear una línea estándar sin columna Grade (17 tokens)', () => {
      const line = '7143              115         6.9 4.58  0.85  27.05  81.4   8.7   29.7   8.6  69.1  7.2  51-1    33  0.27      2   423';
      const data = parseHviDataLine(line);
      assert.ok(data);
      assert.equal(data.baleId, '7143');
      assert.equal(data.sci, '115');
      assert.equal(data.mst, '6.9');
      assert.equal(data.mic, '4.58');
      assert.equal(data.mat, '0.85');
      assert.equal(data.uhml, '27.05');
      assert.equal(data.ui, '81.4');
      assert.equal(data.sf, '8.7');
      assert.equal(data.str, '29.7');
      assert.equal(data.elg, '8.6');
      assert.equal(data.rd, '69.1');
      assert.equal(data.plusB, '7.2');
      assert.equal(data.cgrd, '51-1');
      assert.equal(data.trCnt, '33');
      assert.equal(data.trAr, '0.27');
      assert.equal(data.trId, '2');
      assert.equal(data.amt, '423');
      // Asegurar que NO existe propiedad grade
      assert.equal(data.grade, undefined);
    });

    it('debe descartar el token de Grade cuando viene un caracter espurio (18 tokens)', () => {
      const line = '88520              71     8   6.8 4.60  0.86  26.07  77.1  12.1   25.2   6.9  55.8  7.9  82-1    83  0.81      5   558';
      const data = parseHviDataLine(line);
      assert.ok(data);
      assert.equal(data.baleId, '88520');
      assert.equal(data.sci, '71');
      assert.equal(data.mst, '6.8');
      assert.equal(data.mic, '4.60');
      assert.equal(data.mat, '0.86');
      assert.equal(data.uhml, '26.07');
      assert.equal(data.rd, '55.8');
      assert.equal(data.plusB, '7.9');
      assert.equal(data.cgrd, '82-1');
      assert.equal(data.grade, undefined);
    });

    it('debe parsear líneas donde +b tiene 2 dígitos enteros (ej. 10.0)', () => {
      const line = '1001              126         9.0 5.02  0.87  27.64  82.0   9.2   34.3   7.6  64.9 10.0  53-1    25  0.23      2   670';
      const data = parseHviDataLine(line);
      assert.ok(data);
      assert.equal(data.baleId, '1001');
      assert.equal(data.rd, '64.9');
      assert.equal(data.plusB, '10.0');
    });

    it('debe retornar null para líneas que no son de datos (encabezados, sumarios, vacías)', () => {
      assert.equal(parseHviDataLine(''), null);
      assert.equal(parseHviDataLine('Santana Textiles Chaco'), null);
      assert.equal(parseHviDataLine('System Testing - Individual Tests'), null);
      assert.equal(parseHviDataLine('Bale ID           SCI Grade   Mst  Mic'), null);
      assert.equal(parseHviDataLine('n           144'), null);
      assert.equal(parseHviDataLine('Average           105         6.2 4.61'), null);
      assert.equal(parseHviDataLine('Std.Dev.           11         0.5 0.11'), null);
    });
  });

  describe('processHviFileContent & formatTsv', () => {
    it('debe procesar un archivo completo asociando metadatos y retornando registros con 21 campos', () => {
      const mockContent = `
Santana Textiles Chaco                                                                      USTER     ®      HVI 1000
System Testing - Individual Tests
              Lot ID   03-09-26 SNAIDER LOTE 37                                Catalog
Bale ID           SCI Grade   Mst  Mic   Mat   UHML    UI    SF    Str   Elg    Rd    +b CGrd TrCnt  TrAr   TrID   Amt
                              [%]              [mm]   [%]   [%] [g/tex   [%]            Upland        [%]  TrGrd

197581             98         6.9 4.54  0.86  26.41  79.9  11.5   26.8   7.5  68.5  6.8  51-2    27  0.65      5   561
197597            107     8   7.1 4.55  0.86  26.89  80.2  12.0   29.0   7.5  69.5  6.7  51-2    26  0.30      3   603

n           2
Average           102         7.0 4.54  0.86  26.65  80.0  11.8   27.9   7.5  69.0  6.8 51-2    26  0.48      4   582
`;
      const filename = '03-09-26 snaider lote 37.txt';
      const records = processHviFileContent(mockContent, filename);

      assert.equal(records.length, 2);
      // Como solo tiene 2 registros, debe ser MUESTRA
      assert.equal(records[0].Tipo, 'MUESTRA');
      assert.equal(records[0].Fecha, '03/09/2026');
      assert.equal(records[0].Proveedor, 'SNAIDER');
      assert.equal(records[0].Lote, '37');
      assert.equal(records[0]['Bale ID'], '197581');
      assert.equal(records[0].SCI, '98');

      assert.equal(records[1].Tipo, 'MUESTRA');
      assert.equal(records[1]['Bale ID'], '197597');
      assert.equal(records[1].SCI, '107');

      const tsv = formatTsv(records, true);
      const lines = tsv.trim().split('\n');
      assert.equal(lines.length, 3); // 1 header + 2 rows

      const headerCols = lines[0].split('\t');
      assert.deepEqual(headerCols, HVI_HEADERS);
      assert.equal(headerCols.length, 21);

      const row1Cols = lines[1].split('\t');
      assert.equal(row1Cols.length, 21);
      assert.equal(row1Cols[0], '03/09/2026');
      assert.equal(row1Cols[1], 'MUESTRA');
      assert.equal(row1Cols[2], 'SNAIDER');
      assert.equal(row1Cols[3], '37');
      assert.equal(row1Cols[4], '197581');
    });
  });
});
