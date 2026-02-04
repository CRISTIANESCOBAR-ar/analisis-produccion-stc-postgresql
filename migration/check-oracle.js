const oracledb = require("oracledb");

(async () => {
  try {
    const conn = await oracledb.getConnection({
      user: "SYSTEM",
      password: "Alfa1984",
      connectString: "localhost/XE"
    });
    
    console.log("✅ Conectado a Oracle localhost/XE");
    
    const result = await conn.execute("SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE '%USTER%' OR TABLE_NAME LIKE '%TENSOR%' ORDER BY TABLE_NAME");
    
    console.log("\n📊 Tablas encontradas:", result.rows.length);
    result.rows.forEach(row => console.log("   " + row[0]));
    
    if (result.rows.length > 0) {
      for (const [tableName] of result.rows) {
        const countResult = await conn.execute("SELECT COUNT(*) as cnt FROM " + tableName);
        console.log("   ➜ " + tableName + ": " + countResult.rows[0][0] + " registros");
      }
    }
    
    await conn.close();
  } catch (err) {
    console.log("❌ Error:", err.message);
  }
})();
