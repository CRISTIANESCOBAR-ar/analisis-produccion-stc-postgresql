# 🚀 Guía de Implementación en Servidor Web

Guía completa para implementar **STC Producción V2** en un servidor web de producción.

## 📋 Índice

1. [Mostrar Configuración Actual al Personal de IT](#mostrar-configuración-actual-al-personal-de-it)
2. [Requisitos del Servidor](#requisitos-del-servidor)
3. [Opción 1: Deployment con Docker/Podman (Recomendado)](#opción-1-deployment-con-dockerpodman-recomendado)
4. [Opción 2: Deployment Manual (sin contenedores)](#opción-2-deployment-manual-sin-contenedores)
5. [Configuración de Nginx como Reverse Proxy](#configuración-de-nginx-como-reverse-proxy)
6. [SSL/HTTPS con Let's Encrypt](#sslhttps-con-lets-encrypt)
7. [Variables de Entorno](#variables-de-entorno)
8. [Gestión de Procesos con PM2](#gestión-de-procesos-con-pm2)
9. [Backups Automáticos](#backups-automáticos)
10. [Monitoreo y Logs](#monitoreo-y-logs)
11. [Troubleshooting](#troubleshooting)

---

## � Mostrar Configuración Actual al Personal de IT

Esta sección te muestra **qué comandos ejecutar** y **qué archivos mostrar** al personal de IT para que entiendan cómo está configurado el proyecto actualmente.

### 📌 Preparación Previa

Antes de la reunión, abre PowerShell en la carpeta del proyecto:

```powershell
cd C:\stc-produccion-v2
```

---

### 1️⃣ Información General del Proyecto

```powershell
# Mostrar estructura del proyecto
tree /F /A

# O más simple, listar carpetas principales
Get-ChildItem -Directory | Format-Table Name, LastWriteTime

# Mostrar archivos de configuración importantes
Get-ChildItem -Filter "*.yml","*.json","Dockerfile",".env*" -Recurse -Depth 1 | 
    Select-Object Name, Directory, Length, LastWriteTime | Format-Table
```

**Archivos clave a mencionar:**
- `docker-compose.yml` - Orquestación de servicios
- `Dockerfile` - Build de la aplicación
- `.env` (si existe) - Variables de entorno
- `backend/package.json` - Dependencias del backend
- `frontend/package.json` - Dependencias del frontend
- `init-db/*.sql` - Scripts de inicialización de BD

---

### 2️⃣ Configuración de Podman/Docker

```powershell
# Verificar si están instalados
podman --version
docker --version
# (Uno de los dos debería funcionar)

# Mostrar información del sistema
podman info
# o
docker info

# Ver máquinas Podman (Windows)
podman machine list
podman machine inspect podman-machine-default

# Mostrar configuración de red
podman network ls
podman network inspect stc_network
```

**💡 Explicar:**
- Versión de Podman/Docker instalada
- Sistema operativo del host de contenedores
- Arquitectura (amd64, arm64)
- Configuración de storage y networking

---

### 3️⃣ Contenedores en Ejecución

```powershell
# Ver contenedores activos
podman-compose ps
# o
docker compose ps

# Ver TODOS los contenedores (incluso detenidos)
podman ps -a
# o
docker ps -a

# Detalles de un contenedor específico
podman inspect stc_postgres
podman inspect stc_app

# Ver recursos consumidos
podman stats --no-stream
# o
docker stats --no-stream
```

**💡 Mostrar:**
- Qué contenedores están corriendo
- Puertos mapeados
- Estado de salud (health)
- Uso de CPU y memoria actual

---

### 4️⃣ Archivo docker-compose.yml

```powershell
# Mostrar el archivo completo
Get-Content docker-compose.yml

# O abrirlo en un editor
code docker-compose.yml
notepad docker-compose.yml
```

**💡 Puntos importantes a destacar:**

```yaml
# PUERTOS EXPUESTOS:
- 3001:3001    # Aplicación web (backend + frontend)
- 5433:5432    # PostgreSQL (evita conflicto con instalación local)
- 5050:80      # pgAdmin (opcional)

# VOLÚMENES:
- postgres_data:/var/lib/postgresql/data  # Persistencia de BD
- ./init-db:/docker-entrypoint-initdb.d   # Scripts de inicialización
- ${STC_CSV_HOST_PATH:-./csv}:/data/csv   # Archivos CSV para importar

# VARIABLES DE ENTORNO CLAVE:
- NODE_ENV=production
- PG_HOST=postgres  # Nombre del contenedor, no 'localhost'
- PG_PORT=5432      # Puerto INTERNO
- CSV_FOLDER=/data/csv  # Ruta DENTRO del contenedor
```

---

### 5️⃣ Variables de Entorno

```powershell
# Si existe archivo .env en la raíz, mostrarlo (CUIDADO CON CONTRASEÑAS)
if (Test-Path .env) {
    Write-Host "Archivo .env encontrado:"
    Get-Content .env
} else {
    Write-Host "No hay archivo .env en la raíz"
    Write-Host "Las variables están definidas directamente en docker-compose.yml"
}

# Ver variables dentro de un contenedor en ejecución
podman exec stc_app env | Sort-Object
# o
docker compose exec app env | Sort-Object

# Filtrar solo las relevantes
podman exec stc_app env | Select-String -Pattern "^(NODE_ENV|PORT|PG_|CSV_)"
```

**💡 Variables importantes para el servidor:**

```env
NODE_ENV=production          # Modo de ejecución
PORT=3001                    # Puerto del backend
PG_HOST=postgres             # Host de PostgreSQL (nombre del servicio)
PG_PORT=5432                 # Puerto interno de PostgreSQL
PG_DATABASE=stc_produccion   # Nombre de la base de datos
PG_USER=stc_user             # Usuario de PostgreSQL
PG_PASSWORD=***              # ⚠️ Cambiar en producción
CSV_FOLDER=/data/csv         # Donde están los CSVs
FRONTEND_DIST=/app/frontend/dist  # Build del frontend
```

---

### 6️⃣ Configuración de PostgreSQL

```powershell
# Conectarse a PostgreSQL
podman exec -it stc_postgres psql -U stc_user -d stc_produccion
# o
docker compose exec postgres psql -U stc_user -d stc_produccion
```

**Una vez dentro de `psql`, ejecutar:**

```sql
-- Ver versión de PostgreSQL
SELECT version();

-- Listar todas las bases de datos
\l

-- Conectar a la base de datos del proyecto
\c stc_produccion

-- Ver todas las tablas
\dt

-- Ver detalles de una tabla específica
\d produccion
\d tb_defectos
\d tb_fichas

-- Ver tamaño de la base de datos
SELECT 
    pg_size_pretty(pg_database_size('stc_produccion')) as db_size;

-- Ver tamaño de cada tabla
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Ver conexiones activas
SELECT 
    datname, 
    usename, 
    application_name, 
    client_addr, 
    state 
FROM pg_stat_activity 
WHERE datname = 'stc_produccion';

-- Ver configuración importante
SHOW max_connections;
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW maintenance_work_mem;

-- Salir
\q
```

**💡 Información para el servidor:**
- Versión exacta de PostgreSQL (actualmente 16-alpine)
- Número de tablas y registros
- Tamaño total de la base de datos
- Parámetros de rendimiento actuales

---

### 7️⃣ Scripts de Inicialización de Base de Datos

```powershell
# Listar scripts de inicialización en orden
Get-ChildItem init-db\*.sql | Sort-Object Name | Format-Table Name, Length, LastWriteTime

# Mostrar contenido de los primeros scripts
Get-Content init-db\01-schema.sql | Select-Object -First 50
Get-Content init-db\02-recreate-prod-tables.sql | Select-Object -First 30
```

**💡 Explicar el orden de ejecución:**
1. `01-schema.sql` - Estructura base
2. `02-recreate-prod-tables.sql` - Tablas principales
3. `03-create-sync-history.sql` - Tracking de sincronizaciones
4. `04-08-...sql` - Tablas específicas (defectos, calidad, etc.)
5. `golden-batch*.sql` - Lógica de análisis

Los scripts se ejecutan **automáticamente** cuando se crea el contenedor por primera vez.

---

### 8️⃣ Volúmenes y Persistencia de Datos

```powershell
# Listar volúmenes
podman volume ls
# o
docker volume ls

# Ver detalles de un volumen
podman volume inspect stc_postgres_data
# o
docker volume inspect stc_postgres_data

# Ver dónde están montados los volúmenes
podman inspect stc_postgres | Select-String -Pattern "Mounts" -Context 0,20
```

**💡 Volúmenes importantes:**
- `stc_postgres_data` - **Datos de PostgreSQL** (debe respaldarse)
- `stc_pgadmin_data` - Configuración de pgAdmin (opcional)
- `./csv:/data/csv` - Bind mount para archivos CSV

**⚠️ CRÍTICO para el servidor:**
Los datos de PostgreSQL están en un volumen Docker. En producción:
- Hacer backups regulares con `pg_dump`
- Configurar replicación si es crítico
- Monitorear espacio en disco

---

### 9️⃣ Networking y Puertos

```powershell
# Ver redes de Podman/Docker
podman network ls
podman network inspect stc_network

# Ver qué puertos están escuchando
netstat -ano | Select-String -Pattern ":3001|:5433|:5050"

# O con PowerShell
Get-NetTCPConnection | Where-Object {$_.LocalPort -in 3001,5433,5050} | 
    Select-Object LocalAddress, LocalPort, State, OwningProcess
```

**💡 Puertos utilizados:**
- **3001** - Aplicación web (HTTP)
  - Frontend: Interfaz de usuario
  - Backend API: `/api/*`
  
- **5433** - PostgreSQL (expuesto para desarrollo)
  - Puerto externo: 5433
  - Puerto interno del contenedor: 5432
  - ⚠️ En producción, NO exponer directamente (solo VPN/red interna)

- **5050** - pgAdmin (opcional)
  - Herramienta de administración web
  - En producción: usar solo en red privada o VPN

**Arquitectura de red:**
```
Internet/Red Local
        ↓
   Puerto 80/443 (HTTP/HTTPS)
        ↓
   Nginx (Reverse Proxy)
        ↓
   Puerto 3001 (App Container)
        ↓
   Red interna Docker: stc_network
        ↓
   PostgreSQL Container (puerto 5432 interno)
```

---

### 🔟 Dockerfile - Proceso de Build

```powershell
# Mostrar el Dockerfile
Get-Content Dockerfile
```

**💡 Explicar el proceso multi-stage:**

```dockerfile
# Etapa 1: Construir frontend (Vite)
FROM node:22-alpine AS build-frontend
# - Instala dependencias de producción
# - Ejecuta 'npm run build'
# - Genera archivos estáticos optimizados en frontend/dist

# Etapa 2: Preparar backend
FROM node:22-alpine AS build-backend
# - Instala solo dependencias de producción (--omit=dev)
# - Copia código del backend

# Etapa 3: Imagen final (runtime)
FROM node:22-alpine AS runtime
# - Solo incluye lo necesario para ejecutar
# - Copia backend compilado + frontend build
# - Tamaño de imagen optimizado (~200MB vs ~1GB)
```

**Beneficios:**
- Imagen final pequeña (solo runtime, sin herramientas de build)
- Seguridad (sin código fuente del frontend)
- Rápido de desplegar

---

### 1️⃣1️⃣ Logs y Debugging

```powershell
# Ver logs en tiempo real
podman-compose logs -f app
# o
docker compose logs -f app

# Ver logs de PostgreSQL
podman-compose logs -f postgres

# Ver últimas 100 líneas
podman-compose logs --tail=100 app

# Ver logs desde la última hora
podman-compose logs --since 1h app

# Ver logs de todos los servicios
podman-compose logs --tail=50
```

**💡 Qué buscar en los logs:**
- Errores de conexión a PostgreSQL
- Errores de importación de CSV
- Peticiones HTTP y sus tiempos de respuesta
- Queries lentas de base de datos

---

### 1️⃣2️⃣ Rendimiento Actual

```powershell
# Ver uso de recursos
podman stats
# o
docker stats

# Información del sistema
systeminfo | Select-String -Pattern "Memoria|Procesador"

# Espacio en disco utilizado por Docker
docker system df
# o
podman system df
```

**Métricas a compartir:**
- CPU y RAM usadas por cada contenedor
- Espacio en disco de volúmenes
- Tamaño de imágenes
- Número de contenedores activos

---

### 1️⃣3️⃣ Endpoints de la API

```powershell
# Verificar que la app está corriendo
curl http://localhost:3001/api/health

# Probar otros endpoints (ejemplos)
curl http://localhost:3001/api/produccion/stats
curl http://localhost:3001/api/defectos/resumen
curl http://localhost:3001/api/calidad/ultimos
```

**💡 Endpoints principales:**
```
GET  /api/health                    - Health check
GET  /api/produccion/stats          - Estadísticas de producción
GET  /api/defectos/resumen          - Resumen de defectos
GET  /api/calidad/ultimos           - Últimos datos de calidad
POST /api/import/csv                - Importar archivo CSV
GET  /api/import/status             - Estado de importaciones
POST /api/import/all                - Importar todos los CSV
```

---

### 1️⃣4️⃣ Archivos CSV de Importación

```powershell
# Listar archivos CSV disponibles
Get-ChildItem csv\*.csv | 
    Select-Object Name, Length, LastWriteTime | 
    Format-Table -AutoSize

# Ver tamaño total
$totalSize = (Get-ChildItem csv\*.csv | Measure-Object -Property Length -Sum).Sum
Write-Host "Tamaño total de CSVs: $([math]::Round($totalSize/1MB, 2)) MB"

# Ver primeras líneas de un CSV (para mostrar estructura)
Get-Content csv\fichaArtigo.csv -First 5
Get-Content csv\rptDefPeca.csv -First 5
```

**💡 CSVs del proyecto:**
- `fichaArtigo.csv` - Fichas de artículos
- `rptDefPeca.csv` - Defectos por pieza
- `rptProducaoMaquina.csv` - Producción por máquina
- `rptPrdTestesFisicos.csv` - Tests físicos
- Y otros archivos relacionados

**⚠️ Para el servidor:**
- Los CSVs deben estar en `/opt/stc-data/csv` (o ruta configurada)
- Se importan mediante la interfaz web o API
- Proceso de importación puede tardar varios minutos para archivos grandes

---

### 1️⃣5️⃣ Backup y Restauración

```powershell
# Mostrar script de backup existente
Get-Content backup-database.ps1

# Listar backups disponibles
Get-ChildItem backups\*.sql | 
    Select-Object Name, Length, LastWriteTime | 
    Sort-Object LastWriteTime -Descending |
    Format-Table -AutoSize

# Ver tamaño del último backup
$lastBackup = Get-ChildItem backups\*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "Último backup: $($lastBackup.Name)"
Write-Host "Tamaño: $([math]::Round($lastBackup.Length/1MB, 2)) MB"
Write-Host "Fecha: $($lastBackup.LastWriteTime)"
```

**💡 Estrategia de backup recomendada:**
- **Diario**: `pg_dump` automático a las 2 AM
- **Semanal**: Backup completo + archivos CSV
- **Retención**: 30 días de backups diarios
- **Ubicación**: Fuera del servidor (S3, NAS, etc.)

---

### 1️⃣6️⃣ Documentación del Proyecto

```powershell
# Listar archivos de documentación
Get-ChildItem *.md | Format-Table Name, Length, LastWriteTime

# Abrir README principal
code README.md
# o
notepad README.md
```

**Documentos importantes:**
- `README.md` - Descripción general y quick start
- `GUIA_IMPLEMENTACION_SERVIDOR.md` - Esta guía (para deployment)
- `GUIA_INICIO_PODMAN_POSTGRESQL.md` - Setup de Podman
- `MIGRACION_ORACLE_POSTGRESQL.md` - Proceso de migración
- `INFORME_POSTGRESQL_PODMAN.md` - Informe técnico
- `GOLDEN_BATCH_LOGIC.md` - Lógica de análisis de batches

---

### 📊 Resumen para el Personal de IT

#### ✅ Stack Tecnológico
- **Frontend**: Vue 3 + Vite + TailwindCSS
- **Backend**: Node.js 20 + Express
- **Base de Datos**: PostgreSQL 16
- **Contenedores**: Podman/Docker + compose
- **Reverse Proxy**: Nginx (en servidor)
- **SSL**: Let's Encrypt (en servidor)

#### ✅ Requisitos del Servidor
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disco**: 100 GB SSD
- **OS**: Ubuntu 22.04 LTS o similar
- **Software**: Docker/Podman, Nginx, Node.js 20

#### ✅ Puertos Necesarios
- `80` - HTTP (redirige a HTTPS)
- `443` - HTTPS (aplicación web)
- `5432` - PostgreSQL (solo red interna/VPN)

#### ✅ Volúmenes/Datos Persistentes
- PostgreSQL data: `stc_postgres_data` (~500 MB - 2 GB)
- Archivos CSV: `/opt/stc-data/csv` (~100 MB - 1 GB)
- Backups: `/opt/stc-backups` (depende de retención)

#### ✅ Seguridad
- Firewall: Solo puertos 80, 443, 22
- PostgreSQL: NO exponer al público
- Variables de entorno: Contraseñas fuertes
- SSL: Certificado válido (Let's Encrypt)
- Backups: Cifrados y fuera del servidor

#### ✅ Monitoreo Recomendado
- Uptime del servicio
- Uso de CPU, RAM, disco
- Logs de error de aplicación
- Logs de error de PostgreSQL
- Tiempo de respuesta de la API
- Espacio de base de datos

---

### 🎯 Checklist para el Personal de IT

Antes de implementar en servidor, verificar:

- [ ] Entendieron la arquitectura de contenedores
- [ ] Revisaron el `docker-compose.yml`
- [ ] Vieron cómo conectarse a PostgreSQL
- [ ] Conocen la ubicación de los scripts de inicialización
- [ ] Entienden el proceso de importación de CSV
- [ ] Saben cómo hacer backups y restauraciones
- [ ] Verificaron los puertos necesarios
- [ ] Revisaron los requisitos de hardware
- [ ] Conocen la estructura de logs
- [ ] Tienen acceso a la documentación completa
- [ ] Coordinaron el dominio y DNS
- [ ] Planificaron la estrategia de backup
- [ ] Definieron el plan de monitoreo
- [ ] Acordaron el proceso de actualización

---

### 💬 Preguntas Frecuentes del Personal de IT

**P: ¿Podemos usar Docker en lugar de Podman?**  
R: Sí, son 100% compatibles. Solo cambia `podman-compose` por `docker compose`.

**P: ¿Necesitamos Node.js instalado en el servidor?**  
R: No si usan Docker/Podman. Todo está en contenedores. Solo si hacen deployment manual.

**P: ¿Cómo actualizamos la aplicación?**  
R: `git pull` + `docker compose build` + `docker compose up -d`. Ver sección de Mantenimiento.

**P: ¿Dónde están los logs en producción?**  
R: `docker compose logs app` o dentro del contenedor en `/app/logs` si se configura.

**P: ¿Cuánto tarda el proceso de importación de CSV?**  
R: Depende del tamaño. 1-2 minutos para archivos pequeños, hasta 10-15 minutos para muy grandes.

**P: ¿Qué pasa si se cae el servidor?**  
R: Con `restart: unless-stopped`, los contenedores se reinician automáticamente. Systemd service asegura inicio al bootear.

**P: ¿Podemos usar PostgreSQL existente en lugar del contenedor?**  
R: Sí, cambiar variables PG_HOST, PG_PORT en el contenedor de app para apuntar a PostgreSQL externo.

**P: ¿Es necesario Nginx?**  
R: Recomendado para SSL/HTTPS, caché, y mejor performance. Pero la app puede correr en puerto 80 directamente.

---

## �🖥️ Requisitos del Servidor

### Mínimos
- **CPU:** 2 cores
- **RAM:** 4 GB (Linux) / 6 GB (Windows)
- **Disco:** 50 GB SSD
- **OS:** Ubuntu 22.04 LTS / Debian 12 / RHEL 9 / **Windows Server 2019/2022**

### Recomendados (Producción)
- **CPU:** 4 cores
- **RAM:** 8 GB (Linux) / 12 GB (Windows)
- **Disco:** 100 GB SSD
- **OS:** Ubuntu 22.04 LTS (más eficiente) o **Windows Server 2022** (más familiar)
- **Red:** IP pública estática o nombre de dominio

### 💡 Nota sobre Sistema Operativo
**El proyecto funciona en ambos:** Windows Server y Linux Server.

**👉 Para un análisis completo, ver: [WINDOWS_VS_LINUX_SERVIDOR.md](WINDOWS_VS_LINUX_SERVIDOR.md)**

**Resumen rápido:**

**Elige Windows Server si:**
- ✅ Ya tienen licencias de Windows Server
- ✅ El equipo IT prefiere administración por GUI/RDP
- ✅ Necesitan integración con Active Directory
- ✅ Ya tienen infraestructura Windows establecida
- ✅ Funciona en tu ambiente actual (como en tu Windows 11 Pro)

**Elige Linux si:**
- ✅ Buscan reducir costos (sin licencias) - ~$1000 USD de ahorro
- ✅ Quieren máximo rendimiento y menor uso de recursos (~2GB RAM menos)
- ✅ Prefieren la solución estándar de la industria
- ✅ El equipo IT tiene experiencia con Linux

**⚖️ Ambas opciones son igualmente válidas.** Los contenedores garantizan que el proyecto funcione idénticamente en ambos sistemas operativos.

### Software
- Docker 24+ o Podman 4.5+ (para deployment con contenedores)
- Node.js 20+ (para deployment manual)
- PostgreSQL 14+ (para deployment manual)
- Nginx 1.22+
- Git 2.40+

---

## 🐳 Opción 1: Deployment con Docker/Podman (Recomendado)

Esta es la forma más sencilla y confiable de implementar el proyecto en producción.

**Funciona tanto en Windows Server como en Linux Server.** Las instrucciones se dividen en dos secciones según tu elección.

### 1.1a Preparar el Servidor - Linux (Ubuntu/Debian)

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y git curl wget nano ufw

# Instalar Docker (opción A)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# O instalar Podman (opción B - gratuito para empresas)
sudo apt install -y podman podman-compose

# Configurar firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### 1.1b Preparar el Servidor - Windows Server 2019/2022

```powershell
# Abrir PowerShell como Administrador

# Instalar Chocolatey (gestor de paquetes)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar Git
choco install git -y

# Instalar Docker Desktop (opción A - más fácil con GUI)
# Descargar desde: https://www.docker.com/products/docker-desktop
# O instalar via Chocolatey:
choco install docker-desktop -y

# O instalar Podman (opción B - gratuito, sin Docker Desktop)
# Descargar instalador desde: https://github.com/containers/podman/releases
# O via Chocolatey:
choco install podman-desktop -y

# Instalar Podman CLI
# Seguir wizard de instalación, marcar:
# - "Add podman to PATH"
# - "Create podman machine"

# Verificar instalación
podman --version
# o
docker --version

# Configurar Firewall de Windows
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# Iniciar máquina Podman (si usas Podman)
podman machine init
podman machine start
podman machine list
```

**💡 Nota Windows Server:**
- Docker Desktop requiere WSL2 en Windows Server
- Podman corre nativamente en Windows (más ligero)
- Si usas Podman, los comandos son idénticos a Linux

### 1.2 Clonar el Proyecto

**En Linux:**
```bash
# Crear directorio para el proyecto
sudo mkdir -p /opt/stc-produccion
cd /opt/stc-produccion

# Clonar repositorio (ajustar URL según tu repositorio)
git clone https://github.com/tu-empresa/stc-produccion-v2.git .

# O subir archivos con scp/rsync desde máquina local
# rsync -avz --progress /ruta/local/ usuario@servidor:/opt/stc-produccion/
```

**En Windows Server:**
```powershell
# Crear directorio para el proyecto
New-Item -Path "C:\stc-produccion" -ItemType Directory -Force
Set-Location "C:\stc-produccion"

# Clonar repositorio (ajustar URL según tu repositorio)
git clone https://github.com/tu-empresa/stc-produccion-v2.git .

# O copiar archivos desde máquina local con Explorador de Windows
# O usar RDP para copiar/pegar directo
# O usar robocopy:
# robocopy \\maquina-origen\carpeta C:\stc-produccion /E /Z /MT
```

### 1.3 Configurar Variables de Entorno

**En Linux:**
```bash
# Crear archivo .env en la raíz del proyecto
nano .env
```

**En Windows:**
```powershell
# Crear archivo .env en la raíz del proyecto
notepad .env
# O usar VS Code:
# code .env
```

Contenido del `.env` (igual para Windows y Linux):

```env
# ==============================================
# CONFIGURACIÓN DE PRODUCCIÓN - STC PRODUCCIÓN V2
# ==============================================

# Path de CSV en el servidor
# Linux: /opt/stc-data/csv
# Windows: C:\stc-data\csv
STC_CSV_HOST_PATH=/opt/stc-data/csv

# Base de datos PostgreSQL
POSTGRES_DB=stc_produccion
POSTGRES_USER=stc_user
POSTGRES_PASSWORD=tu_contraseña_segura_aqui_2026

# Backend API
NODE_ENV=production
PORT=3001

# pgAdmin (opcional - comentar si no se usa)
PGADMIN_DEFAULT_EMAIL=admin@tuempresa.com
PGADMIN_DEFAULT_PASSWORD=admin_password_seguro_2026
```

**⚠️ IMPORTANTE:** 
- Cambia las contraseñas por valores seguros y únicos
- En Windows, ajusta `STC_CSV_HOST_PATH=C:/stc-data/csv` (usa `/` no `\`)

### 1.4 Crear Directorio de CSV

**En Linux:**
```bash
# Crear directorio para los archivos CSV
sudo mkdir -p /opt/stc-data/csv

# Dar permisos apropiados
sudo chown -R $USER:$USER /opt/stc-data

# Copiar archivos CSV existentes (si los tienes)
cp -r ./csv/* /opt/stc-data/csv/
```

**En Windows Server:**
```powershell
# Crear directorio para los archivos CSV
New-Item -Path "C:\stc-data\csv" -ItemType Directory -Force

# Copiar archivos CSV existentes (si los tienes)
Copy-Item -Path ".\csv\*" -Destination "C:\stc-data\csv\" -Recurse

# O crear carpeta compartida en red para que usuarios suban CSVs
New-SmbShare -Name "stc-csv" -Path "C:\stc-data\csv" -FullAccess "Todos"
```

**💡 Ventaja en Windows:** Puedes compartir `C:\stc-data\csv` en la red y los usuarios copian CSVs directamente usando el Explorador de Windows (`\\servidor\stc-csv`).

### 1.5 Construir y Levantar los Contenedores

**En Linux:**
```bash
# Construir las imágenes
docker compose build
# O con Podman:
# podman-compose build

# Levantar todos los servicios
docker compose up -d
# O con Podman:
# podman-compose up -d

# Verificar que están corriendo
docker compose ps
docker compose logs -f app

# Verificar salud de PostgreSQL
docker compose exec postgres pg_isready -U stc_user -d stc_produccion
```

**En Windows Server:**
```powershell
# Construir las imágenes
docker compose build
# O con Podman:
# podman-compose build

# Levantar todos los servicios
docker compose up -d
# O con Podman:
# podman-compose up -d

# Verificar que están corriendo
docker compose ps
docker compose logs -f app

# Verificar salud de PostgreSQL
docker compose exec postgres pg_isready -U stc_user -d stc_produccion
```

**💡 Nota:** Los comandos son idénticos en Windows y Linux. Solo cambia la sintaxis del shell (bash vs PowerShell).

### 1.6 Verificar la Aplicación

```bash
# Probar backend API
curl http://localhost:3001/api/health

# Ver logs en tiempo real
docker compose logs -f app
docker compose logs -f postgres

# Acceder a PostgreSQL
docker compose exec postgres psql -U stc_user -d stc_produccion
```

### 1.7 Configuración de Reinicio Automático

Los servicios ya tienen `restart: unless-stopped` en `docker-compose.yml`, pero para asegurar que se inicien al arrancar el servidor:

**En Linux (systemd):**

```bash
# Crear servicio systemd para Docker Compose
sudo nano /etc/systemd/system/stc-produccion.service
```

Contenido:

```ini
[Unit]
Description=STC Producción Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/stc-produccion
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Habilitar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stc-produccion.service
sudo systemctl start stc-produccion.service
sudo systemctl status stc-produccion.service
```

**En Windows Server (Programador de Tareas):**

```powershell
# Opción 1: Crear tarea programada con PowerShell
$action = New-ScheduledTaskAction -Execute "docker" -Argument "compose -f C:\stc-produccion\docker-compose.yml up -d" -WorkingDirectory "C:\stc-produccion"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "STC-Produccion-Startup" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Inicia STC Producción al arrancar el servidor"

# Opción 2: Crear servicio Windows con NSSM (más robusto)
# Descargar NSSM: https://nssm.cc/download
choco install nssm -y

# Instalar como servicio
nssm install STC-Produccion "C:\Program Files\Docker\Docker\resources\bin\docker.exe" "compose -f C:\stc-produccion\docker-compose.yml up -d"
nssm set STC-Produccion AppDirectory "C:\stc-produccion"
nssm set STC-Produccion DisplayName "STC Producción V2"
nssm set STC-Produccion Description "Sistema de Control Textil - Producción V2"
nssm set STC-Produccion Start SERVICE_AUTO_START

# Iniciar servicio
nssm start STC-Produccion

# Ver estado
nssm status STC-Produccion
```

**💡 Recomendación Windows:** Usa NSSM para gestión más robusta del servicio.

---

## ⚙️ Opción 2: Deployment Manual (sin contenedores)

Si prefieres no usar contenedores, puedes instalar todo directamente en el servidor.

### 2.1 Instalar Node.js

```bash
# Instalar Node.js 20 LTS con nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Verificar instalación
node --version
npm --version
```

### 2.2 Instalar PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE USER stc_user WITH PASSWORD 'tu_contraseña_segura';
CREATE DATABASE stc_produccion OWNER stc_user;
GRANT ALL PRIVILEGES ON DATABASE stc_produccion TO stc_user;
\q
EOF
```

### 2.3 Configurar PostgreSQL

```bash
# Editar pg_hba.conf para permitir conexiones locales
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Añadir/modificar:
```
# IPv4 local connections:
host    stc_produccion    stc_user    127.0.0.1/32    md5
```

```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 2.4 Ejecutar Scripts de Inicialización

```bash
# Conectar a PostgreSQL y ejecutar scripts de init-db
cd /opt/stc-produccion

# Ejecutar cada script en orden
for file in init-db/*.sql; do
  echo "Ejecutando $file..."
  PGPASSWORD='tu_contraseña' psql -h localhost -U stc_user -d stc_produccion -f "$file"
done
```

### 2.5 Configurar Backend

```bash
cd /opt/stc-produccion/backend

# Crear archivo .env
nano .env
```

Contenido del `.env`:

```env
NODE_ENV=production
PORT=3001

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=stc_produccion
PG_USER=stc_user
PG_PASSWORD=tu_contraseña_segura

# CSV
CSV_FOLDER=/opt/stc-data/csv

# Frontend
FRONTEND_DIST=/opt/stc-produccion/frontend/dist
```

```bash
# Instalar dependencias de producción
npm ci --omit=dev

# Verificar que funciona
node server.js
# Ctrl+C para detener
```

### 2.6 Construir Frontend

```bash
cd /opt/stc-produccion/frontend

# Instalar dependencias
npm ci

# Construir para producción
npm run build

# Los archivos estarán en frontend/dist
ls -lh dist/
```

### 2.7 Gestión con PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Crear archivo de configuración PM2
cd /opt/stc-produccion
nano ecosystem.config.cjs
```

Contenido:

```javascript
module.exports = {
  apps: [{
    name: 'stc-backend',
    script: './backend/server.js',
    cwd: '/opt/stc-produccion',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/stc/error.log',
    out_file: '/var/log/stc/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

```bash
# Crear directorio de logs
sudo mkdir -p /var/log/stc
sudo chown -R $USER:$USER /var/log/stc

# Iniciar aplicación con PM2
pm2 start ecosystem.config.cjs

# Ver estado
pm2 status
pm2 logs stc-backend

# Configurar PM2 para iniciar al arrancar
pm2 startup systemd
# Ejecutar el comando que PM2 te muestre

pm2 save
```

---

## 🔧 Configuración de Nginx como Reverse Proxy

Nginx (o IIS en Windows) servirá el frontend estático y reenviará las peticiones API al backend.

### Opción A: Nginx (Linux o Windows)

#### En Linux:

### 3.1 Instalar Nginx

```bash
sudo apt install -y nginx

# Iniciar y habilitar
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### En Windows Server:

**Opción 1: IIS (Internet Information Services) - Nativo de Windows** ⭐

```powershell
# Instalar IIS con ARR (Application Request Routing)
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
Install-WindowsFeature -Name Web-WebSockets

# Descargar e instalar ARR y URL Rewrite
# URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite
# ARR: https://www.iis.net/downloads/microsoft/application-request-routing

# O con Chocolatey:
choco install iis-arr urlrewrite -y

# Configurar IIS se hace via GUI (Administrador de IIS)
# O con PowerShell (ver configuración abajo)
```

**Opción 2: Nginx para Windows**

```powershell
# Descargar Nginx para Windows
$nginxUrl = "http://nginx.org/download/nginx-1.24.0.zip"
$downloadPath = "$env:TEMP\nginx.zip"
Invoke-WebRequest -Uri $nginxUrl -OutFile $downloadPath

# Extraer
Expand-Archive -Path $downloadPath -DestinationPath "C:\nginx"

# Instalar como servicio con NSSM
nssm install nginx "C:\nginx\nginx.exe"
nssm set nginx AppDirectory "C:\nginx"
nssm start nginx

# Configuración es similar a Linux (ver abajo)
```

### 3.2 Crear Configuración del Sitio

**En Linux:**

```bash
sudo nano /etc/nginx/sites-available/stc-produccion
```

Contenido:

```nginx
# Redirección HTTP -> HTTPS (se activará después de configurar SSL)
server {
    listen 80;
    listen [::]:80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Permitir Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirigir todo a HTTPS (comentar temporalmente hasta tener SSL)
    # return 301 https://$server_name$request_uri;

    # Configuración temporal para HTTP (eliminar después de SSL)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Configuración HTTPS (activar después de obtener certificados SSL)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name tu-dominio.com www.tu-dominio.com;
# 
#     # Certificados SSL (Let's Encrypt)
#     ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
#     
#     # Configuración SSL moderna
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
# 
#     # Cliente máximo de 50MB para uploads CSV
#     client_max_body_size 50M;
# 
#     # Caché de activos estáticos
#     location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
#         proxy_pass http://localhost:3001;
#         expires 1y;
#         add_header Cache-Control "public, immutable";
#     }
# 
#     # API Backend
#     location /api/ {
#         proxy_pass http://localhost:3001;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         
#         # Timeouts para importaciones largas
#         proxy_connect_timeout 600s;
#         proxy_send_timeout 600s;
#         proxy_read_timeout 600s;
#     }
# 
#     # Frontend - pasar todo al backend que sirve el frontend
#     location / {
#         proxy_pass http://localhost:3001;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }
# 
#     # Security headers
#     add_header X-Frame-Options "SAMEORIGIN" always;
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header X-XSS-Protection "1; mode=block" always;
#     add_header Referrer-Policy "no-referrer-when-downgrade" always;
# }
```

### 3.3 Activar el Sitio

**En Linux:**
```bash
# Verificar configuración
sudo nginx -t

# Crear symlink
sudo ln -s /etc/nginx/sites-available/stc-produccion /etc/nginx/sites-enabled/

# Eliminar sitio default
sudo rm /etc/nginx/sites-enabled/default

# Recargar Nginx
sudo systemctl reload nginx
```

**En Windows (IIS):**

Crear archivo `web.config` en `C:\inetpub\wwwroot\stc-produccion\`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Redirigir HTTP a HTTPS (activar después de SSL) -->
        <!--
        <rule name="HTTP to HTTPS redirect" stopProcessing="true">
          <match url="(.*)" />
          <conditions>
            <add input="{HTTPS}" pattern="off" ignoreCase="true" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
        </rule>
        -->
        
        <!-- Proxy a la aplicación Node.js -->
        <rule name="ReverseProxyInboundRule" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3001/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_FOR" value="{REMOTE_ADDR}" />
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
    
    <!-- Headers de seguridad -->
    <httpProtocol>
      <customHeaders>
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-XSS-Protection" value="1; mode=block" />
      </customHeaders>
    </httpProtocol>
    
    <!-- Límite de tamaño de upload -->
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="104857600" /><!-- 100 MB -->
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

O configurar via GUI:
1. Abrir Administrador de IIS
2. Crear nuevo sitio → Nombre: "STC-Produccion"
3. Ruta física: `C:\stc-produccion\frontend\dist` (si sirves estáticos) o cualquier carpeta
4. Binding: Puerto 80 (HTTP)
5. En URL Rewrite → Agregar regla de proxy a `http://localhost:3001`

**En Windows (Nginx):**
```powershell
# Editar configuración
notepad C:\nginx\conf\nginx.conf

# Same config as Linux (copiar de arriba)

# Reiniciar servicio
nssm restart nginx
```

### 3.4 Probar

```bash
# Desde el servidor
curl http://localhost

# Desde otro equipo
curl http://ip-del-servidor
# o
curl http://tu-dominio.com
```

---

## 🔒 SSL/HTTPS con Let's Encrypt

### 4.1 Instalar Certbot / Win-ACME

**En Linux:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**En Windows Server:**
```powershell
# Opción 1: Win-ACME (recomendado para Windows / IIS)
# Descargar desde: https://www.win-acme.com/
# O con Chocolatey:
choco install win-acme -y

# Opción 2: Certbot para Windows
choco install certbot -y
```

### 4.2 Obtener Certificados

**En Linux:**
```bash
# Asegúrate de que tu dominio apunte a la IP del servidor
# Verifica con: nslookup tu-dominio.com

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Seguir las instrucciones del asistente
# Certbot configurará automáticamente Nginx
```

**En Windows Server con IIS:**
```powershell
# Ejecutar Win-ACME
wacs.exe

# Seguir el wizard:
# 1. N - Create new certificate
# 2. 1 - Single binding of an IIS site
# 3. Seleccionar tu sitio (STC-Produccion)
# 4. Aceptar términos
# 5. Ingresar email
# Win-ACME configurará automáticamente IIS con el certificado
```

**En Windows Server con Nginx:**
```powershell
# Usar certbot
certbot certonly --standalone -d tu-dominio.com -d www.tu-dominio.com

# Certificados se guardan en: C:\Certbot\live\tu-dominio.com\
# Actualizar nginx.conf manualmente con las rutas de los certificados
```

### 4.3 Renovación Automática

**En Linux:**
```bash
# Probar renovación
sudo certbot renew --dry-run

# Ver configuración de renovación automática
sudo systemctl status certbot.timer
```

**En Windows:**
```powershell
# Win-ACME crea automáticamente una tarea programada para renovación
# Ver en: Programador de tareas → win-acme renew

# Verificar tarea
Get-ScheduledTask | Where-Object {$_.TaskName -like "*acme*"}

# O con certbot, crear tarea manual:
$action = New-ScheduledTaskAction -Execute "certbot" -Argument "renew --quiet"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "Certbot-Renewal" -Action $action -Trigger $trigger
```

### 4.4 Activar Configuración HTTPS en Nginx

```bash
# Editar configuración
sudo nano /etc/nginx/sites-available/stc-produccion

# Descomentar la sección HTTPS (server block con listen 443)
# Comentar la configuración temporal HTTP en el server block del puerto 80
# Descomentar la línea: return 301 https://$server_name$request_uri;

# Verificar y recargar
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 Variables de Entorno

### Variables Principales

#### Backend (`backend/.env`)
```env
NODE_ENV=production
PORT=3001

# PostgreSQL
PG_HOST=localhost              # o 'postgres' si usas Docker
PG_PORT=5432
PG_DATABASE=stc_produccion
PG_USER=stc_user
PG_PASSWORD=contraseña_segura

# Archivos CSV
CSV_FOLDER=/opt/stc-data/csv   # o /data/csv dentro del contenedor

# Frontend (solo para deployment manual)
FRONTEND_DIST=/opt/stc-produccion/frontend/dist
```

#### Docker Compose (`.env` en raíz)
```env
# Path de CSV en el host
STC_CSV_HOST_PATH=/opt/stc-data/csv

# PostgreSQL
POSTGRES_DB=stc_produccion
POSTGRES_USER=stc_user
POSTGRES_PASSWORD=contraseña_segura

# Backend
NODE_ENV=production
PORT=3001
```

---

## 🔄 Gestión de Procesos con PM2

### Comandos Útiles

```bash
# Iniciar aplicación
pm2 start ecosystem.config.cjs

# Ver estado
pm2 status
pm2 list

# Ver logs
pm2 logs stc-backend
pm2 logs stc-backend --lines 100

# Reiniciar
pm2 restart stc-backend

# Detener
pm2 stop stc-backend

# Eliminar del PM2
pm2 delete stc-backend

# Monitoreo en tiempo real
pm2 monit

# Información detallada
pm2 show stc-backend
```

### Actualizar Aplicación

```bash
cd /opt/stc-produccion

# Hacer backup de .env
cp backend/.env backend/.env.backup

# Actualizar código
git pull origin main

# Backend: reinstalar dependencias si cambió package.json
cd backend
npm ci --omit=dev

# Frontend: reconstruir
cd ../frontend
npm ci
npm run build

# Reiniciar con PM2
pm2 restart stc-backend

# Ver logs
pm2 logs stc-backend
```

---

## 💾 Backups Automáticos

### 7.1 Script de Backup PostgreSQL

```bash
sudo mkdir -p /opt/stc-backups
sudo nano /opt/stc-backups/backup-database.sh
```

Contenido:

```bash
#!/bin/bash

# Configuración
BACKUP_DIR="/opt/stc-backups/database"
DB_NAME="stc_produccion"
DB_USER="stc_user"
POSTGRES_CONTAINER="stc_postgres"  # Para Docker/Podman
RETENTION_DAYS=30

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Fecha actual
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql"

# Realizar backup
echo "Iniciando backup de $DB_NAME..."

# Opción A: Con Docker/Podman
docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Opción B: PostgreSQL local (comentar la línea anterior y descomentar esta)
# PGPASSWORD='tu_contraseña' pg_dump -h localhost -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Comprimir
gzip "$BACKUP_FILE"
echo "Backup completado: ${BACKUP_FILE}.gz"

# Eliminar backups antiguos
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Backups antiguos eliminados (>$RETENTION_DAYS días)"
```

Dar permisos:

```bash
sudo chmod +x /opt/stc-backups/backup-database.sh
```

### 7.2 Programar Backup Diario con Cron

```bash
sudo crontab -e
```

Añadir:

```cron
# Backup diario a las 2:00 AM
0 2 * * * /opt/stc-backups/backup-database.sh >> /var/log/stc/backup.log 2>&1

# Backup de archivos CSV semanalmente (Domingos a las 3:00 AM)
0 3 * * 0 tar -czf /opt/stc-backups/csv_$(date +\%Y-\%m-\%d).tar.gz /opt/stc-data/csv/ >> /var/log/stc/backup.log 2>&1
```

### 7.3 Restaurar Backup

```bash
# Listar backups disponibles
ls -lh /opt/stc-backups/database/

# Descomprimir
gunzip /opt/stc-backups/database/stc_produccion_2026-02-13_02-00-00.sql.gz

# Restaurar con Docker/Podman
docker compose exec -T postgres psql -U stc_user -d stc_produccion < /opt/stc-backups/database/stc_produccion_2026-02-13_02-00-00.sql

# O con PostgreSQL local
PGPASSWORD='tu_contraseña' psql -h localhost -U stc_user -d stc_produccion < /opt/stc-backups/database/stc_produccion_2026-02-13_02-00-00.sql
```

---

## 📊 Monitoreo y Logs

### 8.1 Logs de la Aplicación

#### Con Docker/Podman
```bash
# Ver logs en tiempo real
docker compose logs -f app
docker compose logs -f postgres

# Últimas 100 líneas
docker compose logs --tail=100 app

# Logs de un periodo específico
docker compose logs --since 1h app
```

#### Con PM2
```bash
# Ver logs
pm2 logs stc-backend

# Últimas 100 líneas
pm2 logs stc-backend --lines 100

# Limpiar logs
pm2 flush

# Ver archivos de log directamente
tail -f /var/log/stc/out.log
tail -f /var/log/stc/error.log
```

### 8.2 Logs de Nginx

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log

# Filtrar por código de error
sudo grep "error" /var/log/nginx/error.log
sudo grep " 500 " /var/log/nginx/access.log
```

### 8.3 Logs de PostgreSQL

```bash
# Con Docker/Podman
docker compose logs -f postgres

# Local
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 8.4 Monitoreo de Recursos

```bash
# Uso de CPU, memoria, disco
htop

# Espacio en disco
df -h

# Uso de disco por directorio
du -sh /opt/stc-produccion/*
du -sh /opt/stc-data/csv/*

# Monitoreo de contenedores
docker stats

# Conexiones de red
sudo netstat -tulpn | grep -E ':(80|443|3001|5432)'
```

### 8.5 Configurar Logrotate

```bash
sudo nano /etc/logrotate.d/stc-produccion
```

Contenido:

```
/var/log/stc/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 usuario usuario
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔍 Troubleshooting

### Problema: No se puede conectar a la aplicación

```bash
# Verificar que el servicio está corriendo
docker compose ps
# o
pm2 status

# Verificar puerto 3001
sudo netstat -tulpn | grep 3001

# Probar conexión local
curl http://localhost:3001/api/health

# Ver logs
docker compose logs --tail=50 app
# o
pm2 logs stc-backend --lines 50
```

### Problema: Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL está corriendo
docker compose ps postgres
# o
sudo systemctl status postgresql

# Probar conexión
docker compose exec postgres pg_isready -U stc_user -d stc_produccion
# o
PGPASSWORD='tu_contraseña' psql -h localhost -U stc_user -d stc_produccion -c '\l'

# Ver logs de PostgreSQL
docker compose logs postgres
# o
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Verificar configuración de conexión
docker compose exec app env | grep PG_
```

### Problema: Nginx muestra 502 Bad Gateway

```bash
# Verificar que el backend está corriendo
curl http://localhost:3001

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Verificar configuración de Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Problema: Error al importar archivos CSV

```bash
# Verificar que el directorio CSV existe y tiene permisos
ls -lh /opt/stc-data/csv/

# Con Docker: verificar que el volumen está montado
docker compose exec app ls -lh /data/csv

# Verificar variable de entorno
docker compose exec app env | grep CSV_FOLDER

# Ver logs durante importación
docker compose logs -f app | grep -i import
```

### Problema: Disco lleno

```bash
# Ver uso de disco
df -h

# Encontrar archivos grandes
sudo du -sh /* | sort -rh | head -10

# Limpiar logs antiguos de Docker
docker system prune -a

# Limpiar backups antiguos
find /opt/stc-backups -mtime +30 -delete

# Comprimir logs
sudo journalctl --vacuum-time=7d
```

### Problema: Memoria insuficiente

```bash
# Ver uso de memoria
free -h

# Ver procesos que más consumen
ps aux --sort=-%mem | head -10

# Limitar memoria de contenedor (editar docker-compose.yml)
# Añadir en el servicio 'app':
#   deploy:
#     resources:
#       limits:
#         memory: 2G

# Reiniciar servicios
docker compose down && docker compose up -d
```

### Verificar Estado General del Sistema

```bash
# Script de diagnóstico rápido
cat << 'EOF' > /tmp/check-stc.sh
#!/bin/bash
echo "=== ESTADO DE STC PRODUCCIÓN ==="
echo ""
echo "1. Contenedores Docker:"
docker compose ps
echo ""
echo "2. Uso de Recursos:"
docker stats --no-stream
echo ""
echo "3. Logs recientes (últimas 5 líneas):"
docker compose logs --tail=5 app
echo ""
echo "4. Conexión PostgreSQL:"
docker compose exec postgres pg_isready -U stc_user -d stc_produccion
echo ""
echo "5. Estado de Nginx:"
sudo systemctl status nginx --no-pager
echo ""
echo "6. Espacio en Disco:"
df -h | grep -E '(Filesystem|/dev/)'
echo ""
echo "7. Test API:"
curl -s http://localhost:3001/api/health
EOF

chmod +x /tmp/check-stc.sh
/tmp/check-stc.sh
```

---

## 📱 Acceso desde Dispositivos Móviles

La aplicación es totalmente responsive y funciona en móviles. Para acceso interno (red local):

1. Asegúrate de que el firewall permita conexiones desde la red local
2. Accede usando: `http://ip-del-servidor` o `https://tu-dominio.com`
3. Para producción, siempre usa HTTPS

---

## 🔧 Mantenimiento

### Actualización del Sistema

```bash
# Mensualmente
sudo apt update && sudo apt upgrade -y
sudo reboot  # Si es necesario
```

### Actualización de la Aplicación

```bash
cd /opt/stc-produccion

# Backup antes de actualizar
/opt/stc-backups/backup-database.sh

# Actualizar código
git pull origin main

# Reconstruir y reiniciar
docker compose build
docker compose up -d

# O con PM2
cd frontend && npm run build
pm2 restart stc-backend
```

### Limpieza Periódica

```bash
# Limpiar logs antiguos de Docker
docker system prune -a -f --volumes

# Limpiar journal
sudo journalctl --vacuum-time=30d

# Limpiar backups antiguos (>30 días)
find /opt/stc-backups -mtime +30 -delete
```

---

## 📞 Soporte

Para problemas o preguntas:
- Revisar logs: `docker compose logs app` o `pm2 logs`
- Ver documentación: `README.md` y otros archivos `.md` en el proyecto
- Contactar al equipo de desarrollo

---

## 📝 Checklist de Implementación

- [ ] Servidor preparado con requisitos mínimos
- [ ] Docker/Podman instalado
- [ ] Código clonado en `/opt/stc-produccion`
- [ ] Archivo `.env` configurado con contraseñas seguras
- [ ] Directorio CSV creado en `/opt/stc-data/csv`
- [ ] Contenedores levantados y funcionando
- [ ] Nginx instalado y configurado
- [ ] Certificado SSL instalado (Let's Encrypt)
- [ ] HTTPS funcionando correctamente
- [ ] Backups automáticos configurados (cron)
- [ ] PM2 o systemd configurado para reinicio automático
- [ ] Firewall configurado (puertos 80, 443)
- [ ] Logs configurados y rotación activa
- [ ] Monitoreo básico implementado
- [ ] Pruebas de la aplicación completadas
- [ ] Documentación entregada al equipo

---

## 🎉 ¡Listo!

Tu aplicación **STC Producción V2** está ahora en producción y lista para usar.

**Acceso:**
- Aplicación web: `https://tu-dominio.com`
- pgAdmin: `http://tu-dominio.com:5050` (si está habilitado)

**Credenciales por defecto de pgAdmin:**
- Email: `admin@stc.com`
- Password: `admin123`

⚠️ **IMPORTANTE:** Cambia las contraseñas por defecto antes de usar en producción.
