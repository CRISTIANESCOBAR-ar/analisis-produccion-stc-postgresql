#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script para mostrar la configuración actual del proyecto al personal de IT

.DESCRIPTION
    Recopila información sobre Podman/Docker, PostgreSQL, estructura del proyecto,
    y toda la configuración necesaria para replicar en el servidor de producción.

.EXAMPLE
    .\mostrar-configuracion-it.ps1
    
.NOTES
    Autor: STC Team
    Fecha: Febrero 2026
#>

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Colores para la salida
function Write-Header {
    param([string]$Text)
    Write-Host "`n================================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "================================================`n" -ForegroundColor Cyan
}

function Write-SubHeader {
    param([string]$Text)
    Write-Host "`n--- $Text ---" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ $Text" -ForegroundColor Blue
}

function Write-Warn {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "docker-compose.yml")) {
    Write-Fail "No se encontró docker-compose.yml. Ejecuta este script desde la raíz del proyecto."
    exit 1
}

Write-Header "CONFIGURACIÓN DE STC PRODUCCIÓN V2 - INFORME PARA IT"

# ============================================================
# 1. INFORMACIÓN GENERAL DEL PROYECTO
# ============================================================
Write-Header "1. INFORMACIÓN GENERAL DEL PROYECTO"

Write-SubHeader "Estructura de Carpetas Principales"
Get-ChildItem -Directory | Select-Object Name, LastWriteTime | Format-Table -AutoSize

Write-SubHeader "Archivos de Configuración"
$configFiles = Get-ChildItem -Include "*.yml","*.yaml","Dockerfile*",".env*","ecosystem.*.js" -Recurse -Depth 1 -ErrorAction SilentlyContinue
$configFiles | Select-Object Name, Directory, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}}, LastWriteTime | Format-Table -AutoSize

# ============================================================
# 2. DOCKER/PODMAN
# ============================================================
Write-Header "2. DOCKER/PODMAN - INFORMACIÓN DE CONTENEDORES"

Write-SubHeader "Versiones Instaladas"
try {
    $podmanVersion = podman --version 2>$null
    if ($podmanVersion) {
        Write-Success "Podman: $podmanVersion"
    }
} catch {
    Write-Info "Podman no está instalado o no está en PATH"
}

try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Success "Docker: $dockerVersion"
    }
} catch {
    Write-Info "Docker no está instalado o no está en PATH"
}

# Detectar cuál usar
$useCmd = $null
if (Get-Command podman -ErrorAction SilentlyContinue) {
    $useCmd = "podman"
    Write-Info "Usando: Podman"
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    $useCmd = "docker"
    Write-Info "Usando: Docker"
} else {
    Write-Fail "Ni Podman ni Docker están disponibles"
    exit 1
}

Write-SubHeader "Estado de Contenedores"
if (Get-Command podman-compose -ErrorAction SilentlyContinue) {
    podman-compose ps
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose ps
}

Write-SubHeader "Uso de Recursos (CPU, Memoria)"
if ($useCmd -eq "podman") {
    podman stats --no-stream
} else {
    docker stats --no-stream
}

Write-SubHeader "Redes"
& $useCmd network ls

Write-SubHeader "Detalles de Red del Proyecto"
& $useCmd network inspect stc_network 2>$null | ConvertFrom-Json | Select-Object Name, Driver, Scope | Format-List

Write-SubHeader "Volúmenes"
& $useCmd volume ls

Write-SubHeader "Detalles del Volumen de PostgreSQL"
& $useCmd volume inspect stc_postgres_data 2>$null | ConvertFrom-Json | Select-Object Name, Mountpoint, CreatedAt | Format-List

# ============================================================
# 3. DOCKER-COMPOSE CONFIGURATION
# ============================================================
Write-Header "3. CONFIGURACIÓN docker-compose.yml"

Write-SubHeader "Contenido del archivo"
Get-Content docker-compose.yml

Write-SubHeader "Servicios Definidos"
Write-Info "- app: Backend (Express + Node.js) + Frontend (Vue build)"
Write-Info "- postgres: Base de datos PostgreSQL 16-alpine"
Write-Info "- pgadmin: Herramienta de administración web (opcional)"

Write-SubHeader "Puertos Expuestos"
Write-Info "- 3001:3001  → Aplicación web (Backend + Frontend)"
Write-Info "- 5433:5432  → PostgreSQL (externo:interno)"
Write-Info "- 5050:80    → pgAdmin (opcional)"

Write-SubHeader "Volúmenes Configurados"
Write-Info "- postgres_data        → Datos de PostgreSQL (persistente)"
Write-Info "- pgadmin_data         → Configuración pgAdmin"
Write-Info "- ./csv:/data/csv      → Archivos CSV para importar"
Write-Info "- ./init-db            → Scripts SQL de inicialización"

# ============================================================
# 4. VARIABLES DE ENTORNO
# ============================================================
Write-Header "4. VARIABLES DE ENTORNO"

Write-SubHeader "Archivo .env en la raíz"
if (Test-Path ".env") {
    Write-Success "Archivo .env encontrado"
    Write-Warn "Mostrando contenido (⚠️ OCULTAR CONTRASEÑAS EN PRODUCCIÓN):"
    Get-Content .env
} else {
    Write-Info "No hay archivo .env - Variables en docker-compose.yml"
}

Write-SubHeader "Variables del Contenedor 'app' (en ejecución)"
try {
    if ($useCmd -eq "podman") {
        podman exec stc_app env 2>$null | Sort-Object | Select-String -Pattern "^(NODE_ENV|PORT|PG_|CSV_|FRONTEND_)"
    } else {
        docker compose exec app env 2>$null | Sort-Object | Select-String -Pattern "^(NODE_ENV|PORT|PG_|CSV_|FRONTEND_)"
    }
} catch {
    Write-Warn "No se pudo obtener variables del contenedor (puede estar detenido)"
}

# ============================================================
# 5. POSTGRESQL
# ============================================================
Write-Header "5. POSTGRESQL - CONFIGURACIÓN Y ESTADO"

Write-SubHeader "Test de Conexión"
try {
    if ($useCmd -eq "podman") {
        $pgReady = podman exec stc_postgres pg_isready -U stc_user -d stc_produccion 2>$null
    } else {
        $pgReady = docker compose exec postgres pg_isready -U stc_user -d stc_produccion 2>$null
    }
    Write-Success "PostgreSQL está accesible: $pgReady"
} catch {
    Write-Fail "No se pudo conectar a PostgreSQL"
}

Write-SubHeader "Versión de PostgreSQL"
try {
    if ($useCmd -eq "podman") {
        podman exec stc_postgres psql -U stc_user -d stc_produccion -c "SELECT version();" 2>$null
    } else {
        docker compose exec postgres psql -U stc_user -d stc_produccion -c "SELECT version();" 2>$null
    }
} catch {
    Write-Warn "No se pudo obtener versión"
}

Write-SubHeader "Tablas en la Base de Datos"
try {
    if ($useCmd -eq "podman") {
        podman exec stc_postgres psql -U stc_user -d stc_produccion -c "\dt" 2>$null
    } else {
        docker compose exec postgres psql -U stc_user -d stc_produccion -c "\dt" 2>$null
    }
} catch {
    Write-Warn "No se pudo listar tablas"
}

Write-SubHeader "Tamaño de la Base de Datos"
try {
    if ($useCmd -eq "podman") {
        podman exec stc_postgres psql -U stc_user -d stc_produccion -c "SELECT pg_size_pretty(pg_database_size('stc_produccion')) as db_size;" 2>$null
    } else {
        docker compose exec postgres psql -U stc_user -d stc_produccion -c "SELECT pg_size_pretty(pg_database_size('stc_produccion')) as db_size;" 2>$null
    }
} catch {
    Write-Warn "No se pudo obtener tamaño"
}

# ============================================================
# 6. SCRIPTS DE INICIALIZACIÓN
# ============================================================
Write-Header "6. SCRIPTS SQL DE INICIALIZACIÓN"

Write-SubHeader "Scripts en init-db/ (ejecutados en orden)"
Get-ChildItem init-db\*.sql | Sort-Object Name | Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}}, LastWriteTime | Format-Table -AutoSize

Write-Info "Estos scripts se ejecutan automáticamente al crear el contenedor PostgreSQL por primera vez."
Write-Info "Crean las tablas, vistas, y configuración necesaria para la aplicación."

# ============================================================
# 7. ARCHIVOS CSV
# ============================================================
Write-Header "7. ARCHIVOS CSV PARA IMPORTACIÓN"

Write-SubHeader "Archivos CSV Disponibles"
if (Test-Path "csv") {
    $csvFiles = Get-ChildItem csv\*.csv
    $csvFiles | Select-Object Name, @{Name="Size (MB)";Expression={[math]::Round($_.Length/1MB,2)}}, LastWriteTime | Format-Table -AutoSize
    
    $totalSize = ($csvFiles | Measure-Object -Property Length -Sum).Sum
    Write-Info "Total: $($csvFiles.Count) archivos, $([math]::Round($totalSize/1MB, 2)) MB"
} else {
    Write-Warn "No se encontró carpeta csv/"
}

Write-Info "`nEn el servidor, estos archivos deben estar en: /opt/stc-data/csv"
Write-Info "Se importan mediante la interfaz web o llamadas a la API"

# ============================================================
# 8. DOCKERFILE
# ============================================================
Write-Header "8. DOCKERFILE - PROCESO DE BUILD"

Write-SubHeader "Contenido del Dockerfile"
Get-Content Dockerfile

Write-Info "`nProceso Multi-Stage Build:"
Write-Info "1. build-frontend → Compila Vue3 + Vite (genera /dist)"
Write-Info "2. build-backend → Instala dependencias de producción"
Write-Info "3. runtime → Imagen final con solo runtime (~200MB)"

# ============================================================
# 9. NETWORKING Y PUERTOS
# ============================================================
Write-Header "9. NETWORKING Y PUERTOS"

Write-SubHeader "Puertos Escuchando en el Host"
$ports = @(3001, 5433, 5050)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Success "Puerto $port está ACTIVO (PID: $($conn.OwningProcess))"
    } else {
        Write-Warn "Puerto $port no está escuchando"
    }
}

Write-SubHeader "Arquitectura de Red"
Write-Info @"

┌─────────────────────────────────────────────┐
│         HOST (Windows/Linux)                │
│                                             │
│  Puerto 3001 → Aplicación Web               │
│  Puerto 5433 → PostgreSQL (dev)             │
│  Puerto 5050 → pgAdmin (dev)                │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Red Docker: stc_network             │   │
│  │                                      │   │
│  │  ┌──────────┐      ┌──────────┐     │   │
│  │  │   app    │─────▶│ postgres │     │   │
│  │  │ (3001)   │      │  (5432)  │     │   │
│  │  └──────────┘      └──────────┘     │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
"@

# ============================================================
# 10. BACKEND
# ============================================================
Write-Header "10. BACKEND - NODE.JS + EXPRESS"

Write-SubHeader "package.json del Backend"
Get-Content backend\package.json | ConvertFrom-Json | Select-Object name, version, description, dependencies | Format-List

Write-SubHeader "Dependencias Principales"
$backendPkg = Get-Content backend\package.json | ConvertFrom-Json
$backendPkg.dependencies.PSObject.Properties | ForEach-Object {
    Write-Info "- $($_.Name): $($_.Value)"
}

# ============================================================
# 11. FRONTEND
# ============================================================
Write-Header "11. FRONTEND - VUE 3 + VITE"

Write-SubHeader "package.json del Frontend"
Get-Content frontend\package.json | ConvertFrom-Json | Select-Object name, version, dependencies | Format-List

Write-SubHeader "Dependencias Principales del Frontend"
$frontendPkg = Get-Content frontend\package.json | ConvertFrom-Json
Write-Info "Framework: Vue $(($frontendPkg.dependencies).vue)"
Write-Info "Build Tool: Vite"
Write-Info "UI: TailwindCSS + Heroicons"
Write-Info "Charts: Chart.js + ECharts"
Write-Info "Otros: Pinia (state), Vue Router, SweetAlert2"

# ============================================================
# 12. LOGS
# ============================================================
Write-Header "12. LOGS Y DEBUGGING"

Write-SubHeader "Últimas 20 líneas de logs - App"
try {
    if ($useCmd -eq "podman") {
        podman-compose logs --tail=20 app 2>$null
    } else {
        docker compose logs --tail=20 app 2>$null
    }
} catch {
    Write-Warn "No se pudieron obtener logs"
}

Write-SubHeader "Últimas 10 líneas de logs - PostgreSQL"
try {
    if ($useCmd -eq "podman") {
        podman-compose logs --tail=10 postgres 2>$null
    } else {
        docker compose logs --tail=10 postgres 2>$null
    }
} catch {
    Write-Warn "No se pudieron obtener logs"
}

# ============================================================
# 13. BACKUPS
# ============================================================
Write-Header "13. BACKUPS Y RESTAURACIÓN"

Write-SubHeader "Scripts de Backup Disponibles"
Get-ChildItem *backup*.ps1, *restore*.ps1 -ErrorAction SilentlyContinue | Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}}, LastWriteTime | Format-Table -AutoSize

Write-SubHeader "Backups Existentes"
if (Test-Path "backups") {
    $backups = Get-ChildItem backups\*.sql | Sort-Object LastWriteTime -Descending
    if ($backups) {
        $backups | Select-Object -First 10 | Select-Object Name, @{Name="Size (MB)";Expression={[math]::Round($_.Length/1MB,2)}}, LastWriteTime | Format-Table -AutoSize
        Write-Info "Total de backups: $($backups.Count)"
        
        $lastBackup = $backups | Select-Object -First 1
        Write-Success "Último backup: $($lastBackup.Name) ($([math]::Round($lastBackup.Length/1MB,2)) MB)"
    } else {
        Write-Warn "No hay backups en la carpeta backups/"
    }
} else {
    Write-Warn "No existe carpeta backups/"
}

# ============================================================
# 14. DOCUMENTACIÓN
# ============================================================
Write-Header "14. DOCUMENTACIÓN DEL PROYECTO"

Write-SubHeader "Archivos de Documentación"
Get-ChildItem *.md | Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}}, LastWriteTime | Format-Table -AutoSize

Write-Info "Documentos clave:"
Write-Info "- README.md → Inicio rápido"
Write-Info "- GUIA_IMPLEMENTACION_SERVIDOR.md → Esta guía de deployment"
Write-Info "- GUIA_INICIO_PODMAN_POSTGRESQL.md → Setup de Podman"
Write-Info "- MIGRACION_ORACLE_POSTGRESQL.md → Proceso de migración"

# ============================================================
# 15. TEST DE ENDPOINTS
# ============================================================
Write-Header "15. TEST DE ENDPOINTS DE LA API"

Write-SubHeader "Probando Endpoint /api/health"
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Success "API responde correctamente:"
    $response | ConvertTo-Json
} catch {
    Write-Fail "No se pudo conectar a la API en http://localhost:3001/api/health"
    Write-Warn "Verifica que los contenedores estén corriendo: podman-compose ps"
}

# ============================================================
# 16. RESUMEN PARA IT
# ============================================================
Write-Header "16. RESUMEN PARA PERSONAL DE IT"

Write-Info @"

STACK TECNOLÓGICO:
  Frontend: Vue 3 + Vite + TailwindCSS
  Backend:  Node.js 20 + Express
  BD:       PostgreSQL 16-alpine
  Deploy:   Docker/Podman Compose
  Proxy:    Nginx (en servidor)

REQUISITOS DEL SERVIDOR:
  CPU:      4 cores
  RAM:      8 GB
  Disco:    100 GB SSD
  OS:       Ubuntu 22.04 LTS (recomendado)
  Software: Docker/Podman, Nginx, certbot

PUERTOS NECESARIOS:
  80   → HTTP (redirige a HTTPS)
  443  → HTTPS (aplicación web)
  5432 → PostgreSQL (solo red interna/VPN)

DATOS PERSISTENTES:
  - Volumen PostgreSQL: ~500MB-2GB
  - Archivos CSV: ~100MB-1GB
  - Backups: Depende de retención (30 días recomendado)

SEGURIDAD:
  ✓ Firewall configurado (solo 80, 443, 22)
  ✓ PostgreSQL NO expuesto públicamente
  ✓ Variables de entorno con contraseñas fuertes
  ✓ SSL con Let's Encrypt
  ✓ Backups cifrados fuera del servidor

PRÓXIMOS PASOS:
  1. Revisar documentación completa en GUIA_IMPLEMENTACION_SERVIDOR.md
  2. Coordinar dominio y DNS
  3. Preparar servidor con requisitos mínimos
  4. Planificar estrategia de backup
  5. Definir plan de monitoreo
  6. Programar migración y pruebas

"@

Write-Header "🎉 INFORME COMPLETO GENERADO"
Write-Success "Toda la información necesaria ha sido recopilada."
Write-Info "Comparte este output con el personal de IT junto con:"
Write-Info "  - GUIA_IMPLEMENTACION_SERVIDOR.md"
Write-Info "  - docker-compose.yml"
Write-Info "  - Dockerfile"
Write-Info "`nPara más detalles, consulta la documentación en los archivos .md del proyecto."

# Opcional: Guardar output en archivo
Write-Host "`n"
$saveOutput = Read-Host "¿Guardar este informe en un archivo? (s/n)"
if ($saveOutput -eq "s") {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $outputFile = "informe-configuracion-it_$timestamp.txt"
    
    # Re-ejecutar el script y guardar output
    Write-Host "Guardando informe en: $outputFile"
    & $PSCommandPath > $outputFile 2>&1
    Write-Success "Informe guardado exitosamente."
}
