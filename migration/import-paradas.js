/**
 * Script de Importación para tb_PARADAS
 * Origen: C:\STC\CSV\rptParadaMaquinaPRD.csv
 * Hoja Excel: rptpm
 * Estructura: 54 columnas con 2 duplicados (MOTIVO, COR)
 * Registros esperados: ~281
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

const CSV_PATH = 'C:\\STC\\CSV\\rptParadaMaquinaPRD.csv';

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
async function importParadas() {
    let client;
    
    try {
        console.log('\n===========================================');
        console.log('INICIANDO IMPORTACIÓN DE tb_PARADAS');
        console.log('===========================================\n');
        
        // 1. Verificar que el archivo CSV exista
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error(`Archivo CSV no encontrado: ${CSV_PATH}`);
        }
        console.log(`✓ Archivo encontrado: ${CSV_PATH}`);
        
        // 2. Leer CSV y renombrar headers duplicados ANTES de parsear
        let fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = fileContent.split('\n');
        const headerLine = lines[0];
        
        console.log('\n--- Procesando headers duplicados ---');
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const seen = {};
        const renamedHeaders = [];
        
        headers.forEach((header) => {
            if (!seen[header]) {
                seen[header] = 1;
                renamedHeaders.push(header);
            } else {
                seen[header]++;
                const newName = `${header}${seen[header] - 1}`;
                console.log(`  Renombrando: "${header}" (duplicado ${seen[header]}) → "${newName}"`);
                renamedHeaders.push(newName);
            }
        });
        
        // Reemplazar la línea de headers
        lines[0] = renamedHeaders.map(h => `"${h}"`).join(',');
        fileContent = lines.join('\n');
        
        console.log(`✓ Headers procesados: ${renamedHeaders.length} columnas`);
        
        // 3. Parsear CSV
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
        
        // 4. Mostrar columnas detectadas
        if (records.length > 0) {
            const columns = Object.keys(records[0]);
            console.log(`\n--- Columnas detectadas: ${columns.length} ---`);
            console.log('Primeras 15:');
            columns.slice(0, 15).forEach((col, idx) => {
                console.log(`  ${idx + 1}. "${col}"`);
            });
            console.log(`... y ${columns.length - 15} más`);
            
            // Mostrar duplicados renombrados
            console.log('\nColumnas duplicadas renombradas:');
            columns.filter(c => c.match(/\d$/)).forEach(col => {
                console.log(`  - ${col}`);
            });
        }
        
        // 5. Conectar a PostgreSQL
        console.log('\n--- Conectando a PostgreSQL ---');
        client = await pool.connect();
        console.log('✓ Conexión establecida');
        
        // 6. Verificar tabla
        const tableCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tb_paradas'
            ORDER BY ordinal_position
        `);
        console.log(`✓ Tabla tb_PARADAS tiene ${tableCheck.rows.length} columnas en PostgreSQL`);
        
        // 7. Limpiar tabla
        await client.query('DELETE FROM tb_PARADAS');
        console.log('✓ Tabla limpiada');
        
        // 8. Preparar inserción (orden fiel a SQLite - 54 columnas)
        const insertSQL = `
            INSERT INTO tb_PARADAS (
                FILIAL, MAQUINA, TP_MAQ, PROCESSO, DATA_BASE,
                HORA_INICIO, HORA_FINAL, TURNO, DURACAO, "NUM OCORREN",
                OPERADOR, NOME_OPER, MOTIVO, DESC_MOTIVO, GRUPO,
                DESC_GRP_MOTIVO, CAUSA, DESC_CAUSA, LADO, POSICAO,
                PARTIDA, URDUME, INDIGO, DATA_TINGIMENT, TURNO_TING,
                STATUS_INDIG, OPER_TING, NOME_OPER_TING, GRUPO_MAQ, OBS,
                PARTIDA_ORIGINAL, CV_ORIG, ST_ORIG, OBS_ORIG, PARTIDA_ANTERIOR,
                CV_ANT, ST_ANT, OBS_ANT, PARTIDA_POSTERIOR, CV_POS,
                ST_POS, OBS_POS, ROLADA, "ID TROCA ROLADA", MOTIVO1,
                "DESCRICAO MOTIVO", "ROLADA INICIAL", COR, "ROLADA FINAL", COR1,
                "OBS TROCA ROLADA", "TEMPO PREVISTO", "SUB-GRUPO", "DESC SUB-GRUPO"
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25,
                $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35,
                $36, $37, $38, $39, $40,
                $41, $42, $43, $44, $45,
                $46, $47, $48, $49, $50,
                $51, $52, $53, $54
            )
        `;
        
        // 9. Importar datos (filtrando headers duplicados)
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
                const dataBase = record['DATA_BASE'] || null;
                if (dataBase && isValidDate(dataBase)) {
                    withDate++;
                }
                
                const values = [
                    record['FILIAL'] || null,
                    record['MAQUINA'] || null,
                    record['TP_MAQ'] || null,
                    record['PROCESSO'] || null,
                    dataBase,
                    record['HORA_INICIO'] || null,
                    record['HORA_FINAL'] || null,
                    record['TURNO'] || null,
                    record['DURACAO'] || null,
                    record['NUM OCORREN'] || null,
                    record['OPERADOR'] || null,
                    record['NOME_OPER'] || null,
                    record['MOTIVO'] || null,
                    record['DESC_MOTIVO'] || null,
                    record['GRUPO'] || null,
                    record['DESC_GRP_MOTIVO'] || null,
                    record['CAUSA'] || null,
                    record['DESC_CAUSA'] || null,
                    record['LADO'] || null,
                    record['POSICAO'] || null,
                    record['PARTIDA'] || null,
                    record['URDUME'] || null,
                    record['INDIGO'] || null,
                    record['DATA_TINGIMENT'] || null,
                    record['TURNO_TING'] || null,
                    record['STATUS_INDIG'] || null,
                    record['OPER_TING'] || null,
                    record['NOME_OPER_TING'] || null,
                    record['GRUPO_MAQ'] || null,
                    record['OBS'] || null,
                    record['PARTIDA_ORIGINAL'] || null,
                    record['CV_ORIG'] || null,
                    record['ST_ORIG'] || null,
                    record['OBS_ORIG'] || null,
                    record['PARTIDA_ANTERIOR'] || null,
                    record['CV_ANT'] || null,
                    record['ST_ANT'] || null,
                    record['OBS_ANT'] || null,
                    record['PARTIDA_POSTERIOR'] || null,
                    record['CV_POS'] || null,
                    record['ST_POS'] || null,
                    record['OBS_POS'] || null,
                    record['ROLADA'] || null,
                    record['ID TROCA ROLADA'] || null,
                    record['MOTIVO1'] || null, // Segunda columna MOTIVO renombrada
                    record['DESCRICAO MOTIVO'] || null,
                    record['ROLADA INICIAL'] || null,
                    record['COR'] || null,
                    record['ROLADA FINAL'] || null,
                    record['COR1'] || null, // Segunda columna COR renombrada
                    record['OBS TROCA ROLADA'] || null,
                    record['TEMPO PREVISTO'] || null,
                    record['SUB-GRUPO'] || null,
                    record['DESC SUB-GRUPO'] || null
                ];
                
                await client.query(insertSQL, values);
                imported++;
                
                if (imported % 50 === 0) {
                    process.stdout.write(`\rProcesados: ${imported}/${records.length}`);
                }
                
            } catch (err) {
                skipped++;
                errors.push({
                    row: i + 2,
                    error: err.message,
                    maquina: record['MAQUINA'],
                    data: record['DATA_BASE']
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
        console.log(`✓ Con fecha DATA_BASE válida: ${withDate}`);
        console.log(`✗ Registros con errores: ${skipped}`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Errores encontrados: ${errors.length}`);
            errors.slice(0, 10).forEach(err => {
                console.log(`  Fila ${err.row}: ${err.error} (MAQUINA: ${err.maquina})`);
            });
        }
        
        // 10. Verificar datos importados
        console.log('\n--- Verificación de datos ---');
        
        const countResult = await client.query('SELECT COUNT(*) FROM tb_PARADAS');
        console.log(`✓ Total registros en PostgreSQL: ${countResult.rows[0].count}`);
        
        // Verificar columnas con datos
        const columnsWithData = await client.query(`
            SELECT 
                COUNT(CASE WHEN FILIAL IS NOT NULL THEN 1 END) as filial_count,
                COUNT(CASE WHEN MAQUINA IS NOT NULL THEN 1 END) as maquina_count,
                COUNT(CASE WHEN DATA_BASE IS NOT NULL THEN 1 END) as data_base_count,
                COUNT(CASE WHEN TURNO IS NOT NULL THEN 1 END) as turno_count,
                COUNT(CASE WHEN MOTIVO IS NOT NULL THEN 1 END) as motivo_count,
                COUNT(CASE WHEN DESC_MOTIVO IS NOT NULL THEN 1 END) as desc_motivo_count,
                COUNT(CASE WHEN MOTIVO1 IS NOT NULL THEN 1 END) as motivo1_count,
                COUNT(CASE WHEN COR IS NOT NULL THEN 1 END) as cor_count,
                COUNT(CASE WHEN COR1 IS NOT NULL THEN 1 END) as cor1_count
            FROM tb_PARADAS
        `);
        
        const dataCheck = columnsWithData.rows[0];
        console.log('\nColumnas principales con datos no nulos:');
        console.log(`  - FILIAL: ${dataCheck.filial_count}`);
        console.log(`  - MAQUINA: ${dataCheck.maquina_count}`);
        console.log(`  - DATA_BASE: ${dataCheck.data_base_count}`);
        console.log(`  - TURNO: ${dataCheck.turno_count}`);
        console.log(`  - MOTIVO: ${dataCheck.motivo_count}`);
        console.log(`  - DESC_MOTIVO: ${dataCheck.desc_motivo_count}`);
        console.log(`  - MOTIVO1: ${dataCheck.motivo1_count} (duplicado)`);
        console.log(`  - COR: ${dataCheck.cor_count}`);
        console.log(`  - COR1: ${dataCheck.cor1_count} (duplicado)`);
        
        // Muestra de datos
        const sample = await client.query(`
            SELECT FILIAL, MAQUINA, DATA_BASE, TURNO, MOTIVO, DESC_MOTIVO, MOTIVO1
            FROM tb_PARADAS 
            LIMIT 3
        `);
        
        console.log('\n--- Muestra de datos importados ---');
        sample.rows.forEach((row, idx) => {
            console.log(`\nRegistro ${idx + 1}:`);
            console.log(`  FILIAL: ${row.filial}`);
            console.log(`  MAQUINA: ${row.maquina}`);
            console.log(`  DATA_BASE: ${row.data_base}`);
            console.log(`  TURNO: ${row.turno}`);
            console.log(`  MOTIVO: ${row.motivo}`);
            console.log(`  DESC_MOTIVO: ${row.desc_motivo}`);
            console.log(`  MOTIVO1: ${row.motivo1}`);
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
importParadas();
