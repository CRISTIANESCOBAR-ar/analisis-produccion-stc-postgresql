/**
 * Script de Migración: Oracle → PostgreSQL (Podman)
 * Migra datos de Uster y TensoRapid desde Oracle a PostgreSQL
 */

const oracledb = require('oracledb');
const { Pool } = require('pg');

// =====================================================
// CONFIGURACIÓN ORACLE (carga-datos-vue)
// =====================================================
const ORACLE_CONFIG = {
  user: process.env.ORACLE_USER || 'SYSTEM',
  password: process.env.ORACLE_PASSWORD || 'Alfa1984',
  connectString: process.env.ORACLE_CONNECT || 'localhost/XE'
};

// =====================================================
// CONFIGURACIÓN POSTGRESQL (Podman)
// =====================================================
const PG_CONFIG = {
  host: 'localhost',
  port: 5433,
  database: 'stc_produccion',
  user: 'stc_user',
  password: 'stc_password_2026',
  max: 10
};

// Tablas a migrar
const TABLES = [
  { oracle: 'USTER_PAR', postgres: 'tb_uster_par' },
  { oracle: 'USTER_TBL', postgres: 'tb_uster_tbl' },
  { oracle: 'TENSORAPID_PAR', postgres: 'tb_tensorapid_par' },
  { oracle: 'TENSORAPID_TBL', postgres: 'tb_tensorapid_tbl' }
];

let oracleConn;
let pgPool;

async function main() {
  console.log('🚀 Iniciando migración Oracle → PostgreSQL (Podman)');
  console.log('================================================\n');

  try {
    // Conectar a Oracle
    console.log('📡 Conectando a Oracle...');
    console.log(`   Usuario: ${ORACLE_CONFIG.user}`);
    console.log(`   Connect String: ${ORACLE_CONFIG.connectString}`);
    
    try {
      oracleConn = await oracledb.getConnection(ORACLE_CONFIG);
      console.log('✅ Conectado a Oracle exitosamente\n');
    } catch (err) {
      console.error('❌ ERROR conectando a Oracle:');
      console.error(`   Mensaje: ${err.message}`);
      console.error(`   Código: ${err.errorNum || 'N/A'}`);
      throw err;
    }

    // Conectar a PostgreSQL
    console.log('📡 Conectando a PostgreSQL (Podman)...');
    console.log(`   Host: ${PG_CONFIG.host}:${PG_CONFIG.port}`);
    console.log(`   Database: ${PG_CONFIG.database}`);
    console.log(`   Usuario: ${PG_CONFIG.user}`);
    
    try {
      pgPool = new Pool(PG_CONFIG);
      const pgClient = await pgPool.connect();
      console.log('✅ Conectado a PostgreSQL exitosamente\n');
      pgClient.release();
    } catch (err) {
      console.error('❌ ERROR conectando a PostgreSQL:');
      console.error(`   Mensaje: ${err.message}`);
      console.error(`   Código: ${err.code || 'N/A'}`);
      throw err;
    }

    // Migrar cada tabla
    for (const table of TABLES) {
      await migrateTable(table.oracle, table.postgres);
    }

    console.log('\n🎉 Migración completada exitosamente!');
    console.log('\n📊 Verificación de datos:');
    await verifyData();

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    // Cerrar conexiones
    if (oracleConn) {
      await oracleConn.close();
      console.log('\n✅ Conexión Oracle cerrada');
    }
    if (pgPool) {
      await pgPool.end();
      console.log('✅ Conexión PostgreSQL cerrada');
    }
  }
}

async function migrateTable(oracleTable, pgTable) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Migrando: ${oracleTable} → ${pgTable}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    // Contar registros en Oracle
    console.log(`🔍 Verificando existencia de tabla ${oracleTable}...`);
    
    let countResult;
    try {
      countResult = await oracleConn.execute(
        `SELECT COUNT(*) as total FROM ${oracleTable}`
      );
    } catch (err) {
      console.error(`❌ ERROR: No se pudo acceder a la tabla ${oracleTable}`);
      console.error(`   Mensaje: ${err.message}`);
      console.error(`   Código: ${err.errorNum || 'N/A'}`);
      console.log(`⚠️  Saltando esta tabla...\n`);
      return;
    }
    
    const totalRows = countResult.rows[0][0];
    console.log(`📊 Registros encontrados en Oracle: ${totalRows}`);

    if (totalRows === 0) {
      console.log('⚠️  Tabla vacía, saltando...\n');
      return;
    }

    // Limpiar tabla PostgreSQL
    console.log(`🧹 Limpiando tabla ${pgTable}...`);
    try {
      await pgPool.query(`TRUNCATE TABLE ${pgTable} RESTART IDENTITY CASCADE`);
      console.log(`✅ Tabla ${pgTable} limpiada`);
    } catch (err) {
      console.error(`❌ ERROR limpiando tabla ${pgTable}:`, err.message);
      throw err;
    }

    // Extraer datos de Oracle
    console.log(`📥 Extrayendo datos de Oracle (puede tardar unos segundos)...`);
    const startTime = Date.now();
    
    let oracleResult;
    try {
      oracleResult = await oracleConn.execute(
        `SELECT * FROM ${oracleTable}`,
        [],
        { 
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          maxRows: 100000 
        }
      );
    } catch (err) {
      console.error(`❌ ERROR extrayendo datos de ${oracleTable}:`, err.message);
      throw err;
    }

    const extractTime = ((Date.now() - startTime) / 1000).toFixed(2);
    let rows = oracleResult.rows;
    console.log(`✅ ${rows.length} registros extraídos en ${extractTime}s`);

    if (rows.length === 0) return;

    // Procesar LOBs (Large Objects) - convertir a strings
    console.log(`🔄 Procesando LOBs (columnas de texto largo)...`);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (const key in row) {
        const value = row[key];
        // Si es un LOB, leer su contenido
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
          try {
            const lobData = await value.getData();
            row[key] = lobData ? lobData.toString('utf8') : null;
          } catch (lobErr) {
            console.error(`⚠️ Error leyendo LOB en fila ${i + 1}, columna ${key}:`, lobErr.message);
            row[key] = null;
          }
        }
      }
    }
    console.log(`✅ LOBs procesados`);

    // Preparar columnas
    const columns = Object.keys(rows[0]);
    const columnNames = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Insertar en lotes de 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    const insertStartTime = Date.now();

    console.log(`💾 Insertando ${rows.length} registros en PostgreSQL...`);
    console.log(`   Columnas: ${columns.join(', ')}`);
    console.log(`   Tamaño de lote: ${BATCH_SIZE} registros\n`);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');

        for (const row of batch) {
          const values = columns.map(col => row[col]);
          try {
            await client.query(
              `INSERT INTO ${pgTable} (${columnNames}) VALUES (${placeholders})`,
              values
            );
            inserted++;
          } catch (err) {
            console.error(`\n❌ ERROR insertando registro:`, err.message);
            console.error(`   Datos:`, values);
            throw err;
          }
        }

        await client.query('COMMIT');
        const percentage = ((inserted / rows.length) * 100).toFixed(1);
        process.stdout.write(`\r   💾 Progreso: ${inserted}/${rows.length} (${percentage}%)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ ERROR en lote ${i}-${i + BATCH_SIZE}:`, err.message);
        throw err;
      } finally {
        client.release();
      }
    }

    const insertTime = ((Date.now() - insertStartTime) / 1000).toFixed(2);
    console.log(`\n✅ Migración de ${pgTable} completada: ${inserted} registros en ${insertTime}s`);
    console.log(`   Velocidad: ${(inserted / parseFloat(insertTime)).toFixed(0)} registros/segundo`);

  } catch (error) {
    console.error(`\n❌ Error migrando ${oracleTable}:`, error.message);
    throw error;
  }
}

async function verifyData() {
  for (const table of TABLES) {
    const result = await pgPool.query(`SELECT COUNT(*) FROM ${table.postgres}`);
    console.log(`   ${table.postgres}: ${result.rows[0].count} registros`);
  }
}

// Ejecutar
main();
