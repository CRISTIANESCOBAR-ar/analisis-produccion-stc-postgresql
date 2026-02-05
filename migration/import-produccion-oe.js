/**
 * Script de Importación para tb_PRODUCCION_OE
 * Origen: C:\STC\CSV\rptProducaoOE.csv
 * Hoja Excel: rptProducaoOE
 * Estructura: 45 columnas sin duplicados
 * Registros esperados: ~7673
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

const CSV_PATH = 'C:\\STC\\CSV\\rptProducaoOE.csv';

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
async function importProduccionOE() {
    let client;
    
    try {
        console.log('\n===========================================');
        console.log('INICIANDO IMPORTACIÓN DE tb_PRODUCCION_OE');
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
            console.log('Primeras 10:');
            columns.slice(0, 10).forEach((col, idx) => {
                console.log(`  ${idx + 1}. "${col}"`);
            });
            console.log(`... y ${columns.length - 10} más`);
        }
        
        // 4. Conectar a PostgreSQL
        console.log('\n--- Conectando a PostgreSQL ---');
        client = await pool.connect();
        console.log('✓ Conexión establecida');
        
        // 5. Verificar tabla
        const tableCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tb_produccion_oe'
            ORDER BY ordinal_position
        `);
        console.log(`✓ Tabla tb_PRODUCCION_OE tiene ${tableCheck.rows.length} columnas en PostgreSQL`);
        
        // 6. Limpiar tabla
        await client.query('DELETE FROM tb_PRODUCCION_OE');
        console.log('✓ Tabla limpiada');
        
        // 7. Preparar inserción (orden fiel a CSV y SQLite - 45 columnas)
        const insertSQL = `
            INSERT INTO tb_PRODUCCION_OE (
                FILIAL, "LOC. FISICO", MAQUINA, NOME_MAQUINA, DATA_PRODUCAO,
                TURNO, LADO, ITEM, "DESC ITEM", "HORA INICIAL",
                "HORA FINAL", RPM, "NUM FUSOS", ALFA, "LOTE PRODUC",
                "TÍTULO", TEMPO, "TORCAO P POLEG", "TORCAO P METRO", "PROD MT/MIN",
                "PROD KG/HR", "PROD CALCULADA", "PROD INFORMADA", "EFIC CALCULADA", "EFIC INFORMADA",
                OPERADOR, "T.BOB.", "RPM CARD", N, S,
                L, T, MO, "CP V+ SL+", "CM V- SL-",
                "CCp C+", "CCm C-", "JP (P+)", "JM (P-)", CVP,
                CVM, "CORT NAT", "% ROB 01", "% ROB 02", "% ROB 03"
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25,
                $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35,
                $36, $37, $38, $39, $40,
                $41, $42, $43, $44, $45
            )
        `;
        
        // 8. Importar datos (filtrando headers duplicados)
        console.log('\n--- Importando datos ---');
        let imported = 0;
        let skipped = 0;
        let withDate = 0;
        let headersSkipped = 0;
        let errors = [];
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            // Filtrar headers duplicados (registros donde FILIAL = "FILIAL")
            if (record['FILIAL'] === 'FILIAL') {
                headersSkipped++;
                continue;
            }
            
            try {
                // Validar fecha
                const dataProducao = record['DATA_PRODUCAO'] || null;
                if (dataProducao && isValidDate(dataProducao)) {
                    withDate++;
                }
                
                const values = [
                    record['FILIAL'] || null,
                    record['LOC. FISICO'] || null,
                    record['MAQUINA'] || null,
                    record['NOME_MAQUINA'] || null,
                    dataProducao,
                    record['TURNO'] || null,
                    record['LADO'] || null,
                    record['ITEM'] || null,
                    record['DESC ITEM'] || null,
                    record['HORA INICIAL'] || null,
                    record['HORA FINAL'] || null,
                    record['RPM'] || null,
                    record['NUM FUSOS'] || null,
                    record['ALFA'] || null,
                    record['LOTE PRODUC'] || null,
                    record['TÍTULO'] || null,
                    record['TEMPO'] || null,
                    record['TORCAO P POLEG'] || null,
                    record['TORCAO P METRO'] || null,
                    record['PROD MT/MIN'] || null,
                    record['PROD KG/HR'] || null,
                    record['PROD CALCULADA'] || null,
                    record['PROD INFORMADA'] || null,
                    record['EFIC CALCULADA'] || null,
                    record['EFIC INFORMADA'] || null,
                    record['OPERADOR'] || null,
                    record['T.BOB.'] || null,
                    record['RPM CARD'] || null,
                    record['N'] || null,
                    record['S'] || null,
                    record['L'] || null,
                    record['T'] || null,
                    record['MO'] || null,
                    record['CP V+ SL+'] || null,
                    record['CM V- SL-'] || null,
                    record['CCp C+'] || null,
                    record['CCm C-'] || null,
                    record['JP (P+)'] || null,
                    record['JM (P-)'] || null,
                    record['CVP'] || null,
                    record['CVM'] || null,
                    record['CORT NAT'] || null,
                    record['% ROB 01'] || null,
                    record['% ROB 02'] || null,
                    record['% ROB 03'] || null
                ];
                
                await client.query(insertSQL, values);
                imported++;
                
                if (imported % 500 === 0) {
                    process.stdout.write(`\rProcesados: ${imported}/${records.length}`);
                }
                
            } catch (err) {
                skipped++;
                errors.push({
                    row: i + 2,
                    error: err.message,
                    maquina: record['MAQUINA'],
                    data: record['DATA_PRODUCAO']
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
        console.log(`✓ Headers duplicados omitidos: ${headersSkipped}`);
        console.log(`✓ Registros importados: ${imported}`);
        console.log(`✓ Con fecha DATA_PRODUCAO válida: ${withDate}`);
        console.log(`✗ Registros con errores: ${skipped}`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${errors.length}`);
            if (errors.length <= 10) {
                errors.forEach(err => {
                    console.log(`  Fila ${err.row}: ${err.error} (MAQUINA: ${err.maquina})`);
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
        
        const countResult = await client.query('SELECT COUNT(*) FROM tb_PRODUCCION_OE');
        console.log(`✓ Total registros en PostgreSQL: ${countResult.rows[0].count}`);
        
        // Verificar columnas con datos
        const columnsWithData = await client.query(`
            SELECT 
                COUNT(CASE WHEN FILIAL IS NOT NULL THEN 1 END) as filial_count,
                COUNT(CASE WHEN MAQUINA IS NOT NULL THEN 1 END) as maquina_count,
                COUNT(CASE WHEN DATA_PRODUCAO IS NOT NULL THEN 1 END) as data_producao_count,
                COUNT(CASE WHEN TURNO IS NOT NULL THEN 1 END) as turno_count,
                COUNT(CASE WHEN ITEM IS NOT NULL THEN 1 END) as item_count,
                COUNT(CASE WHEN "TÍTULO" IS NOT NULL THEN 1 END) as titulo_count,
                COUNT(CASE WHEN "PROD CALCULADA" IS NOT NULL THEN 1 END) as prod_calculada_count,
                COUNT(CASE WHEN "EFIC CALCULADA" IS NOT NULL THEN 1 END) as efic_calculada_count,
                COUNT(CASE WHEN OPERADOR IS NOT NULL THEN 1 END) as operador_count
            FROM tb_PRODUCCION_OE
        `);
        
        const dataCheck = columnsWithData.rows[0];
        console.log('\nColumnas principales con datos no nulos:');
        console.log(`  - FILIAL: ${dataCheck.filial_count}`);
        console.log(`  - MAQUINA: ${dataCheck.maquina_count}`);
        console.log(`  - DATA_PRODUCAO: ${dataCheck.data_producao_count}`);
        console.log(`  - TURNO: ${dataCheck.turno_count}`);
        console.log(`  - ITEM: ${dataCheck.item_count}`);
        console.log(`  - TÍTULO: ${dataCheck.titulo_count}`);
        console.log(`  - PROD CALCULADA: ${dataCheck.prod_calculada_count}`);
        console.log(`  - EFIC CALCULADA: ${dataCheck.efic_calculada_count}`);
        console.log(`  - OPERADOR: ${dataCheck.operador_count}`);
        
        // Muestra de datos
        const sample = await client.query(`
            SELECT FILIAL, MAQUINA, DATA_PRODUCAO, TURNO, ITEM, "TÍTULO", 
                   "PROD CALCULADA", "EFIC CALCULADA"
            FROM tb_PRODUCCION_OE 
            LIMIT 3
        `);
        
        console.log('\n--- Muestra de datos importados ---');
        sample.rows.forEach((row, idx) => {
            console.log(`\nRegistro ${idx + 1}:`);
            console.log(`  FILIAL: ${row.filial}`);
            console.log(`  MAQUINA: ${row.maquina}`);
            console.log(`  DATA_PRODUCAO: ${row.data_producao}`);
            console.log(`  TURNO: ${row.turno}`);
            console.log(`  ITEM: ${row.item}`);
            console.log(`  TÍTULO: ${row['TÍTULO']}`);
            console.log(`  PROD CALCULADA: ${row['PROD CALCULADA']}`);
            console.log(`  EFIC CALCULADA: ${row['EFIC CALCULADA']}`);
        });
        
        // Estadísticas por turno
        const turnoStats = await client.query(`
            SELECT TURNO, COUNT(*) as cantidad
            FROM tb_PRODUCCION_OE
            WHERE TURNO IS NOT NULL
            GROUP BY TURNO
            ORDER BY TURNO
        `);
        
        if (turnoStats.rows.length > 0) {
            console.log('\n--- Distribución por TURNO ---');
            turnoStats.rows.forEach(row => {
                console.log(`  Turno ${row.turno}: ${row.cantidad} registros`);
            });
        }
        
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
importProduccionOE();
