# Guía de Inicio - Podman y PostgreSQL

> **Estado verificado:** 4 mayo 2026 — Stack operativo en este equipo.

## Requisitos Previos (ya instalados en este equipo)

| Componente | Estado | Versión |
|---|---|---|
| Podman Desktop | ✅ Instalado | 1.27.1 |
| Podman CLI | ✅ Instalado | 5.8.2 |
| Docker Compose (provider) | ✅ Instalado | 5.1.3 |
| WSL | ✅ Instalado | — |
| Node.js | ✅ Instalado | v24 |

### Reinstalación desde cero (solo si es necesario)

```powershell
# Podman Desktop (GUI)
winget install -e --id RedHat.Podman-Desktop --accept-source-agreements --accept-package-agreements

# Podman CLI (requerido para comandos en terminal)
winget install -e --id RedHat.Podman --accept-source-agreements --accept-package-agreements

# Docker Compose (provider para 'podman compose')
winget install -e --id Docker.DockerCompose --accept-source-agreements --accept-package-agreements

# WSL (requiere PowerShell como Admin + reinicio)
wsl --install --no-launch
```

> **Importante:** Después de instalar WSL, reiniciar Windows. Luego correr `podman machine init` y `podman machine start`.

### Verificación rápida

```powershell
podman --version        # Debe mostrar: podman version 5.x.x
docker-compose --version # Debe mostrar: Docker Compose version v5.x.x
podman machine list     # Debe mostrar: podman-machine-default
```

### Verificación inmediata después de instalar

Abre una terminal **nueva** de PowerShell y verifica:

```powershell
podman --version
```

> Si aparece `podman no se reconoce`, el PATH no se actualizó aún — cierra PowerShell y vuelve a abrirlo. Si sigue igual, reinicia Windows.

### Requisito crítico de Windows para Podman Machine

Si `podman machine init` falla con "WSL no está instalado":

```powershell
# Ejecutar como Administrador, luego reiniciar Windows
wsl --install --no-launch
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

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

## Arranque diario (sesión de trabajo normal)

### Opción A — Atajo (alias del perfil PowerShell)

```powershell
stc-db-up        # levanta Podman machine + contenedor postgres
stc-db-status    # verifica que esté "Up (healthy)"
```

> En este equipo, `stc-db-up` y `./start-db.ps1` arrancan mejor el PostgreSQL diario porque usan `podman start` si `stc_postgres` ya existe. `podman compose up` queda como paso de creación inicial.

### Opción B — Script todo-en-uno (levanta DB + backend PoC + frontend PoC)

```powershell
cd C:\stc-mezclas-poc
.\start-dev.ps1
```

### Opción C — Comandos manuales paso a paso

```powershell
# 1. Iniciar Podman Machine
podman machine start
# Si ya está corriendo verás: "Error: already running"
# → Verificar inmediatamente que el socket responde:
podman ps
# Si 'podman ps' falla con "unable to connect", hacer stop/start (ver Troubleshooting)

# 2. Levantar PostgreSQL
cd C:\stc-produccion-v2
./start-db.ps1

# Alternativa mínima si el contenedor ya existe:
podman start stc_postgres

# Usar compose solo si el contenedor todavía no existe:
podman compose up -d postgres

# 3. Verificar estado — ESPERAR "Up (healthy)" antes de arrancar el backend
podman ps --filter name=stc_postgres
```

Salida esperada del paso 3:
```
CONTAINER ID  IMAGE                     STATUS          PORTS                   NAMES
xxxxxxxxxxxx  postgres:16-alpine        Up (healthy)    0.0.0.0:5433->5432/tcp  stc_postgres
```

---

### 2. Verificar el Estado de Podman (manual)

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
# Uso diario en este equipo (contenedor ya creado)
podman start stc_postgres

# Solo si el contenedor no existe todavía
podman compose up -d postgres
```

**Salida esperada:**
```
stc_postgres
```

Si se ejecuta por primera vez con `podman compose up -d postgres`, la salida esperada será similar a:

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

### 8. Iniciar el Backend PoC (stc-mezclas-poc)

```powershell
cd C:\stc-mezclas-poc\backend
npm run dev
```

**Salida esperada:**
```
✓ PoC Backend corriendo en puerto 3005
```

---

### 9. Iniciar el Frontend PoC (En otra terminal)

```powershell
cd C:\stc-mezclas-poc\frontend
npm run dev
```

**Salida esperada:**
```
VITE v5.x ready in xxx ms
➜ Local: http://localhost:5173/
```

> **Atajo:** en lugar de los pasos 8 y 9, ejecutar `.\start-dev.ps1` desde `C:\stc-mezclas-poc`.

---

## Información de Conexión

### PostgreSQL
- **Host:** localhost
- **Puerto:** 5433 (desde el host) / 5432 (interno al contenedor)
- **Base de datos:** stc_produccion
- **Usuario:** stc_user
- **Contraseña:** stc_password_2026

### API Backend PoC
- **URL:** http://localhost:3005
- **Health check:** http://localhost:3005/api/health

### Frontend PoC
- **URL:** http://localhost:5173

### Verificación de stack completo
```powershell
cd C:\stc-mezclas-poc
.\check-stack.ps1
# o el alias:
scheck
```

---

## Solución de Problemas Comunes

### Error: `podman compose` falla con "error during connect: EOF" o "pipe not available"

**Causa:** `win-sshproxy.exe` está corriendo con parámetros de una máquina Podman anterior y no puede crear el named pipe de Windows.

**Solución:**
```powershell
# Matar el proxy viejo y reiniciar la machine (el nuevo proxy toma el pipe correcto)
podman machine stop
Stop-Process -Name win-sshproxy -Force -ErrorAction SilentlyContinue
podman machine start
# Salida esperada: "API forwarding listening on: npipe:////./pipe/docker_engine"
```

---

### Error: `podman compose up -d postgres` falla con "could not find a matching machine for connection ..."

**Causa:** En este Windows puede fallar `podman machine inspect` aunque el daemon ya esté respondiendo. El contenedor existente se puede arrancar igual, pero `podman compose` no logra mapear la conexión SSH actual a la machine.

**Solución inmediata:** usar el arranque diario sin compose:
```powershell
cd C:\stc-produccion-v2
.\start-db.ps1

# o, si solo quieres levantar el contenedor existente
podman start stc_postgres
```

**Verificación:**
```powershell
podman ps --filter name=stc_postgres
```

Debe mostrar `Up (healthy)` antes de arrancar el backend.

---

### Error: `Connection terminated unexpectedly` al arrancar el backend

**Causa:** El contenedor postgres tuvo un shutdown no limpio (por ejemplo al hacer `podman machine stop` con el contenedor corriendo). Al reiniciar, postgres entra en modo de **recovery WAL** durante ~5-10 segundos; en ese lapso acepta TCP pero rechaza queries.

**Síntoma:**
```
Error: Connection terminated unexpectedly
    at async ensureSchema (config-standards.js:22:20)
```

**Solución:** Esperar a que los logs muestren `database system is ready to accept connections` antes de arrancar el backend:
```powershell
# Verificar que postgres terminó la recuperación
podman logs stc_postgres 2>&1 | Select-Object -Last 5
# Buscar: "database system is ready to accept connections"

# Entonces arrancar el backend
cd C:\stc-produccion-v2\backend
npm start
```

---

### Error: "already running" pero `podman ps` falla con "unable to connect"

**Causa:** La Podman machine está marcada como running en WSL, pero el proceso SSH que gestiona el socket se cayó. El puerto queda bloqueado por otro proceso del sistema.

**Síntoma exacto:**
```
Error: unable to connect to Podman socket: failed to connect: dial tcp 127.0.0.1:XXXXX: connectex: ...
```

**Solución:**
```powershell
# Stop forzado + reinicio limpio (Podman reasigna el puerto automáticamente)
podman machine stop
podman machine start

# Verificar que el socket responde
podman ps
```

---

### Error: "EADDRINUSE: address already in use — port 3005"

**Causa:** Ya hay un proceso Node.js escuchando en el puerto 3005 (una instancia anterior del backend que no se cerró correctamente).

**Solución:**
```powershell
# Matar el proceso Node en puerto 3005 y reiniciar el backend
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3005 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess) -Force
cd C:\stc-mezclas-poc\backend
npm start
```

---

### Error: `[uster-cardas] schema error:` / `[tensorapid] Schema setup error:` (mensaje vacío)

**Causa:** El backend arrancó mientras PostgreSQL aún estaba en estado `starting` (no `healthy`). La conexión falla antes de establecerse y el objeto de error no tiene `.message`.

**Solución:** Siempre esperar a que el STATUS sea `Up (healthy)` antes de arrancar el backend:
```powershell
# Esperar healthy (puede tardar 10-20 segundos)
podman ps --filter name=stc_postgres

# Una vez healthy, arrancar el backend
cd C:\stc-mezclas-poc\backend
npm start
# Salida esperada: "✓ PoC Backend corriendo en puerto 3005" (sin errores de schema)
```

---

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

### Error: "podman no se reconoce como nombre de un cmdlet"

**Causa:** Podman Desktop no está instalado o PowerShell no se ha reabierto después de la instalación.

**Solución:**
```powershell
# 1. Verificar si el comando existe
podman --version

# 2. Si no existe, instalar Podman Desktop
winget source update
winget install -e --id RedHat.Podman-Desktop --accept-source-agreements --accept-package-agreements

# 3. Cerrar PowerShell y abrir una terminal nueva

# 4. Verificar de nuevo
podman --version
```

Si tras reinstalar sigue fallando, reinicia Windows y vuelve a probar `podman --version` antes de ejecutar `podman machine start`.

---

### Error: "WSL version should be >= 1.2.5"

**Causa:** WSL está desactualizado o falta el kernel de WSL 2.

**Solución:**
```powershell
# 1. Actualizar WSL
wsl --update

# 2. Si la actualización normal no avanza, probar descarga directa
wsl --update --web-download

# 3. Verificar la versión instalada
wsl --version
```

**Resultado esperado:** `Versión de WSL` mayor o igual a `1.2.5`.

Si PowerShell indica que faltan componentes de Windows, abre una terminal como Administrador y habilita estas características:

```powershell
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

Después, reinicia Windows y vuelve a validar con `wsl --version`.

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

**Última actualización:** 4 de mayo de 2026
