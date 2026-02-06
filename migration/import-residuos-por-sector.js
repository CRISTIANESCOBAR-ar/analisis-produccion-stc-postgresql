/**
 * Importación de tb_RESIDUOS_POR_SECTOR desde rptResiduosPorSetor.csv
 * 
 * Características:
 * - 13 columnas
 * - CSV: C:\STC\CSV\rptResiduosPorSetor.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CSV_FOLDER = process.env.CSV_FOLDER || 'C:\\STC\\CSV';
const CSV_FILE = path.join(CSV_FOLDER, 'rptResiduosPorSetor.csv');
const TABLE_NAME = 'tb_RESIDUOS_POR_SECTOR';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026'
});

// Orden exacto de columnas según PostgreSQL
const COLUMN_ORDER = [
  'FILIAL',
  'SETOR',
  'DESC_SETOR',
  'DT_MOV',
  'TURNO',
  'SUBPRODUTO',
  'DESCRICAO',
  'ID',
  'PESO LIQUIDO (KG)',
  'LOTE',
  'OPERADOR',
  'NOME_OPER',
  'OBS'
];

// ============================================================================
// FUNCIONES DE IMPORTACIÓN
// ============================================================================

async function importData() {
  const client = await pool.connect();
  
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log('IMPORTACIÓN tb_RESIDUOS_POR_SECTOR');
    console.log(`${'='.repeat(70)}\n`);
    
    // Verificar que existe el archivo
    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`Archivo no encontrado: ${CSV_FILE}`);
    }
    
    console.log(`📁 Archivo: ${CSV_FILE}`);
    
    // Leer el CSV completo
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    console.log(`\n📋 Columnas detectadas: ${headers.length}`);
    
    // Validar orden de columnas
    console.log('\n🔍 Validando orden de columnas...');
    const orderErrors = [];
    for (let i = 0; i < COLUMN_ORDER.length; i++) {
      if (headers[i] !== COLUMN_ORDER[i]) {
        orderErrors.push(`  Posición ${i + 1}: esperado "${COLUMN_ORDER[i]}", encontrado "${headers[i]}"`);
      }
    }
    
    if (orderErrors.length > 0) {
      console.error('\n❌ ERROR: El orden de columnas no coincide:');
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
    const errors = [];
    
    // Parsear y importar
    const parser = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`⏳ Importando registros...`);
    
    const startImport = Date.now();
    
    for await (const row of parser) {
      totalRows++;
      
      try {
        const values = COLUMN_ORDER.map(col => {
          const val = row[col];
          return val === '' || val === undefined ? null : val;
        });
        
        await client.query(insertSQL, values);
        imported++;
        
        if (imported % 100 === 0) {
          process.stdout.write(`\r   Procesados: ${imported} registros...`);
        }
        
      } catch (err) {
        errors.push({
          row: totalRows,
          error: err.message,
          data: row
        });
        
        if (errors.length > 10) {
          console.error('\n\n❌ Demasiados errores. Abortando...');
          throw new Error('Exceso de errores de importación');
        }
      }
    }
    
    const importElapsed = ((Date.now() - startImport) / 1000).toFixed(2);
    
    console.log(`\n  ✓ ${imported} registros insertados...`);
    console.log(`  ⏱️  Tiempo de importación: ${importElapsed}s`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} errores durante la importación:`);
      errors.forEach(({ row, error }) => {
        console.log(`   - Fila ${row}: ${error}`);
      });
    }
    
    // Verificar conteo final
    const countResult = await client.query(`SELECT COUNT(*) FROM ${TABLE_NAME}`);
    const finalCount = parseInt(countResult.rows[0].count, 10);
    
    console.log(`\n✅ Importación completada:`);
    console.log(`   - Registros en tabla: ${finalCount}`);
    console.log(`   - Total procesado: ${totalRows}`);
    console.log(`   - Importados: ${imported}`);
    console.log(`   - Errores: ${errors.length}`);
    
    return finalCount;
    
  } catch (err) {
    console.error('\n❌ Error en importación:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

(async () => {
  const startTime = Date.now();
  
  try {
    const count = await importData();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Proceso completado en ${elapsed}s`);
    console.log(`   ${count} registros en tb_RESIDUOS_POR_SECTOR`);
    console.log(`${'='.repeat(70)}\n`);
    
    process.exit(0);
    
  } catch (err) {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
