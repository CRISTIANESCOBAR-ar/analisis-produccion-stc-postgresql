# Guía de Estilos de Botones - STC Producción

Esta guía documenta los patrones visuales y clases de Tailwind CSS utilizados para el diseño de botones e inputs interactivos en la aplicación. El objetivo principal es mantener la consistencia estética con la pantalla de **Resumen de Ensayos** (`/resumen`).

---

## 🎨 Principios de Diseño y Tipografía

* **Tipografía de UI (Roboto)**: Se debe utilizar la tipografía de UI `var(--ui-font)` (`'Roboto'`) para todos los elementos interactivos, textos de tablas, inputs y botones.
* **Tipografía de Encabezados (Space Grotesk)**: Reservada para títulos principales (`h1`, `h2`, `h3`, etc.) y branding.
* **Bordes Modernos**: Bordes suavizados de tipo `rounded-lg` para botones y controles.

---

## 🧱 Plantillas de Botones

### 1. Botón Estándar de Control (Fondo Blanco / Neutro)
Utilizado para filtros, botones de acción en barra de herramientas superior, acciones como "Refrescar" o "Exportar".

* **Clases base**:
  `inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md`

```html
<button class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
  <!-- Icono SVG con color text-slate-600 -->
  <svg class="h-4 w-4 text-slate-600" ...></svg>
  <span>Acción</span>
</button>
```

### 2. Botón de Paginación y Controles Secundarios
Más compacto verticalmente (`py-1` en lugar de `py-1.5`), ideal para controles de navegación o alineación estrecha.

* **Clases base**:
  `inline-flex items-center gap-1.5 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md disabled:opacity-40 disabled:pointer-events-none`

```html
<button 
  :disabled="disabledState"
  class="inline-flex items-center gap-1.5 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none shadow-sm hover:shadow-md"
>
  « Primera
</button>
```

### 3. Botones de Acción Primaria (CTA - Call To Action)
Utilizados para ejecuciones de peso en la página ("Analizar", "Guardar", "Ver todos").
* **Tema Índigo** (Defectos y Ensayos):
  `inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm`
* **Tema Azul** (Base de Datos):
  `inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm`

```html
<button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm gap-2">
  <span>Ver todos los registros</span>
</button>
```

---

## 🔍 Inputs y Buscadores Relacionados
Para acompañar a los botones en las cabeceras, los campos de entrada de texto deben ser coherentes en bordes, sombras y foco:

```html
<input 
  type="text" 
  class="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
  placeholder="Buscar..."
/>
```
