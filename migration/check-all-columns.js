const oracledb = require("oracledb");
(async () => {
  const conn = await oracledb.getConnection({user: "SYSTEM", password: "Alfa1984", connectString: "localhost/XE"});
  
  const tables = ["USTER_TBL", "TENSORAPID_PAR", "TENSORAPID_TBL"];
  for (const table of tables) {
    const result = await conn.execute(`SELECT * FROM ${table} WHERE ROWNUM = 1`, [], {outFormat: oracledb.OUT_FORMAT_OBJECT});
    if (result.rows.length > 0) {
      console.log(`\n📋 ${table}:`);
      console.log(Object.keys(result.rows[0]).join(", "));
    }
  }
  await conn.close();
})();
