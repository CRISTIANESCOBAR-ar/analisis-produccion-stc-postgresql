# Correcciones de despliegue y recuperación

Esta entrega se prepara en una rama aislada. Hacer commit/push de la rama no instala la versión ni reinicia los procesos de la PC de producción. No contiene una migración de datos ni cambia contraseñas del servidor existente.

## Cambios

- La imagen incluye `shared/` durante la compilación y la ejecución; se versionan los locks de backend/frontend para usar `npm ci`.
- La aplicación completa exige autenticación HTTP Basic en `NODE_ENV=production`. El navegador solicita usuario y contraseña al abrir la página y los reutiliza en las llamadas al mismo origen. `/api/health` sigue público y solo devuelve disponibilidad.
- El control de origen y de acceso se aplica antes de todas las rutas y archivos estáticos. Desarrollo local mantiene compatibilidad; para proteger también el servidor de desarrollo compartido, definir ambas variables `STC_AUTH_*`.
- Compose recibe secretos por entorno, publica PostgreSQL/pgAdmin en localhost por defecto y deja pgAdmin fuera del arranque habitual; iniciarlo explícitamente o con el perfil `admin`.
- `.env` y dumps se excluyen de la imagen. El dump que estaba versionado se retira del seguimiento; las copias e historial anteriores siguen existiendo. Esta entrega no reescribe el historial de Git.
- Windows conserva su script de respaldo. Linux usa `pg_dump` 16 y guarda archivos custom en el volumen `stc_app_backups`; un respaldo fallido queda marcado como error y no se publica un archivo completo. Configurar retención y una copia externa de ese volumen según el espacio disponible.

## Preparación sin tocar la instalación activa

1. Usar otra carpeta para obtener la rama y ejecutar `npm ci` en `backend` y `frontend`, seguido de `npm test` en la raíz y `npm run build` en `frontend`.
2. Para Compose, copiar `.env.example` a `.env` en esa carpeta. Completar `POSTGRES_PASSWORD` con la contraseña **actual** de la base. Cambiar esa variable no modifica la contraseña de un volumen inicializado. Para ejecución directa en Windows, conservar el `backend/.env` actual y sus variables `PG_*`.
3. Definir `STC_AUTH_USER` sin dos puntos y `STC_AUTH_PASSWORD` con al menos 16 caracteres. Mantenerlas fuera de Git y de variables `VITE_*`. El acceso de aplicación es independiente del usuario de PostgreSQL.
4. Configurar HTTPS en el punto de acceso antes de usar estas credenciales fuera de una conexión local confiable. HTTP Basic no cifra la contraseña; necesita TLS para ello.
5. Si hay otros orígenes de frontend, añadir sus URL exactas a `FRONTEND_ORIGIN`. No usar comodines. En desarrollo con Vite, la API pasa por `/api`; autenticar a través de ese mismo origen. El despliegue de producción sirve interfaz y API desde la misma dirección.
6. Construir la imagen antes del cambio. Para pruebas de arranque, usar una base y volúmenes de prueba independientes. El servidor ya tiene rutinas automáticas de esquema, índices y secuencias al iniciar, por lo que no debe arrancarse una segunda instancia de prueba contra la base real.

No ejecutar `compose down`, recrear PostgreSQL ni borrar volúmenes para aplicar estos cambios. La configuración conserva los nombres de los volúmenes existentes.

## Activación y continuidad

La PC actual sirve la API en el puerto 3001 y las interfaces de desarrollo en 5173/5174. Esta entrega no modifica esos procesos. Antes de activar la autenticación, distribuir las credenciales a los usuarios y verificar los clientes que importan datos o consumen la API.

Para un cambio sin interrupción hace falta un proxy estable o balanceador que permita alternar entre instancias verificadas. Sin ese mecanismo no se puede garantizar un reinicio de Node con cero interrupción. Preparar esa transición por separado; no sustituir procesos ni hacer `pull` dentro de una carpeta vigilada por nodemon durante el uso del sistema.

Si se implementa un relevo de instancias, comprobar primero health, carga de la interfaz, consultas y autenticación, y mantener disponible la versión anterior. La rotación de la contraseña de PostgreSQL y la restricción de puertos de un contenedor ya existente deben coordinarse después con todos sus consumidores; modificar Compose por sí solo no cambia un contenedor que ya está corriendo.

## Recuperación de código

El punto anterior a esta entrega es `9d9e8b3a85c56cb2e1592996ec3546316fe0e1ca`, publicado con la etiqueta `codex-baseline-20261007`.

Para preparar una copia de recuperación sin borrar cambios locales:

```powershell
git fetch origin --tags
git switch -c recuperacion/stc-20261007 codex-baseline-20261007
```

Hacerlo en una carpeta de trabajo limpia y aislada. Para deshacer una entrega ya integrada, revertir sus commits en orden inverso: primero el commit de `frontend/dist` y después el de código; guardar la reversión en un nuevo commit y publicarlo. No usar `reset --hard` ni `push --force` sobre la instalación o rama compartida.

Cambiar de commit no restaura datos ni secretos. Conservar el entorno de la versión anterior y respaldos verificados por separado. Si solo se publicó la rama de correcciones, la instalación activa sigue en su versión anterior y no requiere revertir nada.

## Recuperación de respaldos Linux

Los archivos completos terminan en `.dump`; los `.partial` son incompletos y no deben restaurarse. Usar `pg_restore --list` para inspeccionar el archivo y probar `pg_restore --exit-on-error --no-owner --dbname=<base_de_prueba>` en una base vacía e independiente antes de una recuperación real. No restaurar encima de producción como parte de la validación. Mantener los respaldos Windows `.sql` y su procedimiento existente.

## Validación

`npm test` ejecuta las pruebas Node y Vitest sin conectarse a producción. Las pruebas de seguridad usan un servidor temporal y las de respaldo usan procesos simulados. Las cinco pruebas antiguas de calibración se reemplazaron por seis casos del API actual (ranking, filtros y métricas), sin cambiar cálculos de producción.

En el entorno restringido de Windows, si la carpeta temporal del sistema impide renombrar archivos, configurar `TEMP` y `TMP` a una carpeta de trabajo escribible antes de ejecutar las pruebas. No se deben cambiar los permisos de producción para resolver ese problema.

Se actualizaron Express 4 y dependencias compatibles para corregir los avisos de `proxy-addr`, `body-parser` y `qs`, manteniendo la versión mayor de Express. Queda pendiente migrar `csv-parse` a una versión mayor para resolver su aviso moderado, con pruebas específicas sobre los CSV reales. La construcción del frontend también informa avisos de dependencias preexistentes; esa actualización requiere un trabajo separado de compatibilidad. No se ejecutó `npm audit fix --force` ni se cambiaron reglas textiles para silenciar pruebas.
