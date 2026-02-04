const oracledb = require("oracledb");
(async () => {
  const conn = await oracledb.getConnection({user: "SYSTEM", password: "Alfa1984", connectString: "localhost/XE"});
  const result = await conn.execute("SELECT * FROM USTER_PAR WHERE ROWNUM = 1", [], {outFormat: oracledb.OUT_FORMAT_OBJECT});
  console.log("\n📋 Columnas en USTER_PAR (Oracle):");
  console.log(Object.keys(result.rows[0]).join(", "));
  await conn.close();
})();
