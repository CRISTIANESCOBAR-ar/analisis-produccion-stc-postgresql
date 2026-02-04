# Backend API - STC Producción V2

Backend Express.js con PostgreSQL para sistema integrado de producción y ensayos textiles.

## 🎯 Características

- **Base de datos:** PostgreSQL 16 con 22 tablas
- **ORM:** node-postgres (pg) con consultas SQL nativas
- **CORS:** Configurado para desarrollo local
- **Pool de conexiones:** Hasta 20 conexiones simultáneas

## 📦 Tablas Soportadas

### Producción (11 tablas)
- `tb_PRODUCCION` - Registro principal (~150K registros)
- `tb_CALIDAD` - Control de calidad
- `tb_PARADAS` - Paradas de máquinas
- `tb_PRODUCCION_OE` - Producción OE específica (6,315 registros)
- `tb_FICHAS` - Fichas técnicas
- `tb_METAS` - Metas mensuales
- `tb_TESTES` - Tests de producción
- `tb_DEFECTOS` - Catálogo de defectos
- `tb_RESIDUOS_INDIGO` - Residuos índigo
- `tb_RESIDUOS_POR_SECTOR` - Residuos por sector
- `tb_CALIDAD_FIBRA` - Datos HVI

### Ensayos (4 tablas - Oracle/carga-datos-docker)
- `uster_par` - Parámetros Uster
- `uster_tbl` - Datos Uster (U%, CVm%, irregularidades)
- `tensorapid_par` - Parámetros TensoRapid
- `tensorapid_tbl` - Datos TensoRapid (fuerza, elongación)

### Config/Sistema (7 tablas)
- `import_control`, `import_column_warnings`, `schema_changes_log`
- `tb_COSTO_ITEMS`, `tb_COSTO_ITEM_ALIAS`, `tb_COSTO_MENSUAL`
- `tb_PROCESO`

## 🚀 Instalación

```bash
cd backend
npm install
cp .env.example .env
node server.js
```

## 📡 Endpoints API

### Health Check
```
GET /api/health
```

### USTER
```
POST /api/uster/status - Verificar ensayos existentes
GET  /api/uster/par - Obtener parámetros
GET  /api/uster/tbl?testnr=xxx - Obtener datos detallados
POST /api/uster/husos - Obtener lista de husos
POST /api/uster/upload - Subir archivos .PAR y .TBL
DELETE /api/uster/delete/:testnr - Eliminar ensayo
```

### TensoRapid
```
POST /api/tensorapid/status - Verificar ensayos existentes
GET  /api/tensorapid/par - Obtener parámetros
GET  /api/tensorapid/tbl?testnr=xxx - Obtener datos detallados
POST /api/tensorapid/upload - Subir datos TensoRapid
DELETE /api/tensorapid/delete/:testnr - Eliminar ensayo
```

## 🔧 Variables de Entorno

```env
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=stc_produccion
PG_USER=stc_user
PG_PASSWORD=stc_password_2026
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```

## 📊 Pool de Conexiones

- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 2s

## 🧪 Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Get Uster PAR
curl http://localhost:3001/api/uster/par

# Get TensoRapid PAR
curl http://localhost:3001/api/tensorapid/par
```

## 🔐 Seguridad

- CORS configurado para localhost en desarrollo
- Validación de datos en endpoints
- Transacciones para operaciones críticas
- Prepared statements para prevenir SQL injection

## 📝 Notas

- Los datos se almacenan en PostgreSQL dentro de contenedor Podman
- Compatibilidad con estructura Oracle original (uppercaseKeys)
- Logs de queries con duración de ejecución
