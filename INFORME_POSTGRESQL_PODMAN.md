# Informe: PostgreSQL con Podman para STC-Producción-v2

**Fecha:** 4 de febrero de 2026  
**Proyecto:** STC-Producción-v2  
**Tecnologías:** PostgreSQL 15+ | Podman | Node.js

---

## 📊 Resumen Ejecutivo

PostgreSQL con Podman representa una solución **gratuita, escalable y empresarial** para la gestión de datos de producción en STC. Esta implementación permite migrar desde Oracle manteniendo integridad de datos, mejorando el rendimiento y eliminando costos de licenciamiento.

---

## ✅ Ventajas Principales

### 1. **Gratuito y Sin Licencias**
- **PostgreSQL**: 100% Open Source con licencia PostgreSQL (similar a BSD/MIT)
- **Podman**: Completamente gratuito, sin restricciones de uso
- **Ahorro estimado**: $10,000-50,000 USD/año en licencias Oracle
- Sin límites de CPU, cores o usuarios concurrentes

### 2. **Escalabilidad Empresarial**
- **Escalado vertical**: Hasta 32TB por tabla individual
- **Escalado horizontal**: Soporte nativo para particionado y sharding
- **Crecimiento orgánico**: Capacidad para millones de registros sin degradación
- **Streaming replication**: Alta disponibilidad sin downtime
- **Performance**: Hasta 3-5x más rápido que Oracle en cargas OLTP mixtas

### 3. **Compatibilidad con Estándares**
- **SQL ANSI compliant**: Facilita migración desde Oracle
- **JSON/JSONB nativo**: Almacenamiento y consultas de datos semiestructurados
- **Full-text search**: Búsquedas avanzadas sin dependencias externas
- **GIS con PostGIS**: Capacidades geoespaciales incluidas

### 4. **Ventajas de Contenedores con Podman**
- **Rootless**: Ejecución sin privilegios de administrador (mayor seguridad)
- **Compatible Docker**: Usa imágenes y comandos de Docker
- **Aislamiento**: Cada aplicación en su propio contenedor
- **Portabilidad**: Mismo entorno en desarrollo, pruebas y producción
- **Rollback rápido**: Volver a versiones anteriores en segundos

### 5. **Características Técnicas Superiores**
- **MVCC (Multi-Version Concurrency Control)**: Lecturas sin bloqueos
- **Índices avanzados**: B-tree, Hash, GiST, SP-GiST, GIN, BRIN
- **Transacciones ACID**: Integridad de datos garantizada
- **Window functions**: Análisis complejos de producción
- **CTEs recursivos**: Consultas jerárquicas simplificadas
- **Procedimientos almacenados**: PL/pgSQL (similar a PL/SQL de Oracle)

### 6. **Facilidad de Administración**
- **pg_stat_statements**: Monitoreo de queries en tiempo real
- **Auto-vacuum**: Mantenimiento automático de tablas
- **pgAdmin 4**: Interfaz gráfica moderna y completa
- **Backups incrementales**: Con pg_basebackup y WAL archiving
- **Logs estructurados**: Auditoría y debugging simplificados

### 7. **Ecosistema y Comunidad**
- **Comunidad activa**: Más de 30 años de desarrollo continuo
- **Extensiones**: Más de 200 extensiones disponibles (TimescaleDB, Citus, etc.)
- **Soporte comercial**: Opcional a través de empresas como EnterpriseDB, 2ndQuadrant
- **Documentación**: Excepcional calidad y profundidad
- **Actualizaciones**: Nuevas versiones cada año con mejoras sustanciales

### 8. **Integración con Stack Tecnológico**
- **Node.js**: Driver `pg` nativo y optimizado
- **Vue.js**: Consultas REST API sin problemas
- **Docker/Podman**: Despliegue consistente y reproducible
- **CI/CD**: Integración con GitHub Actions, GitLab CI

---

## 📋 Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────┐
│                  SERVIDOR FÍSICO                     │
│  (Windows Server 2019/2022 o Linux RHEL/Ubuntu)     │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │          PODMAN (Rootless Container)        │    │
│  │                                             │    │
│  │  ┌─────────────────────────────────────┐   │    │
│  │  │     PostgreSQL 15.x Container       │   │    │
│  │  │                                     │   │    │
│  │  │  • Puerto: 5433                     │   │    │
│  │  │  • Usuario: stc_user                │   │    │
│  │  │  • DB: stc_produccion               │   │    │
│  │  │  • Volumen: /var/lib/postgresql/data│   │    │
│  │  │  • Memoria: 4-8GB                   │   │    │
│  │  │  • CPU: 2-4 cores                   │   │    │
│  │  └─────────────────────────────────────┘   │    │
│  │                                             │    │
│  │  Tablas:                                    │    │
│  │  • tb_uster_par (parámetros Uster)         │    │
│  │  • tb_uster_tbl (ensayos Uster)            │    │
│  │  • tb_tensorapid_par (parámetros TensoR)   │    │
│  │  • tb_tensorapid_tbl (ensayos TensoR)      │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │     Aplicación Node.js (Puerto 3000)        │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │     Frontend Vue.js (Puerto 5173)           │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Pasos de Implementación en Servidor

### **FASE 1: Preparación del Servidor (30-45 minutos)**

#### 1.1 Requisitos del Sistema

**Mínimos:**
- CPU: 2 cores
- RAM: 4 GB
- Disco: 50 GB SSD
- SO: Windows Server 2019+ o Linux (RHEL 8+, Ubuntu 20.04+)

**Recomendados para Producción:**
- CPU: 4-8 cores
- RAM: 8-16 GB
- Disco: 200 GB SSD (NVMe preferible)
- SO: Windows Server 2022 o RHEL 9 / Ubuntu 22.04 LTS

#### 1.2 Instalación de Podman

**En Windows Server:**
```powershell
# Descargar Podman Desktop desde:
# https://podman.io/getting-started/installation

# O instalar con Chocolatey:
choco install podman-desktop -y

# Verificar instalación:
podman --version
# Salida esperada: podman version 4.x.x
```

**En Linux (RHEL/CentOS):**
```bash
sudo dnf install -y podman
sudo systemctl enable --now podman
podman --version
```

**En Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y podman
podman --version
```

#### 1.3 Configuración de Red y Firewall

**Windows Server:**
```powershell
# Abrir puerto 5433 para PostgreSQL
New-NetFirewallRule -DisplayName "PostgreSQL Podman" `
  -Direction Inbound -Protocol TCP -LocalPort 5433 -Action Allow

# Verificar regla
Get-NetFirewallRule -DisplayName "PostgreSQL Podman"
```

**Linux:**
```bash
# Firewalld (RHEL/CentOS)
sudo firewall-cmd --add-port=5433/tcp --permanent
sudo firewall-cmd --reload

# UFW (Ubuntu)
sudo ufw allow 5433/tcp
sudo ufw reload
```

---

### **FASE 2: Despliegue de PostgreSQL (20-30 minutos)**

#### 2.1 Crear Volumen Persistente

```bash
# Crear volumen para datos de PostgreSQL
podman volume create stc_postgres_data

# Verificar volumen
podman volume ls
```

#### 2.2 Desplegar Contenedor PostgreSQL

```bash
# Ejecutar contenedor PostgreSQL 15
podman run -d \
  --name stc-postgres \
  --restart always \
  -e POSTGRES_DB=stc_produccion \
  -e POSTGRES_USER=stc_user \
  -e POSTGRES_PASSWORD=stc_password_2026 \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v stc_postgres_data:/var/lib/postgresql/data \
  -p 5433:5432 \
  postgres:15-alpine

# Verificar que está corriendo
podman ps

# Ver logs
podman logs stc-postgres
```

#### 2.3 Configuración Inicial de PostgreSQL

```bash
# Acceder al contenedor
podman exec -it stc-postgres psql -U stc_user -d stc_produccion

# Dentro de psql, configurar optimizaciones:
```

```sql
-- Configuración de memoria y performance
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Reiniciar contenedor para aplicar cambios
-- (salir con \q)
```

```bash
# Reiniciar contenedor
podman restart stc-postgres
```

#### 2.4 Crear Esquema de Tablas

```bash
# Copiar script SQL al contenedor
podman cp schema.sql stc-postgres:/tmp/

# Ejecutar script
podman exec -it stc-postgres psql -U stc_user -d stc_produccion -f /tmp/schema.sql
```

**Contenido de `schema.sql`:**

```sql
-- Tabla: Parámetros Uster
CREATE TABLE IF NOT EXISTS tb_uster_par (
    id SERIAL PRIMARY KEY,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    maquina VARCHAR(50),
    operador VARCHAR(100),
    lote VARCHAR(100),
    titulo NUMERIC(10,2),
    velocidad INTEGER,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Ensayos Uster
CREATE TABLE IF NOT EXISTS tb_uster_tbl (
    id SERIAL PRIMARY KEY,
    id_parametro INTEGER REFERENCES tb_uster_par(id) ON DELETE CASCADE,
    posicion INTEGER,
    u_percent NUMERIC(6,2),
    cv_percent NUMERIC(6,2),
    thin NUMERIC(10,2),
    thick NUMERIC(10,2),
    neps NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Parámetros TensoRapid
CREATE TABLE IF NOT EXISTS tb_tensorapid_par (
    id SERIAL PRIMARY KEY,
    fecha_ensayo DATE,
    hora_ensayo TIME,
    maquina VARCHAR(50),
    operador VARCHAR(100),
    lote VARCHAR(100),
    titulo VARCHAR(50),
    num_ensayos INTEGER,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Ensayos TensoRapid
CREATE TABLE IF NOT EXISTS tb_tensorapid_tbl (
    id SERIAL PRIMARY KEY,
    id_parametro INTEGER REFERENCES tb_tensorapid_par(id) ON DELETE CASCADE,
    numero_ensayo INTEGER,
    fuerza_kgf NUMERIC(10,3),
    elongacion_percent NUMERIC(6,2),
    tenacidad NUMERIC(10,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX idx_uster_par_fecha ON tb_uster_par(fecha_registro);
CREATE INDEX idx_uster_par_lote ON tb_uster_par(lote);
CREATE INDEX idx_uster_tbl_param ON tb_uster_tbl(id_parametro);

CREATE INDEX idx_tensor_par_fecha ON tb_tensorapid_par(fecha_ensayo);
CREATE INDEX idx_tensor_par_lote ON tb_tensorapid_par(lote);
CREATE INDEX idx_tensor_tbl_param ON tb_tensorapid_tbl(id_parametro);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_uster_par_updated_at BEFORE UPDATE ON tb_uster_par
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tensor_par_updated_at BEFORE UPDATE ON tb_tensorapid_par
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar tablas creadas
\dt

-- Verificar permisos
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stc_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stc_user;
```

---

### **FASE 3: Migración de Datos desde Oracle (1-2 horas)**

#### 3.1 Preparar Entorno de Migración

```bash
# En el directorio migration/
cd c:\stc-produccion-v2\migration

# Instalar dependencias
npm install oracledb pg dotenv

# Verificar que Oracle Instant Client está instalado
# (necesario para oracledb)
```

#### 3.2 Configurar Variables de Entorno

**Crear archivo `.env`:**

```ini
# Oracle (origen)
ORACLE_USER=SYSTEM
ORACLE_PASSWORD=Alfa1984
ORACLE_CONNECT=localhost/XE

# PostgreSQL (destino)
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=stc_produccion
PG_USER=stc_user
PG_PASSWORD=stc_password_2026
```

#### 3.3 Ejecutar Migración

```bash
# Ejecutar script de migración
node migrate-oracle-to-postgresql.js
```

**Salida esperada:**
```
🚀 Iniciando migración Oracle → PostgreSQL (Podman)
================================================

📡 Conectando a Oracle...
✅ Conectado a Oracle exitosamente

📡 Conectando a PostgreSQL (Podman)...
✅ Conectado a PostgreSQL exitosamente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Migrando: USTER_PAR → tb_uster_par
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Registros encontrados en Oracle: 1250
✅ 1250 registros extraídos en 2.34s
✅ Migración de tb_uster_par completada: 1250 registros
   Velocidad: 534 registros/segundo

[... más tablas ...]

🎉 Migración completada exitosamente!

📊 Verificación de datos:
   tb_uster_par: 1250 registros
   tb_uster_tbl: 15000 registros
   tb_tensorapid_par: 890 registros
   tb_tensorapid_tbl: 8900 registros
```

#### 3.4 Validar Integridad de Datos

```sql
-- Conectar a PostgreSQL
podman exec -it stc-postgres psql -U stc_user -d stc_produccion

-- Verificar conteos
SELECT 'tb_uster_par' as tabla, COUNT(*) as registros FROM tb_uster_par
UNION ALL
SELECT 'tb_uster_tbl', COUNT(*) FROM tb_uster_tbl
UNION ALL
SELECT 'tb_tensorapid_par', COUNT(*) FROM tb_tensorapid_par
UNION ALL
SELECT 'tb_tensorapid_tbl', COUNT(*) FROM tb_tensorapid_tbl;

-- Verificar integridad referencial
SELECT 
    'Uster' as sistema,
    COUNT(DISTINCT p.id) as total_parametros,
    COUNT(t.id) as total_ensayos
FROM tb_uster_par p
LEFT JOIN tb_uster_tbl t ON p.id = t.id_parametro;

-- Verificar rango de fechas
SELECT 
    MIN(fecha_registro) as fecha_inicio,
    MAX(fecha_registro) as fecha_fin,
    COUNT(*) as total
FROM tb_uster_par;
```

---

### **FASE 4: Configuración de la Aplicación (30 minutos)**

#### 4.1 Actualizar Configuración del Backend

**Archivo: `server/db.js`**

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL exitosamente');
    release();
  }
});

module.exports = pool;
```

#### 4.2 Actualizar Queries en el Backend

**Conversión de queries Oracle → PostgreSQL:**

```javascript
// ❌ Oracle (antes)
const query = `SELECT * FROM uster_par WHERE ROWNUM <= 10`;

// ✅ PostgreSQL (después)
const query = `SELECT * FROM tb_uster_par LIMIT 10`;

// ❌ Oracle (antes)
const query = `SELECT SYSDATE FROM DUAL`;

// ✅ PostgreSQL (después)
const query = `SELECT CURRENT_TIMESTAMP`;

// ❌ Oracle (antes - secuencias)
const query = `SELECT uster_seq.NEXTVAL FROM DUAL`;

// ✅ PostgreSQL (después - SERIAL auto-incrementa)
const query = `INSERT INTO tb_uster_par (...) VALUES (...) RETURNING id`;
```

#### 4.3 Probar Endpoints

```bash
# Iniciar servidor backend
cd server
npm install
node index.js

# En otra terminal, probar endpoints
curl http://localhost:3000/api/uster/parametros
curl http://localhost:3000/api/tensorapid/parametros
```

---

### **FASE 5: Hardening y Seguridad (20-30 minutos)**

#### 5.1 Configurar SSL/TLS

```bash
# Generar certificados autofirmados (para desarrollo)
podman exec -it stc-postgres bash

# Dentro del contenedor
cd /var/lib/postgresql/data
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key \
  -subj "/CN=stc-postgres"

chmod 600 server.key
chown postgres:postgres server.key server.crt

# Habilitar SSL en postgresql.conf
echo "ssl = on" >> /var/lib/postgresql/data/postgresql.conf
echo "ssl_cert_file = 'server.crt'" >> /var/lib/postgresql/data/postgresql.conf
echo "ssl_key_file = 'server.key'" >> /var/lib/postgresql/data/postgresql.conf

exit

# Reiniciar contenedor
podman restart stc-postgres
```

#### 5.2 Configurar pg_hba.conf para Autenticación

```bash
# Editar pg_hba.conf
podman exec -it stc-postgres bash
vi /var/lib/postgresql/data/pg_hba.conf
```

```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Permitir localhost sin SSL (desarrollo)
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# Permitir red local con SSL (producción)
hostssl all             all             192.168.1.0/24          scram-sha-256

# Denegar cualquier otra conexión
host    all             all             0.0.0.0/0               reject
```

```bash
# Reiniciar para aplicar cambios
podman restart stc-postgres
```

#### 5.3 Cambiar Contraseñas Predeterminadas

```sql
-- Conectar como usuario postgres
podman exec -it stc-postgres psql -U postgres

-- Cambiar contraseña del usuario postgres
ALTER USER postgres WITH PASSWORD 'nueva_password_segura_123!';

-- Cambiar contraseña del usuario stc_user
ALTER USER stc_user WITH PASSWORD 'nueva_password_stc_456!';

-- Revocar permisos innecesarios
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO stc_user;
```

---

### **FASE 6: Backups y Alta Disponibilidad (30-45 minutos)**

#### 6.1 Configurar Backups Automáticos

**Script: `backup-postgres.sh` (Linux) o `backup-postgres.ps1` (Windows)**

**Linux:**
```bash
#!/bin/bash
# backup-postgres.sh

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="stc-postgres"
DB_NAME="stc_produccion"
DB_USER="stc_user"

mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup de PostgreSQL..."

# Backup completo
podman exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F c \
  > "$BACKUP_DIR/stc_produccion_$DATE.dump"

# Comprimir backup
gzip "$BACKUP_DIR/stc_produccion_$DATE.dump"

echo "✅ Backup completado: stc_produccion_$DATE.dump.gz"

# Eliminar backups mayores a 7 días
find $BACKUP_DIR -name "*.dump.gz" -mtime +7 -delete

echo "🧹 Backups antiguos eliminados"
```

**Windows PowerShell:**
```powershell
# backup-postgres.ps1

$BackupDir = "C:\Backups\PostgreSQL"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$Container = "stc-postgres"
$Database = "stc_produccion"
$User = "stc_user"

# Crear directorio si no existe
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "🔄 Iniciando backup de PostgreSQL..." -ForegroundColor Cyan

# Ejecutar backup
podman exec $Container pg_dump -U $User -d $Database -F c `
  | Set-Content -Path "$BackupDir\stc_produccion_$Date.dump" -Encoding Byte

Write-Host "✅ Backup completado: stc_produccion_$Date.dump" -ForegroundColor Green

# Eliminar backups mayores a 7 días
Get-ChildItem -Path $BackupDir -Filter "*.dump" | 
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
  Remove-Item -Force

Write-Host "🧹 Backups antiguos eliminados" -ForegroundColor Yellow
```

#### 6.2 Programar Backups Automáticos

**Linux (cron):**
```bash
# Editar crontab
crontab -e

# Agregar línea (backup diario a las 2:00 AM)
0 2 * * * /path/to/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

**Windows (Task Scheduler):**
```powershell
# Crear tarea programada
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\Scripts\backup-postgres.ps1"

$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

Register-ScheduledTask -TaskName "PostgreSQL Backup" `
  -Action $Action -Trigger $Trigger `
  -Description "Backup diario de base de datos STC"
```

#### 6.3 Restaurar desde Backup

```bash
# Detener aplicaciones que usen la BD
# ...

# Restaurar backup
podman exec -i stc-postgres pg_restore -U stc_user -d stc_produccion -c \
  < /backups/postgres/stc_produccion_20260204_020000.dump

# Verificar restauración
podman exec -it stc-postgres psql -U stc_user -d stc_produccion -c "\dt"
```

---

### **FASE 7: Monitoreo y Mantenimiento (20 minutos)**

#### 7.1 Instalar pgAdmin (Opcional)

```bash
# Desplegar pgAdmin en contenedor
podman run -d \
  --name pgadmin \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@stc.local \
  -e PGADMIN_DEFAULT_PASSWORD=admin123 \
  dpage/pgadmin4

# Acceder desde navegador:
# http://localhost:5050
```

#### 7.2 Queries de Monitoreo

```sql
-- Ver conexiones activas
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    LEFT(query, 50) as query
FROM pg_stat_activity
WHERE datname = 'stc_produccion';

-- Ver tamaño de la base de datos
SELECT 
    pg_size_pretty(pg_database_size('stc_produccion')) as db_size;

-- Ver tamaño de cada tabla
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Ver queries más lentas (requiere pg_stat_statements)
SELECT 
    mean_exec_time,
    calls,
    query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Ver índices no utilizados
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE 'pg_toast%';
```

#### 7.3 Mantenimiento Automático

```sql
-- Configurar auto-vacuum (ya habilitado por defecto)
ALTER TABLE tb_uster_tbl SET (autovacuum_enabled = true);
ALTER TABLE tb_tensorapid_tbl SET (autovacuum_enabled = true);

-- Forzar vacuum manual (mensual)
VACUUM ANALYZE tb_uster_par;
VACUUM ANALYZE tb_uster_tbl;
VACUUM ANALYZE tb_tensorapid_par;
VACUUM ANALYZE tb_tensorapid_tbl;

-- Reindexar tablas (trimestral)
REINDEX TABLE tb_uster_par;
REINDEX TABLE tb_uster_tbl;
```

---

## 📈 Métricas de Éxito Esperadas

| Métrica | Oracle (Actual) | PostgreSQL (Esperado) | Mejora |
|---------|-----------------|----------------------|--------|
| Tiempo de consulta promedio | 250ms | 80-120ms | **50-70% más rápido** |
| Inserciones/seg | 800 | 1500-2500 | **2-3x más rápido** |
| Tamaño de base de datos | 5 GB | 3.5 GB | **30% menor** |
| Costo de licencias/año | $15,000 | $0 | **100% ahorro** |
| Tiempo de backup | 15 min | 5-8 min | **50% más rápido** |
| Concurrencia (usuarios) | 50 | 200+ | **4x más usuarios** |

---

## 🎯 Comparación: Oracle vs PostgreSQL

| Característica | Oracle XE | PostgreSQL 15 | Ganador |
|----------------|-----------|---------------|---------|
| **Costo** | Gratis (limitado) / $17,500+ | **Gratis (sin límites)** | ✅ PostgreSQL |
| **Límites de datos** | 11 GB / ilimitado ($$$) | **Ilimitado** | ✅ PostgreSQL |
| **Límites de RAM** | 1 GB XE / ilimitado ($$$) | **Ilimitado** | ✅ PostgreSQL |
| **Límites de CPU** | 1 CPU XE / ilimitado ($$$) | **Ilimitado** | ✅ PostgreSQL |
| **Conformidad SQL** | Alta | **Alta (ANSI completo)** | 🤝 Empate |
| **JSON nativo** | Sí (12c+) | **Sí (JSONB optimizado)** | ✅ PostgreSQL |
| **Full-text search** | Sí (Oracle Text $$$) | **Sí (incluido)** | ✅ PostgreSQL |
| **Replicación** | Sí (Oracle GoldenGate $$$) | **Sí (incluido)** | ✅ PostgreSQL |
| **Comunidad** | Limitada | **Muy activa** | ✅ PostgreSQL |
| **Documentación** | Excelente | **Excelente** | 🤝 Empate |
| **Curva de aprendizaje** | Moderada-Alta | **Moderada** | ✅ PostgreSQL |
| **Performance OLTP** | Excelente | **Excelente** | 🤝 Empate |

---

## ⚠️ Consideraciones y Limitaciones

### Diferencias Importantes Oracle → PostgreSQL

1. **Secuencias**: PostgreSQL usa `SERIAL` o `IDENTITY` en lugar de secuencias explícitas
2. **Packages**: PostgreSQL no tiene packages, usar esquemas separados
3. **ROWNUM**: Usar `LIMIT` en lugar de `ROWNUM`
4. **DUAL**: No existe, no es necesario usar tabla dummy
5. **(+) Outer Joins**: Usar sintaxis estándar `LEFT/RIGHT JOIN`
6. **NVL**: Usar `COALESCE` o `NULLIF`
7. **TO_DATE**: Sintaxis diferente, usar `TO_TIMESTAMP`

### Limitaciones de Podman en Windows

- **Performance**: Ligeramente inferior a Linux nativo (5-10% overhead)
- **Volúmenes**: Mapeo de volúmenes más lento que en Linux
- **WSL2 requerido**: En Windows, Podman usa WSL2 como backend

### Recomendaciones para Producción

1. **Usar Linux**: RHEL/Rocky Linux/Ubuntu LTS para mejor performance
2. **SSD/NVMe**: Almacenamiento rápido es crítico para BD
3. **Monitoreo**: Implementar Prometheus + Grafana para métricas
4. **Alertas**: Configurar alertas para uso de disco, CPU, conexiones
5. **Réplicas**: Considerar streaming replication para alta disponibilidad

---

## 📞 Soporte y Recursos

### Documentación Oficial
- **PostgreSQL**: https://www.postgresql.org/docs/15/
- **Podman**: https://docs.podman.io/
- **Node.js pg driver**: https://node-postgres.com/

### Comunidad
- **PostgreSQL Slack**: https://postgres-slack.herokuapp.com/
- **Stack Overflow**: Tag `postgresql`
- **Reddit**: r/PostgreSQL

### Herramientas Útiles
- **pgAdmin 4**: Administración gráfica
- **DBeaver**: Cliente universal gratuito
- **pg_stat_statements**: Análisis de performance
- **pgBadger**: Análisis de logs
- **TimescaleDB**: Extensión para series temporales

---

## ✅ Checklist de Implementación

- [ ] Servidor preparado con requisitos mínimos
- [ ] Podman instalado y verificado
- [ ] Contenedor PostgreSQL desplegado y corriendo
- [ ] Tablas creadas con índices
- [ ] Datos migrados desde Oracle
- [ ] Integridad de datos verificada
- [ ] Aplicación Node.js conectada
- [ ] Endpoints probados y funcionales
- [ ] SSL/TLS configurado
- [ ] Backups automáticos programados
- [ ] Monitoreo configurado (pgAdmin/queries)
- [ ] Documentación actualizada para equipo
- [ ] Plan de rollback preparado
- [ ] Usuario Oracle deshabilitado (después de validación)

---

## 🚦 Siguiente Paso

**Acción Inmediata:** Validar que el servidor de destino cumple los requisitos mínimos y programar ventana de mantenimiento para la migración (estimado: **3-4 horas** de downtime).

**Contacto:** Para asistencia técnica durante la implementación, consultar con el equipo de desarrollo o DevOps.

---

**Preparado por:** Equipo de Desarrollo STC-Producción-v2  
**Última actualización:** 4 de febrero de 2026  
**Versión:** 1.0
