/**
 * Importación de tb_CALIDAD_FIBRA desde rptMovimMP.csv
 * 
 * Características:
 * - 69 columnas
 * - ~14,964 registros
 * - 12 columnas requieren mapeo de nombres
 * - FORNECEDOR aparece duplicado (renombrar segunda ocurrencia a FORNECEDOR_2)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CSV_FILE = 'C:\\STC\\CSV\\rptMovimMP.csv';
const TABLE_NAME = 'tb_CALIDAD_FIBRA';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

// Orden exacto de columnas según SQLite
const COLUMN_ORDER = [
  'ITEM', 'DESC_ITEM', 'ID', 'DATA_MOVIMENTO', 'TIPO_MOV',
  'PRODUTOR', 'PROCED', 'LOTE', 'PILHA', 'DESTINO',
  'COR', 'TP_MIC', 'TP', 'CLASSIFIC', 'LOTE_INTERNO',
  'CORTEZA', 'QTDE', 'MISTURA', 'SEQ', 'TIPO_MP',
  'FORNECEDOR', 'NMFORN', 'NF', 'LOTE_FIAC', 'TAM',
  'SCI', 'MST', 'MIC', 'MAT', 'UHML',
  'UI', 'SF', 'STR', 'ELG', 'RD',
  'PLUS_B', 'TIPO', 'TrCNT', 'TrAR', 'TRID',
  'SAC', 'PIM', 'SC', 'BENF', 'TP_SELO',
  'NUM_SELO', 'PESO', 'PESO_MEDIO', 'ENT_SAI', 'UM',
  'OBSERVACAO', 'IDFIL', 'DT_EMISSAO', 'DT_ENTRADA_PROD', 'HR_ENTRADA_PROD',
  'TURNO_ENT_PROD', 'LADO', 'FARDOS_TESTADOS', 'FORNECEDOR_2', 'CONSIGNADO',
  'LIBERADO', 'DATA_LIBERACAO', 'DOC_VENDA', 'DT_EMIS_DOC_VENDA', 'USU_LIBEROU',
  'DT_INCLUSAO', 'USU_INCLUSAO', 'DT_ALTERACAO', 'USU_ALTERACAO'
];

// Mapeo de nombres CSV → PostgreSQL
const COLUMN_NAME_MAPPING = {
  'TP MIC': 'TP_MIC',
  'LOTE INTERNO': 'LOTE_INTERNO',
  'TIPO MP': 'TIPO_MP',
  '+b': 'PLUS_B',
  'TP SELO': 'TP_SELO',
  'NUM SELO': 'NUM_SELO',
  'OBSERVACAO (DO TESTE)': 'OBSERVACAO',
  'FARDOS TESTADOS': 'FARDOS_TESTADOS',
  'DOC VENDA': 'DOC_VENDA',
  'DT EMIS DOC VENDA': 'DT_EMIS_DOC_VENDA',
  'USU LIBEROU': 'USU_LIBEROU'
};

// ============================================================================
// FUNCIONES DE MAPEO
// ============================================================================

function renameHeaders(headers) {
  const renamedHeaders = [];
  const seenHeaders = {};
  
  for (let i = 0; i < headers.length; i++) {
    let header = headers[i].trim();
    
    // Aplicar mapeo de nombres si existe
    if (COLUMN_NAME_MAPPING[header]) {
      header = COLUMN_NAME_MAPPING[header];
    }
    
    // Manejar duplicados (FORNECEDOR aparece 2 veces)
    if (seenHeaders[header]) {
      seenHeaders[header]++;
      const newName = `${header}_${seenHeaders[header]}`;
      renamedHeaders.push(newName);
      console.log(`  Renombrando duplicado: "${headers[i]}" (aparición ${seenHeaders[header]}) → "${newName}"`);
    } else {
      seenHeaders[header] = 1;
      renamedHeaders.push(header);
      
      // Reportar si se hizo un mapeo
      if (COLUMN_NAME_MAPPING[headers[i]]) {
        console.log(`  Mapeando: "${headers[i]}" → "${header}"`);
      }
    }
  }
  
  return renamedHeaders;
}

// ============================================================================
// FUNCIONES DE IMPORTACIÓN
// ============================================================================

async function importData() {
  const client = await pool.connect();
  
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log('IMPORTACIÓN tb_CALIDAD_FIBRA');
    console.log(`${'='.repeat(70)}\n`);
    
    // Verificar que existe el archivo
    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`Archivo no encontrado: ${CSV_FILE}`);
    }
    
    console.log(`📁 Archivo: ${CSV_FILE}`);
    
    // Leer el CSV completo para obtener y renombrar headers
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = fileContent.split('\n');
    const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    console.log('\n📋 Aplicando mapeos de columnas:');
    const renamedHeaders = renameHeaders(originalHeaders);
    
    // Reconstruir el CSV con headers renombrados
    lines[0] = renamedHeaders.map(h => `"${h}"`).join(',');
    const modifiedContent = lines.join('\n');
    
    // Validar orden de columnas
    console.log('\n🔍 Validando orden de columnas...');
    const orderErrors = [];
    for (let i = 0; i < COLUMN_ORDER.length; i++) {
      if (renamedHeaders[i] !== COLUMN_ORDER[i]) {
        orderErrors.push(`  Posición ${i + 1}: esperado "${COLUMN_ORDER[i]}", encontrado "${renamedHeaders[i]}"`);
      }
    }
    
    if (orderErrors.length > 0) {
      console.error('\n❌ ERROR: El orden de columnas no coincide con SQLite:');
      orderErrors.forEach(err => console.error(err));
      throw new Error('Orden de columnas incorrecto');
    }
    
    console.log('✓ Orden validado correctamente\n');
    
    // Limpiar tabla
    console.log(`🗑️  Limpiando tabla ${TABLE_NAME}...`);
    await client.query(`TRUNCATE TABLE ${TABLE_NAME}`);
    
    // Preparar INSERT statement con comillas en nombres de columnas
    const quotedColumns = COLUMN_ORDER.map(col => `"${col}"`).join(', ');
    const placeholders = COLUMN_ORDER.map((_, i) => `$${i + 1}`).join(', ');
    const insertSQL = `INSERT INTO ${TABLE_NAME} (${quotedColumns}) VALUES (${placeholders})`;
    
    // Contadores
    let totalRows = 0;
    let imported = 0;
    let headersSkipped = 0;
    const errors = [];
    
    // Parsear y importar
    const parser = parse(modifiedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });
    
    console.log('📥 Importando registros (esto puede tardar varios minutos)...\n');
    
    for await (const record of parser) {
      totalRows++;
      
      // Filtrar headers duplicados en los datos
      if (record['ITEM'] === 'ITEM') {
        headersSkipped++;
        continue;
      }
      
      try {
        // Preparar valores en el orden correcto
        const values = COLUMN_ORDER.map(col => {
          const value = record[col];
          return (value === undefined || value === null || value === '') ? null : value;
        });
        
        await client.query(insertSQL, values);
        imported++;
        
        // Mostrar progreso cada 500 registros (archivo grande)
        if (imported % 500 === 0) {
          process.stdout.write(`\r   Procesados: ${imported} registros`);
        }
      } catch (err) {
        errors.push({
          row: totalRows,
          error: err.message,
          data: record
        });
        
        if (errors.length <= 5) {
          console.error(`\n❌ Error en fila ${totalRows}:`, err.message);
        }
      }
    }
    
    console.log(`\r   Procesados: ${imported} registros`);
    
    // Resumen
    console.log(`\n${'='.repeat(70)}`);
    console.log('RESUMEN DE IMPORTACIÓN');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total filas CSV:       ${totalRows}`);
    console.log(`Headers duplicados:    ${headersSkipped}`);
    console.log(`Registros importados:  ${imported}`);
    console.log(`Errores:               ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errores encontrados:');
      errors.slice(0, 5).forEach(e => {
        console.log(`   Fila ${e.row}: ${e.error}`);
      });
      if (errors.length > 5) {
        console.log(`   ... y ${errors.length - 5} errores más`);
      }
    }
    
    // Validación de datos
    console.log(`\n${'='.repeat(70)}`);
    console.log('VALIDACIÓN DE DATOS');
    console.log(`${'='.repeat(70)}`);
    
    const dateValidation = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "DATA_MOVIMENTO" IS NOT NULL AND "DATA_MOVIMENTO" != '' THEN 1 END) as with_date
      FROM ${TABLE_NAME}
    `);
    
    console.log(`Registros con fecha:   ${dateValidation.rows[0].with_date}/${dateValidation.rows[0].total}`);
    
    // Verificar columnas con más datos
    const columnStats = await client.query(`
      SELECT 
        COUNT(CASE WHEN "ITEM" IS NOT NULL AND "ITEM" != '' THEN 1 END) as item,
        COUNT(CASE WHEN "LOTE" IS NOT NULL AND "LOTE" != '' THEN 1 END) as lote,
        COUNT(CASE WHEN "FORNECEDOR" IS NOT NULL AND "FORNECEDOR" != '' THEN 1 END) as fornecedor,
        COUNT(CASE WHEN "TIPO_MOV" IS NOT NULL AND "TIPO_MOV" != '' THEN 1 END) as tipo_mov,
        COUNT(CASE WHEN "QTDE" IS NOT NULL AND "QTDE" != '' THEN 1 END) as qtde,
        COUNT(CASE WHEN "FORNECEDOR_2" IS NOT NULL AND "FORNECEDOR_2" != '' THEN 1 END) as fornecedor_2
      FROM ${TABLE_NAME}
    `);
    
    const stats = columnStats.rows[0];
    console.log(`Columnas con datos:`);
    console.log(`   ITEM:         ${stats.item}`);
    console.log(`   LOTE:         ${stats.lote}`);
    console.log(`   FORNECEDOR:   ${stats.fornecedor}`);
    console.log(`   TIPO_MOV:     ${stats.tipo_mov}`);
    console.log(`   QTDE:         ${stats.qtde}`);
    console.log(`   FORNECEDOR_2: ${stats.fornecedor_2} (duplicado)`);
    
    // Muestra de datos
    console.log(`\n${'='.repeat(70)}`);
    console.log('MUESTRA DE DATOS');
    console.log(`${'='.repeat(70)}`);
    
    const sampleData = await client.query(`
      SELECT "ITEM", "LOTE", "FORNECEDOR", "TIPO_MOV", "QTDE", "DATA_MOVIMENTO"
      FROM ${TABLE_NAME}
      LIMIT 3
    `);
    
    sampleData.rows.forEach((row, i) => {
      console.log(`\nRegistro ${i + 1}:`);
      console.log(`  ITEM: ${row.ITEM}, LOTE: ${row.LOTE}`);
      console.log(`  FORNECEDOR: ${row.FORNECEDOR}, TIPO_MOV: ${row.TIPO_MOV}`);
      console.log(`  QTDE: ${row.QTDE}, DATA: ${row.DATA_MOVIMENTO}`);
    });
    
    // Actualizar estadísticas de PostgreSQL
    console.log(`\n📊 Actualizando estadísticas de PostgreSQL (esto puede tardar)...`);
    await client.query(`VACUUM ANALYZE ${TABLE_NAME}`);
    console.log('✓ Estadísticas actualizadas\n');
    
    console.log(`${'='.repeat(70)}`);
    console.log(`✅ Importación completada: ${imported} registros en ${TABLE_NAME}`);
    console.log(`${'='.repeat(70)}\n`);
    
  } catch (error) {
    console.error('\n❌ Error durante la importación:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

importData().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
