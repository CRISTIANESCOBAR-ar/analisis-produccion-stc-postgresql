import express from 'express';

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

  // 2. Get columns and data for a specific table
  router.get('/tables/:tableName/data', async (req, res) => {
    const { tableName } = req.params;
    const { page = 1, limit = 50, search = '' } = req.query;

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

      // Basic global search filter across text columns if provided
      if (search) {
        const textCols = colsResult.rows.filter(r => ['character varying', 'text', 'uuid'].includes(r.data_type)).map(r => r.column_name);
        if (textCols.length > 0) {
          const searchConditions = textCols.map(col => `"${col}"::text ILIKE $1`);
          dataQuery += ` WHERE ${searchConditions.join(' OR ')}`;
          queryParams.push(`%${search}%`);
        }
      }

      // order by ID if exists, otherwise first column
      const orderCol = columns.includes('id') ? 'id' : columns[0];
      dataQuery += ` ORDER BY "${orderCol}" DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;

      const dataResult = await pool.query(dataQuery, queryParams);

      // Fetch total count for pagination
      let countQuery = `SELECT COUNT(*) FROM public."${tableName}"`;
      if (search && queryParams.length > 0) {
        const textCols = colsResult.rows.filter(r => ['character varying', 'text', 'uuid'].includes(r.data_type)).map(r => r.column_name);
        const searchConditions = textCols.map(col => `"${col}"::text ILIKE $1`);
        countQuery += ` WHERE ${searchConditions.join(' OR ')}`;
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
