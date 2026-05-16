# 🔐 Sistema de Backup y Recuperación

## 📋 Resumen

Este documento describe el sistema de backup automático implementado para proteger los datos de la base de datos PostgreSQL.

## 🎯 Problema Identificado

- **Fecha**: 6 de febrero de 2026
- **Incidente**: Tablas `tb_uster_par` y `tb_uster_tbl` encontradas vacías
- **Causa**: Script con `DROP TABLE` en carpeta `/init-db` 
- **Solución**: Script eliminado + sistema de backups implementado

## 💾 Sistema de Backups

### Backup Manual

```powershell
# Crear backup inmediatamente
.\backup-database.ps1
```

Los backups se guardan en: `C:\stc-produccion-v2\backups\`

Si la unidad `D:` está disponible, el script también copia automáticamente los backups a `D:\Backups-STC\`.

### Backup Enfocado por Eventos de Importación

Para no depender solo del Programador de tareas de Windows, el backend de la PoC ahora puede disparar un backup en segundo plano cuando se confirman importaciones de:

- USTER
- USTER Cardas
- Tensorapid
- HVI/CSV

Ese disparo **no ocurre por cada archivo inmediatamente**. Se aplica una estrategia de consolidación:

- Ventana de silencio: 15 minutos después del último guardado relevante
- Cooldown mínimo entre backups automáticos: 2 horas
- Tipo de backup disparado por la app: `Focused`

El modo `Focused` genera un dump rápido solo de tablas críticas de ensayos:

- `tb_uster_par`
- `tb_uster_tbl`
- `tb_uster_carda_par`
- `tb_uster_carda_tbl`
- `tb_tensorapid_par`
- `tb_tensorapid_tbl`
- `tb_hvi_ensayos`
- `tb_hvi_detalles`

### Backup Full al Final de Importaciones Masivas

La app de producción ahora dispara un backup `Full` cuando una importación masiva termina sin errores en:

- `POST /api/produccion/import-all`
- `POST /api/produccion/import/force-all`

Regla aplicada:

- si el lote no importó nada, no se lanza backup full
- si hubo algún error en el lote, no se lanza backup full
- si el lote terminó bien y hubo tablas importadas, se dispara backup `Full` en segundo plano

Ejecución manual del modo enfocado:

```powershell
.\backup-database.ps1 -Mode Focused -Reason "manual"
```

El estado del scheduler se puede ver en el backend:

```text
GET /api/health
```

Campo esperado en la respuesta:

```json
{
  "backupTrigger": {
    "enabled": true,
    "running": false,
    "pending": false
  }
}
```

### Backup Automático Diario

Para configurar backup automático diario:

Opción recomendada en este repositorio:

```powershell
.
egister-nightly-backup-task.ps1
```

Eso registra una tarea diaria que ejecuta:

```powershell
.
un-nightly-backup.ps1
```

El wrapper nocturno primero:

- verifica/arranca Podman
- inicia `stc_postgres` si hace falta
- espera a que PostgreSQL esté `healthy`
- ejecuta `backup-database.ps1 -Mode Full`

Configuración aplicada por la tarea:

- `WakeToRun`
- `StartWhenAvailable`
- ejecución con el usuario actual en modo `S4U`
- `RunLevel Highest`

Si prefieres crearla manualmente en Task Scheduler:

1. Abrir **Programador de tareas** (Task Scheduler)
2. Crear tarea básica:
   - **Nombre**: Backup STC Producción
   - **Desencadenador**: Diario a las 2:00 AM
   - **Acción**: Iniciar programa
     - **Programa**: `powershell.exe`
     - **Argumentos**: `-NoProfile -ExecutionPolicy Bypass -File C:\stc-produccion-v2\run-nightly-backup.ps1`
     - **Iniciar en**: `C:\stc-produccion-v2`

### Retención

- Backups full: **7** copias en `C:` y **14** copias en `D:`
- Backups enfocados de ensayos: **30** copias en `C:` y **60** copias en `D:`
- Los backups más antiguos se eliminan automáticamente

## 🔄 Restauración de Datos

### Restauración Interactiva

```powershell
# Muestra lista de backups disponibles
.\restore-database.ps1
```

### Restauración Específica

```powershell
# Restaurar un archivo específico
.\restore-database.ps1 "C:\stc-produccion-v2\backups\stc_produccion_2026-02-06_10-30-00.sql"
```

⚠️ **ADVERTENCIA**: La restauración sobrescribe TODOS los datos actuales.

## 🛡️ Medidas de Protección Implementadas

### 1. Scripts de Init-DB Seguros

**REGLA**: Ningún script en `/init-db` debe tener `DROP TABLE` sin protección.

❌ **NUNCA HACER**:
```sql
DROP TABLE IF EXISTS tb_uster_par;  -- ¡PELIGRO!
```

✅ **CORRECTO**:
```sql
CREATE TABLE IF NOT EXISTS tb_uster_par (...);
```

### 2. Volúmenes Persistentes

El volumen `stc_postgres_data` es persistente:
```powershell
# Ver info del volumen
podman volume inspect stc_postgres_data

# NUNCA ejecutar esto sin backup:
# podman volume rm stc_postgres_data  ⚠️ BORRA TODO
```

### 3. Manejo de Errores Mejorado

El backend ahora maneja errores sin romper la UI:
- Query falla → devuelve array vacío
- Log del error → facilita debugging
- Usuario puede continuar trabajando

## 📊 Verificación de Integridad

### Verificar Datos Actuales

```powershell
podman exec stc_postgres psql -U stc_user -d stc_produccion -c "
  SELECT 
    'tb_produccion' as tabla, COUNT(*) as registros FROM tb_produccion
  UNION ALL
  SELECT 'tb_defectos', COUNT(*) FROM tb_defectos
  UNION ALL
  SELECT 'tb_testes', COUNT(*) FROM tb_testes
  UNION ALL
  SELECT 'tb_uster_par', COUNT(*) FROM tb_uster_par
  UNION ALL
  SELECT 'tb_tensorapid_par', COUNT(*) FROM tb_tensorapid_par;
"
```

### Estado Esperado (6 feb 2026)

| Tabla | Registros |
|-------|-----------|
| tb_produccion | 144,342 |
| tb_defectos | 541,383 |
| tb_testes | 9,667 |
| tb_tensorapid_par | 353 |
| tb_uster_par | 0* |

\* `tb_uster_par` está vacía porque los datos se importan **desde archivos TXT locales** bajo demanda, NO desde Oracle.

## 🔍 Datos de USTER

### Flujo de Trabajo USTER

Los datos de USTER funcionan diferente a otros módulos:

1. **Archivos fuente**: Carpeta local con archivos TXT de ensayos
2. **Escaneo**: La UI escanea la carpeta y encuentra archivos
3. **Verificación**: Consulta PostgreSQL para ver cuáles ya están guardados
4. **Importación**: Usuario selecciona y guarda ensayos uno por uno
5. **Persistencia**: Datos quedan en `tb_uster_par` y `tb_uster_tbl`

❗ **IMPORTANTE**: Si tb_uster_par está vacía, NO es pérdida de datos. Los archivos TXT originales siguen existiendo y se pueden reimportar.

## 🚨 En Caso de Pérdida de Datos

### Paso 1: No Entrar en Pánico
Los datos de producción Oracle→PostgreSQL están en backups.

### Paso 2: Revisar Backups Disponibles
```powershell
ls C:\stc-produccion-v2\backups\
```

### Paso 3: Restaurar Último Backup Bueno
```powershell
.\restore-database.ps1
# Seleccionar el backup anterior al incidente
```

### Paso 4: Verificar Integridad
```powershell
# Verificar conteos de registros (ver sección anterior)
```

### Paso 5: Reimportar USTER si Necesario
Los datos de USTER se pueden volver a importar desde los archivos TXT originales.

## 📞 Contacto y Soporte

Para cualquier duda sobre backups o recuperación, revisar este documento primero.

---
**Última actualización**: 6 de febrero de 2026
