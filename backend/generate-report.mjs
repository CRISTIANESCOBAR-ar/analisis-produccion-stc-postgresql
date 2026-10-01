import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { processReportData } from './report-titulo.js';

const pool = new pg.Pool({
    user: 'stc_user',
    host: 'localhost',
    database: 'stc_produccion',
    password: 'stc_password_2026',
    port: 5433
});

async function run() {
    try {
        const query = `
            SELECT data_producao, "TÍTULO" as titulo, maquina, lado, turno 
            FROM tb_produccion_oe 
            WHERE data_producao ILIKE '%2026%'
              AND "TÍTULO" IN ('12.5', '12,5')
            ORDER BY data_producao ASC;
        `;
        // Nota: data_producao está importado como texto (dd/mm/yyyy o similar) basado en el esquema.
        
        const res = await pool.query(query);
        const rawData = res.rows;
        
        if (rawData.length === 0) {
            console.log("No data found for 12.5 in 2026");
            fs.writeFileSync('reporte_output.json', JSON.stringify({ headers: [], rows: [] }));
            return;
        }

        const { headers, rows } = processReportData(rawData, '12.5');

        // Create CSV
        const csvLines = [];
        csvLines.push(headers.join(','));
        for (const r of rows) {
            const line = headers.map(h => {
                let v = String(r[h] || '').replace(/"/g, '""');
                return v.includes(',') ? `"${v}"` : v;
            });
            csvLines.push(line.join(','));
        }
        
        const csvPath = path.join(process.cwd(), 'reporte_titulo_12_5_2026.csv');
        fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
        
        // Dump JSON for the assistant to read and render Markdown Table
        fs.writeFileSync('reporte_output.json', JSON.stringify({ headers, rows }, null, 2), 'utf-8');
        
        console.log(`Report generated with ${rows.length} rows.`);
        console.log(`CSV saved to ${csvPath}`);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}
run();
