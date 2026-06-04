# Preparación de PC como servidor local (temporal)

Fecha: 2026-06-03

Este documento recoge la evaluación de la PC que indicaste y un paso a paso para dejarla operativa como servidor local temporal, además de instrucciones para trasladar el contenedor Podman/Postgres y copiar los proyectos `stc-produccion-v2` y `stc-mezclas-poc`.

## 1) Resumen de idoneidad
- Id del equipo: Intel i3-8100 @ 3.60GHz, 8 GB RAM — Apto para desarrollo, demos y pruebas con pocos usuarios concurrentes.
- Limitaciones: 8 GB RAM es el principal cuello de botella si ejecutas DB local + varios contenedores + navegador. Recomendado 16 GB para carga más confortable.
- Red: la IP `192.168.137.1` sugiere Internet Connection Sharing / hotspot — funciona para pruebas pero es frágil; ideal reservar IP por DHCP o asignar IP estática en la LAN.

## 2) Software mínimo recomendado
- Node.js LTS (para frontend/backend)
- Git
- Docker Desktop + WSL2 o Podman Desktop (para contenedores)
- PostgreSQL (si prefieres instalarlo nativo) o Postgres en contenedor
- PM2 (o NSSM) para ejecutar procesos como servicio en Windows

## 3) Instalación rápida en Windows (PowerShell como administrador)

Instalar Node y Git con `winget` (si está disponible):

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
```

Instalar Docker Desktop (alternativa: Podman Desktop). Requiere habilitar WSL2 y virtualización:

```powershell
# Habilitar WSL y características necesarias (Admin)
wsl --install
# Instala Docker Desktop manualmente o con winget
winget install --id Docker.DockerDesktop -e
```

Si prefieres Podman Desktop, descárgalo desde https://podman.io/ o usa los instaladores oficiales.

Instalar PM2 global (opcional, para correr backend como servicio):

```powershell
npm install -g pm2
pm2 startup
# ejecutar el comando que muestre pm2 startup como administrador
```

## 4) Levantar frontend/backend localmente (ejemplo Vite + Node)

En el equipo destino, dentro de cada proyecto:

```powershell
cd C:\ruta\a\stc-mezclas-poc\frontend
npm install
npm run dev -- --host    # permite acceso desde la red

cd C:\ruta\a\stc-produccion-v2\backend
npm install
npm run start
```

Abrir puerto en Firewall (ejemplo puerto 5174):

```powershell
New-NetFirewallRule -DisplayName "App 5174" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow -Profile Private
```

Probar desde otra máquina: abrir `http://<IP_DEL_PC>:5174/` o usar `Test-NetConnection`:

```powershell
Test-NetConnection -ComputerName 192.168.137.1 -Port 5174
```

## 5) Migración del contenedor Podman/Postgres
Presento dos métodos: A) Recomendado (dump SQL) y B) Copia del volumen (rápida, más frágil).

### Método A — Recomendado: volcado SQL (pg_dump / pg_dumpall)
Ventajas: más portable, menos dependiente de versiones y permisos.

1. En la máquina origen (donde corre Podman): identificar contenedor Postgres

```bash
podman ps --format "table {{.Names}}\t{{.Image}}"
```

2. Crear volcado completo (toda la cluster DB) o por base de datos:

```bash
# Volcado de todo (Unix / WSL)
CONTAINER=stc_postgres
podman exec -i $CONTAINER pg_dumpall -U postgres > pg_dumpall_$(date +%F).sql

# Ó volcado de una DB concreta
podman exec -i $CONTAINER pg_dump -U postgres -d nombre_db > nombre_db_$(date +%F).sql
```

En PowerShell puedes hacer:

```powershell
$container = "stc_postgres"
podman exec -i $container pg_dumpall -U postgres | Out-File -Encoding UTF8 C:\backups\pg_dumpall.sql
```

3. Copiar el archivo `.sql` al nuevo PC (SCP, SMB, copia por USB, etc.).

4. En el nuevo PC: levantar un contenedor Postgres compatible (misma versión mayor recomendada):

```bash
podman run -d --name pg -e POSTGRES_PASSWORD=mi_pass -p 5432:5432 postgres:15
```

5. Restaurar:

```bash
# opción: copiar el archivo al contenedor
podman cp pg_dumpall_2026-06-03.sql pg:/tmp/
podman exec -i pg psql -U postgres -f /tmp/pg_dumpall_2026-06-03.sql

# ó vía canal
cat pg_dumpall_2026-06-03.sql | podman exec -i pg psql -U postgres
```

### Método B — Copia del volumen de datos (rápido, requiere misma versión)
Usa este método si la DB es grande y puedes garantizar la misma versión de Postgres en destino.

1. Parar el contenedor en origen:

```bash
podman stop stc_postgres
```

2. Empaquetar el volumen con un contenedor temporal (alpine/busybox):

```bash
# ejemplo: volumen nombrado pgdata
podman run --rm -v pgdata:/var/lib/postgresql/data -v $(pwd):/backup alpine \
  sh -c "cd /var/lib/postgresql/data && tar czf /backup/pgdata.tar.gz ."
```

En PowerShell, monta una carpeta Windows como `/backup` o copia el archivo generado.

3. Transferir `pgdata.tar.gz` al nuevo PC.

4. En el nuevo PC crear el volumen y extraer:

```bash
podman volume create pgdata
podman run --rm -v pgdata:/var/lib/postgresql/data -v $(pwd):/backup alpine \
  sh -c "cd /var/lib/postgresql/data && tar xzf /backup/pgdata.tar.gz"
```

5. Levantar el contenedor Postgres usando ese volumen:

```bash
podman run -d --name pg -e POSTGRES_PASSWORD=mi_pass -p 5432:5432 -v pgdata:/var/lib/postgresql/data postgres:15
```

6. Comprobar logs y permisos. Nota: asegúrate de usar la misma versión mayor de Postgres (p. ej. 15.x).

### Transferir la imagen del contenedor (opcional)

```bash
podman save -o postgres_15.tar docker.io/library/postgres:15
# copiar postgres_15.tar al nuevo PC
podman load -i postgres_15.tar
```

## 6) Copiar / mover los proyectos (`stc-produccion-v2`, `stc-mezclas-poc`)

Opción A — Clonar desde repositorio remoto (si existe):

```powershell
git clone https://<repo>/stc-produccion-v2.git C:\stc-produccion-v2
git clone https://<repo>/stc-mezclas-poc.git C:\stc-mezclas-poc
```

Opción B — Copia directa desde la máquina origen (ejemplo con `robocopy`):

```powershell
robocopy \\\ORIGEN_PC\C$\ruta\stc-produccion-v2 C:\stc-produccion-v2 /MIR /COPY:DAT /R:3 /W:5
robocopy \\\ORIGEN_PC\C$\ruta\stc-mezclas-poc C:\stc-mezclas-poc /MIR /COPY:DAT /R:3 /W:5
```

Después de copiar:

```powershell
cd C:\stc-produccion-v2\backend
npm install
# configurar variables de entorno (.env) según entorno

cd C:\stc-mezclas-poc\frontend
npm install
npm run build
```

## 7) Checklist final y pruebas
- Asegurar IP fija o reserva DHCP para la PC.
- Abrir puertos necesarios en Firewall (ej. 5174, 5432 si Postgres debe ser accesible localmente desde la LAN).
- Probar acceso desde otra máquina: `curl http://<IP>:5174/` o navegar.
- Verificar que la base de datos responde: `psql -h <IP> -U postgres -p 5432 -l`.

## 8) Notas y recomendaciones
- No usar esta PC como servidor de producción definitivo: sin redundancia ni seguridad profesional.
- Hacer backups frecuentes (`pg_dump` o copia del volumen) y automatizar con tareas programadas.
- Preferible SSD y 16 GB RAM si se van a ejecutar servicios simultáneos.
- Mantén las versiones de Postgres iguales para evitar problemas al copiar datos a nivel de archivos.

---

Si quieres, puedo:
- preparar scripts PowerShell para automatizar instalación básica (Node/Git/abrir firewall),
- generar comandos exactos para migrar tu contenedor actual (dime el nombre del contenedor y si la máquina origen es Linux/Windows),
- o ejecutar ciertos comandos aquí si me indicas que puedo correrlos en tu terminal.
