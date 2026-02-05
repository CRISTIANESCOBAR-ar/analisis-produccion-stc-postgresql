/**
 * Importación de tb_RESIDUOS_INDIGO desde RelResIndigo.csv
 * 
 * Características:
 * - 39 columnas (sin duplicados)
 * - ~15 registros
 * - Mapeo: CSV "DEVOL TEC." → PostgreSQL "DEVOL TEC#"
 * - Validación de orden exacto SQLite
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CSV_FILE = 'C:\\STC\\CSV\\RelResIndigo.csv';
const TABLE_NAME = 'tb_RESIDUOS_INDIGO';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

// Orden exacto de columnas según SQLite
// NOTA: Columna 39 se mapea de CSV "DEVOL TEC." a PostgreSQL "DEVOL TEC#"
const COLUMN_ORDER = [
  'FILIAL', 'SETOR', 'DESC_SETOR', 'DT_MOV', 'TURNO',
  'SUBPRODUTO', 'DESCRICAO', 'ID', 'PESO LIQUIDO (KG)', 'LOTE',
  'PARTIDA', 'ROLADA', 'MOTIVO', 'DESC_MOTIVO', 'OPERADOR',
  'NOME_OPER', 'PE DE ROLO', 'INDIGO', 'URDUME', 'TURNO CORTE',
  'GAIOLA', 'OBS', 'PESO ROLO 01', 'PESO ROLO 02', 'PESO ROLO 03',
  'PESO ROLO 04', 'PESO ROLO 05', 'PESO ROLO 06', 'PESO ROLO 07', 'PESO ROLO 08',
  'PESO ROLO 09', 'PESO ROLO 10', 'PESO ROLO 11', 'PESO ROLO 12', 'PESO ROLO 13',
  'PESO ROLO 14', 'PESO ROLO 15', 'PESO ROLO 16', 'DEVOL TEC#'
];

// ============================================================================
// MAPEO DE NOMBRES DE COLUMNAS
// ============================================================================

// Renombra headers del CSV para coincidir con PostgreSQL
function renameHeaders(headers) {
  return headers.map(header => {
    const trimmed = header.trim();
    // CSV tiene "DEVOL TEC." pero PostgreSQL usa "DEVOL TEC#"
    if (trimmed === 'DEVOL TEC.') return 'DEVOL TEC#';
    return trimmed;
  });
}

// ============================================================================
// FUNCIONES DE IMPORTACIÓN
// ============================================================================

async function importData() {
  const client = await pool.connect();
  
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log('IMPORTACIÓN tb_RESIDUOS_INDIGO');
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
    const renamedHeaders = renameHeaders(originalHeaders);
    
    console.log('\n📋 Mapeos de columnas aplicados:');
    for (let i = 0; i < originalHeaders.length; i++) {
      if (originalHeaders[i] !== renamedHeaders[i]) {
        console.log(`   "${originalHeaders[i]}" → "${renamedHeaders[i]}"`);
      }
    }
    
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
    
    console.log('📥 Importando registros...\n');
    
    for await (const record of parser) {
      totalRows++;
      
      // Filtrar headers duplicados en los datos
      // (aunque no se detectaron, es una buena práctica)
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
        
        // Mostrar progreso cada 5 registros (tabla pequeña)
        if (imported % 5 === 0) {
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
    
    // Validación de fechas
    console.log(`\n${'='.repeat(70)}`);
    console.log('VALIDACIÓN DE DATOS');
    console.log(`${'='.repeat(70)}`);
    
    const dateValidation = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "DT_MOV" IS NOT NULL AND "DT_MOV" != '' THEN 1 END) as with_date
      FROM ${TABLE_NAME}
    `);
    
    console.log(`Registros con fecha:   ${dateValidation.rows[0].with_date}/${dateValidation.rows[0].total}`);
    
    // Verificar columnas con más datos
    const columnStats = await client.query(`
      SELECT 
        COUNT(CASE WHEN "FILIAL" IS NOT NULL AND "FILIAL" != '' THEN 1 END) as filial,
        COUNT(CASE WHEN "SETOR" IS NOT NULL AND "SETOR" != '' THEN 1 END) as setor,
        COUNT(CASE WHEN "DT_MOV" IS NOT NULL AND "DT_MOV" != '' THEN 1 END) as dt_mov,
        COUNT(CASE WHEN "TURNO" IS NOT NULL AND "TURNO" != '' THEN 1 END) as turno,
        COUNT(CASE WHEN "DESCRICAO" IS NOT NULL AND "DESCRICAO" != '' THEN 1 END) as descricao,
        COUNT(CASE WHEN "PESO LIQUIDO (KG)" IS NOT NULL AND "PESO LIQUIDO (KG)" != '' THEN 1 END) as peso_liquido
      FROM ${TABLE_NAME}
    `);
    
    const stats = columnStats.rows[0];
    console.log(`Columnas con datos:`);
    console.log(`   FILIAL:            ${stats.filial}`);
    console.log(`   SETOR:             ${stats.setor}`);
    console.log(`   DT_MOV:            ${stats.dt_mov}`);
    console.log(`   TURNO:             ${stats.turno}`);
    console.log(`   DESCRICAO:         ${stats.descricao}`);
    console.log(`   PESO LIQUIDO (KG): ${stats.peso_liquido}`);
    
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
