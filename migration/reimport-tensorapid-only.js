/**
 * Re-importación de TensoRapid solamente
 * Corrige el problema de HUSO_NUMBER = NULL
 */

const fs = require('fs');

const BACKEND_URL = 'http://localhost:3001';

// Función para convertir valores de Oracle (coma → punto)
const parseOracleNumber = (value) => {
  if (value == null || value === '') return null;
  const str = String(value).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

async function reimportTensorapid() {
  console.log('📂 Leyendo archivos JSON de TensoRapid...');
  
  const tensorPar = JSON.parse(fs.readFileSync('oracle-tensorapid-par.json', 'utf8'));
  const tensorTbl = JSON.parse(fs.readFileSync('oracle-tensorapid-tbl.json', 'utf8'));
  
  console.log(`  ✓ TENSORAPID_PAR: ${tensorPar.length} registros`);
  console.log(`  ✓ TENSORAPID_TBL: ${tensorTbl.length} registros\n`);

  // Agrupar TBL por TESTNR
  console.log('🔄 Agrupando datos por TESTNR...\n');
  
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

  console.log('🚀 Iniciando re-importación de TensoRapid...\n');

  let tensorSuccess = 0, tensorFail = 0;
  const tensorErrors = [];
  
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
  
  console.log(`\n  ✓ TENSORAPID completado: ${tensorSuccess} exitosos, ${tensorFail} fallidos\n`);

  console.log('\n========================================');
  console.log('        RESUMEN RE-IMPORTACIÓN');
  console.log('========================================');
  console.log(`TENSORAPID:  ${tensorSuccess} exitosos, ${tensorFail} fallidos`);
  console.log('========================================\n');

  if (tensorFail > 0) {
    console.log('⚠️  Errores en TENSORAPID (primeros 5):');
    tensorErrors.slice(0, 5).forEach(err => {
      console.log(`    ${err.testnr}: ${err.error.substring(0, 80)}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ ¡Re-importación completada exitosamente sin errores!\n');
  }
}

reimportTensorapid().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
