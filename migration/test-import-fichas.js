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

async function testImportFichas() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('TEST DE IMPORTACIÓN: tb_FICHAS');
    console.log('========================================\n');
    
    // 1. Verificar esquema actual
    console.log('1️⃣  Verificando esquema PostgreSQL...');
    const schemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tb_fichas'
      ORDER BY ordinal_position
    `;
    const schemaResult = await client.query(schemaQuery);
    console.log(`   ✓ Columnas en PostgreSQL: ${schemaResult.rows.length}`);
    
    // 2. Leer CSV y verificar headers
    console.log('\n2️⃣  Leyendo CSV...');
    const csvPath = 'C:\\STC\\CSV\\fichaArtigo.csv';
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo no encontrado: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`   ✓ Registros en CSV: ${records.length}`);
    
    // 3. Verificar headers del CSV
    const csvHeaders = Object.keys(records[0]);
    console.log(`   ✓ Columnas en CSV: ${csvHeaders.length}`);
    
    // 4. Comparar columnas
    console.log('\n3️⃣  Comparando columnas CSV vs PostgreSQL...');
    const pgColumns = schemaResult.rows.map(r => r.column_name);
    
    const missingInPG = csvHeaders.filter(h => 
      !pgColumns.some(pg => pg.toLowerCase() === h.toLowerCase())
    );
    
    const missingInCSV = pgColumns.filter(pg => 
      !csvHeaders.some(h => h.toLowerCase() === pg.toLowerCase())
    );
    
    if (missingInPG.length > 0) {
      console.log(`   ⚠️  Columnas en CSV pero NO en PostgreSQL (${missingInPG.length}):`);
      missingInPG.forEach(col => console.log(`      - ${col}`));
    }
    
    if (missingInCSV.length > 0) {
      console.log(`   ⚠️  Columnas en PostgreSQL pero NO en CSV (${missingInCSV.length}):`);
      missingInCSV.forEach(col => console.log(`      - ${col}`));
    }
    
    if (missingInPG.length === 0 && missingInCSV.length === 0) {
      console.log('   ✅ Todas las columnas coinciden perfectamente');
    }
    
    // 5. Registros actuales en la tabla
    console.log('\n4️⃣  Verificando datos actuales...');
    const countQuery = 'SELECT COUNT(*) as total FROM tb_fichas';
    const countResult = await client.query(countQuery);
    const currentRows = parseInt(countResult.rows[0].total);
    console.log(`   ✓ Registros actuales en tb_FICHAS: ${currentRows}`);
    
    // 6. Muestra de datos
    console.log('\n5️⃣  Muestra de datos (primeros 3 registros)...');
    const sampleQuery = `
      SELECT "ARTIGO CODIGO", "ARTIGO", "COR", "TRAMA" 
      FROM tb_fichas 
      LIMIT 3
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row['ARTIGO CODIGO']} | ${row.TRAMA || '(sin TRAMA)'}`);
    });
    
    // 7. Validar duplicados potenciales
    console.log('\n6️⃣  Buscando duplicados en el CSV...');
    const duplicates = {};
    records.forEach(record => {
      const key = record['ARTIGO CODIGO'];
      if (key && key !== 'ARTIGO CODIGO') {
        duplicates[key] = (duplicates[key] || 0) + 1;
      }
    });
    
    const dupes = Object.entries(duplicates).filter(([k, v]) => v > 1);
    if (dupes.length > 0) {
      console.log(`   ⚠️  Encontrados ${dupes.length} códigos duplicados:`);
      dupes.slice(0, 5).forEach(([code, count]) => {
        console.log(`      - ${code}: ${count} veces`);
      });
    } else {
      console.log('   ✅ No hay duplicados en el CSV');
    }
    
    // 8. Resumen final
    console.log('\n========================================');
    console.log('RESUMEN DEL TEST');
    console.log('========================================');
    console.log(`Columnas PostgreSQL: ${pgColumns.length}`);
    console.log(`Columnas CSV:        ${csvHeaders.length}`);
    console.log(`Registros CSV:       ${records.length}`);
    console.log(`Registros en DB:     ${currentRows}`);
    console.log(`Estado:              ${currentRows === records.length - dupes.length ? '✅ SINCRONIZADO' : '⚠️  NECESITA REIMPORTACIÓN'}`);
    console.log('========================================\n');
    
    // Pregunta si desea reimportar
    const validRecords = records.filter(r => {
      const code = r['ARTIGO CODIGO'];
      return code && code !== 'ARTIGO CODIGO' && code.trim() !== '';
    });
    
    console.log(`Registros válidos para importar: ${validRecords.length}`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testImportFichas().catch(console.error);
