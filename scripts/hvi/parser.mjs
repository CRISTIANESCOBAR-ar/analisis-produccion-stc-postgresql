/**
 * Módulo de procesamiento y parseo de datos HVI de hilandería.
 * Sigue principios de Clean Code y Clean Architecture (Uncle Bob).
 */

export const HVI_HEADERS = [
  'Fecha',
  'Tipo',
  'Proveedor',
  'Lote',
  'Bale ID',
  'SCI',
  'Mst',
  'Mic',
  'Mat',
  'UHML',
  'UI',
  'SF',
  'Str',
  'Elg',
  'Rd',
  '+b',
  'CGrd',
  'TrCnt',
  'TrAr',
  'TrID',
  'Amt'
];

/**
 * Normaliza nombres de proveedores conocidos.
 * @param {string} rawProvider
 * @returns {string}
 */
export function normalizeProvider(rawProvider) {
  const upper = rawProvider.trim().toUpperCase();
  if (upper === 'SNIDER') {
    return 'SNAIDER';
  }
  return upper;
}

/**
 * Extrae y normaliza metadatos del nombre del archivo TXT.
 * @param {string} filename
 * @returns {{ fecha: string, proveedor: string, lote: string } | null}
 */
export function parseFilename(filename) {
  const match = filename.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})\s+(.+?)\s+(lote|entr\.?)\s*(.*)\.txt$/i);
  if (!match) {
    return null;
  }

  const [, rawDay, rawMonth, rawYear, rawProv, , rawLote] = match;

  const day = rawDay.padStart(2, '0');
  const month = rawMonth.padStart(2, '0');
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const fecha = `${day}/${month}/${year}`;

  const proveedor = normalizeProvider(rawProv);

  // Extrae número puro del lote
  const loteMatch = rawLote.match(/(\d+)/);
  const lote = loteMatch ? loteMatch[1] : rawLote.trim();

  return {
    fecha,
    proveedor,
    lote
  };
}

/**
 * Clasifica el lote según el número de registros efectivos.
 * Regla: supera 25 (> 25) -> ENTRADA, caso contrario (<= 25) -> MUESTRA.
 * @param {number} count
 * @returns {'ENTRADA' | 'MUESTRA'}
 */
export function classifyBatch(count) {
  return count > 25 ? 'ENTRADA' : 'MUESTRA';
}

/**
 * Limpia errores de tipeo en Bale ID como puntos iniciales o finales.
 * @param {string} rawBaleId
 * @returns {string}
 */
export function cleanBaleId(rawBaleId) {
  return rawBaleId.replace(/^\.+|\.+$/g, '').trim();
}

/**
 * Palabras clave que identifican líneas de encabezado, pie o resumen.
 */
const NON_DATA_KEYWORDS = [
  'Santana',
  'System Testing',
  'Lot ID',
  'Operator',
  'Print Date',
  'Serial Number',
  'Short/Weak',
  'Long/Strong',
  'Bale ID',
  '[%]',
  'Upland',
  'HVI SW',
  'n ',
  'Average',
  'Std.Dev.',
  'CV%',
  'Q99%',
  'Min',
  'Max'
];

/**
 * Parsea una línea de datos HVI.
 * Descarta automáticamente la columna Grade si viene presente.
 * @param {string} line
 * @returns {object | null}
 */
export function parseHviDataLine(line) {
  const clean = line.replace(/\x0c/g, '').trim();
  if (!clean) {
    return null;
  }

  for (const kw of NON_DATA_KEYWORDS) {
    if (clean.includes(kw)) {
      return null;
    }
  }

  const tokens = clean.split(/\s+/);
  if (tokens.length < 17) {
    return null;
  }

  const rawBaleId = tokens[0];
  const baleId = cleanBaleId(rawBaleId);

  // El Bale ID debe ser numérico tras la limpieza
  if (!/^\d+$/.test(baleId)) {
    return null;
  }

  let sci;
  let mst;
  let rest;

  if (tokens.length === 17) {
    // Sin columna Grade
    sci = tokens[1];
    mst = tokens[2];
    rest = tokens.slice(3);
  } else if (tokens.length >= 18) {
    // Con columna Grade espuria (tokens[2]), se ignora Grade
    sci = tokens[1];
    mst = tokens[3];
    rest = tokens.slice(4);
  }

  if (!rest || rest.length < 14) {
    return null;
  }

  const [
    mic,
    mat,
    uhml,
    ui,
    sf,
    str,
    elg,
    rd,
    plusB,
    cgrd,
    trCnt,
    trAr,
    trId,
    amt
  ] = rest;

  return {
    baleId,
    sci,
    mst,
    mic,
    mat,
    uhml,
    ui,
    sf,
    str,
    elg,
    rd,
    plusB,
    cgrd,
    trCnt,
    trAr,
    trId,
    amt
  };
}

/**
 * Procesa el contenido completo de un archivo TXT individual.
 * @param {string} fileContent
 * @param {string} filename
 * @returns {Array<object>}
 */
export function processHviFileContent(fileContent, filename) {
  const metadata = parseFilename(filename);
  if (!metadata) {
    return [];
  }

  const lines = fileContent.split(/\r?\n/);
  const parsedRows = [];

  for (const line of lines) {
    const data = parseHviDataLine(line);
    if (data) {
      parsedRows.push(data);
    }
  }

  const tipo = classifyBatch(parsedRows.length);

  return parsedRows.map(row => ({
    Fecha: metadata.fecha,
    Tipo: tipo,
    Proveedor: metadata.proveedor,
    Lote: metadata.lote,
    'Bale ID': row.baleId,
    SCI: row.sci,
    Mst: row.mst,
    Mic: row.mic,
    Mat: row.mat,
    UHML: row.uhml,
    UI: row.ui,
    SF: row.sf,
    Str: row.str,
    Elg: row.elg,
    Rd: row.rd,
    '+b': row.plusB,
    CGrd: row.cgrd,
    TrCnt: row.trCnt,
    TrAr: row.trAr,
    TrID: row.trId,
    Amt: row.amt
  }));
}

/**
 * Convierte un arreglo de registros en formato TSV.
 * @param {Array<object>} records
 * @param {boolean} includeHeader
 * @returns {string}
 */
export function formatTsv(records, includeHeader = true) {
  const lines = [];
  if (includeHeader) {
    lines.push(HVI_HEADERS.join('\t'));
  }

  for (const r of records) {
    const rowValues = HVI_HEADERS.map(col => r[col] ?? '');
    lines.push(rowValues.join('\t'));
  }

  return lines.join('\n') + '\n';
}
