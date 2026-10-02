import express from 'express';
import { 
  construirQueryCalibracion, 
  procesarResultadosCalibracion, 
  construirQueryDefectosCatalogo 
} from '../services/calibracionRevisoresService.js';

export default function(query) {
  const router = express.Router();

  /**
   * GET /api/produccion/calibracion-revisores/defectos-catalogo
   * Retorna lista de defectos disponibles
   */
  router.get('/calibracion-revisores/defectos-catalogo', async (req, res) => {
    try {
      const { sql, values } = construirQueryDefectosCatalogo();
      const result = await query(sql, values, 'defectos-catalogo');
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error en /api/produccion/calibracion-revisores/defectos-catalogo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno al consultar el catálogo de defectos'
      });
    }
  });

  /**
   * GET /api/produccion/calibracion-revisores
   * Query params:
   *  - fecha_inicio: string (YYYY-MM-DD)
   *  - fecha_fin: string (YYYY-MM-DD)
   *  - cod_defecto: string (ej. '205')
   */
  router.get('/calibracion-revisores', async (req, res) => {
    try {
      const {
        fecha_inicio = '',
        fecha_fin = '',
        cod_defecto = '205'
      } = req.query;

      const { sql, values } = construirQueryCalibracion({
        fechaInicio: fecha_inicio,
        fechaFin: fecha_fin,
        codDefecto: cod_defecto
      });

      const result = await query(sql, values, 'calibracion-revisores');
      const procesado = procesarResultadosCalibracion(result.rows);

      res.json({
        success: true,
        fechaInicio: fecha_inicio || null,
        fechaFin: fecha_fin || null,
        codDefecto: cod_defecto,
        data: procesado.revisores,
        promedioGlobal: procesado.promedioGlobal
      });
    } catch (error) {
      console.error('Error en /api/produccion/calibracion-revisores:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno al consultar calibración de revisores'
      });
    }
  });

  return router;
}
