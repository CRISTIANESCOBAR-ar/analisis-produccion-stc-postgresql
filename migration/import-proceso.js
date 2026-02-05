/**
 * Importación de tb_PROCESO desde rpsPosicaoEstoquePRD.csv
 * 
 * Características:
 * - 40 columnas (sin duplicados)
 * - ~130 registros
 * - Orden validado contra SQLite
 * - NOTA: Tabla se llama tb_PROCESO (una S), no tb_PROCESSO
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CSV_FILE = 'C:\\STC\\CSV\\rpsPosicaoEstoquePRD.csv';
const TABLE_NAME = 'tb_PROCESO';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

// Orden exacto de columnas según SQLite
const COLUMN_ORDER = [
  'FILIAL', 'PROCESSO', 'PARTIDA', 'ARTIGO', 'COR',
  'DESC_NM_MERC', 'MT_DISPONIV', 'DT_PROD', 'NUM_FIOS', 'FLANGE',
  'LADO', 'MAQUINA', 'STATUS', 'URDUME', 'MT_PREVISTA',
  'MT_A_BATER', 'MT_PROX24H', 'BATIDAS', 'RPM', 'EFIC_TA',
  'EFIC_TB', 'EFIC_TC', 'EFIC_DIA', 'ART_PROGR', 'NM_MERC_PROG',
  'COR_PG', 'URDUME_PRO', 'GRUPO_TEAR', 'REPROCESSO', 'LARGURA',
  'TRAMA_REDUZIDA_1', 'TRAMA_REDUZIDA_2', 'DATA FINAL TECEL', 'HORA_FINAL_TECEL', 'TURNO_FINAL_TECE',
  'HORA_FINAL_TECEL_V2', 'OBS ACABAMENTO', 'COD MOT REP', 'MOTIVO REPROCESSO', 'OBS REPROCESSO'
];

// ============================================================================
// FUNCIONES DE IMPORTACIÓN
// ============================================================================

async function importData() {
  const client = await pool.connect();
  
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log('IMPORTACIÓN tb_PROCESO');
    console.log(`${'='.repeat(70)}\n`);
    
    // Verificar que existe el archivo
    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`Archivo no encontrado: ${CSV_FILE}`);
    }
    
    console.log(`📁 Archivo: ${CSV_FILE}`);
    
    // Leer headers del CSV
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = fileContent.split('\n');
    const csvHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Validar orden de columnas
    console.log('\n🔍 Validando orden de columnas...');
    const orderErrors = [];
    for (let i = 0; i < COLUMN_ORDER.length; i++) {
      if (csvHeaders[i] !== COLUMN_ORDER[i]) {
        orderErrors.push(`  Posición ${i + 1}: esperado "${COLUMN_ORDER[i]}", encontrado "${csvHeaders[i]}"`);
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
    const parser = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });
    
    console.log('📥 Importando registros...\n');
    
    for await (const record of parser) {
      totalRows++;
      
      // Filtrar headers duplicados en los datos (preventivo)
      if (record['FILIAL'] === 'FILIAL') {
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
        
        // Mostrar progreso cada 25 registros
        if (imported % 25 === 0) {
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
        COUNT(CASE WHEN "DT_PROD" IS NOT NULL AND "DT_PROD" != '' THEN 1 END) as with_date
      FROM ${TABLE_NAME}
    `);
    
    console.log(`Registros con fecha:   ${dateValidation.rows[0].with_date}/${dateValidation.rows[0].total}`);
    
    // Verificar columnas con más datos
    const columnStats = await client.query(`
      SELECT 
        COUNT(CASE WHEN "FILIAL" IS NOT NULL AND "FILIAL" != '' THEN 1 END) as filial,
        COUNT(CASE WHEN "PROCESSO" IS NOT NULL AND "PROCESSO" != '' THEN 1 END) as processo,
        COUNT(CASE WHEN "PARTIDA" IS NOT NULL AND "PARTIDA" != '' THEN 1 END) as partida,
        COUNT(CASE WHEN "ARTIGO" IS NOT NULL AND "ARTIGO" != '' THEN 1 END) as artigo,
        COUNT(CASE WHEN "MAQUINA" IS NOT NULL AND "MAQUINA" != '' THEN 1 END) as maquina,
        COUNT(CASE WHEN "STATUS" IS NOT NULL AND "STATUS" != '' THEN 1 END) as status,
        COUNT(CASE WHEN "MT_DISPONIV" IS NOT NULL AND "MT_DISPONIV" != '' THEN 1 END) as mt_disponiv
      FROM ${TABLE_NAME}
    `);
    
    const stats = columnStats.rows[0];
    console.log(`Columnas con datos:`);
    console.log(`   FILIAL:       ${stats.filial}`);
    console.log(`   PROCESSO:     ${stats.processo}`);
    console.log(`   PARTIDA:      ${stats.partida}`);
    console.log(`   ARTIGO:       ${stats.artigo}`);
    console.log(`   MAQUINA:      ${stats.maquina}`);
    console.log(`   STATUS:       ${stats.status}`);
    console.log(`   MT_DISPONIV:  ${stats.mt_disponiv}`);
    
    // Muestra de datos
    console.log(`\n${'='.repeat(70)}`);
    console.log('MUESTRA DE DATOS');
    console.log(`${'='.repeat(70)}`);
    
    const sampleData = await client.query(`
      SELECT "FILIAL", "PROCESSO", "PARTIDA", "ARTIGO", "STATUS", "MT_DISPONIV", "DT_PROD"
      FROM ${TABLE_NAME}
      LIMIT 3
    `);
    
    sampleData.rows.forEach((row, i) => {
      console.log(`\nRegistro ${i + 1}:`);
      console.log(`  FILIAL: ${row.FILIAL}, PROCESSO: ${row.PROCESSO}`);
      console.log(`  PARTIDA: ${row.PARTIDA}, ARTIGO: ${row.ARTIGO}`);
      console.log(`  STATUS: ${row.STATUS}, MT_DISPONIV: ${row.MT_DISPONIV}`);
      console.log(`  DT_PROD: ${row.DT_PROD}`);
    });
    
    // Actualizar estadísticas de PostgreSQL
    console.log(`\n📊 Actualizando estadísticas de PostgreSQL...`);
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
