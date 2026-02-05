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

// Mapeo de columnas CSV → SQLite
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
  'TRAMA REDUZIDO': 'TRAMA REDUZIDO',
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
  'TRAMA': 'TRAMA'
};

async function importFichas() {
  const client = await pool.connect();
  
  try {
    console.log('Leyendo CSV...');
    const csvContent = fs.readFileSync('C:\\STC\\CSV\\fichaArtigo.csv', 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    console.log(`CSV leído: ${records.length} registros`);
    
    // Renombrar columnas duplicadas en los headers originales
    const firstRecord = records[0];
    const originalHeaders = Object.keys(firstRecord);
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
    
    console.log('Renombrando columnas duplicadas...');
    const processedRecords = records.map(record => {
      const newRecord = {};
      originalHeaders.forEach((oldHeader, index) => {
        const newHeader = renamedHeaders[index];
        newRecord[newHeader] = record[oldHeader];
      });
      return newRecord;
    });
    
    console.log('Iniciando importación...');
    await client.query('BEGIN');
    
    let imported = 0;
    for (const record of processedRecords) {
      // Mapear valores CSV a columnas SQLite
      const values = {};
      for (const [csvCol, sqliteCol] of Object.entries(columnMapping)) {
        values[sqliteCol] = record[csvCol] || null;
      }
      
      // Construir query
      const columns = Object.keys(values).map(c => `"${c}"`).join(', ');
      const placeholders = Object.keys(values).map((_, i) => `$${i + 1}`).join(', ');
      const valuesList = Object.values(values);
      
      const query = `INSERT INTO tb_fichas (${columns}) VALUES (${placeholders})`;
      
      try {
        await client.query(query, valuesList);
        imported++;
        
        if (imported % 100 === 0) {
          console.log(`  Importados ${imported} registros...`);
        }
      } catch (err) {
        console.error(`\nError en registro ${imported + 1}:`);
        console.error('Query:', query.substring(0, 200));
        console.error('Error completo:', err);
        throw err; // Detener para ver el primer error
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✓ Importación completada: ${imported} de ${records.length} registros`);
    
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
