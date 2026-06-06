# 🏭 STC Producción V2 - PostgreSQL + Podman

Sistema de análisis de producción textil migrado a PostgreSQL con Podman.

## 🚀 Quick Start

### Prerequisitos
- **Podman 5.7+** instalado y máquina iniciada (`podman machine start`)
- **podman-compose** instalado (`pip install podman-compose`)
- Node.js 20+ (para scripts de migración)
- Python 3.12+ (para procesamiento CSV)

### ¿Por qué Podman en lugar de Docker?
- ✅ **100% gratuito** (Apache 2.0) - sin restricciones para empresas
- ✅ **Sin daemon** - más seguro y liviano  
- ✅ **Rootless por defecto** - mayor seguridad
- ✅ **Compatible con Docker Compose** - usa los mismos archivos `.yml`
- ❌ Docker Desktop requiere **licencia de pago** para empresas >250 empleados o >$10M ingresos

### 1. Levantar Base de Datos

```powershell
# Iniciar contenedores con Podman
podman-compose up -d postgres

# Verificar que están corriendo
podman ps

# Ver logs
podman logs stc_postgres
```

### 2. Verificar Conexión

```powershell
# Conectarse a PostgreSQL
podman exec -it stc_postgres psql -U stc_user -d stc_produccion

# Dentro de psql:
\dt          # Listar tablas
\d produccion  # Ver estructura de tabla produccion
SELECT * FROM produccion LIMIT 5;  # Ver datos de prueba
\q           # Salir
```

### 3. pgAdmin (Opcional)

```powershell
# Iniciar pgAdmin
podman-compose up -d pgadmin

# Abrir navegador: http://localhost:5050
# Usuario: admin@stc.com
# Password: admin123
```

## 🌐 Frontend + Backend (recomendado para servidor)

- **Estrategia:** el frontend llama a la API con URL relativa ` /api ` (misma origin).
  - En desarrollo, Vite proxyfía ` /api ` al backend.
  - En servidor (Podman), lo ideal es publicar una única URL y enrutar ` /api ` al backend (reverse proxy) o servir el build del frontend desde el mismo host.
- **Config opcional:** si alguna vez necesitas un prefijo distinto al mismo host, puedes fijar `VITE_API_BASE` al construir el frontend.


## 📊 Estructura de Tablas

### produccion
Datos de producción de máquinas tejedoras
- **Registros estimados**: ~150K
- **Particionado**: Por mes (futuro)
- **Índices**: fecha, filial, máquina, partida

### calidad
Registros de revisión de calidad
- **Registros estimados**: ~80K
- **Índices**: fecha, partida, revisor, rolada

### residuos_indigo
Residuos de producción índigo
- **Registros estimados**: ~5K
- **Índices**: fecha, filial

## 🔧 Comandos Útiles

### Podman
```powershell
# Iniciar todo
podman-compose up -d

# Detener todo
podman-compose down

# Ver logs en tiempo real
podman-compose logs -f postgres

# Reiniciar base de datos
podman-compose restart postgres

# Eliminar todo (incluyendo datos)
podman-compose down -v

# Estado de la máquina virtual Podman
podman machine list
podman machine start  # Si está detenida
podman machine stop   # Para detenerla
```

### PostgreSQL
```powershell
# Conectar a la base de datos
podman exec -it stc_postgres psql -U stc_user -d stc_produccion

# Backup de base de datos
docker exec stc_postgres pg_dump -U stc_user stc_produccion > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Restaurar backup
Get-Content backup.sql | docker exec -i stc_postgres psql -U stc_user -d stc_produccion
```

### Consultas de Verificación
```sql
-- Contar registros por tabla
SELECT 
    'produccion' as tabla, COUNT(*) as registros FROM produccion
UNION ALL
SELECT 'calidad', COUNT(*) FROM calidad
UNION ALL
SELECT 'residuos_indigo', COUNT(*) FROM residuos_indigo;

-- Ver última importación
SELECT * FROM import_control ORDER BY ultima_importacion DESC;

-- Estadísticas de producción del mes actual
SELECT * FROM obtener_estadisticas_mes(2026, 2);

-- Resumen diario
SELECT * FROM resumen_produccion_diaria LIMIT 10;
```

## 📁 Estructura del Proyecto

```
stc-produccion-v2/
├── docker-compose.yml          # Orquestación Docker
├── .env                        # Variables de entorno
├── README.md                   # Este archivo
├── init-db/                    # Scripts SQL iniciales
│   └── 01-schema.sql          # Schema PostgreSQL
├── backend/                    # API Node.js (próximo)
├── frontend/                   # Vue 3 app (próximo)
└── scripts/                    # Scripts de migración (próximo)
```

## ✅ Checklist de Validación - Fase 1

### PostgreSQL
- [ ] Docker container corriendo
- [ ] Conexión exitosa con psql
- [ ] Tablas creadas correctamente
- [ ] Datos de prueba insertados
- [ ] Índices creados
- [ ] Triggers funcionando
- [ ] Vista resumen_produccion_diaria accesible
- [ ] Función obtener_estadisticas_mes ejecutable

### pgAdmin (Opcional)
- [ ] Interfaz accesible en http://localhost:5050
- [ ] Servidor PostgreSQL agregado
- [ ] Visualización de tablas OK

## 🔜 Próximas Fases

**Fase 2**: Backend API
- Express + node-postgres
- Endpoints básicos CRUD
- Middleware de autenticación

**Fase 3**: Migración de Datos
- Script de migración SQLite → PostgreSQL
- Validación de integridad
- Comparación de conteos

**Fase 4**: Frontend
- Copiar componentes activos
- Conectar a nueva API
- Testing end-to-end

## 📝 Notas

- **Nota:** Las vistas de interfaz `Uster`, `Uster Cardas` y `Tenso/Tensorapid` fueron reubicadas y ahora se gestionan desde otra aplicación. La UI principal de este repositorio redirige a `Resumen Ensayos` cuando corresponde; conserve las instrucciones de sincronización y backend en `ARCHIVOS_USTER_EN_CONTENEDOR.md` si necesita integrar archivos raw.
- **Seguridad**: Las credenciales actuales son de desarrollo. Cambiar en producción.
- **Performance**: PostgreSQL optimizado para consultas con índices estratégicos.
- **Backup**: Configurar backups automáticos en producción.
- **Logs**: Por defecto en `./logs/` (crear carpeta si no existe).

## 🆘 Troubleshooting

### Puerto 5432 ocupado
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :5432

# Cambiar puerto en docker-compose.yml
ports:
  - "5433:5432"  # Puerto externo: 5433
```

### Docker no inicia
```powershell
# Verificar Docker Desktop corriendo
docker version

# Reiniciar Docker Desktop
# Abrir Docker Desktop y hacer restart
```

### No se puede conectar
```powershell
# Verificar que el container está corriendo
docker ps | findstr stc_postgres

# Ver logs de errores
docker logs stc_postgres

# Verificar network
docker network ls | findstr stc_network
```

## 📞 Soporte

Para problemas o dudas, revisar logs y documentación de PostgreSQL 16.

---
**Versión**: 2.0.0  
**Última actualización**: 03/02/2026
