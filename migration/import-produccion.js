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

// Mapeo de columnas CSV → PostgreSQL (66 columnas)
// Basado en analisis-produccion-stc/scripts/mappings/tb_PRODUCCION.json
const columnMapping = {
  'FILIAL': 'FILIAL',
  'DT_INICIO': 'DT_INICIO',
  'HORA_INICIO': 'HORA_INICIO',
  'DT_FINAL': 'DT_FINAL',
  'HORA_FINAL': 'HORA_FINAL',
  'DT_BASE_PRODUCAO': 'DT_BASE_PRODUCAO',
  'TURNO': 'TURNO',
  'PARTIDA': 'PARTIDA',
  'PARTIDA_DUPLA': 'PARTIDA_DUPLA',
  'R': 'R',
  'ARTIGO': 'ARTIGO',
  'COR': 'COR',
  'METRAGEM': 'METRAGEM',
  'METRAGEM ENCOLH': 'METRAGEM ENCOLH',
  'TEMPO': 'TEMPO',
  'VELOC CALC': 'VELOC CALC',
  'VELOC': 'VELOC',
  'EFICIENCIA': 'EFICIENCIA',
  'NUM_FIOS': 'NUM_FIOS',
  'S': 'S',
  'MAQUINA': 'MAQUINA',
  'RUPTURAS': 'RUPTURAS',
  'CAVALOS': 'CAVALOS',
  'OPERADOR': 'OPERADOR',
  'NM OPERADOR': 'NM OPERADOR',
  'NM MERCADO': 'NM MERCADO',
  'LARG PAD': 'LARG PAD',
  'LARG INI': 'LARG INI',
  'LARG FIM': 'LARG FIM',
  'TRAMA REDUZIDA 1': 'TRAMA REDUZIDA 1',
  'TRAMA REDUZIDA 2': 'TRAMA REDUZIDA 2',
  'RUP FIACAO': 'RUP FIACAO',
  'RUP URD': 'RUP URD',
  'RUP OPER': 'RUP OPER',
  'LOTE FIACAO': 'LOTE FIACAO',
  'MAQ  FIACAO': 'MAQ FIACAO',  // Doble espacio en CSV → columna PostgreSQL con espacio simple
  'ROLADA': 'ROLADA',
  'SELETOR': 'SELETOR',
  'QTDE_RUPTURA': 'QTDE_RUPTURA',
  'COD_RUP': 'COD_RUP',
  'MOTIVO_RUP': 'MOTIVO_RUP',
  'TIPO_RUP': 'TIPO_RUP',
  'DESC_TP_RUPTURA': 'DESC_TP_RUPTURA',
  'COD_CAVALO': 'COD_CAVALO',
  'DESC_CAVALO': 'DESC_CAVALO',
  'QTDE_CAVALO': 'QTDE_CAVALO',
  'PONTOS_LIDOS': 'PONTOS_LIDOS',
  'PONTOS_100%': 'PONTOS_100%',
  'BATIDAS': 'BATIDAS',
  'ENCOLH ACAB': 'ENCOLH ACAB',
  'ESTIRAGEM REVISAO': 'ESTIRAGEM REVISAO',
  'TEMPO LEIT MIN': 'TEMPO LEIT MIN',
  // Columnas duplicadas: "TOTAL MINUTOS TUR" aparece 3 veces (renombradas _2, _3, _4 por el algoritmo)
  'TOTAL MINUTOS TUR': 'TOTAL MINUTOS TUR',
  'TOTAL MINUTOS TUR_2': 'TOTAL MINUTOS TUR 1',
  'TOTAL MINUTOS TUR_3': 'TOTAL MINUTOS TUR 2',
  'PARADA TEC TRAMA': 'PARADA TEC TRAMA',
  'PARADA TEC URDUME': 'PARADA TEC URDUME',
  'PARADA TEC OUTROS': 'PARADA TEC OUTROS',
  'PARADA TEC STOP': 'PARADA TEC STOP',
  'BASE URDUME': 'BASE URDUME',
  'RPM LEITURA': 'RPM LEITURA',
  'RPM NOMINALTEAR': 'RPM NOMINALTEAR',
  'GRUPO TEAR': 'GRUPO TEAR',
  'DESC TEAR': 'DESC TEAR',
  'MODELO TEAR': 'MODELO TEAR',
  'MAQ INDIGO': 'MAQ INDIGO'
};

async function importProduccion() {
  const client = await pool.connect();
  
  try {
    console.log('Leyendo CSV rptProducaoMaquina.csv...');
    const csvContent = fs.readFileSync('C:\\STC\\CSV\\rptProducaoMaquina.csv', 'utf-8');
    
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
    console.log('Limpiando tabla tb_PRODUCCION...');
    await client.query('TRUNCATE TABLE tb_PRODUCCION');
    
    let imported = 0;
    let skipped = 0;
    
    for (const record of records) {
      // Filtrar filas vacías o encabezados duplicados (usar DT_BASE_PRODUCAO como referencia)
      const dtBase = record['DT_BASE_PRODUCAO'] || '';
      if (dtBase === 'DT_BASE_PRODUCAO' || dtBase.trim() === '' || !dtBase.match(/\d{2}\/\d{2}\/\d{4}/)) {
        skipped++;
        continue;
      }
      
      // Mapear valores CSV a columnas PostgreSQL
      const values = {};
      for (const [csvCol, pgCol] of Object.entries(columnMapping)) {
        values[pgCol] = record[csvCol] || null;
      }
      
      // Construir query
      const columns = Object.keys(values).map(c => `"${c}"`).join(', ');
      const placeholders = Object.keys(values).map((_, i) => `$${i + 1}`).join(', ');
      const valueArray = Object.values(values);
      
      const query = `INSERT INTO tb_PRODUCCION (${columns}) VALUES (${placeholders})`;
      
      await client.query(query, valueArray);
      imported++;
      
      if (imported % 1000 === 0) {
        console.log(`  Importados ${imported} registros...`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Importación completada:`);
    console.log(`   - Registros importados: ${imported}`);
    console.log(`   - Registros omitidos: ${skipped}`);
    
    // Verificar datos importados
    const result = await client.query('SELECT COUNT(*) as total FROM tb_PRODUCCION');
    console.log(`   - Total en base de datos: ${result.rows[0].total}`);
    
    // Verificar muestra de datos
    console.log('\nMuestra de datos importados:');
    const sample = await client.query(`
      SELECT "PARTIDA", "ARTIGO", "COR", "METRAGEM", "SELETOR", "MAQ FIACAO"
      FROM tb_PRODUCCION 
      LIMIT 5
    `);
    console.table(sample.rows);
    
    // Verificar columna SELETOR (debe tener datos como "CAVALOS")
    console.log('\nVerificando columna SELETOR (clave para validación):');
    const seletorSample = await client.query(`
      SELECT "PARTIDA", "ARTIGO", "SELETOR", "ROLADA"
      FROM tb_PRODUCCION 
      WHERE "SELETOR" IS NOT NULL AND "SELETOR" != ''
      LIMIT 10
    `);
    console.table(seletorSample.rows);
    
    const seletorCount = await client.query(`
      SELECT COUNT(*) as total 
      FROM tb_PRODUCCION 
      WHERE "SELETOR" IS NOT NULL AND "SELETOR" != ''
    `);
    console.log(`   - Registros con SELETOR: ${seletorCount.rows[0].total}`);
    
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
importProduccion().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
