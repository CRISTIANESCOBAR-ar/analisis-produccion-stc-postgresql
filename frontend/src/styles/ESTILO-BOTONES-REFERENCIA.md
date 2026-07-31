# Guía de Estilo: Botones de Acción / Tabs / Filtros

> Referencia canónica extraída de [`ResumenEnsayos.vue`](file:///c:/stc-produccion-v2/frontend/src/components/ensayos/ResumenEnsayos.vue#L75-L149).  
> Aplicada a [`AnalisisMesaTest.vue`](file:///c:/stc-produccion-v2/frontend/src/components/produccion/AnalisisMesaTest.vue#L11-L37) el 25/07/2026.

---

## Anatomía del Botón

Cada botón es un `<button>` con layout `inline-flex`, ícono SVG 4×4 a la izquierda y texto a la derecha.

### Estructura HTML

```html
<button
  @click="handler"
  v-tippy="{ content: 'Descripción contextual', placement: 'bottom', theme: 'light' }"
  class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
  :class="isActive ? 'bg-blue-50 text-blue-700 border-blue-500' : 'bg-white text-slate-700 hover:bg-slate-50'"
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <!-- paths del ícono -->
  </svg>
  Texto del botón
</button>
```

---

## Clases Detalladas

### Clase base (siempre presente)

| Clase | Propósito |
|-------|-----------|
| `inline-flex` | Layout inline flex para alinear ícono + texto |
| `items-center` | Centrado vertical |
| `gap-1` | Espaciado 4px entre ícono y texto |
| `px-2` | Padding horizontal 8px |
| `py-1` | Padding vertical 4px |
| `border` | Borde sólido |
| `border-slate-200` | Color de borde por defecto (gris claro) |
| `rounded-lg` | Bordes redondeados 8px |
| `text-sm` | Tamaño de fuente 14px |
| `font-medium` | Peso de fuente 500 |
| `transition-colors` | Transición suave en colores |
| `duration-150` | Duración de transición 150ms |
| `shadow-sm` | Sombra sutil |
| `hover:shadow-md` | Sombra más pronunciada al hover |

**Clase base como string:**
```
inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md
```

### Estado Activo (seleccionado)

| Clase | Propósito |
|-------|-----------|
| `bg-blue-50` | Fondo azul muy tenue |
| `text-blue-700` | Texto azul oscuro |
| `border-blue-500` | Borde azul sólido (reemplaza el slate-200) |

**String:**
```
bg-blue-50 text-blue-700 border-blue-500
```

### Estado Inactivo

| Clase | Propósito |
|-------|-----------|
| `bg-white` | Fondo blanco limpio |
| `text-slate-700` | Texto gris oscuro |
| `hover:bg-slate-50` | Fondo gris muy claro al hover |

**String:**
```
bg-white text-slate-700 hover:bg-slate-50
```

---

## Variantes de Color Semánticas (KPIs & Filtros)

Para botones que indican estado (Crítico, Alerta, En Meta), se usan tonos suaves del color correspondiente tanto inactivo como activo, manteniendo la estructura estándar del botón:

| Variante | Inactivo (Tono suave) | Activo (Seleccionado) |
|----------|-----------------------|-----------------------|
| **Azul (Todos/Default)** | `bg-white text-slate-700 border-slate-200 hover:bg-slate-50` | `bg-blue-50 text-blue-700 border-blue-500 font-semibold` |
| **Rojo Ladrillo / Bermellón (Crítico)** | `bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70` | `bg-rose-100 text-rose-900 border-rose-400 font-medium` |
| **Ámbar (Alerta/Deriva)** | `bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70` | `bg-amber-100 text-amber-900 border-amber-400 font-medium` |
| **Verde Pastel Pálido (En Meta)** | `bg-green-50 text-green-700 border-green-200/60 hover:bg-green-100/60` | `bg-green-100 text-green-800 border-green-400 font-medium` |

---

## Contenedor de Grupo de Botones

Los botones se agrupan en un `<div>` simple **sin** fondo, sin borde, sin padding extra:

```html
<div class="flex items-center gap-2">
  <!-- botones aquí -->
</div>
```

> [!CAUTION]
> **NO usar** contenedores con `bg-slate-100 p-1 rounded-lg border border-slate-200` como wrapper.
> Eso produce el aspecto de "pill container" tipo segmented control que es el estilo **VIEJO** que queremos evitar.

---

## Ícono SVG

- Tamaño: `h-4 w-4` (16×16px)
- Fill: `none`
- Stroke: `currentColor` (hereda el color del texto del botón)
- Stroke width: `2`
- Aria: `aria-hidden="true"`

### Íconos usados actualmente

| Botón | SVG Path |
|-------|----------|
| **Todos** (grid 2×2) | `<rect x="3" y="3" width="7" height="7"/>` × 4 cuadrantes |
| **Dentro** (check circle) | `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>` + polyline check |
| **Fuera** (alert circle) | `<circle cx="12" cy="12" r="10"/>` + líneas de exclamación |
| **Refrescar** | `<path d="M21 12a9 9 0 1 1-3-6.7"/>` + polyline flecha |
| **Exportar** (download) | `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` + polyline + line |
| **Seguimiento** (chart line) | `<path d="M3 3v18h18"/>` + `<path d="M18 17l-5-9-4 5-3-3"/>` |
| **Análisis** (trend up) | `<path d="M21 21H4a1 1 0 0 1-1-1V3"/>` + `<path d="M7 14l4-4 4 4 6-6"/>` |

---

## Ejemplo Completo: Grupo de Tabs

```vue
<div class="flex items-center gap-2">
  <button 
    @click="tabActivo = 'seguimiento'"
    class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
    :class="tabActivo === 'seguimiento'
      ? 'bg-blue-50 text-blue-700 border-blue-500'
      : 'bg-white text-slate-700 hover:bg-slate-50'"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M3 3v18h18" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M18 17l-5-9-4 5-3-3" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
    Seguimiento &amp; Tendencias
  </button>
  <button 
    @click="tabActivo = 'analisis'"
    class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
    :class="tabActivo === 'analisis'
      ? 'bg-blue-50 text-blue-700 border-blue-500'
      : 'bg-white text-slate-700 hover:bg-slate-50'"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M21 21H4a1 1 0 0 1-1-1V3" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7 14l4-4 4 4 6-6" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
    Análisis Gráfico por Artículo
  </button>
</div>
```

## Ejemplo: Grupo de Filtros con Colores Semánticos

```vue
<div class="flex items-center gap-2">
  <!-- Todos -->
  <button @click="filterAll"
    class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
    :class="statusFilter === 'all'
      ? 'bg-blue-50 text-blue-700 border-blue-500'
      : 'bg-white text-slate-700 hover:bg-slate-50'">
    <!-- SVG ícono --> Todos
  </button>
  <!-- Dentro -->
  <button @click="filterOk"
    class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
    :class="statusFilter === 'ok'
      ? 'bg-green-50 text-green-700 border-green-500'
      : 'bg-white text-slate-700 hover:bg-slate-50'">
    <!-- SVG ícono --> Dentro
  </button>
  <!-- Fuera -->
  <button @click="filterOutOfRange"
    class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
    :class="statusFilter === 'out-of-range'
      ? 'bg-red-50 text-red-700 border-red-500'
      : 'bg-white text-slate-700 hover:bg-slate-50'">
    <!-- SVG ícono --> Fuera
  </button>
</div>
```

---

> [!IMPORTANT]
> Este documento es la referencia canónica para **todos** los botones de acción, tabs y filtros del proyecto.
> Cualquier nuevo componente que necesite botones de este tipo debe seguir estas clases exactas.
