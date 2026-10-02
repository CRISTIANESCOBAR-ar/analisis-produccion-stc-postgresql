import express from 'express';
import { 
  construirQueryTrazabilidadCausaRaiz,
  procesarConsolidadoCausaRaiz
} from '../services/trazabilidadCausaRaizService.js';

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

  return router;
}
