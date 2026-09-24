import { query } from './database.js'; (async () => { try { const res = await query('SELECT \
PARTIDA\, \S\ FROM tb_produccion WHERE \PARTIDA\ = \ LIMIT 5', ['560625']); console.log(res.rows); } catch (e) { console.error(e); } finally { process.exit(0); } })();
