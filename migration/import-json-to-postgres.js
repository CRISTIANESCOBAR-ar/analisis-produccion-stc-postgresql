// Script para importar datos JSON a PostgreSQL
const fs = require('fs');

const BACKEND_URL = 'http://localhost:3001';

// Helper para convertir valores que vienen de Oracle VARCHAR2 a números
const parseOracleNumber = (value) => {
  if (value == null || value === '') return null;
  // Reemplazar coma por punto para valores como "9,62" → 9.62
  const str = String(value).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

async function importData() {
  console.log('📂 Leyendo archivos JSON...\n');
  
  // Leer archivos JSON
  const usterPar = JSON.parse(fs.readFileSync('oracle-uster-par.json', 'utf8'));
  const usterTbl = JSON.parse(fs.readFileSync('oracle-uster-tbl.json', 'utf8'));
  const tensorPar = JSON.parse(fs.readFileSync('oracle-tensorapid-par.json', 'utf8'));
  const tensorTbl = JSON.parse(fs.readFileSync('oracle-tensorapid-tbl.json', 'utf8'));

  console.log(`  ✓ USTER_PAR: ${usterPar.length} registros`);
  console.log(`  ✓ USTER_TBL: ${usterTbl.length} registros`);
  console.log(`  ✓ TENSORAPID_PAR: ${tensorPar.length} registros`);
  console.log(`  ✓ TENSORAPID_TBL: ${tensorTbl.length} registros\n`);

  // Agrupar TBL por TESTNR
  console.log('🔄 Agrupando datos por TESTNR...\n');
  
  const usterTblByTest = {};
  usterTbl.forEach(row => {
    if (!usterTblByTest[row.TESTNR]) usterTblByTest[row.TESTNR] = [];
    
    // Convertir valores numéricos de Oracle (pueden venir como strings con coma)
    const normalizedRow = {
      SEQNO: row.SEQNO,
      NO_: parseOracleNumber(row.NO_),
      U_PERCENT: parseOracleNumber(row.U_PERCENT),
      CVM_PERCENT: parseOracleNumber(row.CVM_PERCENT),
      INDICE_PERCENT: parseOracleNumber(row.INDICE_PERCENT),
      CVM_1M_PERCENT: parseOracleNumber(row.CVM_1M_PERCENT),
      CVM_3M_PERCENT: parseOracleNumber(row.CVM_3M_PERCENT),
      CVM_10M_PERCENT: parseOracleNumber(row.CVM_10M_PERCENT),
      TITULO: parseOracleNumber(row.TITULO),
      TITULO_REL_PERC: parseOracleNumber(row.TITULO_REL_PERC),
      H: parseOracleNumber(row.H),
      SH: parseOracleNumber(row.SH),
      SH_1M: parseOracleNumber(row.SH_1M),
      SH_3M: parseOracleNumber(row.SH_3M),
      SH_10M: parseOracleNumber(row.SH_10M),
      DELG_MINUS30_KM: parseOracleNumber(row.DELG_MINUS30_KM),
      DELG_MINUS40_KM: parseOracleNumber(row.DELG_MINUS40_KM),
      DELG_MINUS50_KM: parseOracleNumber(row.DELG_MINUS50_KM),
      DELG_MINUS60_KM: parseOracleNumber(row.DELG_MINUS60_KM),
      GRUE_35_KM: parseOracleNumber(row.GRUE_35_KM),
      GRUE_50_KM: parseOracleNumber(row.GRUE_50_KM),
      GRUE_70_KM: parseOracleNumber(row.GRUE_70_KM),
      GRUE_100_KM: parseOracleNumber(row.GRUE_100_KM),
      NEPS_140_KM: parseOracleNumber(row.NEPS_140_KM),
      NEPS_200_KM: parseOracleNumber(row.NEPS_200_KM),
      NEPS_280_KM: parseOracleNumber(row.NEPS_280_KM),
      NEPS_400_KM: parseOracleNumber(row.NEPS_400_KM)
    };
    
    usterTblByTest[row.TESTNR].push(normalizedRow);
  });

  const tensorTblByTest = {};
  tensorTbl.forEach(row => {
    if (!tensorTblByTest[row.TESTNR]) tensorTblByTest[row.TESTNR] = [];
    
    const normalizedRow = {
      ID: row.ID,
      NO_: parseOracleNumber(row.NO_),
      HUSO_NUMBER: row.ID,  // FIX: Backend espera HUSO_NUMBER
      TIEMPO_ROTURA: parseOracleNumber(row.TIEMPO_ROTURA),
      FUERZA_B: parseOracleNumber(row.FUERZA_B),
      ELONGACION: parseOracleNumber(row.ELONGACION),
      TENACIDAD: parseOracleNumber(row.TENACIDAD),
      TRABAJO: parseOracleNumber(row.TRABAJO)
    };
    
    tensorTblByTest[row.TESTNR].push(normalizedRow);
  });

  console.log('🚀 Iniciando importación a PostgreSQL...\n');

  // Importar Uster
  let usterSuccess = 0, usterFail = 0;
  const usterErrors = [];
  
  console.log('  Importando USTER...');
  for (const par of usterPar) {
    const tbl = usterTblByTest[par.TESTNR] || [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/uster/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ par, tbl })
      });
      
      if (response.ok) {
        usterSuccess++;
        if (usterSuccess % 50 === 0) {
          console.log(`    ${usterSuccess}/${usterPar.length}...`);
        }
      } else {
        usterFail++;
        const errorText = await response.text();
        usterErrors.push({ testnr: par.TESTNR, error: errorText });
        console.error(`    ✗ Uster ${par.TESTNR}: ${errorText.substring(0, 100)}`);
      }
    } catch (err) {
      usterFail++;
      usterErrors.push({ testnr: par.TESTNR, error: err.message });
      console.error(`    ✗ Uster ${par.TESTNR}: ${err.message}`);
    }
  }
  console.log(`  ✓ USTER completado: ${usterSuccess} exitosos, ${usterFail} fallidos\n`);

  // Importar TensoRapid
  let tensorSuccess = 0, tensorFail = 0;
  const tensorErrors = [];
  
  console.log('  Importando TENSORAPID...');
  for (const par of tensorPar) {
    const tbl = tensorTblByTest[par.TESTNR] || [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/tensorapid/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ par, tbl })
      });
      
      if (response.ok) {
        tensorSuccess++;
        if (tensorSuccess % 50 === 0) {
          console.log(`    ${tensorSuccess}/${tensorPar.length}...`);
        }
      } else {
        tensorFail++;
        const errorText = await response.text();
        tensorErrors.push({ testnr: par.TESTNR, error: errorText });
        console.error(`    ✗ TensoRapid ${par.TESTNR}: ${errorText.substring(0, 100)}`);
      }
    } catch (err) {
      tensorFail++;
      tensorErrors.push({ testnr: par.TESTNR, error: err.message });
      console.error(`    ✗ TensoRapid ${par.TESTNR}: ${err.message}`);
    }
  }
  console.log(`  ✓ TENSORAPID completado: ${tensorSuccess} exitosos, ${tensorFail} fallidos\n`);

  console.log('\n========================================');
  console.log('             RESUMEN FINAL');
  console.log('========================================');
  console.log(`USTER:       ${usterSuccess} exitosos, ${usterFail} fallidos`);
  console.log(`TENSORAPID:  ${tensorSuccess} exitosos, ${tensorFail} fallidos`);
  console.log('========================================\n');

  if (usterErrors.length > 0) {
    console.log('⚠️  Errores en USTER (primeros 5):');
    usterErrors.slice(0, 5).forEach(e => console.log(`   ${e.testnr}: ${e.error.substring(0, 80)}`));
  }
  
  if (tensorErrors.length > 0) {
    console.log('⚠️  Errores en TENSORAPID (primeros 5):');
    tensorErrors.slice(0, 5).forEach(e => console.log(`   ${e.testnr}: ${e.error.substring(0, 80)}`));
  }

  if (usterFail === 0 && tensorFail === 0) {
    console.log('\n✅ ¡Migración completada exitosamente sin errores!');
  } else {
    console.log(`\n⚠️  Migración completada con ${usterFail + tensorFail} errores`);
  }
}

importData().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
