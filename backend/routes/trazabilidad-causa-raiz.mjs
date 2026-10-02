import express from 'express';
import { 
  construirQueryTrazabilidadCausaRaiz,
  procesarConsolidadoCausaRaiz,
  construirQueryTrazabilidadPorRolada,
  construirQueryCortesOE,
  construirQueryCortesEnergia,
  procesarTrazabilidadPorRolada,
  construirQueryHVI,
  procesarResultadosHVI
} from '../services/trazabilidadCausaRaizService.js';
import { defectoSectorMap } from '../utils/defectosSectores.mjs';

export default function(query) {
  const router = express.Router();

  /**
   * GET /api/produccion/trazabilidad-causa-raiz
   * Query params:
   *  - fecha_inicio: string (YYYY-MM-DD)
   *  - fecha_fin: string (YYYY-MM-DD)
   *  - cod_defecto: string (ej. '205')
   *  - lotes: string (ej. '129, 130')
   */
  router.get('/trazabilidad-causa-raiz', async (req, res) => {
    try {
      const {
        fecha_inicio = '',
        fecha_fin = '',
        cod_defecto = '205',
        lotes = ''
      } = req.query;

      const { sql, values } = construirQueryTrazabilidadCausaRaiz({
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
        codDefecto: cod_defecto,
        lotes: lotes
      });

      const result = await query(sql, values, 'trazabilidad-causa-raiz');
      const { data, kpis } = procesarConsolidadoCausaRaiz(result.rows);

      res.json({
        success: true,
        fechaInicio: fecha_inicio || null,
        fechaFin: fecha_fin || null,
        codDefecto: cod_defecto,
        kpis,
        data
      });
    } catch (error) {
      console.error('Error en /api/produccion/trazabilidad-causa-raiz:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno al consultar trazabilidad causa raíz'
      });
    }
  });

  /**
   * GET /api/produccion/trazabilidad-causa-raiz/por-rolada
   */
  router.get('/trazabilidad-causa-raiz/por-rolada', async (req, res) => {
    try {
      const { fecha_inicio, fecha_fin, cod_defecto, roladas } = req.query;
      
      // 1. Principal Query
      const { sql: sqlRolada, values: valRolada } = construirQueryTrazabilidadPorRolada({
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
        codigosDefecto: cod_defecto,
        roladas
      });
      const resRoladas = await query(sqlRolada, valRolada, 'traz-rolada-main');
      const roladasRows = resRoladas.rows || [];

      // Extraer lotes únicos
      const lotesSet = new Set();
      for (const r of roladasRows) {
        if (r.lotes_oe) {
          r.lotes_oe.split(',').forEach(l => {
            const trimmed = l.trim();
            if (trimmed) lotesSet.add(trimmed);
          });
        }
      }
      const lotes = Array.from(lotesSet);

      // 2. Query OE
      const { sql: sqlOE, values: valOE } = construirQueryCortesOE(lotes);
      let oeRows = [];
      if (lotes.length > 0) {
        const resOE = await query(sqlOE, valOE, 'traz-rolada-oe');
        oeRows = resOE.rows || [];
      }

      // 3. Query Energia
      const { sql: sqlE } = construirQueryCortesEnergia();
      const resE = await query(sqlE, [], 'traz-rolada-energia');
      const energiaRows = resE.rows || [];

      // 4. Query HVI
      const { sql: sqlHvi, values: valHvi } = construirQueryHVI(lotes);
      let hviMap = {};
      if (lotes.length > 0) {
        const resHvi = await query(sqlHvi, valHvi, 'traz-rolada-hvi');
        hviMap = procesarResultadosHVI(resHvi.rows || []);
      }

      // 5. Procesar
      const { data, maquinasOE } = procesarTrazabilidadPorRolada(roladasRows, oeRows, energiaRows, hviMap);

      res.json({
        success: true,
        data,
        maquinasOE,
        fechaInicio: fecha_inicio || null,
        fechaFin: fecha_fin || null,
        codigosDefecto: cod_defecto
      });
    } catch (error) {
      console.error('Error en /por-rolada:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/produccion/trazabilidad-causa-raiz/sectores-defectos
   */
  router.get('/trazabilidad-causa-raiz/sectores-defectos', async (req, res) => {
    try {
      const defRes = await query(`
        SELECT DISTINCT "COD_DEF", "DESC_DEFEITO" as "DESC_DEF" 
        FROM tb_defectos 
        WHERE "COD_DEF" IS NOT NULL AND "COD_DEF" <> ''
        ORDER BY "COD_DEF" ASC
      `);
      
      const sectores = new Set(['TODOS']);
      const defectos = [];

      for (const row of (defRes.rows || [])) {
        const cod = row.COD_DEF ? String(row.COD_DEF).trim() : '';
        const sector = defectoSectorMap[parseInt(cod, 10)] || 'DESCONOCIDO';
        sectores.add(sector);
        defectos.push({
          cod,
          desc: row.DESC_DEF ? row.DESC_DEF.trim() : '',
          sector
        });
      }

      res.json({
        success: true,
        sectores: Array.from(sectores),
        defectos
      });
    } catch (error) {
      console.error('Error en /sectores-defectos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
