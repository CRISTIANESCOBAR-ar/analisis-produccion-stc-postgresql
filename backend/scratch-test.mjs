import { query } from './db.js';
import { construirQueryTrazabilidadCausaRaiz } from './services/trazabilidadCausaRaizService.js';

async function test() {
  try {
    console.log("Generando query...");
    const { sql, values } = construirQueryTrazabilidadCausaRaiz({
      fechaInicio: '2026-09-01',
      fechaFin: '2026-10-01',
      codDefecto: '205',
      lotes: ''
    });
    
    console.log("Ejecutando query en DB...");
    const result = await query(sql, values);
    console.log("OK, filas:", result.rows.length);
  } catch (error) {
    console.error("ERROR EN DB:", error.message);
  }
  process.exit();
}

test();
