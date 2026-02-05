# Validación tb_RESIDUOS_INDIGO

## 📊 Información General

| Aspecto | Detalle |
|---------|---------|
| **Tabla** | tb_RESIDUOS_INDIGO |
| **Fuente CSV** | RelResIndigo.csv |
| **Hoja Excel** | rptResiduosIndigo |
| **Registros** | 16 (todos los datos del CSV) |
| **Columnas** | 39 |
| **Estado** | ✅ UP_TO_DATE |
| **Advertencias** | 0 |

## 🔍 Análisis de Estructura

### Características Especiales
- **Tabla pequeña**: Solo 16 registros históricos
- **Sin duplicados**: No hay columnas duplicadas ni headers en datos
- **Mapeo de nombre**: CSV "DEVOL TEC." → PostgreSQL "DEVOL TEC#"
- **Columnas PESO ROLO**: 16 columnas consecutivas (01 a 16) para pesos de rollos

### Estructura de Datos
```
39 columnas totales:
- Identificación: FILIAL, SETOR, DESC_SETOR (3)
- Temporal: DT_MOV, TURNO, TURNO CORTE (3)
- Producto: SUBPRODUTO, DESCRICAO, ID (3)
- Medidas: PESO LIQUIDO (KG), PESO ROLO 01-16 (17)
- Trazabilidad: LOTE, PARTIDA, ROLADA, URDUME (4)
- Motivo: MOTIVO, DESC_MOTIVO (2)
- Personal: OPERADOR, NOME_OPER (2)
- Adicional: PE DE ROLO, INDIGO, GAIOLA, OBS, DEVOL TEC# (5)
```

## ✅ Validación de Orden de Columnas

### Comparación SQLite vs CSV
**Resultado**: 38/39 columnas coinciden exactamente

**Única diferencia detectada (columna 39)**:
- SQLite: `DEVOL TEC#` (con almohadilla)
- CSV: `DEVOL TEC.` (con punto)
- **Solución**: Mapeo automático en import script mediante función `renameHeaders()`

### Orden Validado
Todas las columnas mantienen el orden exacto de SQLite:
1-8: FILIAL → ID ✓
9-16: PESO LIQUIDO (KG) → NOME_OPER ✓
17-22: PE DE ROLO → OBS ✓
23-38: PESO ROLO 01 → PESO ROLO 16 ✓
39: DEVOL TEC# ✓ (mapeado desde "DEVOL TEC.")

## 📥 Proceso de Importación

### Archivos Creados
1. **init-db/10-recreate-tb-residuos-indigo.sql** (65 líneas)
   - Schema con 39 columnas TEXT
   - 5 índices: DT_MOV, DESCRICAO, FILIAL, SETOR, TURNO
   
2. **migration/import-residuos-indigo.js** (263 líneas)
   - Función `renameHeaders()` para mapear "DEVOL TEC." → "DEVOL TEC#"
   - Validación de orden de columnas
   - Filtro de headers duplicados (preventivo)
   - VACUUM ANALYZE post-importación

### Ejecución
```bash
# Schema
Get-Content init-db/10-recreate-tb-residuos-indigo.sql | podman exec -i stc_postgres psql -U stc_user -d stc_produccion

# Import
cd migration
node import-residuos-indigo.js
```

### Resultado
```
Total filas CSV:       16
Headers duplicados:    0
Registros importados:  16
Errores:               0
```

## 📊 Validación de Datos

### Cobertura de Datos
| Columna | Registros | Porcentaje |
|---------|-----------|------------|
| FILIAL | 16/16 | 100% |
| SETOR | 16/16 | 100% |
| DT_MOV | 16/16 | 100% |
| TURNO | 16/16 | 100% |
| DESCRICAO | 16/16 | 100% |
| PESO LIQUIDO (KG) | 16/16 | 100% |

**Todas las columnas principales tienen 100% de datos válidos**

### Consulta de Verificación
```sql
-- Verificar count
SELECT COUNT(*) FROM tb_RESIDUOS_INDIGO;  -- 16 ✓

-- Ver distribución por sector
SELECT SETOR, DESC_SETOR, COUNT(*) as registros
FROM tb_RESIDUOS_INDIGO
GROUP BY SETOR, DESC_SETOR
ORDER BY SETOR;

-- Ver registro por fecha
SELECT DT_MOV, COUNT(*) as registros
FROM tb_RESIDUOS_INDIGO
GROUP BY DT_MOV
ORDER BY DT_MOV;
```

## 🔄 Sincronización

### Registro en tb_sync_history
```sql
INSERT INTO tb_sync_history 
(table_name, operation_type, rows_affected, description, success) 
VALUES (
  'tb_RESIDUOS_INDIGO', 
  'IMPORT', 
  16, 
  'Importación inicial: 16 registros desde RelResIndigo.csv (39 columnas, mapeo: DEVOL TEC. → DEVOL TEC#)', 
  true
);
```

### Estado en API
```json
{
  "table": "tb_RESIDUOS_INDIGO",
  "csv_file": "RelResIndigo.csv",
  "xlsx_sheet": "rptResiduosIndigo",
  "rows_imported": 16,
  "status": "UP_TO_DATE"
}
```

## ⚙️ Backend - Column Warnings

### Verificación
```bash
curl http://localhost:3001/api/produccion/import/column-warnings
```

**Resultado**: 0 advertencias para tb_RESIDUOS_INDIGO

**Motivo**: El mapeo "DEVOL TEC." → "DEVOL TEC#" se realiza durante la importación, por lo que el backend solo ve las columnas PostgreSQL que coinciden exactamente con el CSV procesado.

**No requiere mapping dictionary en server.js** porque el renombrado se hace en el import script antes de insertar en PostgreSQL.

## 📝 Patrón de Implementación

### Estrategia de Mapeo
A diferencia de tablas con columnas duplicadas (FICHAS, PRODUCCION, CALIDAD, PARADAS) que requieren mapping dictionaries en el backend, tb_RESIDUOS_INDIGO usa **mapeo en import script** para normalizar nombres de columnas.

**Ventaja**: No contamina el backend con mappings de normalización de caracteres especiales.

### Casos de Uso del Patrón
- ✅ **Import script mapping**: Normalización de caracteres (#, ., /, %, etc.)
- ✅ **Backend mapping**: Columnas duplicadas que cambian de nombre (MOTIVO → MOTIVO1)

## ✅ Checklist de Validación

- [x] Schema creado correctamente
- [x] Import script con validación de orden
- [x] Mapeo de nombre aplicado (DEVOL TEC. → DEVOL TEC#)
- [x] 16 registros importados sin errores
- [x] VACUUM ANALYZE ejecutado
- [x] tb_sync_history actualizado
- [x] API status: UP_TO_DATE
- [x] Column warnings: 0
- [x] Orden de columnas validado contra SQLite
- [x] Datos verificados en columnas principales

## 🎯 Conclusión

**tb_RESIDUOS_INDIGO**: Migración completada exitosamente

- **100% de datos importados** (16/16 registros)
- **100% fidelidad estructural** (39/39 columnas en orden correcto)
- **0 advertencias** en sistema de warnings
- **Mapeo funcional** de caracteres especiales
- **Patrón establecido** para normalización en import script

---

**Fecha de validación**: 5 de febrero de 2026  
**Validado por**: GitHub Copilot  
**Patrón aplicado**: Import-time column renaming
