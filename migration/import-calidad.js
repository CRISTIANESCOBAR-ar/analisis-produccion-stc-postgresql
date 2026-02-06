import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

// Mapeo de columnas CSV → PostgreSQL (87 columnas)
// Basado en analisis-produccion-stc/scripts/mappings/tb_CALIDAD.json
const columnMapping = {
  'EMP': 'EMP',
  'DAT_PROD': 'DAT_PROD',
  'GRP_DEF': 'GRP_DEF',
  'COD_DE': 'COD_DE',
  'DEFEITO': 'DEFEITO',
  'INDIGO': 'INDIGO',
  'CC': 'CC',
  'GRP_TEAR': 'GRP_TEAR',
  'TEAR': 'TEAR',
  'ARTIGO': 'ARTIGO',
  'COR': 'COR',
  'PARTIDA': 'PARTIDA',
  'G_CMEST': 'G_CMEST',
  'ACONDIC': 'ACONDIC',
  'GRP_TEC': 'GRP_TEC',
  'TRAMA': 'TRAMA',
  'ROLADA': 'ROLADA',
  'METRAGEM': 'METRAGEM',
  'QUALIDADE': 'QUALIDADE',
  'PESO BRUTO': 'PESO BRUTO',
  'REVISOR FINAL': 'REVISOR FINAL',
  'HORA': 'HORA',
  'NM MERC': 'NM MERC',
  'TUR TEC': 'TUR TEC',
  'T TEC1': 'T TEC1',
  'T TEC2': 'T TEC2',
  'EMENDAS': 'EMENDAS',
  'PEÇA': 'PEÇA',
  'ETIQUETA': 'ETIQUETA',
  'PESO LIQUIDO': 'PESO LIQUIDO',
  'LARGURA': 'LARGURA',
  'GR/M2': 'GR/M2',
  'T INDIGO': 'T INDIGO',
  'PONTUACAO': 'PONTUACAO',
  'REPROCESSO': 'REPROCESSO',
  'COD DIREC': 'COD DIREC',
  'DESC DIREC': 'DESC DIREC',
  'DT INI TEC': 'DT INI TEC',
  'HR INI TEC': 'HR INI TEC',
  'DT FIM TEC': 'DT FIM TEC',
  'HR FIM TEC': 'HR FIM TEC',
  'RPM TECEL': 'RPM TECEL',
  'GRUPO CMESTR': 'GRUPO CMESTR',
  'URDUME': 'URDUME',
  'MODELO TEAR': 'MODELO TEAR',
  'ST IND': 'ST IND',
  'G.PR': 'G#PR',  // Transformación: punto → numeral
  'DT  TINGIMENTO': 'DT  TINGIMENTO',  // Doble espacio
  'TURNO INDIGO': 'TURNO INDIGO',
  'OPER INDIGO': 'OPER INDIGO',
  'LAVADEIRA 01': 'LAVADEIRA 01',
  'TURNO LAVAD': 'TURNO LAVAD ',  // Primera ocurrencia con espacio al final
  'LAVADEIRA 02': 'LAVADEIRA 02',
  'TURNO LAVAD_2': 'TURNO LAVAD 1',  // Segunda ocurrencia
  'LAVADEIRA 03': 'LAVADEIRA 03',
  'TURNO LAVAD 03': 'TURNO LAVAD 03',
  'INTEGRADA': 'INTEGRADA',
  'TURNO INTEGR': 'TURNO INTEGR',
  'SANFOR 01': 'SANFOR 01',
  'TURNO SANF 01': 'TURNO SANF 01',
  'SANFOR 02': 'SANFOR 02',
  'TURNO SANF 02': 'TURNO SANF 02',
  'CALANDRA': 'CALANDRA',
  'TURNO CALAND': 'TURNO CALAND',
  'ESTAMAPRIA': 'ESTAMAPRIA',
  'TURNO ESTAMP': 'TURNO ESTAMP',
  'MERCERZ 01': 'MERCERZ 01',
  'TURNO MERC 01': 'TURNO MERC 01',
  'MERCERZ 02': 'MERCERZ 02',
  'TURNO MERC 02': 'TURNO MERC 02',
  'DATA PESAGEM': 'DATA PESAGEM',
  'HORA PESAGEM': 'HORA PESAGEM',
  'TURNO PESAGEM': 'TURNO PESAGEM ',  // Con espacio al final
  'LOCAL TECEL': 'LOCAL TECEL',
  'DEF EMENDA': 'DEF EMENDA',
  'DESC DEF EMENDA': 'DESC DEF EMENDA',
  'HORARIO_REVISAO': 'HORARIO_REVISAO',
  'TURNO_HORARIO_REVISAO': 'TURNO_HORARIO_REVISAO',
  'TURNO_REVISAO': 'TURNO_REVISAO',
  'DATA_REVISAO': 'DATA_REVISAO',
  'REVISOR EMENDA': 'REVISOR EMENDA',
  'HORA PECA FINAL': 'HORA PECA FINAL',
  'TURNO PECA FINAL': 'TURNO PECA FINAL',
  'DEFEITO MANCHA': 'DEFEITO MANCHA'
};

async function importCalidad() {
  const client = await pool.connect();
  
  try {
    console.log('Leyendo CSV rptAcompDiarioPBI.csv...');
    const csvContent = fs.readFileSync('C:\\STC\\CSV\\rptAcompDiarioPBI.csv', 'utf-8');
    
    // Leer headers de la primera línea y renombrar duplicados
    const lines = csvContent.split('\n');
    const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Renombrar headers duplicados
    const seenColumns = {};
    const renamedHeaders = [];
    
    for (const header of originalHeaders) {
      if (seenColumns[header]) {
        seenColumns[header]++;
        renamedHeaders.push(`${header}_${seenColumns[header]}`);
      } else {
        seenColumns[header] = 1;
        renamedHeaders.push(header);
      }
    }
    
    // Reemplazar primera línea con headers renombrados
    lines[0] = renamedHeaders.join(',');
    const csvContentWithRenamedHeaders = lines.join('\n');
    
    console.log(`Headers originales encontrados: ${originalHeaders.length}`);
    console.log(`Headers renombrados: ${renamedHeaders.length} columnas`);
    
    // Mostrar columnas duplicadas detectadas
    const duplicates = Object.entries(seenColumns).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('\nColumnas duplicadas detectadas:');
      duplicates.forEach(([col, count]) => {
        console.log(`  - "${col}": ${count} veces`);
      });
    }
    
    // Ahora parsear con headers únicos
    const records = parse(csvContentWithRenamedHeaders, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`\nCSV leído: ${records.length} registros`);
    
    console.log('\nIniciando importación...');
    await client.query('BEGIN');
    
    // Limpiar tabla antes de importar
    console.log('Limpiando tabla tb_CALIDAD...');
    await client.query('TRUNCATE TABLE tb_CALIDAD');
    
    let imported = 0;
    let skipped = 0;
    
    // PASO 1: Filtrar y preparar registros válidos
    console.log('Preparando datos...');
    const validRecords = [];
    
    for (const record of records) {
      // Filtrar filas vacías o encabezados duplicados
      const datProd = record['DAT_PROD'] || '';
      if (datProd === 'DAT_PROD' || datProd.trim() === '' || !datProd.match(/\d{2}\/\d{2}\/\d{4}/)) {
        skipped++;
        continue;
      }
      
      // Mapear valores CSV a columnas PostgreSQL
      const values = {};
      for (const [csvCol, pgCol] of Object.entries(columnMapping)) {
        values[pgCol] = record[csvCol] || null;
      }
      
      validRecords.push(values);
    }
    
    console.log(`Registros válidos: ${validRecords.length}`);
    console.log(`Registros omitidos: ${skipped}`);
    
    if (validRecords.length === 0) {
      console.log('\n⚠️  No hay registros válidos para importar');
      await client.query('COMMIT');
      return;
    }
    
    // PASO 2: Insertar en batches (ajustado por número de columnas)
    // PostgreSQL tiene límite de ~32,767 parámetros por query
    // Con 87 columnas: usar batch conservador de 150 filas = 13,050 parámetros
    const numColumns = Object.keys(validRecords[0]).length;
    const BATCH_SIZE = 150; // Batch conservador para muchas columnas
    const numBatches = Math.ceil(validRecords.length / BATCH_SIZE);
    
    console.log(`\nInsertando en ${numBatches} batches de ${BATCH_SIZE} registros (${numColumns} columnas)...`);
    
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      
      if (batch.length === 0) continue;
      
      // Obtener columnas del primer registro
      const columns = Object.keys(batch[0]).map(c => `"${c}"`).join(', ');
      const batchCols = Object.keys(batch[0]).length;
      
      // Construir placeholders para múltiples registros
      const valuePlaceholders = [];
      const allValues = [];
      
      batch.forEach((record, idx) => {
        const offset = idx * batchCols;
        const placeholders = Array.from({ length: batchCols }, (_, colIdx) => `$${offset + colIdx + 1}`);
        valuePlaceholders.push(`(${placeholders.join(', ')})`);
        allValues.push(...Object.values(record));
      });
      
      // Ejecutar INSERT con múltiples VALUES
      const query = `INSERT INTO tb_CALIDAD (${columns}) VALUES ${valuePlaceholders.join(', ')}`;
      
      await client.query(query, allValues);
      imported += batch.length;
      
      // Mostrar progreso cada 5 batches
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      if (currentBatch % 5 === 0 || currentBatch === numBatches) {
        console.log(`  ⏳ Batch ${currentBatch}/${numBatches} - ${imported} registros insertados...`);
      }
    }
    
    console.log(`  ✓ ${imported} registros insertados...`);
    
    await client.query('COMMIT');
    console.log(`\n✅ Importación completada:`);
    console.log(`   - Registros importados: ${imported}`);
    console.log(`   - Registros omitidos: ${skipped}`);
    
    // Verificar datos importados
    const result = await client.query('SELECT COUNT(*) as total FROM tb_CALIDAD');
    console.log(`   - Total en base de datos: ${result.rows[0].total}`);
    
    // Verificar muestra de datos
    console.log('\nMuestra de datos importados:');
    const sample = await client.query(`
      SELECT "PARTIDA", "ARTIGO", "COR", "METRAGEM", "ETIQUETA", "QUALIDADE"
      FROM tb_CALIDAD 
      LIMIT 5
    `);
    console.table(sample.rows);
    
    // Verificar columnas clave
    console.log('\nVerificando columnas especiales:');
    const specialSample = await client.query(`
      SELECT "PARTIDA", "G#PR", "TURNO LAVAD ", "TURNO LAVAD 1", "DT  TINGIMENTO"
      FROM tb_CALIDAD 
      WHERE "G#PR" IS NOT NULL OR "TURNO LAVAD " IS NOT NULL OR "TURNO LAVAD 1" IS NOT NULL
      LIMIT 5
    `);
    console.table(specialSample.rows);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la importación:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar importación
importCalidad().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
