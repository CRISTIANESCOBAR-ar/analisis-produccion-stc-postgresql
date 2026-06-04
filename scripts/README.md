Scripts para migración Postgres (Podman) y copia de proyectos

Ubicación: `stc-produccion-v2/scripts`

Prerequisitos
- Podman/Podman Desktop instalado en origen y destino (o Docker si prefieres adaptar).
- `robocopy` (viene con Windows) para copiar proyectos vía UNC.
- Compartir la carpeta destino en la máquina receptor (o usar C$ con credenciales de administrador).
- Permisos administrativos para abrir puertos y crear servicios si hiciera falta.

Archivos incluidos
- `export_postgres_dump.ps1` — crea volcado SQL desde el contenedor Postgres y opcionalmente lo copia a un UNC remoto.
- `import_postgres_dump.ps1` — restaura el volcado en un nuevo contenedor Postgres en la máquina destino.
- `copy_projects_robocopy.ps1` — usa `robocopy` para copiar (o reflejar) carpetas de proyecto desde la máquina origen.

Ejemplo de flujo (resumido)
1) En la máquina origen (Windows 11) ejecutar:

```powershell
# crear volcado y copiar a la carpeta compartida del destino
cd C:\ruta\a\stc-produccion-v2\scripts
.\export_postgres_dump.ps1 -ContainerName stc_postgres -BackupDir C:\stc_backups\pg -DestinationShare \\\WIN10HOST\C$\stc_backups -Compress
```

2) En la máquina destino (Windows 10) ejecutar:

```powershell
# importar el volcado a un contenedor Postgres nuevo
cd C:\stc-produccion-v2\scripts
.\import_postgres_dump.ps1 -BackupDir C:\stc_backups\stc_postgres -PostgresPassword 'mi_pass_segura' -ForceReplace

# copiar proyectos desde el origen (ejemplo usando C$)
.\copy_projects_robocopy.ps1 -SourceUNC "\\ORIGEN_HOST\C$\ruta\stc-produccion-v2" -DestinationPath "C:\stc-produccion-v2" -Mirror
```

Notas
- El método por volcado SQL (`pg_dumpall`) es el recomendado: más portable y menos dependiente de la versión exacta de Postgres.
- Si necesitas copiar volúmenes a nivel de archivos (tar del volumen), dímelo y preparo un script separado; requiere más cuidado con versiones de Postgres.
- Revisa los logs y comprueba que `pg_isready` responda antes de restaurar.

Si quieres, puedo ejecutar los comandos en tu terminal (dime en qué máquina empezar y confirma permisos), o adaptar los scripts para usar SCP/PSCP en lugar de UNC.
