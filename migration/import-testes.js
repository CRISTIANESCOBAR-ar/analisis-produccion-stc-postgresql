/**
 * Script de Importación para tb_TESTES
 * Origen: C:\STC\CSV\rptPrdTestesFisicos.csv
 * Hoja Excel: report2
 * Estructura: 26 columnas sin duplicados
 * Registros esperados: ~1000-2000
 */

const fs = require('fs');
const csv = require('csv-parse');
const { Pool } = require('pg');

// Configuración de PostgreSQL
const pool = new Pool({
    user: 'stc_user',
    host: 'localhost',
    database: 'stc_produccion',
    password: 'stc_password_2026',
    port: 5433
});

const CSV_PATH = 'C:\\STC\\CSV\\rptPrdTestesFisicos.csv';

/**
 * Validar formato de fecha DD/MM/YYYY
 */
function isValidDate(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    return regex.test(dateStr);
}

/**
 * Main: Importar datos de CSV a PostgreSQL
 */
async function importTestes() {
    let client;
    
    try {
        console.log('\n===========================================');
        console.log('INICIANDO IMPORTACIÓN DE tb_TESTES');
        console.log('===========================================\n');
        
        // 1. Verificar que el archivo CSV exista
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error(`Archivo CSV no encontrado: ${CSV_PATH}`);
        }
        console.log(`✓ Archivo encontrado: ${CSV_PATH}`);
        
        // 2. Leer CSV
        const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
        
        console.log('\n--- Parseando CSV ---');
        const records = [];
        const parser = csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true
        });
        
        for await (const record of parser) {
            records.push(record);
        }
        
        console.log(`✓ Total registros en CSV: ${records.length}`);
        
        // 3. Mostrar columnas detectadas
        if (records.length > 0) {
            const columns = Object.keys(records[0]);
            console.log(`\n--- Columnas detectadas: ${columns.length} ---`);
            columns.forEach((col, idx) => {
                console.log(`  ${idx + 1}. "${col}"`);
            });
        }
        
        // 4. Conectar a PostgreSQL
        console.log('\n--- Conectando a PostgreSQL ---');
        client = await pool.connect();
        console.log('✓ Conexión establecida');
        
        // 5. Verificar tabla
        const tableCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tb_testes'
            ORDER BY ordinal_position
        `);
        console.log(`✓ Tabla tb_TESTES tiene ${tableCheck.rows.length} columnas en PostgreSQL`);
        
        // 6. Limpiar tabla
        await client.query('DELETE FROM tb_TESTES');
        console.log('✓ Tabla limpiada');
        
        // 7. Preparar inserción (orden fiel a CSV y SQLite)
        const insertSQL = `
            INSERT INTO tb_TESTES (
                MAQUINA, ARTIGO, NM_MERC, PARTIDA, METRAGEM,
                DT_PROD, HORA_PROD, TURNO,
                LARG_AL, GRAMAT, POTEN,
                "%_ENC_URD", "%_ENC_TRAMA",
                "%_SK1", "%_SK2", "%_SK3", "%_SK4",
                "%_SKE", "%_STT", "%_SKM",
                APROV, COD_ART, COR_ART, OBS, REPROCESSO, "SEQ TESTE"
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11,
                $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20,
                $21, $22, $23, $24, $25, $26
            )
        `;
        
        // 8. Importar datos
        console.log('\n--- Importando datos ---');
        let imported = 0;
        let skipped = 0;
        let withDate = 0;
        let errors = [];
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            try {
                // Validar fecha
                const dtProd = record['DT_PROD'] || null;
                if (dtProd && isValidDate(dtProd)) {
                    withDate++;
                }
                
                const values = [
                    record['MAQUINA'] || null,
                    record['ARTIGO'] || null,
                    record['NM_MERC'] || null,
                    record['PARTIDA'] || null,
                    record['METRAGEM'] || null,
                    dtProd,
                    record['HORA_PROD'] || null,
                    record['TURNO'] || null,
                    record['LARG_AL'] || null,
                    record['GRAMAT'] || null,
                    record['POTEN'] || null,
                    record['%_ENC_URD'] || null,
                    record['%_ENC_TRAMA'] || null,
                    record['%_SK1'] || null,
                    record['%_SK2'] || null,
                    record['%_SK3'] || null,
                    record['%_SK4'] || null,
                    record['%_SKE'] || null,
                    record['%_STT'] || null,
                    record['%_SKM'] || null,
                    record['APROV'] || null,
                    record['COD_ART'] || null,
                    record['COR_ART'] || null,
                    record['OBS'] || null,
                    record['REPROCESSO'] || null,
                    record['SEQ TESTE'] || null
                ];
                
                await client.query(insertSQL, values);
                imported++;
                
                if (imported % 100 === 0) {
                    process.stdout.write(`\rProcesados: ${imported}/${records.length}`);
                }
                
            } catch (err) {
                skipped++;
                errors.push({
                    row: i + 2, // +2 porque la primera fila es header y empezamos en 0
                    error: err.message,
                    artigo: record['ARTIGO'],
                    partida: record['PARTIDA']
                });
                
                if (errors.length <= 5) {
                    console.log(`\n⚠️  Error en fila ${i + 2}: ${err.message}`);
                }
            }
        }
        
        console.log(`\n\n===========================================`);
        console.log('RESUMEN DE IMPORTACIÓN');
        console.log('===========================================');
        console.log(`Total registros en CSV: ${records.length}`);
        console.log(`✓ Registros importados: ${imported}`);
        console.log(`✓ Con fecha DT_PROD válida: ${withDate}`);
        console.log(`✗ Registros omitidos: ${skipped}`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${errors.length}`);
            if (errors.length <= 10) {
                errors.forEach(err => {
                    console.log(`  Fila ${err.row}: ${err.error} (ARTIGO: ${err.artigo}, PARTIDA: ${err.partida})`);
                });
            } else {
                console.log(`  (Mostrando primeros 10)`);
                errors.slice(0, 10).forEach(err => {
                    console.log(`  Fila ${err.row}: ${err.error}`);
                });
            }
        }
        
        // 9. Verificar datos importados
        console.log('\n--- Verificación de datos ---');
        
        const countResult = await client.query('SELECT COUNT(*) FROM tb_TESTES');
        console.log(`✓ Total registros en PostgreSQL: ${countResult.rows[0].count}`);
        
        // Verificar columnas con datos
        const columnsWithData = await client.query(`
            SELECT 
                COUNT(CASE WHEN MAQUINA IS NOT NULL THEN 1 END) as maquina_count,
                COUNT(CASE WHEN ARTIGO IS NOT NULL THEN 1 END) as artigo_count,
                COUNT(CASE WHEN PARTIDA IS NOT NULL THEN 1 END) as partida_count,
                COUNT(CASE WHEN DT_PROD IS NOT NULL THEN 1 END) as dt_prod_count,
                COUNT(CASE WHEN LARG_AL IS NOT NULL THEN 1 END) as larg_al_count,
                COUNT(CASE WHEN GRAMAT IS NOT NULL THEN 1 END) as gramat_count,
                COUNT(CASE WHEN "%_ENC_URD" IS NOT NULL THEN 1 END) as enc_urd_count,
                COUNT(CASE WHEN "%_SK1" IS NOT NULL THEN 1 END) as sk1_count,
                COUNT(CASE WHEN METRAGEM IS NOT NULL THEN 1 END) as metragem_count
            FROM tb_TESTES
        `);
        
        const dataCheck = columnsWithData.rows[0];
        console.log('\nColumnas con datos no nulos:');
        console.log(`  - MAQUINA: ${dataCheck.maquina_count}`);
        console.log(`  - ARTIGO: ${dataCheck.artigo_count}`);
        console.log(`  - PARTIDA: ${dataCheck.partida_count}`);
        console.log(`  - DT_PROD: ${dataCheck.dt_prod_count}`);
        console.log(`  - LARG_AL: ${dataCheck.larg_al_count}`);
        console.log(`  - GRAMAT: ${dataCheck.gramat_count}`);
        console.log(`  - %_ENC_URD: ${dataCheck.enc_urd_count}`);
        console.log(`  - %_SK1: ${dataCheck.sk1_count}`);
        console.log(`  - METRAGEM: ${dataCheck.metragem_count}`);
        
        // Muestra de datos
        const sample = await client.query(`
            SELECT MAQUINA, ARTIGO, PARTIDA, DT_PROD, LARG_AL, GRAMAT, "%_ENC_URD", METRAGEM
            FROM tb_TESTES 
            LIMIT 3
        `);
        
        console.log('\n--- Muestra de datos importados ---');
        sample.rows.forEach((row, idx) => {
            console.log(`\nRegistro ${idx + 1}:`);
            console.log(`  MAQUINA: ${row.maquina}`);
            console.log(`  ARTIGO: ${row.artigo}`);
            console.log(`  PARTIDA: ${row.partida}`);
            console.log(`  DT_PROD: ${row.dt_prod}`);
            console.log(`  LARG_AL: ${row.larg_al}`);
            console.log(`  GRAMAT: ${row.gramat}`);
            console.log(`  %_ENC_URD: ${row['%_ENC_URD']}`);
            console.log(`  METRAGEM: ${row.metragem}`);
        });
        
        console.log('\n✅ IMPORTACIÓN COMPLETADA\n');
        
    } catch (error) {
        console.error('\n❌ ERROR EN IMPORTACIÓN:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Ejecutar importación
importTestes();
