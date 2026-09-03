import express from 'express';

export default function(query) {
  const router = express.Router();

  router.get('/velocidad-maquina', async (req, res) => {
    try {
      const { filial = '05', maquina = '165001', mes } = req.query;
      
      let dateFilter = '';
      const params = [maquina, filial];
      
      if (mes) {
        const [year, month] = mes.split('-');
        dateFilter = `
          AND to_timestamp(p."DT_INICIO" || ' ' || COALESCE(NULLIF(BTRIM(p."HORA_INICIO"), ''), '00:00'), 'DD/MM/YYYY HH24:MI') >= to_timestamp($3, 'YYYY-MM-DD HH24:MI:SS')
          AND to_timestamp(p."DT_INICIO" || ' ' || COALESCE(NULLIF(BTRIM(p."HORA_INICIO"), ''), '00:00'), 'DD/MM/YYYY HH24:MI') < to_timestamp($4, 'YYYY-MM-DD HH24:MI:SS')
        `;
        const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
        const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
        
        params.push(`${year}-${month}-01 00:00:00`);
        params.push(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`);
      }

      const sql = `
        SELECT 
          p."PARTIDA" as partida,
          p."ARTIGO" as artigo,
          MAX(f."TRAMA") as trama,
          p."R" as r,
          MIN(to_timestamp(p."DT_INICIO" || ' ' || COALESCE(NULLIF(BTRIM(p."HORA_INICIO"), ''), '00:00'), 'DD/MM/YYYY HH24:MI')) as start_time,
          MAX(to_timestamp(p."DT_FINAL" || ' ' || COALESCE(NULLIF(BTRIM(p."HORA_FINAL"), ''), '00:00'), 'DD/MM/YYYY HH24:MI')) as end_time,
          SUM(CAST(NULLIF(BTRIM(REPLACE(REPLACE(p."METRAGEM", '.', ''), ',', '.')), '') AS NUMERIC)) as total_metragem,
          MAX(CAST(NULLIF(BTRIM(REPLACE(REPLACE(f."ENC.ACAB URD", '.', ''), ',', '.')), '') AS NUMERIC)) as encogimiento
        FROM public.tb_produccion p
        INNER JOIN public.tb_fichas f ON p."ARTIGO" = f."ARTIGO CODIGO"
        WHERE p."SELETOR" = 'ACABAMENTO' 
          AND p."MAQUINA" = $1
          AND p."FILIAL" = $2
          AND p."DT_INICIO" IS NOT NULL AND BTRIM(p."DT_INICIO") != ''
          AND p."DT_FINAL" IS NOT NULL AND BTRIM(p."DT_FINAL") != ''
          ${dateFilter}
        GROUP BY p."PARTIDA", p."ARTIGO", p."R"
        ORDER BY start_time ASC
      `;

      const result = await query(sql, params, 'velocidad-maquina');
      
      const processedData = result.rows.map(row => {
        const startTime = new Date(row.start_time).getTime();
        const endTime = new Date(row.end_time).getTime();
        const totalMinutes = (endTime - startTime) / 60000;
        
        const encogimiento = parseFloat(row.encogimiento) || 0;
        const totalMetragem = parseFloat(row.total_metragem) || 0;
        
        let metrosEntrada = 0;
        let velocidadEntrada = 0;
        let velocidadSalida = 0;
        
        if (totalMinutes > 0) {
          metrosEntrada = totalMetragem / (1 - (encogimiento / 100));
          velocidadEntrada = metrosEntrada / totalMinutes;
          velocidadSalida = totalMetragem / totalMinutes;
        }

        return {
          partida: row.partida,
          artigo: row.artigo,
          trama: row.trama,
          r: row.r,
          startTime: row.start_time,
          endTime: row.end_time,
          totalMinutes,
          totalMetragem,
          encogimiento,
          metrosEntrada,
          velocidadEntrada,
          velocidadSalida
        };
      });

      res.json({
        success: true,
        data: processedData
      });
      
    } catch (err) {
      console.error('Error in /velocidad-maquina:', err);
      res.status(500).json({ success: false, message: 'Error fetching machine speed data', error: err.message });
    }
  });

  return router;
}
