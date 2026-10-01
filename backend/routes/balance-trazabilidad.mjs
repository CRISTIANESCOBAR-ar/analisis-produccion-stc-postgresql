import express from 'express';
import { construirQueryBalance, procesarConsolidado } from '../services/balanceTrazabilidadService.js';

export default function(query) {
  const router = express.Router();

  /**
   * GET /api/produccion/balance-trazabilidad
   * Query params:
   *  - fecha_inicio: string (YYYY-MM-DD)
   *  - fecha_fin: string (YYYY-MM-DD)
   *  - sector_matriz: 'INTEGRADA' | 'TECELAGEM' | 'CALIDAD' (default 'INTEGRADA')
   *  - search: string (opcional)
   */
  router.get('/balance-trazabilidad', async (req, res) => {
    try {
      const {
        fecha_inicio = '',
        fecha_fin = '',
        sector_matriz = 'INTEGRADA',
        search = ''
      } = req.query;

      const { sql, values } = construirQueryBalance({
        sectorMatriz: sector_matriz,
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
        search
      });

      const result = await query(sql, values, 'balance-trazabilidad');
      const { partidas, kpis } = procesarConsolidado(result.rows);

      res.json({
        success: true,
        sectorMatriz: sector_matriz,
        fechaInicio: fecha_inicio || null,
        fechaFin: fecha_fin || null,
        total: partidas.length,
        kpis,
        data: partidas
      });
    } catch (error) {
      console.error('Error en /api/produccion/balance-trazabilidad:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno al consultar balance de trazabilidad'
      });
    }
  });

  return router;
}
