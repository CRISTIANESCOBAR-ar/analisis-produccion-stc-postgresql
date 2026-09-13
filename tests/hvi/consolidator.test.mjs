import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { consolidateHviDirectory } from '../../scripts/hvi/consolidator.mjs';

describe('HVI Consolidator - Capa 2: Tests de Aceptación e Integración', () => {
  let tempDir;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hvi-test-'));
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('debe ignorar archivos que no correspondan al patrón HVI o el consolidado previo', async () => {
    // Archivo no HVI
    fs.writeFileSync(path.join(tempDir, 'notas.txt'), 'esto es una nota');
    // Archivo consolidado previo
    fs.writeFileSync(path.join(tempDir, 'HVI_Consolidado.txt'), 'archivo previo');

    const outputPath = path.join(tempDir, 'output.txt');
    const result = await consolidateHviDirectory(tempDir, outputPath);

    assert.equal(result.totalFilesProcessed, 0);
    assert.equal(result.totalRecords, 0);
    assert.equal(result.skippedFiles.length, 2);
  });

  it('debe consolidar múltiples archivos ordenados cronológicamente y generar el TSV exacto', async () => {
    const file1 = `
Santana Textiles Chaco                                                                      USTER     ®      HVI 1000
System Testing - Individual Tests
              Lot ID   01-07-26  CARAM LOTE  6578                              Catalog
Bale ID           SCI Grade   Mst  Mic   Mat   UHML    UI    SF    Str   Elg    Rd    +b CGrd TrCnt  TrAr   TrID   Amt
                              [%]              [mm]   [%]   [%] [g/tex   [%]            Upland        [%]  TrGrd

4358              103         6.9 4.64  0.87  27.82  80.6  11.1   26.2   6.7  71.8  6.1  51-1    71  0.88      6   515
Average           103         6.9 4.64  0.87  27.82  80.6  11.1   26.2   6.7  71.8  6.1 51-1    71  0.88      6   515
`;

    const file2 = `
Santana Textiles Chaco                                                                      USTER     ®      HVI 1000
System Testing - Individual Tests
              Lot ID   13-08-26 CARAM ENTR. 762                                Catalog
Bale ID           SCI Grade   Mst  Mic   Mat   UHML    UI    SF    Str   Elg    Rd    +b CGrd TrCnt  TrAr   TrID   Amt
                              [%]              [mm]   [%]   [%] [g/tex   [%]            Upland        [%]  TrGrd

605               105         7.3 5.02  0.87  26.70  80.0  11.4   30.8   7.9  66.5  8.3  52-1    55  0.83      5   593
606                91     .   7.5 5.06  0.87  26.94  79.2  11.9   28.8   7.7  58.5  9.7  63-1    49  3.92      8   656
Average            98         7.4 5.04  0.87  26.82  79.6  11.6   29.8   7.8  62.5  9.0 57-1    52  2.37      6   624
`;

    fs.writeFileSync(path.join(tempDir, '01-07-26  caram lote  6578.txt'), file1, 'latin1');
    fs.writeFileSync(path.join(tempDir, '13-08-26 caram entr. 762.txt'), file2, 'latin1');

    const outputPath = path.join(tempDir, 'HVI_Consolidado.txt');
    const result = await consolidateHviDirectory(tempDir, outputPath);

    assert.equal(result.totalFilesProcessed, 2);
    assert.equal(result.totalRecords, 3);
    assert.equal(result.totalMuestraBatches, 2); // Ambos tienen <= 25 registros
    assert.equal(result.totalEntradaBatches, 0);

    assert.ok(fs.existsSync(outputPath));
    const content = fs.readFileSync(outputPath, 'utf8');
    const lines = content.trim().split('\n');

    // 1 header + 3 registros = 4 líneas
    assert.equal(lines.length, 4);

    // Verificar que todas las líneas tengan 21 columnas
    for (let idx = 0; idx < lines.length; idx++) {
      const cols = lines[idx].split('\t');
      assert.equal(cols.length, 21, `La fila ${idx} debe tener 21 columnas exactas`);
    }

    // Fila 1: 01-07-26
    const row1 = lines[1].split('\t');
    assert.equal(row1[0], '01/07/2026');
    assert.equal(row1[1], 'MUESTRA');
    assert.equal(row1[2], 'CARAM');
    assert.equal(row1[3], '6578');
    assert.equal(row1[4], '4358');

    // Fila 2: 13-08-26
    const row2 = lines[2].split('\t');
    assert.equal(row2[0], '13/08/2026');
    assert.equal(row2[1], 'MUESTRA');
    assert.equal(row2[2], 'CARAM');
    assert.equal(row2[3], '762'); // Lote puro
    assert.equal(row2[4], '605');

    // Fila 3: 13-08-26 con Grade espurio eliminado
    const row3 = lines[3].split('\t');
    assert.equal(row3[4], '606');
    assert.equal(row3[5], '91'); // SCI
    assert.equal(row3[6], '7.5'); // Mst (omitiendo el '.')
  });
});
