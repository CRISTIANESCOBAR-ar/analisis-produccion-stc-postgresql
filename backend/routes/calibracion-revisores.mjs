import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  construirQueryRevisores,
  construirQueryRankingMetros,
  procesarResultadosRanking,
  construirQueryIA,
  procesarResultadosIA
} from '../services/calibracionRevisoresService.js';

export default function(query) {
  const router = express.Router();

  /**
   * GET /api/produccion/calibracion-revisores/revisores
   */
  router.get('/calibracion-revisores/revisores', async (req, res) => {
    try {
      const { sql, values } = construirQueryRevisores();
      const result = await query(sql, values, 'lista-revisores');
      
      res.json({
        success: true,
        data: result.rows.map(r => r.revisor)
      });
    } catch (error) {
      console.error('Error en /api/produccion/calibracion-revisores/revisores:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno'
      });
    }
  });

  /**
   * POST /api/produccion/calibracion-revisores/ranking
   */
  router.post('/calibracion-revisores/ranking', async (req, res) => {
    try {
      const { fecha, revisores = [] } = req.body;

      if (!fecha || revisores.length === 0) {
        return res.json({ success: true, data: { mes: [], dia: [] } });
      }

      // Query Mes
      const qMes = construirQueryRankingMetros({ fecha, tipo: 'mes' });
      const resMes = await query(qMes.sql, qMes.values, 'ranking-mes');
      const dataMes = procesarResultadosRanking(resMes.rows, revisores);

      // Query Dia
      const qDia = construirQueryRankingMetros({ fecha, tipo: 'dia' });
      const resDia = await query(qDia.sql, qDia.values, 'ranking-dia');
      const dataDia = procesarResultadosRanking(resDia.rows, revisores);

      res.json({
        success: true,
        data: {
          mes: dataMes,
          dia: dataDia
        }
      });
    } catch (error) {
      console.error('Error en /api/produccion/calibracion-revisores/ranking:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno'
      });
    }
  });

  /**
   * POST /api/produccion/calibracion-revisores/revision-cq-ia
   */
  router.post('/calibracion-revisores/revision-cq-ia', async (req, res) => {
    try {
      const { rankingData } = req.body;

      if (!rankingData || (!rankingData.mes && !rankingData.dia)) {
         return res.json({ success: true, insight: 'No hay datos en el periodo seleccionado para evaluar.' });
      }

      // 2. Invocar Gemini
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, error: 'GOOGLE_API_KEY no configurada' });
      }

      const modelName = req.body.model || "gemini-1.5-pro";
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `Actúa como un supervisor de calidad textil. Analiza este JSON que contiene el "Ranking de Revisores" (desempeño de inspección de tela). 
El JSON incluye dos tablas: "mes" (acumulado mensual) y "dia" (desempeño del día actual seleccionado).

Métricas:
- metros_totales: cantidad de tela revisada.
- pts_100m: severidad/puntos marcados cada 100m2.
- pct_sin_defecto: porcentaje de piezas de 1ra calidad sin defectos.
- metros_repro: metros reprocesados.

Tu objetivo es escribir un comentario gerencial directo y conciso. Señala si algún revisor está fuera de parámetro HOY respecto a su propio promedio del MES (por ejemplo, si hoy está siendo muy laxo o muy estricto en comparación a su tendencia mensual). Si todos están alineados, indícalo.

Devuelve tu análisis en Markdown.

DATOS:
${JSON.stringify(rankingData, null, 2)}`;

      const apiResult = await model.generateContent(prompt);
      const text = apiResult.response.text();

      res.json({ success: true, insight: text });
    } catch (error) {
      console.error('Error en /api/produccion/calibracion-revisores/revision-cq-ia:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error en análisis IA'
      });
    }
  });

  return router;
}
