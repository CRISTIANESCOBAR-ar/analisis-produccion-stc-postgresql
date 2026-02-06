const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026',
});

// Parsear valores de INSERT de Oracle
function parseOracleInsert(line) {
  const match = line.match(/values\s*\((.*)\);?\s*$/i);
  if (!match) return null;
  
  const valuesStr = match[1];
  const values = [];
  let current = '';
  let inQuote = false;
  let parenCount = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const prevChar = i > 0 ? valuesStr[i - 1] : '';
    
    if (char === "'" && prevChar !== '\\') {
      inQuote = !inQuote;
      current += char;
    } else if (char === '(' && !inQuote) {
      parenCount++;
      current += char;
    } else if (char === ')' && !inQuote) {
      parenCount--;
      current += char;
    } else if (char === ',' && !inQuote && parenCount === 0) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    values.push(current.trim());
  }
  
  return values;
}

// Convertir valor de Oracle a PostgreSQL
function convertValue(val) {
  if (!val || val === 'null') return null;
  
  // Quitar comillas
  val = val.trim();
  if (val.startsWith("'") && val.endsWith("'")) {
    val = val.slice(1, -1);
  }
  
  // Convertir to_timestamp
  const tsMatch = val.match(/to_timestamp\('(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})\d*','DD\/MM\/RR HH24:MI:SSXFF'\)/);
  if (tsMatch) {
    const [, day, month, year, hour, min, sec, ms] = tsMatch;
    return `20${year}-${month}-${day} ${hour}:${min}:${sec}.${ms}`;
  }
  
  // Reemplazar comas por puntos en números
  if (/^\d+,\d+$/.test(val)) {
    val = val.replace(',', '.');
  }
  
  return val;
}

async function importUsterPar(filePath) {
  console.log('\n📖 Leyendo USTER_PAR...');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const records = [];
  
  for (const line of lines) {
    if (line.match(/^Insert into SYSTEM\.USTER_PAR/i)) {
      const values = parseOracleInsert(line);
      if (!values || values.length < 27) continue;
      
      // Mapeo de columnas Oracle a PostgreSQL
      // Oracle: TESTNR,CATALOG,TIME_STAMP,LOTE,SORTIMENT,ARTICLE,MASCHNR,MATCLASS,NOMCOUNT,NOMTWIST,USCODE,FB_MIC,FB_TIPO,FB_LONG,FB_PORC,LABORANT,TUNAME,GROUPS,WITHIN,TOTAL,SPEED,TESTTIME,SLOT,ABSORBERPRESSURE,CREATED_AT,ESTIRAJE,PASADOR
      // Index:  0       1       2          3    4         5       6       7        8        9        10     11     12      13      14     15       16     17     18     19    20    21       22   23                24         25       26
      
      records.push({
        testnr: convertValue(values[0]),
        nomcount: convertValue(values[8]),
        maschnr: convertValue(values[6]),
        lote: convertValue(values[3]),
        laborant: convertValue(values[15]),
        time_stamp: convertValue(values[2]),
        matclass: convertValue(values[7]),
        estiraje: convertValue(values[25]),
        pasador: convertValue(values[26]),
        created_at: convertValue(values[24])
      });
    }
  }
  
  console.log(`✅ Parseados ${records.length} registros de USTER_PAR`);
  return records;
}

async function importUsterTbl(filePath) {
  console.log('\n📖 Leyendo USTER_TBL...');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const records = [];
  
  for (const line of lines) {
    if (line.match(/^Insert into SYSTEM\.USTER_TBL/i)) {
      const values = parseOracleInsert(line);
      if (!values || values.length < 30) continue;
      
      // Mapeo de columnas Oracle a PostgreSQL
      // Oracle: ID,TESTNR,SEQNO,NO_,CREATED_AT,U_PERCENT,CVM_PERCENT,INDICE_PERCENT,CVM_1M_PERCENT,CVM_3M_PERCENT,CVM_10M_PERCENT,TITULO,TITULO_REL_PERC,H,SH,SH_1M,SH_3M,SH_10M,DELG_MINUS30_KM,DELG_MINUS40_KM,DELG_MINUS50_KM,DELG_MINUS60_KM,GRUE_35_KM,GRUE_50_KM,GRUE_70_KM,GRUE_100_KM,NEPS_140_KM,NEPS_200_KM,NEPS_280_KM,NEPS_400_KM
      // Index:  0  1      2     3   4          5         6           7              8              9              10              11     12             13 14  15    16    17    18              19              20              21              22         23         24         25          26          27          28          29
      
      records.push({
        testnr: convertValue(values[1]),
        seqno: convertValue(values[2]),
        no_: convertValue(values[3]),
        u_percent: convertValue(values[5]),
        cvm_percent: convertValue(values[6]),
        indice_percent: convertValue(values[7]),
        cvm_1m_percent: convertValue(values[8]),
        cvm_3m_percent: convertValue(values[9]),
        cvm_10m_percent: convertValue(values[10]),
        titulo: convertValue(values[11]),
        titulo_rel_perc: convertValue(values[12]),
        h: convertValue(values[13]),
        sh: convertValue(values[14]),
        sh_1m: convertValue(values[15]),
        sh_3m: convertValue(values[16]),
        sh_10m: convertValue(values[17]),
        delg_minus30_km: convertValue(values[18]),
        delg_minus40_km: convertValue(values[19]),
        delg_minus50_km: convertValue(values[20]),
        delg_minus60_km: convertValue(values[21]),
        grue_35_km: convertValue(values[22]),
        grue_50_km: convertValue(values[23]),
        grue_70_km: convertValue(values[24]),
        grue_100_km: convertValue(values[25]),
        neps_140_km: convertValue(values[26]),
        neps_200_km: convertValue(values[27]),
        neps_280_km: convertValue(values[28]),
        neps_400_km: convertValue(values[29]),
        created_at: convertValue(values[4])
      });
    }
  }
  
  console.log(`✅ Parseados ${records.length} registros de USTER_TBL`);
  return records;
}

async function main() {
  const parFile = process.argv[2] || 'C:\\STC\\USTER_PAR.TXT';
  const tblFile = process.argv[3] || 'C:\\STC\\USTER_TBL.TXT';
  
  console.log('🔄 Importando datos de USTER desde archivos TXT...');
  console.log('');
  
  try {
    // Conectar a PostgreSQL
    console.log('📡 Conectando a PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Conectado');
    
    // Importar USTER_PAR
    const parRecords = await importUsterPar(parFile);
    
    console.log('\n💾 Insertando USTER_PAR en PostgreSQL...');
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE tb_uster_par CASCADE');
    
    for (const record of parRecords) {
      try {
        await client.query(`
          INSERT INTO tb_uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          record.testnr,
          record.nomcount,
          record.maschnr,
          record.lote,
          record.laborant,
          record.time_stamp,
          record.matclass,
          record.estiraje,
          record.pasador,
          record.created_at
        ]);
      } catch (err) {
        console.error(`❌ Error insertando testnr ${record.testnr}:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ ${parRecords.length} registros insertados en tb_uster_par`);
    
    // Importar USTER_TBL
    const tblRecords = await importUsterTbl(tblFile);
    
    console.log('\n💾 Insertando USTER_TBL en PostgreSQL...');
    await client.query('BEGIN');
    await client.query('DELETE FROM tb_uster_tbl');
    
    let insertedCount = 0;
    for (const record of tblRecords) {
      try {
        await client.query(`
          INSERT INTO tb_uster_tbl (
            testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo, titulo_rel_perc,
            h, sh, sh_1m, sh_3m, sh_10m, delg_minus30_km, delg_minus40_km,
            delg_minus50_km, delg_minus60_km, grue_35_km, grue_50_km, grue_70_km,
            grue_100_km, neps_140_km, neps_200_km, neps_280_km, neps_400_km, created_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
          )
        `, [
          record.testnr, record.seqno, record.no_, 
          record.u_percent, record.cvm_percent, record.indice_percent,
          record.cvm_1m_percent, record.cvm_3m_percent, record.cvm_10m_percent,
          record.titulo, record.titulo_rel_perc,
          record.h, record.sh, record.sh_1m, record.sh_3m, record.sh_10m,
          record.delg_minus30_km, record.delg_minus40_km,
          record.delg_minus50_km, record.delg_minus60_km,
          record.grue_35_km, record.grue_50_km, record.grue_70_km,
          record.grue_100_km,
          record.neps_140_km, record.neps_200_km, record.neps_280_km, record.neps_400_km,
          record.created_at
        ]);
        insertedCount++;
      } catch (err) {
        console.error(`❌ Error insertando testnr ${record.testnr} seqno ${record.seqno}:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ ${insertedCount} registros insertados en tb_uster_tbl`);
    
    // Verificar
    console.log('\n🔍 Verificando datos importados...');
    const result = await client.query(`
      SELECT 
        'tb_uster_par' as tabla, 
        COUNT(*) as registros 
      FROM tb_uster_par
      UNION ALL
      SELECT 
        'tb_uster_tbl' as tabla, 
        COUNT(*) as registros 
      FROM tb_uster_tbl
    `);
    
    console.log('\n📊 Resultado:');
    result.rows.forEach(row => {
      console.log(`   ${row.tabla}: ${row.registros} registros`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Importación completada exitosamente!');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

main();
