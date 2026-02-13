# 🎯 Comandos Rápidos - Demostración IT

**Para copiar/pegar durante la demostración**

---

## 📂 1. Estructura del Proyecto

```powershell
# Listar carpetas principales
Get-ChildItem -Directory | Format-Table Name

# Ver archivos de configuración
Get-ChildItem docker-compose.yml, Dockerfile, *.md | Format-Table
```

---

## 🐳 2. Docker/Podman

```powershell
# Versiones
podman --version
docker --version

# Estado de contenedores
podman-compose ps
# o
docker compose ps

# Estadísticas de recursos
podman stats --no-stream
# o
docker stats --no-stream

# Redes
podman network ls
podman network inspect stc_network

# Volúmenes
podman volume ls
podman volume inspect stc_postgres_data
```

---

## 📄 3. Ver Configuración

```powershell
# docker-compose.yml
Get-Content docker-compose.yml

# Dockerfile
Get-Content Dockerfile

# Variables de entorno
Get-Content .env
# o ver dentro del contenedor:
podman exec stc_app env | Select-String "PG_|NODE_ENV|PORT|CSV"
```

---

## 🗄️ 4. PostgreSQL

```powershell
# Test de conexión
podman exec stc_postgres pg_isready -U stc_user -d stc_produccion

# Conectar a psql
podman exec -it stc_postgres psql -U stc_user -d stc_produccion
```

**Comandos dentro de psql:**
```sql
-- Versión
SELECT version();

-- Listar bases de datos
\l

-- Listar tablas
\dt

-- Ver estructura de tabla
\d produccion
\d tb_defectos

-- Tamaño de la BD
SELECT pg_size_pretty(pg_database_size('stc_produccion'));

-- Tamaño de tablas (top 10)
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 10;

-- Número de registros por tabla
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Salir
\q
```

---

## 📁 5. Scripts de Inicialización

```powershell
# Listar scripts SQL
Get-ChildItem init-db\*.sql | Sort-Object Name | Format-Table Name, Length

# Ver primeras líneas de un script
Get-Content init-db\01-schema.sql -First 50
```

---

## 📊 6. Archivos CSV

```powershell
# Listar CSVs
Get-ChildItem csv\*.csv | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}, LastWriteTime | Format-Table

# Ver primeras líneas de un CSV
Get-Content csv\fichaArtigo.csv -First 5

# Verificar dentro del contenedor
podman exec stc_app ls -lh /data/csv
```

---

## 📝 7. Logs

```powershell
# Logs en tiempo real - App
podman-compose logs -f app

# Logs en tiempo real - PostgreSQL
podman-compose logs -f postgres

# Últimas 50 líneas
podman-compose logs --tail=50 app

# Última hora
podman-compose logs --since 1h app

# Todos los servicios
podman-compose logs --tail=20
```

---

## 🔍 8. Inspeccionar Contenedores

```powershell
# Detalles del contenedor app
podman inspect stc_app | ConvertFrom-Json | Select-Object Name, State, NetworkSettings

# Detalles del contenedor postgres
podman inspect stc_postgres | ConvertFrom-Json | Select-Object Name, State

# Ver variables de entorno del contenedor
podman exec stc_app env | Sort-Object
```

---

## 🌐 9. Puertos y Red

```powershell
# Puertos en uso
netstat -ano | Select-String ":3001|:5433|:5050"

# Con PowerShell
Get-NetTCPConnection | Where-Object {$_.LocalPort -in 3001,5433,5050} | Format-Table LocalPort, State, OwningProcess
```

---

## 🧪 10. Probar API

```powershell
# Health check
curl http://localhost:3001/api/health

# Con PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/api/health"

# Ver en navegador
Start-Process "http://localhost:3001"
```

---

## 💾 11. Backups

```powershell
# Mostrar script de backup
Get-Content backup-database.ps1 -First 50

# Listar backups existentes
Get-ChildItem backups\*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 10 | Format-Table Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}, LastWriteTime

# Crear backup manual
podman exec stc_postgres pg_dump -U stc_user stc_produccion > "backups/manual-backup-$(Get-Date -Format 'yyyy-MM-dd').sql"
```

---

## 📦 12. Backend + Frontend

```powershell
# package.json del Backend
Get-Content backend\package.json | ConvertFrom-Json | Select-Object name, version, dependencies

# package.json del Frontend
Get-Content frontend\package.json | ConvertFrom-Json | Select-Object name, version, dependencies

# Ver estructura de carpetas
tree backend /F | Select-Object -First 30
tree frontend /F | Select-Object -First 30
```

---

## 🔄 13. Reiniciar Servicios

```powershell
# Reiniciar todos los servicios
podman-compose restart

# Reiniciar solo app
podman-compose restart app

# Reiniciar solo postgres
podman-compose restart postgres

# Parar todo
podman-compose down

# Levantar todo
podman-compose up -d

# Reconstruir y levantar
podman-compose build
podman-compose up -d
```

---

## 📚 14. Documentación

```powershell
# Listar documentación
Get-ChildItem *.md | Format-Table Name, Length, LastWriteTime

# Abrir documentos principales
code README.md
code GUIA_IMPLEMENTACION_SERVIDOR.md
code MIGRACION_ORACLE_POSTGRESQL.md
```

---

## 🎬 15. Script Automático

```powershell
# Ejecutar script completo de demostración
.\mostrar-configuracion-it.ps1

# Guardar output en archivo
.\mostrar-configuracion-it.ps1 > informe-it.txt
```

---

## 🚨 16. Troubleshooting Rápido

```powershell
# ¿Están corriendo los contenedores?
podman-compose ps

# ¿Responde la app?
curl http://localhost:3001/api/health

# ¿Responde PostgreSQL?
podman exec stc_postgres pg_isready

# Ver errores recientes
podman-compose logs --tail=50 app | Select-String "error|Error|ERROR"

# Uso de disco
Get-PSDrive C | Select-Object Used, Free

# Uso de memoria
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet/1MB,2)}}
```

---

## 📋 17. Información del Sistema

```powershell
# Sistema operativo
[System.Environment]::OSVersion

# Información de CPU
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors

# Memoria RAM
Get-CimInstance Win32_ComputerSystem | Select-Object @{Name="RAM(GB)";Expression={[math]::Round($_.TotalPhysicalMemory/1GB,2)}}

# Espacio en disco
Get-PSDrive C | Select-Object @{Name="Used(GB)";Expression={[math]::Round($_.Used/1GB,2)}}, @{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}
```

---

## 🎯 Comandos Más Importantes

### Durante la Demo - Top 5:
1. `podman-compose ps` - Ver estado
2. `podman exec -it stc_postgres psql -U stc_user -d stc_produccion` - Conectar a BD
3. `Get-Content docker-compose.yml` - Mostrar configuración
4. `podman-compose logs -f app` - Ver logs
5. `curl http://localhost:3001/api/health` - Probar API

### Para el Servidor - Top 5:
1. `docker compose up -d` - Levantar servicios
2. `docker compose logs -f` - Ver logs
3. `docker compose ps` - Ver estado
4. `docker compose restart app` - Reiniciar app
5. `docker exec postgres pg_dump...` - Hacer backup

---

## ⌨️ Atajos de Teclado para la Demo

- `Alt + Tab` - Cambiar entre ventanas
- `Ctrl + C` - Detener logs en tiempo real
- `Ctrl + L` - Limpiar terminal
- `↑` - Comando anterior
- `Tab` - Autocompletar

---

## 📝 Notas

- Si usa Docker en lugar de Podman, reemplaza `podman` por `docker`
- `podman-compose` = `docker compose` (sin guión en Docker Compose v2)
- En Linux, puede necesitar `sudo` antes de comandos Docker
- En Windows, ejecutar desde PowerShell (no CMD)

---

**Consejo:** Ten este documento abierto en una segunda pantalla o impreso durante la demostración.
