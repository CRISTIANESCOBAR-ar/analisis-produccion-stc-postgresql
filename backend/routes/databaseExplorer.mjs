import express from 'express';

// Mapeo estático de tablas a columnas de fecha
const DATE_COLUMNS = {
  'tb_calidad': 'DAT_PROD',
  'tb_calidad_fibra': 'DATA_MOVIMENTO',
  'tb_defectos': 'DATA_PROD',
  'tb_paradas': 'data_base',
  'tb_produccion': 'DT_BASE_PRODUCAO',
  'tb_produccion_carda': 'data',
  'tb_produccion_oe': 'data_producao',
  'tb_residuos_indigo': 'DT_MOV',
  'tb_residuos_por_sector': 'DT_MOV'
};

// Conversor robusto de columnas de texto a fecha nativa de PostgreSQL
function sqlParseDateText(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR btrim(${colIdent}) = '' THEN NULL
      WHEN btrim(${colIdent}) ~ '^[0-3]?[0-9]/[0-1]?[0-9]/[0-9]{4}(\\s|$)'
        THEN to_date(split_part(btrim(${colIdent}), ' ', 1), 'DD/MM/YYYY')
      WHEN btrim(${colIdent}) ~ '^[0-3]?[0-9]/[0-1]?[0-9]/[0-9]{2}(\\s|$)'
        THEN to_date(split_part(btrim(${colIdent}), ' ', 1), 'DD/MM/YY')
      WHEN btrim(${colIdent}) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        THEN substring(btrim(${colIdent}) from 1 for 10)::date
      ELSE NULL
    END
  )`;
}

export default function(pool) {
  const router = express.Router();

  // 1. Get all tables
  router.get('/tables', async (req, res) => {
    try {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      const result = await pool.query(query);
      res.json({ success: true, tables: result.rows.map(r => r.table_name) });
    } catch (err) {
      console.error('Error fetching tables:', err);
      res.status(500).json({ success: false, message: 'Error fetching tables' });
    }
  });

  // 2. Get temporal summary grouped by month or day
  router.get('/tables/:tableName/temporal-summary', async (req, res) => {
    const { tableName } = req.params;
    const { month } = req.query; // formato opcional YYYY-MM

    try {
      // Validar que la tabla exista
      const tableCheck = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      if (tableCheck.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Table not found' });
      }

      const dateCol = DATE_COLUMNS[tableName.toLowerCase()];
      if (!dateCol) {
        return res.json({ success: true, hasSummary: false });
      }

      const dateExpr = sqlParseDateText(`"${dateCol}"`);
      let summaryQuery = '';
      const params = [];

      if (month) {
        // Desglose diario para un mes específico
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ success: false, message: 'Invalid month format (expected YYYY-MM)' });
        }
        params.push(month);
        summaryQuery = `
          SELECT 
            TO_CHAR(${dateExpr}, 'YYYY-MM-DD') AS periodo,
            COUNT(*) AS total_registros
          FROM public."${tableName}"
          WHERE ${dateExpr} IS NOT NULL 
            AND TO_CHAR(${dateExpr}, 'YYYY-MM') = $1
          GROUP BY 1
          ORDER BY 1 DESC
        `;
      } else {
        // Agrupación mensual general
        summaryQuery = `
          SELECT 
            TO_CHAR(${dateExpr}, 'YYYY-MM') AS periodo,
            COUNT(*) AS total_registros
          FROM public."${tableName}"
          WHERE ${dateExpr} IS NOT NULL
          GROUP BY 1
          ORDER BY 1 DESC
        `;
      }

      const result = await pool.query(summaryQuery, params);
      res.json({
        success: true,
        hasSummary: true,
        summaryType: month ? 'days' : 'months',
        data: result.rows
      });

    } catch (err) {
      console.error(`Error fetching temporal summary for ${tableName}:`, err);
      res.status(500).json({ success: false, message: 'Error fetching temporal summary' });
    }
  });

  // 3. Get columns and data for a specific table
  router.get('/tables/:tableName/data', async (req, res) => {
    const { tableName } = req.params;
    const { page = 1, limit = 50, search = '', date = '' } = req.query;

    try {
      // Validate table name (prevent SQL injection)
      const tableCheck = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );

      if (tableCheck.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Table not found' });
      }

      // Fetch columns
      const colsResult = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [tableName]
      );
      const columns = colsResult.rows.map(r => r.column_name);

      // Build data query
      const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
      let dataQuery = `SELECT * FROM public."${tableName}"`;
      const queryParams = [];
      const whereConditions = [];

      // Filtro opcional por fecha específica
      const dateCol = DATE_COLUMNS[tableName.toLowerCase()];
      if (date && dateCol) {
        queryParams.push(date);
        const dateExpr = sqlParseDateText(`"${dateCol}"`);
        whereConditions.push(`${dateExpr} = $${queryParams.length}::date`);
      }

      // Filtro opcional de búsqueda global
      if (search) {
        const textCols = colsResult.rows.filter(r => ['character varying', 'text', 'uuid'].includes(r.data_type)).map(r => r.column_name);
        if (textCols.length > 0) {
          queryParams.push(`%${search}%`);
          const searchConditions = textCols.map(col => `"${col}"::text ILIKE $${queryParams.length}`);
          whereConditions.push(`(${searchConditions.join(' OR ')})`);
        }
      }

      if (whereConditions.length > 0) {
        dataQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // order by ID if exists, otherwise first column
      const orderCol = columns.includes('id') ? 'id' : columns[0];
      dataQuery += ` ORDER BY "${orderCol}" DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

      const dataResult = await pool.query(dataQuery, queryParams);

      // Fetch total count for pagination
      let countQuery = `SELECT COUNT(*) FROM public."${tableName}"`;
      if (whereConditions.length > 0) {
        countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      const countResult = await pool.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        columns,
        data: dataResult.rows,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (err) {
      console.error(`Error fetching data for table ${tableName}:`, err);
      res.status(500).json({ success: false, message: 'Error fetching table data' });
    }
  });

  return router;
}

