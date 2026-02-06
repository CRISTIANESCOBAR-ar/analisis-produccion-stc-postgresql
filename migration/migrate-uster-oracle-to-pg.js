/**
 * Migración directa: Oracle USTER_PAR/USTER_TBL → PostgreSQL tb_uster_par/tb_uster_tbl
 * 
 * Ejecutar: node migrate-uster-oracle-to-pg.js
 */

const oracledb = require('oracledb');
const { Pool } = require('pg');

// =====================================================
// CONFIGURACIÓN
// =====================================================
const ORACLE_CONFIG = {
  user: 'SYSTEM',
  password: 'Alfa1984',
  connectString: 'localhost/XE'
};

const PG_CONFIG = {
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026',
  max: 10
};

let oracleConn;
let pgPool;

// Helper para convertir valores a número (maneja VARCHAR2 con comas, etc.)
function toNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

async function main() {
  console.log('🚀 Migración Oracle → PostgreSQL (USTER)');
  console.log('==========================================\n');

  try {
    // Conectar a Oracle
    console.log('📡 Conectando a Oracle...');
    oracleConn = await oracledb.getConnection(ORACLE_CONFIG);
    console.log('✅ Conectado a Oracle\n');

    // Conectar a PostgreSQL
    console.log('📡 Conectando a PostgreSQL...');
    pgPool = new Pool(PG_CONFIG);
    await pgPool.query('SELECT 1');
    console.log('✅ Conectado a PostgreSQL\n');

    // Contar registros en Oracle
    const parCount = (await oracleConn.execute('SELECT COUNT(*) FROM USTER_PAR')).rows[0][0];
    const tblCount = (await oracleConn.execute('SELECT COUNT(*) FROM USTER_TBL')).rows[0][0];
    console.log(`📊 Registros en Oracle:`);
    console.log(`   USTER_PAR: ${parCount}`);
    console.log(`   USTER_TBL: ${tblCount}\n`);

    // Borrar datos existentes en PostgreSQL
    console.log('🧹 Borrando datos existentes en PostgreSQL...');
    await pgPool.query('TRUNCATE TABLE tb_uster_tbl CASCADE');
    await pgPool.query('TRUNCATE TABLE tb_uster_par CASCADE');
    console.log('✅ Tablas limpiadas\n');

    // Migrar USTER_PAR
    await migrateUsterPar();

    // Migrar USTER_TBL
    await migrateUsterTbl();

    // Verificar
    console.log('\n📊 Verificación final:');
    const pgPar = (await pgPool.query('SELECT COUNT(*) FROM tb_uster_par')).rows[0].count;
    const pgTbl = (await pgPool.query('SELECT COUNT(*) FROM tb_uster_tbl')).rows[0].count;
    console.log(`   tb_uster_par: ${pgPar} registros`);
    console.log(`   tb_uster_tbl: ${pgTbl} registros`);

    if (parseInt(pgPar) === parCount && parseInt(pgTbl) === tblCount) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
    } else {
      console.log('\n⚠️  Advertencia: Los conteos no coinciden exactamente');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (oracleConn) await oracleConn.close();
    if (pgPool) await pgPool.end();
    console.log('\n✅ Conexiones cerradas');
  }
}

async function migrateUsterPar() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Migrando USTER_PAR → tb_uster_par');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Extraer de Oracle (OBS es CLOB, lo manejamos aparte)
  const result = await oracleConn.execute(
    `SELECT TESTNR, NOMCOUNT, MASCHNR, LOTE, LABORANT, 
            TIME_STAMP, MATCLASS, ESTIRAJE, PASADOR, OBS
     FROM USTER_PAR
     ORDER BY TESTNR`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { OBS: { type: oracledb.STRING } } }
  );

  console.log(`   Extraídos ${result.rows.length} registros de Oracle`);

  // Insertar en PostgreSQL en lotes
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
    const batch = result.rows.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
      try {
        await pgPool.query(
          `INSERT INTO tb_uster_par 
           (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            row.TESTNR,
            row.NOMCOUNT,
            row.MASCHNR,
            row.LOTE,
            row.LABORANT,
            row.TIME_STAMP,
            row.MATCLASS,
            row.ESTIRAJE,
            row.PASADOR,
            row.OBS
          ]
        );
        inserted++;
      } catch (err) {
        console.error(`   ⚠️ Error insertando TESTNR ${row.TESTNR}:`, err.message);
      }
    }
    
    process.stdout.write(`\r   Insertados: ${inserted}/${result.rows.length}`);
  }

  console.log(`\n✅ ${inserted} registros insertados en tb_uster_par`);
}

async function migrateUsterTbl() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Migrando USTER_TBL → tb_uster_tbl');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Extraer de Oracle
  const result = await oracleConn.execute(
    `SELECT TESTNR, SEQNO, NO_, U_PERCENT, CVM_PERCENT, INDICE_PERCENT,
            CVM_1M_PERCENT, CVM_3M_PERCENT, CVM_10M_PERCENT,
            TITULO, TITULO_REL_PERC, H, SH, SH_1M, SH_3M, SH_10M,
            DELG_MINUS30_KM, DELG_MINUS40_KM, DELG_MINUS50_KM, DELG_MINUS60_KM,
            GRUE_35_KM, GRUE_50_KM, GRUE_70_KM, GRUE_100_KM,
            NEPS_140_KM, NEPS_200_KM, NEPS_280_KM, NEPS_400_KM
     FROM USTER_TBL
     ORDER BY TESTNR, SEQNO`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 100000 }
  );

  console.log(`   Extraídos ${result.rows.length} registros de Oracle`);

  // Insertar en PostgreSQL en lotes
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
    const batch = result.rows.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
      try {
        await pgPool.query(
          `INSERT INTO tb_uster_tbl 
           (testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent,
            titulo, titulo_rel_perc, h, sh, sh_1m, sh_3m, sh_10m,
            delg_minus30_km, delg_minus40_km, delg_minus50_km, delg_minus60_km,
            grue_35_km, grue_50_km, grue_70_km, grue_100_km,
            neps_140_km, neps_200_km, neps_280_km, neps_400_km)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
          [
            row.TESTNR,
            row.SEQNO,
            row.NO_,
            row.U_PERCENT,
            row.CVM_PERCENT,
            row.INDICE_PERCENT,
            row.CVM_1M_PERCENT,
            row.CVM_3M_PERCENT,
            row.CVM_10M_PERCENT,
            toNum(row.TITULO),
            toNum(row.TITULO_REL_PERC),
            row.H,
            row.SH,
            row.SH_1M,
            row.SH_3M,
            row.SH_10M,
            row.DELG_MINUS30_KM,
            row.DELG_MINUS40_KM,
            row.DELG_MINUS50_KM,
            row.DELG_MINUS60_KM,
            row.GRUE_35_KM,
            row.GRUE_50_KM,
            row.GRUE_70_KM,
            row.GRUE_100_KM,
            row.NEPS_140_KM,
            row.NEPS_200_KM,
            row.NEPS_280_KM,
            row.NEPS_400_KM
          ]
        );
        inserted++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`\n   ⚠️ Error insertando TESTNR ${row.TESTNR} SEQNO ${row.SEQNO}:`, err.message);
        }
      }
    }
    
    process.stdout.write(`\r   Insertados: ${inserted}/${result.rows.length} (errores: ${errors})`);
  }

  console.log(`\n✅ ${inserted} registros insertados en tb_uster_tbl`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} registros con error (posiblemente FK faltante)`);
  }
}

main();
