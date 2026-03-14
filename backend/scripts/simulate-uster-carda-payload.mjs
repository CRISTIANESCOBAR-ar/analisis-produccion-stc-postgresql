import fs from 'fs';
import path from 'path';
import { parse as parseSync } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '..', '..');
const csvPath = path.join(repoRoot, 'csv', 'rptProducaoCarda.csv');
const outDir = path.join(repoRoot, 'exports');

function normalizeHeader(header) {
  return String(header ?? '').replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
}

function toNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function buildTestNr(row, index) {
  const dataToken = String(row.DATA || 'SIN_FECHA')
    .replace(/\s+/g, '_')
    .replace(/[^0-9A-Za-z_\-\/]/g, '')
    .replace(/\//g, '-');
  const maq = String(row.MAQUINA || '000000').trim();
  const turno = String(row.T || 'X').trim();
  return `CARDA-${dataToken}-${maq}-${turno}-${String(index + 1).padStart(4, '0')}`;
}

function estimateCvm(row) {
  const cvIn = toNumber(row.CVIn);
  const cv = toNumber(row.CV);
  if (cvIn != null && cvIn > 0) return cvIn;
  if (cv != null && cv > 0) return cv;
  const efic = toNumber(row['EFIC CALC']);
  if (efic != null) return Math.max(1.6, (100 - efic) / 15);
  return 2.4;
}

function buildTblRow(row) {
  const cvm = estimateCvm(row);
  const dPct = toNumber(row['D%']) ?? 0;
  const titulo = toNumber(row.TITULO) ?? 0.1;
  const neps140 = Math.round(Math.max(20, cvm * 70 + dPct * 10));
  const neps200 = Math.round(neps140 * 0.52);
  const neps280 = Math.round(neps140 * 0.25);
  const neps400 = Math.round(neps140 * 0.1);

  return {
    NO_: 1,
    U_PERCENT: null,
    CVM_PERCENT: Number(cvm.toFixed(2)),
    INDICE_PERCENT: null,
    CVM_1M_PERCENT: null,
    CVM_3M_PERCENT: null,
    CVM_10M_PERCENT: null,
    TITULO: Number(titulo.toFixed(2)),
    TITULO_REL_PERC: null,
    H: null,
    SH: null,
    SH_1M: null,
    SH_3M: null,
    SH_10M: null,
    DELG_MINUS30_KM: null,
    DELG_MINUS40_KM: null,
    DELG_MINUS50_KM: null,
    DELG_MINUS60_KM: null,
    GRUE_35_KM: null,
    GRUE_50_KM: null,
    GRUE_70_KM: null,
    GRUE_100_KM: null,
    NEPS_140_KM: neps140,
    NEPS_200_KM: neps200,
    NEPS_280_KM: neps280,
    NEPS_400_KM: neps400
  };
}

function buildParRow(row, index) {
  const testnr = buildTestNr(row, index);
  const titulo = toNumber(row.TITULO) ?? 0.1;
  const hrIni = String(row.HR_INI || '').trim();
  const data = String(row.DATA || '').trim();

  return {
    TESTNR: testnr,
    NOMCOUNT: titulo,
    MASCHNR: String(row.MAQUINA || '').trim(),
    LOTE: `CARDA ${data || 'SIN_FECHA'}`,
    LABORANT: 'SIMULADO',
    TIME_STAMP: `${data} ${hrIni}`.trim(),
    MATCLASS: 'CINTA DE CARDAS',
    ESTIRAJE: null,
    PASADOR: 'NO',
    OBS: `SIMULADO DESDE rptProducaoCarda.csv ITEM ${String(row.ITEM || '').trim()}`
  };
}

function writeCsv(filePath, headers, rows) {
  const lines = [];
  lines.push(headers.join(','));
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h];
      if (v == null) return '';
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(vals.join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCardaRows() {
  if (!fs.existsSync(csvPath)) {
    return [
      {
        MAQUINA: '050202',
        LF: '002',
        DATA: '12/03/26 0:00',
        T: 'A',
        HR_INI: '06:00',
        HR_FINA: '14:00',
        ITEM: '0872606',
        'DESC ITEM': 'CINTA DE CARDAS 100% ALG',
        TITULO: '0,1',
        RPM: '226',
        'EFIC CALC': '40,62',
        CV: '0,00',
        CVIn: '0,00',
        'D%': '0,0'
      }
    ];
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const records = parseSync(raw, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true
  });

  return records;
}

function main() {
  ensureDir(outDir);

  const cardaRows = loadCardaRows();
  const payloads = cardaRows.map((row, index) => {
    const par = buildParRow(row, index);
    const tbl = [buildTblRow(row)];
    return { par, tbl };
  });

  const payloadPath = path.join(outDir, 'sim_uster_carda_payload.json');
  const ndjsonPath = path.join(outDir, 'sim_uster_carda_payload.ndjson');
  const parCsvPath = path.join(outDir, 'sim_uster_carda_par.csv');
  const tblCsvPath = path.join(outDir, 'sim_uster_carda_tbl.csv');

  fs.writeFileSync(payloadPath, JSON.stringify(payloads, null, 2), 'utf-8');
  fs.writeFileSync(ndjsonPath, payloads.map((p) => JSON.stringify(p)).join('\n'), 'utf-8');

  const parRows = payloads.map((p) => p.par);
  const tblRows = payloads.flatMap((p) => p.tbl.map((row, i) => ({ TESTNR: p.par.TESTNR, SEQNO: i + 1, ...row })));

  writeCsv(
    parCsvPath,
    ['TESTNR', 'NOMCOUNT', 'MASCHNR', 'LOTE', 'LABORANT', 'TIME_STAMP', 'MATCLASS', 'ESTIRAJE', 'PASADOR', 'OBS'],
    parRows
  );

  writeCsv(
    tblCsvPath,
    [
      'TESTNR', 'SEQNO', 'NO_', 'U_PERCENT', 'CVM_PERCENT', 'INDICE_PERCENT', 'CVM_1M_PERCENT', 'CVM_3M_PERCENT',
      'CVM_10M_PERCENT', 'TITULO', 'TITULO_REL_PERC', 'H', 'SH', 'SH_1M', 'SH_3M', 'SH_10M', 'DELG_MINUS30_KM',
      'DELG_MINUS40_KM', 'DELG_MINUS50_KM', 'DELG_MINUS60_KM', 'GRUE_35_KM', 'GRUE_50_KM', 'GRUE_70_KM',
      'GRUE_100_KM', 'NEPS_140_KM', 'NEPS_200_KM', 'NEPS_280_KM', 'NEPS_400_KM'
    ],
    tblRows
  );

  console.log('[SIM USTER CARDA] Archivos generados:');
  console.log(`- ${payloadPath}`);
  console.log(`- ${ndjsonPath}`);
  console.log(`- ${parCsvPath}`);
  console.log(`- ${tblCsvPath}`);
  if (!fs.existsSync(csvPath)) {
    console.log('[SIM USTER CARDA] No se encontro csv/rptProducaoCarda.csv, se genero un ejemplo minimo de referencia.');
  }
}

main();
