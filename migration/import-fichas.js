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

// Mapeo de columnas CSV → PostgreSQL
const columnMapping = {
  'ARTIGO CODIGO': 'ARTIGO CODIGO',
  'ARTIGO': 'ARTIGO',
  'COR': 'COR',
  'NCM': 'NCM',
  'BASE': 'BASE',
  'UnP': 'UnP',
  'VENDA': 'VENDA',
  'PRODUÇÃO': 'PRODUCAO',
  'NOME REDUZIDO': 'NOME REDUZIDO',
  'NOME DE MERCADO': 'NOME DE MERCADO',
  'LINHA': 'LINHA',
  'URDUME': 'URDUME',
  'SARJA': 'SARJA',
  'COD. RETALHO': 'COD# RETALHO',
  'SAP': 'SAP',
  'TRAMA REDUZIDO': 'TRAMA REDUZIDO',  // Columna 16 del CSV
  'SGS': 'SGS',
  'SGS UN 1': 'SGS UN 1',
  'DESCRIÇÃO': 'DESCRICAO',
  'BATIDAS/FIO': 'BATIDAS/FIO',
  'NE RESULTANTE': 'NE RESULTANTE',
  'SAP_2': 'SAP1',
  'TRAMA REDUZIDO_2': 'TRAMA REDUZIDO1',
  'SGS_2': 'SGS1',
  'SGS UN 2': 'SGS UN 2',
  'DESCRIÇÃO_2': 'DESCRICAO1',
  'BATIDAS/FIO_2': 'BATIDAS/FIO1',
  'NE RESULTANTE_2': 'NE RESULTANTE1',
  'CONS.TR/m': 'CONS#TR/m',
  'SGS_3': 'SGS2',
  'QT.FIOS': 'QT#FIOS',
  'NE RESULTANTE_3': 'NE RESULTANTE2',
  'SGS_4': 'SGS3',
  'QT.FIOS_2': 'QT#FIOS1',
  'NE RESULTANTE_4': 'NE RESULTANTE3',
  'CONS.URD/m': 'CONS#URD/m',
  'BATIDA': 'BATIDA',
  'LARG.PENTE': 'LARG#PENTE',
  'LARG.CRU': 'LARG#CRU',
  'PESO/m CRU': 'PESO/m CRU',
  'Oz/jd2': 'Oz/jd2',
  'Peso/m2': 'Peso/m2',
  'LARGURA MIN': 'LARGURA MIN',
  'LARGURA': 'LARGURA',
  'LARGURA MAX': 'LARGURA MAX',
  'SKEW MIN': 'SKEW MIN',
  'SKEW MAX': 'SKEW MAX',
  'URD.MIN': 'URD#MIN',
  'URD.MAX': 'URD#MAX',
  'TRAMA MIN': 'TRAMA MIN',
  'TRAMA MAX': 'TRAMA MAX',
  'VAR STR.MIN TRAMA': 'VAR STR#MIN TRAMA',
  'VAR STR.MAX TRAMA': 'VAR STR#MAX TRAMA',
  'VAR STR.MIN URD': 'VAR STR#MIN URD',
  'VAR STR.MAX URD': 'VAR STR#MAX URD',
  'PONTOS': 'PONTOS',
  'ENC.TEC.URDUME': 'ENC#TEC#URDUME',
  'ENC. TEC.TRAMA': 'ENC# TEC#TRAMA',
  'ENC.ACAB URD': 'ENC#ACAB URD',
  'ENC.ACAB TRAMA': 'ENC#ACAB TRAMA',
  'LAV.AMAC.URD': 'LAV#AMAC#URD',
  'LAV.AMAC.TRM': 'LAV#AMAC#TRM',
  'LAV STONE': 'LAV STONE',
  'LAV STONE_2': 'LAV STONE 1',
  'STRET LAV STONE': 'STRET LAV STONE',
  'COMPOSIÇÃO': 'COMPOSICAO',
  'TRAMA': 'TRAMA'  // Columna 67 del CSV → columna TRAMA de PostgreSQL
};

async function importFichas() {
  const client = await pool.connect();
  
  try {
    console.log('Leyendo CSV...');
    const csvContent = fs.readFileSync('C:\\STC\\CSV\\fichaArtigo.csv', 'utf-8');
    
    // Leer headers de la primera línea y renombrar duplicados
    const lines =csvContent.split('\n');
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
    
    // Ahora parsear con headers únicos
    const records = parse(csvContentWithRenamedHeaders, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`CSV leído: ${records.length} registros`);
    console.log(`Headers renombrados: ${renamedHeaders.length} columnas`);
    
    console.log('Iniciando importación...');
    await client.query('BEGIN');
    
    // Limpiar tabla antes de importar
    console.log('Limpiando tabla tb_FICHAS...');
    await client.query('TRUNCATE TABLE tb_FICHAS');
    
    let imported = 0;
    let skipped = 0;
    
    // PASO 1: Filtrar y preparar registros válidos
    console.log('Preparando datos...');
    const validRecords = [];
    
    for (const record of records) {
      // Filtrar filas que son encabezados duplicados
      const artigoCodigo = record['ARTIGO CODIGO'] || '';
      if (artigoCodigo === 'ARTIGO CODIGO' || artigoCodigo.trim() === '') {
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
    
    // PASO 2: Insertar en batches de 500
    const BATCH_SIZE = 500;
    const numBatches = Math.ceil(validRecords.length / BATCH_SIZE);
    
    console.log(`\nInsertando en ${numBatches} batches de ${BATCH_SIZE} registros...`);
    
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      
      if (batch.length === 0) continue;
      
      // Obtener columnas del primer registro
      const columns = Object.keys(batch[0]).map(c => `"${c}"`).join(', ');
      const numColumns = Object.keys(batch[0]).length;
      
      // Construir placeholders para múltiples registros
      const valuePlaceholders = [];
      const allValues = [];
      
      batch.forEach((record, idx) => {
        const offset = idx * numColumns;
        const placeholders = Array.from({ length: numColumns }, (_, colIdx) => `$${offset + colIdx + 1}`);
        valuePlaceholders.push(`(${placeholders.join(', ')})`);
        allValues.push(...Object.values(record));
      });
      
      // Ejecutar INSERT con múltiples VALUES
      const query = `INSERT INTO tb_fichas (${columns}) VALUES ${valuePlaceholders.join(', ')}`;
      
      await client.query(query, allValues);
      imported += batch.length;
      
      if ((i + batch.length) % 500 === 0 || i + batch.length >= validRecords.length) {
        console.log(`  ✓ ${imported} registros insertados...`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✓ Importación completada: ${imported} registros importados, ${skipped} omitidos`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en importación:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importFichas().catch(console.error);
