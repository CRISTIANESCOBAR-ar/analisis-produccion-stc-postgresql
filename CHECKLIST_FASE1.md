# ✅ CHECKLIST - FASE 1: PostgreSQL + Docker

**Fecha inicio**: 03/02/2026  
**Objetivo**: Validar infraestructura Docker funcional

---

## 🎯 FASE 1: Setup Docker + PostgreSQL

### Pre-requisitos
- [ ] Docker Desktop instalado
- [ ] Docker Desktop corriendo
- [ ] Puerto 5432 disponible
- [ ] Puerto 5050 disponible (pgAdmin)

### 1️⃣ Levantar Contenedores (5 min)

```powershell
cd C:\stc-produccion-v2
docker-compose up -d
```

**Validaciones**:
- [ ] Contenedor `stc_postgres` creado
- [ ] Contenedor `stc_postgres` corriendo (status: Up)
- [ ] Contenedor `stc_pgadmin` corriendo
- [ ] Network `stc_network` creado
- [ ] Volumen `stc_postgres_data` creado

**Comandos de verificación**:
```powershell
docker ps
docker network ls | findstr stc
docker volume ls | findstr stc
```

### 2️⃣ Verificar PostgreSQL (3 min)

```powershell
# Ver logs
docker logs stc_postgres

# Conectar a psql
docker exec -it stc_postgres psql -U stc_user -d stc_produccion
```

**Dentro de psql**:
```sql
-- Listar tablas
\dt

-- Verificar tabla produccion
\d produccion

-- Ver datos de prueba
SELECT * FROM produccion;

-- Ver todas las tablas con datos
SELECT 
    'produccion' as tabla, COUNT(*) as registros FROM produccion
UNION ALL
SELECT 'calidad', COUNT(*) FROM calidad;

-- Salir
\q
```

**Validaciones**:
- [ ] Conexión exitosa
- [ ] 3 tablas creadas: `produccion`, `calidad`, `residuos_indigo`
- [ ] 1 tabla de control: `import_control`
- [ ] Tabla `produccion` tiene 3 registros de prueba
- [ ] Tabla `calidad` tiene 2 registros de prueba
- [ ] Vista `resumen_produccion_diaria` existe
- [ ] Función `obtener_estadisticas_mes` existe

### 3️⃣ Verificar Índices (2 min)

```powershell
docker exec -it stc_postgres psql -U stc_user -d stc_produccion
```

```sql
-- Ver índices de produccion
\d produccion

-- Verificar que existan índices
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('produccion', 'calidad', 'residuos_indigo')
ORDER BY tablename, indexname;
```

**Validaciones**:
- [ ] Al menos 6 índices en `produccion`
- [ ] Al menos 5 índices en `calidad`
- [ ] Al menos 2 índices en `residuos_indigo`

### 4️⃣ Probar Triggers (2 min)

```sql
-- Actualizar un registro
UPDATE produccion 
SET metros_producidos = 1050.00 
WHERE id = 1;

-- Verificar que updated_at cambió
SELECT id, metros_producidos, created_at, updated_at 
FROM produccion 
WHERE id = 1;
```

**Validaciones**:
- [ ] `updated_at` es diferente a `created_at`
- [ ] `updated_at` es más reciente

### 5️⃣ Probar Vista y Función (2 min)

```sql
-- Probar vista
SELECT * FROM resumen_produccion_diaria;

-- Probar función
SELECT * FROM obtener_estadisticas_mes(2026, 2);
```

**Validaciones**:
- [ ] Vista retorna datos
- [ ] Función ejecuta sin errores
- [ ] Resultados son coherentes

### 6️⃣ pgAdmin (Opcional - 3 min)

1. Abrir navegador: http://localhost:5050
2. Login:
   - Email: `admin@stc.com`
   - Password: `admin123`
3. Add New Server:
   - Name: `STC Producción`
   - Host: `postgres` (nombre del servicio en Docker)
   - Port: `5432`
   - Username: `stc_user`
   - Password: `stc_password_2026`

**Validaciones**:
- [ ] Login exitoso
- [ ] Servidor agregado
- [ ] Visualización de tablas OK
- [ ] Query tool funciona

### 7️⃣ Test de Performance (2 min)

```sql
-- Insertar 1000 registros de prueba
INSERT INTO produccion (filial, fecha_produccion, turno, maquina, artigo, partida, metros_producidos, eficiencia)
SELECT 
    '05',
    '2026-01-01'::date + (n || ' days')::interval,
    CASE WHEN random() < 0.33 THEN 'A' WHEN random() < 0.66 THEN 'B' ELSE 'C' END,
    '50' || (100 + (random() * 20)::int)::text,
    'ART' || (1000 + (random() * 100)::int)::text,
    'PART' || (1000 + (random() * 50)::int)::text,
    (800 + random() * 400)::decimal(12,2),
    (70 + random() * 25)::decimal(5,2)
FROM generate_series(1, 1000) as n;

-- Verificar inserción
SELECT COUNT(*) FROM produccion;

-- Probar consulta con índices
EXPLAIN ANALYZE
SELECT * FROM produccion
WHERE fecha_produccion BETWEEN '2026-01-01' AND '2026-01-31'
  AND filial = '05'
ORDER BY fecha_produccion DESC;
```

**Validaciones**:
- [ ] Inserción exitosa (1003 registros total)
- [ ] Query usa índices (Index Scan en EXPLAIN)
- [ ] Tiempo de respuesta < 50ms

---

## ✅ RESULTADO FASE 1

### ✅ TODO OK - Continuar Fase 2
- [ ] Todos los checks pasaron
- [ ] PostgreSQL funciona correctamente
- [ ] Índices optimizados
- [ ] Triggers activos
- [ ] Listo para backend API

### ⚠️ PROBLEMAS ENCONTRADOS
**Problema**:
```
[Describir aquí cualquier error encontrado]
```

**Solución aplicada**:
```
[Describir solución]
```

---

## 🔜 PRÓXIMA FASE

Una vez completada Fase 1, proceder a:
- **Fase 2**: Backend API con Express + pg
  - Endpoints CRUD básicos
  - Conexión a PostgreSQL
  - Testing con Postman/Thunder Client

---

## 📝 NOTAS

**Tiempo estimado Fase 1**: 20-30 minutos  
**Última actualización**: 03/02/2026 16:30
