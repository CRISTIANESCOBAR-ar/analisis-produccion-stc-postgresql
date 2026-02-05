/**
 * Script de Importación para tb_DEFECTOS
 * Origen: C:\STC\CSV\rptDefPeca.csv
 * Hoja Excel: rptDefPeca
 * Estructura: 11 columnas sin duplicados
 * Registros esperados: ~2380
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

const CSV_PATH = 'C:\\STC\\CSV\\rptDefPeca.csv';

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
async function importDefectos() {
    let client;
    
    try {
        console.log('\n===========================================');
        console.log('INICIANDO IMPORTACIÓN DE tb_DEFECTOS');
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
            WHERE table_name = 'tb_defectos'
            ORDER BY ordinal_position
        `);
        console.log(`✓ Tabla tb_DEFECTOS tiene ${tableCheck.rows.length} columnas en PostgreSQL`);
        
        // 6. Limpiar tabla
        await client.query('DELETE FROM tb_DEFECTOS');
        console.log('✓ Tabla limpiada');
        
        // 7. Preparar inserción (orden fiel a CSV y SQLite)
        const insertSQL = `
            INSERT INTO tb_DEFECTOS (
                FILIAL, PARTIDA, PECA, ETIQUETA, ARTIGO, NM_MERC,
                COD_DEF, DESC_DEFEITO, PONTOS, QUALIDADE, DATA_PROD
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11
            )
        `;
        
        // 8. Importar datos
        console.log('\n--- Importando datos ---');
        let imported = 0;
        let skipped = 0;
        let withDate = 0;
        let withDefect = 0;
        let errors = [];
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            try {
                // Validar fecha
                const dataProd = record['DATA_PROD'] || null;
                if (dataProd && isValidDate(dataProd)) {
                    withDate++;
                }
                
                // Contar registros con código de defecto
                if (record['COD_DEF']) {
                    withDefect++;
                }
                
                const values = [
                    record['FILIAL'] || null,
                    record['PARTIDA'] || null,
                    record['PECA'] || null,
                    record['ETIQUETA'] || null,
                    record['ARTIGO'] || null,
                    record['NM_MERC'] || null,
                    record['COD_DEF'] || null,
                    record['DESC_DEFEITO'] || null,
                    record['PONTOS'] || null,
                    record['QUALIDADE'] || null,
                    dataProd
                ];
                
                await client.query(insertSQL, values);
                imported++;
                
                if (imported % 200 === 0) {
                    process.stdout.write(`\rProcesados: ${imported}/${records.length}`);
                }
                
            } catch (err) {
                skipped++;
                errors.push({
                    row: i + 2,
                    error: err.message,
                    partida: record['PARTIDA'],
                    cod_def: record['COD_DEF']
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
        console.log(`✓ Con fecha DATA_PROD válida: ${withDate}`);
        console.log(`✓ Con código de defecto: ${withDefect}`);
        console.log(`✗ Registros omitidos: ${skipped}`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${errors.length}`);
            if (errors.length <= 10) {
                errors.forEach(err => {
                    console.log(`  Fila ${err.row}: ${err.error} (PARTIDA: ${err.partida})`);
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
        
        const countResult = await client.query('SELECT COUNT(*) FROM tb_DEFECTOS');
        console.log(`✓ Total registros en PostgreSQL: ${countResult.rows[0].count}`);
        
        // Verificar columnas con datos
        const columnsWithData = await client.query(`
            SELECT 
                COUNT(CASE WHEN FILIAL IS NOT NULL THEN 1 END) as filial_count,
                COUNT(CASE WHEN PARTIDA IS NOT NULL THEN 1 END) as partida_count,
                COUNT(CASE WHEN ETIQUETA IS NOT NULL THEN 1 END) as etiqueta_count,
                COUNT(CASE WHEN ARTIGO IS NOT NULL THEN 1 END) as artigo_count,
                COUNT(CASE WHEN COD_DEF IS NOT NULL THEN 1 END) as cod_def_count,
                COUNT(CASE WHEN DESC_DEFEITO IS NOT NULL THEN 1 END) as desc_defeito_count,
                COUNT(CASE WHEN PONTOS IS NOT NULL THEN 1 END) as pontos_count,
                COUNT(CASE WHEN QUALIDADE IS NOT NULL THEN 1 END) as qualidade_count,
                COUNT(CASE WHEN DATA_PROD IS NOT NULL THEN 1 END) as data_prod_count
            FROM tb_DEFECTOS
        `);
        
        const dataCheck = columnsWithData.rows[0];
        console.log('\nColumnas con datos no nulos:');
        console.log(`  - FILIAL: ${dataCheck.filial_count}`);
        console.log(`  - PARTIDA: ${dataCheck.partida_count}`);
        console.log(`  - ETIQUETA: ${dataCheck.etiqueta_count}`);
        console.log(`  - ARTIGO: ${dataCheck.artigo_count}`);
        console.log(`  - COD_DEF: ${dataCheck.cod_def_count}`);
        console.log(`  - DESC_DEFEITO: ${dataCheck.desc_defeito_count}`);
        console.log(`  - PONTOS: ${dataCheck.pontos_count}`);
        console.log(`  - QUALIDADE: ${dataCheck.qualidade_count}`);
        console.log(`  - DATA_PROD: ${dataCheck.data_prod_count}`);
        
        // Muestra de datos
        const sample = await client.query(`
            SELECT FILIAL, PARTIDA, ETIQUETA, ARTIGO, COD_DEF, DESC_DEFEITO, QUALIDADE, DATA_PROD
            FROM tb_DEFECTOS 
            LIMIT 3
        `);
        
        console.log('\n--- Muestra de datos importados ---');
        sample.rows.forEach((row, idx) => {
            console.log(`\nRegistro ${idx + 1}:`);
            console.log(`  FILIAL: ${row.filial}`);
            console.log(`  PARTIDA: ${row.partida}`);
            console.log(`  ETIQUETA: ${row.etiqueta}`);
            console.log(`  ARTIGO: ${row.artigo}`);
            console.log(`  COD_DEF: ${row.cod_def}`);
            console.log(`  DESC_DEFEITO: ${row.desc_defeito}`);
            console.log(`  QUALIDADE: ${row.qualidade}`);
            console.log(`  DATA_PROD: ${row.data_prod}`);
        });
        
        // Estadísticas por calidad
        const qualityStats = await client.query(`
            SELECT QUALIDADE, COUNT(*) as cantidad
            FROM tb_DEFECTOS
            WHERE QUALIDADE IS NOT NULL
            GROUP BY QUALIDADE
            ORDER BY cantidad DESC
        `);
        
        if (qualityStats.rows.length > 0) {
            console.log('\n--- Distribución por QUALIDADE ---');
            qualityStats.rows.forEach(row => {
                console.log(`  ${row.qualidade}: ${row.cantidad} defectos`);
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
importDefectos();
