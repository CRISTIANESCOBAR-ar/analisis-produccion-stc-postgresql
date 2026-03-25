# Componente EficienciasTecelaje - Guía de Integración

## 📋 Descripción

Componente Vue 3 que replica la macro VBA de eficiencias de tecelaje, mostrando:
- **Resumen de eficiencias**: EFIC_TA, EFIC_TB, EFIC_TC, EFIC_DIA (promediadas por FILIAL)
- **Detalle por turno**: Tabla dinámmica con datos de piezas en tecelaje
- **Cálculo de caídas**: Convertir tiempo en formato hh:mm según fórmula VBA
- **Estadísticas**: Metros totales, eficiencia promedio, telar más usado, etc.

## 🚀 Integración en el Proyecto

### 1. Backend (Ya Implementado)
Los endpoints están registrados en `c:\stc-produccion-v2\backend\server.js`:

```javascript
GET  /api/produccion/eficiencias/resumen   → Eficiencias promedio
POST /api/produccion/eficiencias/detalle   → Detalles por turno
```

**Body para POST /detalle:**
```json
{
  "turno": "A" | "B" | "C" | "DIA"
}
```

### 2. Frontend - Importación del Componente

En cualquier página/componente Vue donde desees mostrar las eficiencias:

```vue
<template>
  <div>
    <!-- Otros contenidos -->
    <EficienciasTecelaje />
  </div>
</template>

<script setup>
import EficienciasTecelaje from '@/components/EficienciasTecelaje.vue'
</script>
```

### 3. Agregar a Ruteador (si se necesita como página separada)

En `c:\stc-produccion-v2\frontend\src\router.js`:

```javascript
{
  path: '/eficiencias-tecelaje',
  name: 'EficienciasTecelaje',
  component: () => import('@/components/EficienciasTecelaje.vue')
}
```

Luego acceder via: `http://localhost:5173/eficiencias-tecelaje`

## 📁 Archivos Creados

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| **Endpoint backend** | `backend/server.js` (línea ~6990+) | Dos rutas GET/POST para eficiencias |
| **Servicio frontend** | `frontend/src/services/eficienciasService.js` | Funciones fetch hacia API |
| **Componente Vue** | `frontend/src/components/EficienciasTecelaje.vue` | UI interactiva con tabs y tabla |

## 🔄 Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│    EficienciasTecelaje.vue (Componente Vue)             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tabs: [Turno A] [Turno B] [Turno C] [Turno DÍA]│  │
│  │  Header: Resumen de eficiencias (A/B/C/DÍA)      │  │
│  │  Tabla: Artículos, colores, metros, caída, etc.  │  │
│  │  Footer: Estadísticas agregadas                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ (fetch)
┌─────────────────────────────────────────────────────────┐
│    eficienciasService.js (Funciones HTTP)               │
│  - fetchEficienciasResumen()                            │
│  - fetchEficienciasDetalle(turno)                       │
│  - fetchEficienciasCompletas(turno)                     │
└─────────────────────────────────────────────────────────┘
                          ↓ (POST/GET)
┌─────────────────────────────────────────────────────────┐
│    Backend: server.js                                   │
│                                                         │
│  GET  /api/produccion/eficiencias/resumen              │
│  ├─ Query: tb_proceso (PROCESSO='TECELAGEM')           │
│  ├─ ROUND(AVG(EFIC_TA), EFIC_TB, EFIC_TC, EFIC_DIA)   │
│  └─ Return: { EFIC_TA, EFIC_TB, EFIC_TC, EFIC_DIA }   │
│                                                         │
│  POST /api/produccion/eficiencias/detalle              │
│  ├─ Body: { turno: 'A'|'B'|'C'|'DIA' }                │
│  ├─ Query: tb_processo JOIN tb_fichas                  │
│  ├─ Calcula CAIDA con fórmula VBA                      │
│  └─ Return: { turno, total, data[...] }               │
└─────────────────────────────────────────────────────────┘
                          ↓ (JOIN)
┌─────────────────────────────────────────────────────────┐
│    PostgreSQL                                           │
│  - tb_processo (FILIAL, PROCESSO, EFIC_TA/B/C/DIA)    │
│  - tb_fichas (ARTIGO CODIGO, BATIDAS/FIO, etc.)       │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Funcionalidades Implementadas

### ✅ Resumen de Eficiencias
Muestra 4 tarjetas con:
- EFIC_TA (Turno A)
- EFIC_TB (Turno B)
- EFIC_TC (Turno C)
- EFIC_DIA (Día completo)

Colores por tarjeta:
- Azul: Turno A
- Verde: Turno B
- Púrpura: Turno C
- Naranja: Día

### ✅ Selector de Turno (Tabs)
Tabs interactivos para cambiar entre turnos A/B/C/DIA

### ✅ Tabla de Detalles
Columnas:
| Col | Contenido |
|-----|-----------|
| T | Tipo (primera letra artículo) |
| Artículo | LEFT(ARTIGO, 10) |
| Color | Código de color |
| Nombre | Descripción mercado |
| Trama | TRAMA_REDUZIDA_1 |
| Efi % | Eficiencia con código de color |
| Metros | Metros previstos ajustados |
| Estado | STATUS (COMPLETO/INICIO/PARADO) |
| Telar | Número de telar |
| **Caída (hh:mm)** | ⭐ Cálculo VBA convertido a tiempo |
| Grupo | GRUPO_TEAR |

### ✅ Cálculo de Caída
Fórmula VBA replicada en JavaScript:
```javascript
horas = MT_A_BATER / ((((RPM * 1440) / (BATIDAS/FIO * 100) * 0.90) / 90) * (EFIC_TURNO + 0.1)) + 0.25
tiempo = hh:mm
```

### ✅ Estadísticas Agregadas
Footer con:
- Metros Totales
- Eficiencia Promedio
- Telar Más Usado
- Status Más Común

## 🎨 Estilos

El componente usa **Tailwind CSS** con:
- Grid responsivo (mobile-first)
- Tabla con alternancia bg-white/bg-gray-50
- Hover effects en filas
- Colores semantic (verde=aprobado, rojo=crítico, naranja=precaución)
- Animación de carga (spinner)

## 🧪 Pruebas Rápidas

### Test 1: Verificar endpoint resumen
```bash
curl http://localhost:3001/api/produccion/eficiencias/resumen
# Esperado: { "EFIC_TA": "85.2%", "EFIC_TB": "87.1%", ... }
```

### Test 2: Verificar endpoint detalle
```bash
curl -X POST http://localhost:3001/api/produccion/eficiencias/detalle \
  -H "Content-Type: application/json" \
  -d '{"turno":"A"}'
# Esperado: { "turno": "A", "total": 123, "data": [...] }
```

### Test 3: Abrir componente en navegador
1. Importar componente en cualquier vista
2. Abrir devtools Firefox/Chrome (F12)
3. Verificar Network → GET/POST a `/api/produccion/eficiencias/*`
4. Verificar que tabla se llena correctamente

## 📝 Notas de Desarrollo

### Conversión VBA → JavaScript
- `Format(valor, "0.0")` → `parseFloat(valor).toFixed(1)`
- `Left(text, n)`, `Right(text, n)` → `text.substring(0, n)`, `text.slice(-n)`
- `Val(text)` → `parseFloat(text)` o `parseInt(text)`
- `IIF()` → Operador ternario `? :`

### Campos de Texto vs Numéricos
PostgreSQL almacena eficiencias como TEXT, por eso se usan helpers:
```javascript
sqlParseNumber('"EFIC_TA"') // Convierte TEXT → numeric
```

### Join con tb_fichas
Se necesita el campo **BATIDAS/FIO** para calcular caída. Si no existe fila en tb_fichas:
```javascript
LEFT JOIN tb_fichas → BATIDAS/FIO será NULL → caida = '--:--'
```

## 🔐 Validaciones

✅ Turno debe ser A/B/C/DIA  
✅ Números válidos en cálculos (evita división por cero)  
✅ Handle de valores nulos/undefined  
✅ Formateo de números con decimales  
✅ CSS responsive (mobile/tablet/desktop)  

## 🚦 Estados de Carga

1. **Initial**: loadingResumen=true, loadingDetalle=true
2. **Resumen Ready**: Muestra 4 tarjetas
3. **Detalle Ready**: Muestra tabla completa
4. **Error**: Mensaje en rojo con detalles

## 📦 Dependencias

- Vue 3 (ya instalado)
- Tailwind CSS (ya configurado)
- Fetch nativo (sin axios necesario)
- Node.js/PostgreSQL en backend (ya corriendo)

## ✨ Mejoras Futuras Posibles

- [ ] Exportar tabla a CSV/Excel
- [ ] Gráficos de eficiencia por turno (Chart.js/ApexCharts)
- [ ] Filtros por rango de fechas (si se agrega DT_PROD)
- [ ] Opciones de ordenamiento de columnas (click header)
- [ ] Paginación si dataset > 500 filas
- [ ] Modo oscuro
- [ ] Integración con calendario de turnos

---

**Versión**: 1.0  
**Fecha Creación**: 22 de Marzo 2026  
**Autor**: GitHub Copilot  
**Estado**: ✅ Listo para producción
