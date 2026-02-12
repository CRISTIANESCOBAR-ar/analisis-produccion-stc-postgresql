# Guía de Inicio - Podman y PostgreSQL

## Requisitos Previos
- Podman Desktop instalado en Windows
- Docker Compose instalado
- Proyecto clonado en `C:\stc-produccion-v2`

---

## 🔑 Credenciales de Acceso

### PostgreSQL
- **Host:** localhost
- **Puerto:** 5433 (desde el host) / 5432 (interno)
- **Base de datos:** `stc_produccion`
- **Usuario:** `stc_user`
- **Contraseña:** `stc_password_2026`

### pgAdmin (Administración Visual)
- **URL:** http://localhost:5050/browser/
- **Email:** admin@stc.com
- **Contraseña:** admin123

---

## Pasos para Iniciar el Sistema

### 1. Iniciar Podman Machine

```powershell
podman machine start
```

**Salida esperada:**
```
Starting machine "podman-machine-default"
```

> **Nota:** Si ya está corriendo, verás: `Error: already running` (esto es normal, continúa).

---

### 2. Verificar el Estado de Podman

```powershell
podman ps
```

**Salida esperada:**
```
CONTAINER ID  IMAGE  COMMAND  CREATED  STATUS  PORTS  NAMES
```
(lista vacía o con contenedores existentes)

---

### 3. Navegar al Directorio del Proyecto

```powershell
cd C:\stc-produccion-v2
```

---

### 4. Levantar PostgreSQL

```powershell
podman compose up -d postgres
```

**Salida esperada:**
```
[+] up 2/2
 ✔ Network stc_network    Created
 ✔ Container stc_postgres Created
```

---

### 5. Verificar que PostgreSQL esté Corriendo

```powershell
podman ps
```

**Salida esperada:**
```
CONTAINER ID  IMAGE                     COMMAND    STATUS                   PORTS                   NAMES
cd4d2aa7ba99  postgres:16-alpine        postgres   Up (healthy)             0.0.0.0:5433->5432/tcp  stc_postgres
```

> **Importante:** Verifica que el STATUS sea `Up (healthy)`

---

### 6. Ver Logs de PostgreSQL (Opcional)

```powershell
podman logs stc_postgres
```

---

### 7. Iniciar pgAdmin (Opcional - Administración Visual de Base de Datos)

```powershell
podman compose up -d pgadmin
```

**Salida esperada:**
```
[+] up 1/1
 ✔ Container stc_pgadmin Created
```

Abre tu navegador en: **http://localhost:5050/browser/**

**Credenciales de acceso:**
- **Email:** admin@stc.com
- **Contraseña:** admin123

**Configurar conexión a PostgreSQL en pgAdmin:**
1. Click derecho en "Servers" → "Register" → "Server"
2. En la pestaña "General":
   - **Name:** `STC Produccion`
3. En la pestaña "Connection":
   - **Host name/address:** `postgres` (nombre del contenedor)
   - **Port:** `5432`
   - **Maintenance database:** `stc_produccion`
   - **Username:** `stc_user`
   - **Password:** `stc_password_2026` ⚠️ No guardar la contraseña por seguridad
4. Click en "Save"

> **Nota:** pgAdmin es opcional. Solo inícialo si necesitas administrar la base de datos visualmente.

---

### 8. Iniciar el Backend

```powershell
cd backend
npm start
```

**Salida esperada:**
```
✅ PostgreSQL conectado
🚀 Backend iniciado en puerto 3001
```

---

### 9. Iniciar el Frontend (En otra terminal)

```powershell
cd C:\stc-produccion-v2\frontend
npm run dev
```

**Salida esperada:**
```
VITE v5.x ready in xxx ms
➜ Local: http://localhost:5173/
```

---

## Información de Conexión

### PostgreSQL
- **Host:** localhost
- **Puerto:** 5433 (desde el host)
- **Base de datos:** stc_produccion
- **Usuario:** stc_user
- **Contraseña:** stc_password_2026

### pgAdmin (Opcional)
- **URL:** http://localhost:5050/browser/
- **Email:** admin@stc.com
- **Contraseña:** admin123

### API Backend
- **URL:** http://localhost:3001
- **Endpoints:** 
  - API: `http://localhost:3001/api/*`
  - Health: `http://localhost:3001/health`

### Frontend
- **URL:** http://localhost:5173

---

## Solución de Problemas Comunes

### Error: "network stc_network has incorrect label"

**Causa:** Red creada con configuración antigua.

**Solución:**
```powershell
# 1. Detener todo
podman compose down

# 2. Eliminar todos los contenedores
podman rm -f $(podman ps -aq)

# 3. Eliminar la red problemática
podman network rm stc_network

# 4. Recrear PostgreSQL
podman compose up -d postgres
```

---

### Error: "PostgreSQL no disponible (intento X/30)"

**Causa:** PostgreSQL no está corriendo o no está listo.

**Solución:**
```powershell
# Verificar el estado
podman ps

# Ver los logs
podman logs stc_postgres

# Si no aparece, levantar PostgreSQL
podman compose up -d postgres

# Esperar a que el healthcheck sea "healthy"
podman ps
```

---

### Error: "ECONNREFUSED 127.0.0.1:5432"

**Causa:** El backend está intentando conectarse al puerto incorrecto.

**Solución:**
Verificar variables de entorno en `backend/.env` o configuración:
```env
PG_HOST=localhost
PG_PORT=5433
```

---

### Error: "pgAdmin no carga en http://localhost:5050"

**Causa:** El contenedor de pgAdmin no está corriendo o no se levantó correctamente.

**Solución:**
```powershell
# Verificar si está corriendo
podman ps | Select-String pgadmin

# Ver los logs para diagnosticar
podman logs stc_pgadmin

# Reiniciar el contenedor
podman restart stc_pgadmin

# Si no existe, levantarlo
podman compose up -d pgadmin
```

---

## Comandos Útiles

### Ver todos los contenedores (activos e inactivos)
```powershell
podman ps -a
```

### Detener PostgreSQL
```powershell
podman stop stc_postgres
```

### Reiniciar PostgreSQL
```powershell
podman restart stc_postgres
```

### Ver logs de pgAdmin
```powershell
podman logs stc_pgadmin
```

### Detener pgAdmin
```powershell
podman stop stc_pgadmin
```

### Detener todo el stack
```powershell
podman compose down
```

### Ver las redes
```powershell
podman network ls
```

### Limpiar todo (CUIDADO: elimina datos)
```powershell
podman compose down -v
```

---

## Orden Recomendado de Inicio

1. Podman Machine ✅
2. PostgreSQL (contenedor) ✅
3. pgAdmin (opcional) ✅
4. Backend (Node.js) ✅
5. Frontend (Vite) ✅

---

## Orden Recomendado de Apagado

1. Frontend (Ctrl+C en terminal)
2. Backend (Ctrl+C en terminal)
3. pgAdmin: `podman stop stc_pgadmin` (opcional)
4. PostgreSQL: `podman stop stc_postgres` (opcional, puede quedarse corriendo)
5. Podman Machine: `podman machine stop` (opcional)

---

**Última actualización:** 10 de febrero de 2026
