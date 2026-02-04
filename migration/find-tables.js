const oracledb = require("oracledb");

(async () => {
  try {
    const conn = await oracledb.getConnection({
      user: "SYSTEM",
      password: "Alfa1984",
      connectString: "localhost:1521/XEPDB1"
    });
    
    const result = await conn.execute("SELECT owner, table_name FROM all_tables WHERE (table_name LIKE '%USTER%' OR table_name LIKE '%TENSOR%') AND owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'XDB', 'CTXSYS', 'MDSYS') ORDER BY owner, table_name");
    
    console.log("\n📊 Tablas encontradas:", result.rows.length);
    result.rows.forEach(row => console.log("   " + row[0] + "." + row[1]));
    
    await conn.close();
  } catch (err) {
    console.log("❌ Error:", err.message);
  }
})();
