import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import pg from 'pg';

const { Pool } = pg;

const DEFAULT_BACKUP = 'C:\\stc-produccion-v2\\backups\\sync\\sync_2026-05-02_13-48-52_fixed.sql';

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function extractHeaderStatements(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const statements = [];

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO public.tb_hvi_ensayos ')) {
      statements.push(line);
    }
  }

  return statements;
}

function getHeaderId(statement) {
  const match = statement.match(/VALUES \((\d+),/);
  return match ? Number(match[1]) : null;
}

function findMatchingParen(source, openIndex) {
  let depth = 0;
  let inString = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inString) {
      if (char === "'" && nextChar === "'") {
        index += 1;
        continue;
      }

      if (char === "'") {
        inString = false;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitSqlList(source) {
  const parts = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inString) {
      current += char;
      if (char === "'" && nextChar === "'") {
        current += nextChar;
        index += 1;
        continue;
      }

      if (char === "'") {
        inString = false;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === ',') {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

function parseInsertStatement(statement) {
  const valuesKeywordIndex = statement.indexOf(' VALUES ');
  if (valuesKeywordIndex < 0) {
    throw new Error(`INSERT sin VALUES reconocible: ${statement}`);
  }

  const columnsOpenIndex = statement.indexOf('(', statement.indexOf('tb_hvi_ensayos'));
  const columnsCloseIndex = findMatchingParen(statement, columnsOpenIndex);
  const valuesOpenIndex = statement.indexOf('(', valuesKeywordIndex);
  const valuesCloseIndex = findMatchingParen(statement, valuesOpenIndex);

  if (columnsOpenIndex < 0 || columnsCloseIndex < 0 || valuesOpenIndex < 0 || valuesCloseIndex < 0) {
    throw new Error(`No se pudo parsear INSERT: ${statement}`);
  }

  const columns = splitSqlList(statement.slice(columnsOpenIndex + 1, columnsCloseIndex));
  const values = splitSqlList(statement.slice(valuesOpenIndex + 1, valuesCloseIndex));

  if (columns.length !== values.length) {
    throw new Error(`INSERT inconsistente, columnas=${columns.length} valores=${values.length}`);
  }

  return { columns, values };
}

function buildCompatibleInsert(statement, availableColumns) {
  const { columns, values } = parseInsertStatement(statement);
  const pairs = columns
    .map((column, index) => ({ column, value: values[index] }))
    .filter(({ column }) => availableColumns.has(column));

  const filteredColumns = pairs.map(({ column }) => column);
  const filteredValues = pairs.map(({ value }) => value);

  if (!filteredColumns.includes('id') || !filteredColumns.includes('lote')) {
    throw new Error(`Faltan columnas requeridas para reconstruir cabecera: ${statement}`);
  }

  return `INSERT INTO public.tb_hvi_ensayos (${filteredColumns.join(', ')}) VALUES (${filteredValues.join(', ')}) ON CONFLICT DO NOTHING;`;
}

async function main() {
  const backupPath = getArg('--backup') || DEFAULT_BACKUP;
  const apply = hasFlag('--apply');

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup no encontrado: ${backupPath}`);
  }

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || '5434'),
    database: process.env.PGDATABASE || 'stc_produccion',
    user: process.env.PGUSER || 'stc_user',
    password: process.env.PGPASSWORD || 'stc_password_2026',
  });

  try {
    const columnsQuery = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='tb_hvi_ensayos'
    `);
    const availableColumns = new Set(columnsQuery.rows.map((row) => row.column_name));

    const orphanQuery = await pool.query(`
      SELECT d.ensayo_id, COUNT(*)::int AS detalles
      FROM tb_hvi_detalles d
      WHERE NOT EXISTS (
        SELECT 1
        FROM tb_hvi_ensayos e
        WHERE e.id = d.ensayo_id
      )
      GROUP BY d.ensayo_id
      ORDER BY d.ensayo_id
    `);

    if (orphanQuery.rows.length === 0) {
      console.log('No hay detalles HVI huérfanos.');
      return;
    }

    const orphanIds = orphanQuery.rows.map((row) => Number(row.ensayo_id));
    const orphanIdSet = new Set(orphanIds);
    const headerStatements = await extractHeaderStatements(backupPath);
    const matchingStatements = headerStatements.filter((statement) => orphanIdSet.has(getHeaderId(statement)));
    const compatibleStatements = matchingStatements.map((statement) => buildCompatibleInsert(statement, availableColumns));
    const matchedIds = matchingStatements.map(getHeaderId).filter((id) => id !== null);
    const missingFromBackup = orphanIds.filter((id) => !matchedIds.includes(id));

    console.log(`Backup: ${backupPath}`);
    console.log(`Ensayos huérfanos detectados: ${orphanIds.join(', ')}`);
    console.table(orphanQuery.rows);

    if (missingFromBackup.length > 0) {
      console.warn(`Cabeceras no encontradas en backup: ${missingFromBackup.join(', ')}`);
    }

    if (!apply) {
      console.log(`Cabeceras recuperables desde backup: ${matchedIds.join(', ')}`);
      console.log('Modo seco. Use --apply para insertar las cabeceras faltantes y reajustar la secuencia.');
      return;
    }

    if (matchingStatements.length === 0) {
      throw new Error('No se encontraron cabeceras recuperables en el backup.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of compatibleStatements) {
        await client.query(statement);
      }

      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('tb_hvi_ensayos', 'id'),
          COALESCE((SELECT MAX(id) FROM tb_hvi_ensayos), 1),
          true
        )
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const remaining = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM tb_hvi_detalles d
      WHERE NOT EXISTS (
        SELECT 1
        FROM tb_hvi_ensayos e
        WHERE e.id = d.ensayo_id
      )
    `);

    console.log(`Cabeceras restauradas: ${matchedIds.join(', ')}`);
    console.log(`Detalles huérfanos restantes: ${remaining.rows[0].total}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});