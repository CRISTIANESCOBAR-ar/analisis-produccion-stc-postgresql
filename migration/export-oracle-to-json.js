// Script para exportar datos de Oracle a JSON
require('dotenv').config({ path: '../carga-datos-vue/server/.env' });
const oracledb = require('oracledb');
const fs = require('fs');

async function exportData() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER || 'SYSTEM',
      password: process.env.ORACLE_PASSWORD || 'Alfa1984',
      connectString: process.env.ORACLE_CONNECTIONSTRING || 'localhost:1521/XE'
    });

    console.log('✓ Conectado a Oracle\n');
    console.log('🔄 Exportando datos...\n');

    // Helper para normalizar valores Oracle (convertir a tipos primitivos)
    const normalizeRow = (row) => {
      const normalized = {};
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          normalized[key] = null;
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          normalized[key] = value;
        } else if (value instanceof Date) {
          normalized[key] = value.toISOString();
        } else if (typeof value === 'object') {
          // Intentar convertir a string si es un tipo especial de Oracle
          normalized[key] = String(value);
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    };

    // Exportar Uster PAR
    console.log('  Exportando USTER_PAR...');
    const usterPar = await connection.execute(
      `SELECT TESTNR, NOMCOUNT, MASCHNR, LOTE, LABORANT, TIME_STAMP, MATCLASS, ESTIRAJE, PASADOR, OBS 
       FROM USTER_PAR ORDER BY TESTNR`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const normalizedUsterPar = usterPar.rows.map(normalizeRow);
    fs.writeFileSync('oracle-uster-par.json', JSON.stringify(normalizedUsterPar, null, 2));
    console.log(`    ✓ ${normalizedUsterPar.length} registros`);

    // Exportar Uster TBL
    console.log('  Exportando USTER_TBL...');
    const usterTbl = await connection.execute(
      `SELECT TESTNR, SEQNO, NO_, U_PERCENT, CVM_PERCENT, INDICE_PERCENT,
              CVM_1M_PERCENT, CVM_3M_PERCENT, CVM_10M_PERCENT, 
              TITULO, TITULO_REL_PERC,
              H, SH, SH_1M, SH_3M, SH_10M,
              DELG_MINUS30_KM, DELG_MINUS40_KM, DELG_MINUS50_KM, DELG_MINUS60_KM,
              GRUE_35_KM, GRUE_50_KM, GRUE_70_KM, GRUE_100_KM,
              NEPS_140_KM, NEPS_200_KM, NEPS_280_KM, NEPS_400_KM
       FROM USTER_TBL ORDER BY TESTNR, SEQNO`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const normalizedUsterTbl = usterTbl.rows.map(normalizeRow);
    fs.writeFileSync('oracle-uster-tbl.json', JSON.stringify(normalizedUsterTbl, null, 2));
    console.log(`    ✓ ${normalizedUsterTbl.length} registros`);

    // Exportar TensoRapid PAR
    console.log('  Exportando TENSORAPID_PAR...');
    const tensorPar = await connection.execute(
      `SELECT TESTNR, NOMCOUNT AS NE_TITULO, NOMCOUNT AS TITULO, 
              COMMENT_TEXT, LENGTH AS LONG_PRUEBA, TIME AS TIME_STAMP,
              LOTE, USTER_TESTNR, LABORANT 
       FROM TENSORAPID_PAR ORDER BY TESTNR`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const normalizedTensorPar = tensorPar.rows.map(normalizeRow);
    fs.writeFileSync('oracle-tensorapid-par.json', JSON.stringify(normalizedTensorPar, null, 2));
    console.log(`    ✓ ${normalizedTensorPar.length} registros`);

    // Exportar TensoRapid TBL
    console.log('  Exportando TENSORAPID_TBL...');
    const tensorTbl = await connection.execute(
      `SELECT TESTNR, HUSO_NUMBER AS ID, HUSO_NUMBER AS NO_, 
              TIEMPO_ROTURA, FUERZA_B, ELONGACION, TENACIDAD, TRABAJO
       FROM TENSORAPID_TBL ORDER BY TESTNR, HUSO_NUMBER`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const normalizedTensorTbl = tensorTbl.rows.map(normalizeRow);
    fs.writeFileSync('oracle-tensorapid-tbl.json', JSON.stringify(normalizedTensorTbl, null, 2));
    console.log(`    ✓ ${normalizedTensorTbl.length} registros`);

    console.log('\n✅ Exportación completada exitosamente!');
    console.log('\nArchivos generados:');
    console.log('  - oracle-uster-par.json');
    console.log('  - oracle-uster-tbl.json');
    console.log('  - oracle-tensorapid-par.json');
    console.log('  - oracle-tensorapid-tbl.json');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error cerrando conexión:', err.message);
      }
    }
  }
}

exportData();
