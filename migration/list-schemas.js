const oracledb = require("oracledb");

(async () => {
  try {
    const conn = await oracledb.getConnection({
      user: "SYSTEM",
      password: "Alfa1984",
      connectString: "localhost:1521/XEPDB1"
    });
    
    const result = await conn.execute("SELECT owner, COUNT(*) as table_count FROM all_tables WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'XDB', 'CTXSYS', 'MDSYS', 'WMSYS', 'OLAPSYS', 'ORDDATA', 'ORDSYS', 'LBACSYS', 'GSMADMIN_INTERNAL', 'ANONYMOUS', 'APPQOSSYS', 'AUDSYS', 'DBSFWUSER', 'DBSNMP', 'DVF', 'DVSYS', 'GGSYS', 'OJVMSYS', 'REMOTE_SCHEDULER_AGENT') GROUP BY owner ORDER BY table_count DESC");
    
    console.log("\n📊 Esquemas con tablas:");
    result.rows.forEach(row => console.log("   " + row[0] + ": " + row[1] + " tablas"));
    
    await conn.close();
  } catch (err) {
    console.log("❌ Error:", err.message);
  }
})();
