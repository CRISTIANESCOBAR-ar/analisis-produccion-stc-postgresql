import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFilename,
  processHviFileContent,
  formatTsv
} from './parser.mjs';

/**
 * Convierte una fecha 'dd/mm/yyyy' a 'yyyy-mm-dd' para ordenamiento cronológico.
 * @param {string} fechaStr
 * @returns {string}
 */
export function toIsoDateKey(fechaStr) {
  const parts = fechaStr.split('/');
  if (parts.length !== 3) return fechaStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Procesa todos los archivos HVI de un directorio y los consolida en un único archivo TSV.
 * @param {string} sourceDir
 * @param {string} outputPath
 * @returns {Promise<{
 *   totalFilesProcessed: number,
 *   totalRecords: number,
 *   totalMuestraBatches: number,
 *   totalEntradaBatches: number,
 *   skippedFiles: string[]
 * }>}
 */
export async function consolidateHviDirectory(sourceDir, outputPath) {
  const files = fs.readdirSync(sourceDir);
  const matchedFiles = [];
  const skippedFiles = [];

  for (const f of files) {
    if (f.toLowerCase() === 'hvi_consolidado.txt' || !f.toLowerCase().endsWith('.txt')) {
      skippedFiles.push(f);
      continue;
    }

    const meta = parseFilename(f);
    if (!meta) {
      skippedFiles.push(f);
      continue;
    }

    matchedFiles.push({ filename: f, meta });
  }

  // Ordenamiento cronológico y luego por nombre de archivo
  matchedFiles.sort((a, b) => {
    const dateA = toIsoDateKey(a.meta.fecha);
    const dateB = toIsoDateKey(b.meta.fecha);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return a.filename.localeCompare(b.filename);
  });

  const allRecords = [];
  let totalMuestraBatches = 0;
  let totalEntradaBatches = 0;

  for (const { filename } of matchedFiles) {
    const fullPath = path.join(sourceDir, filename);
    const content = fs.readFileSync(fullPath, 'latin1');
    const records = processHviFileContent(content, filename);

    if (records.length > 0) {
      if (records[0].Tipo === 'ENTRADA') {
        totalEntradaBatches++;
      } else {
        totalMuestraBatches++;
      }
      allRecords.push(...records);
    }
  }

  const tsvContent = formatTsv(allRecords, true);
  fs.writeFileSync(outputPath, tsvContent, 'utf8');

  return {
    totalFilesProcessed: matchedFiles.length,
    totalRecords: allRecords.length,
    totalMuestraBatches,
    totalEntradaBatches,
    skippedFiles
  };
}

// Ejecución directa desde terminal
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const defaultSource = 'C:\\stc-produccion-v2\\HVI Crudo';
  const defaultOutput = path.join(defaultSource, 'HVI_Consolidado.txt');

  console.log('Iniciando consolidación HVI...');
  console.log(`Directorio origen: ${defaultSource}`);
  console.log(`Archivo destino:   ${defaultOutput}`);

  consolidateHviDirectory(defaultSource, defaultOutput)
    .then(summary => {
      console.log('\n--- Resumen de Consolidación ---');
      console.log(`Archivos procesados: ${summary.totalFilesProcessed}`);
      console.log(`Lotes clasificados como MUESTRA: ${summary.totalMuestraBatches}`);
      console.log(`Lotes clasificados como ENTRADA: ${summary.totalEntradaBatches}`);
      console.log(`Total registros útiles consolidados: ${summary.totalRecords}`);
      if (summary.skippedFiles.length > 0) {
        console.log(`Archivos omitidos (${summary.skippedFiles.length}):`, summary.skippedFiles);
      }
      console.log('Consolidación completada con éxito.');
    })
    .catch(err => {
      console.error('Error durante la consolidación:', err);
      process.exit(1);
    });
}
