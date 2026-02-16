<template>
  <div class="flex flex-col h-full bg-slate-50 p-6 overflow-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <span class="p-2 bg-indigo-100 text-indigo-600 rounded-lg text-xl">⚙️</span>
        Estándares de Calidad y Mezcla
      </h2>
      
      <!-- Selector de Versión -->
      <div class="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
        <label class="text-xs font-bold text-slate-500 uppercase">Versión Activa:</label>
        <select v-model="currentVersion" class="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer">
          <option :value="currentVersion">{{ currentVersion }}</option>
          <option value="nueva">+ Crear Nueva Versión</option>
        </select>
        <button 
          @click="guardarCambios" 
          :disabled="saving"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          <span v-if="saving">Guardando...</span>
          <span v-else>💾 Guardar Configuración</span>
        </button>
      </div>
    </div>

    <!-- TOOLTIP AMBIENTE FLOTANTE (Teleport) -->
    <!-- Se recomienda montarlo al body si usáramos Teleport, pero para simpleza en Vue puro sin tanta configuración lo pondremos fixed arriba de todo -->
    <div 
       v-if="tooltipVisible"
       :style="{ 
          top: tooltipPosition.top, 
          left: tooltipPosition.left,
          transform: tooltipPlacement === 'top' ? 'translate(-50%, -100%)' :  
                     tooltipPlacement === 'bottom' ? 'translate(-50%, 0)' : 
                     tooltipPlacement === 'left' ? 'translate(-100%, 0)' : 'translate(0, 0)'
       }"
       class="fixed z-[9999] w-[320px] bg-white text-slate-700 rounded-lg shadow-2xl border border-slate-200 pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95"
    >
        <div class="p-2" v-html="hviTooltips[tooltipVisible] || '<div>Sin Info</div>'"></div>
        
         <!-- Flecha (Estilos condicionales según placement) -->
         <div 
           v-if="tooltipPlacement === 'top'"
           class="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-white drop-shadow-sm"
         ></div>
         <div 
           v-if="tooltipPlacement === 'bottom'"
           class="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-8 border-transparent border-b-white drop-shadow-sm"
         ></div>
         <div 
           v-if="tooltipPlacement === 'left'"
           class="absolute top-4 left-full -ml-px border-8 border-transparent border-l-white drop-shadow-sm"
         ></div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- SECCIÓN A: Matriz de Títulos (Hilos) -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 class="font-bold text-slate-700 flex items-center gap-2">
            <span>🧵</span> Matriz de Hilos por Título (Ne)
          </h3>
          <span class="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">Requisitos mínimos para aprobar lote</span>
        </div>
        
        <div class="overflow-x-auto p-4">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th class="px-4 py-3 bg-slate-50 first:rounded-tl-lg">Título (Ne)</th>
                <th class="px-4 py-3 bg-slate-50">Aplicación</th>
                <th class="px-4 py-3 bg-slate-50 text-center">SCI (Min)</th>
                <th class="px-4 py-3 bg-slate-50 text-center">STR (g/tex)</th>
                <th class="px-4 py-3 bg-slate-50 text-center">MIC (Rango)</th>
                <th class="px-4 py-3 bg-slate-50 text-center last:rounded-tr-lg">SF % (Max)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(hilo, index) in hilosConfig" :key="index" class="hover:bg-indigo-50/30 transition-colors group">
                <td class="px-4 py-2 font-mono text-sm font-bold text-indigo-700">
                  <input v-model="hilo.titulo_ne" class="bg-transparent w-full focus:outline-none focus:text-indigo-900" />
                </td>
                <td class="px-4 py-2 text-xs font-medium text-slate-600">
                   <input v-model="hilo.aplicacion" class="bg-transparent w-full focus:outline-none focus:text-slate-900 border-b border-transparent focus:border-indigo-300" />
                </td>
                <td class="px-4 py-2 text-center">
                   <input type="number" v-model.number="hilo.sci_min" class="w-16 text-center text-sm bg-slate-100 rounded focus:ring-2 focus:ring-indigo-400 outline-none" />
                </td>
                <td class="px-4 py-2 text-center">
                   <div class="relative flex items-center justify-center">
                     <span class="absolute left-2 text-slate-400 text-[10px]">></span>
                     <input type="number" step="0.1" v-model.number="hilo.str_min" class="w-16 pl-4 text-center text-sm bg-slate-100 rounded focus:ring-2 focus:ring-indigo-400 outline-none" />
                   </div>
                </td>
                <td class="px-4 py-2 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <input type="number" step="0.1" v-model.number="hilo.mic_min" class="w-12 text-center text-xs bg-slate-100 rounded" />
                    <span class="text-slate-400">-</span>
                    <input type="number" step="0.1" v-model.number="hilo.mic_max" class="w-12 text-center text-xs bg-slate-100 rounded" />
                  </div>
                </td>
                <td class="px-4 py-2 text-center">
                   <input type="number" step="0.1" v-model.number="hilo.sf_max" class="w-16 text-center text-sm bg-red-50 text-red-700 font-bold rounded focus:ring-2 focus:ring-red-400 outline-none" />
                </td>
              </tr>
            </tbody>
          </table>
          <button @click="addHilo" class="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 text-xs font-bold hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            + Agregar Nuevo Título
          </button>
        </div>
      </div>

      <!-- SECCIÓN B: Panel de Tolerancias (Mezcla) -->
      <div class="lg:col-span-1 bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col">
        <div class="px-6 py-4 border-b border-slate-100 bg-amber-50 flex justify-between items-center">
          <h3 class="font-bold text-amber-800 flex items-center gap-2">
            <span>⚖️</span> Reglas de Mezcla
          </h3>
        </div>
        
        <div class="p-6 flex flex-col gap-6 overflow-auto max-h-[800px]">
          <p class="text-xs text-slate-500 leading-relaxed">
            Habilita la <b>inteligencia de mezclado</b>. Define Promedios Objetivo, Límites Absolutos (Hard Caps) y Rangos de Tolerancia.
          </p>

          <div v-for="(tol, idx) in toleranciasConfig" :key="idx" class="relative pl-4 border-l-4 border-amber-400 bg-amber-50/50 p-4 rounded-r-lg group">
            
            <!-- Header de la Regla -->
            <div class="flex justify-between items-center mb-3">
              <div class="flex items-center gap-2 relative">
                  <span class="font-black text-slate-700 text-base">{{ tol.parametro }}</span>
                  <!-- Tooltip informativo V3 (Posición Dinámica + Icono SVG) -->
                  <div 
                    class="relative inline-flex items-center justify-center"
                    @mouseenter="showTooltip($event, tol.parametro)"
                    @mouseleave="hideTooltip"
                    @click="showTooltip($event, tol.parametro)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400 hover:text-emerald-600 cursor-help transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 bg-white rounded border border-amber-200 text-amber-600 shadow-sm">
                Regla {{ tol.porcentaje_min_ideal }}/{{ 100 - tol.porcentaje_min_ideal }}
              </span>
            </div>
            
            <!-- Grid de Configuración (2 filas x 2 columnas) -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              
              <!-- Objetivo (Ideal) -->
              <div class="col-span-1">
                <label class="block text-slate-500 font-semibold mb-1" title="Promedio Objetivo que la mayoría del lote debe cumplir">
                  Promedio Objetivo
                </label>
                <div class="flex items-center relative">
                   <!-- Icono condicional < o > -->
                   <span class="absolute left-2 font-bold text-slate-400 z-10">
                     {{ tol.parametro === '+b' ? '<' : '>' }}
                   </span>
                   <input 
                      v-if="tol.parametro !== '+b'"
                      type="number" step="0.01" 
                      v-model.number="tol.valor_ideal_min" 
                      class="w-full pl-6 pr-2 py-1.5 bg-white border border-amber-300 rounded text-slate-800 font-bold focus:ring-2 focus:ring-amber-500 outline-none shadow-sm" 
                   />
                   <input 
                      v-else
                      type="number" step="0.01" 
                      v-model.number="tol.promedio_objetivo_max" 
                      class="w-full pl-6 pr-2 py-1.5 bg-white border border-amber-300 rounded text-slate-800 font-bold focus:ring-2 focus:ring-amber-500 outline-none shadow-sm" 
                   />
                </div>
              </div>
              
              <!-- Hard Cap (Límite Absoluto) -->
              <div class="col-span-1">
                <label class="block text-slate-500 font-semibold mb-1 text-red-500" title="Valor máximo/absoluto permitido. Lotes fuera de esto se rechazan.">
                  Límite Máximo (Hard)
                </label>
                <div class="flex items-center relative">
                   <span class="absolute left-2 font-bold text-red-300 z-10">≤</span>
                   <input 
                      type="number" step="0.01" 
                      v-model.number="tol.limite_max_absoluto" 
                      class="w-full pl-6 pr-2 py-1.5 bg-white border border-red-200 rounded text-slate-800 font-bold focus:ring-2 focus:ring-red-400 outline-none shadow-sm" 
                   />
                </div>
              </div>

              <!-- Rango Tolerancia (Min - Max) -->
              <div class="col-span-2 bg-slate-50 p-2 rounded border border-slate-100">
                <label class="block text-slate-400 mb-1 text-[10px] uppercase font-bold tracking-wider">
                  Rango Tolerancia ({{ 100 - tol.porcentaje_min_ideal }}%)
                </label>
                <div class="flex items-center gap-2">
                   <div class="relative w-full">
                     <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Min</span>
                     <input type="number" step="0.01" v-model.number="tol.rango_tol_min" class="w-full pl-8 py-1 bg-white border border-slate-200 rounded text-center text-slate-600 focus:border-indigo-300 outline-none" />
                   </div>
                   <span class="text-slate-300 font-bold">-</span>
                   <div class="relative w-full">
                     <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Max</span>
                     <input type="number" step="0.01" v-model.number="tol.rango_tol_max" class="w-full pl-8 py-1 bg-white border border-slate-200 rounded text-center text-slate-600 focus:border-indigo-300 outline-none" />
                   </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Swal from 'sweetalert2';

const currentVersion = ref('Estándar 2026');
const saving = ref(false);

const hilosConfig = ref([]);
const toleranciasConfig = ref([]);
const tooltipVisible = ref(null); // Almacena el ID del parámetro cuyo tooltip se muestra
const tooltipPosition = ref({ top: '0px', left: '0px' });
const tooltipPlacement = ref('top'); // top, bottom, left, right

// Tooltips HTML extraídos de AnalisisCalidadFibra V2 (Estilos Originales Claros)
const hviTooltips = {
  MIC: `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        MIC - Micronaire
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Medida de permeabilidad al aire. Combina finura y madurez.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: 3.7 - 4.2 (Ideal Denim)</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: < 3.4 (Inmadura) o > 4.9 (Gruesa)</div>
      </div>
      <div style="background: #fef3c7; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
        <div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 4px;">⚠️ MIC Bajo (<3.4):</div>
        <div style="font-size: 11px; color: #78350f; line-height: 1.5;">Fibra inmadura que colapsa. Forma Neps (puntos blancos).</div>
      </div>
      <div style="background: #fff7ed; padding: 10px; border-radius: 6px;">
        <div style="font-size: 11px; color: #c2410c; font-weight: 600; margin-bottom: 4px;">⚠️ MIC Alto (>4.9):</div>
        <div style="font-size: 11px; color: #9a3412; line-height: 1.5;">Fibras gruesas = menos fibras en sección transversal = hilo más débil.</div>
      </div>
    </div>
  `,
  LEN: `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        LEN - Length (Longitud UHML)
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Longitud promedio de la mitad más larga de las fibras.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: > 28mm (1.11")</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: < 26mm (1.03")</div>
      </div>
      <div style="background: #eff6ff; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 4px;">🔧 Impacto Hilatura:</div>
        <div style="font-size: 11px; color: #475569; line-height: 1.5;">Dicta el ajuste de rodillos. Mayor longitud permite hilos más finos.</div>
      </div>
       <div style="background: #fef3c7; padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 2px;">⚠️ Variación:</div>
        <div style="font-size: 11px; color: #78350f; line-height: 1.5;">Mezclar fibras cortas y largas sin control genera partes gruesas y delgadas.</div>
      </div>
    </div>
  `,
  STR: `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        STR - Strength (Resistencia)
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Resistencia a la rotura medida en g/tex.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: > 30 g/tex</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: < 25 g/tex (Riesgo Denim)</div>
      </div>
      <div style="background: #eff6ff; padding: 10px; border-radius: 6px; margin-bottom: 6px;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 4px;">📊 Regla de Oro:</div>
        <div style="font-size: 11px; color: #475569; line-height: 1.5;">Resistencia del hilo ≈ 50-60% de la resistencia de la fibra.</div>
      </div>
      <div style="background: #fef3c7; padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 2px;">👖 Lavado Stone Wash:</div>
        <div style="font-size: 11px; color: #78350f; line-height: 1.5;">Denim sufre estrés mecánico. STR bajo = roturas en costuras.</div>
      </div>
    </div>
  `,
  ELG: `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        ELG - Elongation (Elasticidad)
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Capacidad de estiramiento antes de rotura. "Resorte" natural.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: > 7%</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: < 5%</div>
      </div>
      <div style="background: #eff6ff; padding: 10px; border-radius: 6px; margin-bottom: 6px;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 2px;">🎯 Ventaja Mecánica:</div>
        <div style="font-size: 11px; color: #475569; line-height: 1.5;">Absorbe impactos del telar (golpe del peine). Reduce paradas.</div>
      </div>
    </div>
  `,
  RD: `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        Rd - Reflectance (Brillo)
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Grado de reflectancia (blanco vs gris). Escala Nickerson-Hunter.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: 75 - 82 (Bright)</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: < 70 (Grisáceo/Spotted)</div>
      </div>
      <div style="background: #eff6ff; padding: 10px; border-radius: 6px;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 600; margin-bottom: 2px;">🎨 Clasificación Visual:</div>
        <div style="font-size: 11px; color: #475569; line-height: 1.5;">Rd bajo oscurece el tono final del hilo, incluso después del teñido.</div>
      </div>
    </div>
  `,
  '+b': `
    <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
      <div style="font-weight: 700; font-size: 15px; color: #0f766e; margin-bottom: 10px; border-bottom: 2px solid #14b8a6; padding-bottom: 6px;">
        +b - Yellowness (Amarillamiento)
      </div>
      <div style="font-size: 12px; color: #334155; margin-bottom: 10px; line-height: 1.6; font-weight: 600;">
        Grado de amarillo. Indica oxidación o envejecimiento.
      </div>
      <div style="background: #f0fdfa; padding: 8px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #14b8a6;">
        <div style="font-size: 11px; color: #059669; font-weight: 500;">✓ Óptimo: < 9.5 (Blanco)</div>
      </div>
      <div style="background: #fef2f2; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #ef4444;">
        <div style="font-size: 11px; color: #dc2626; font-weight: 500;">✗ Crítico: > 12.0 (Tinged/Yellow)</div>
      </div>
       <div style="background: #fef3c7; padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: #92400e; font-weight: 600; margin-bottom: 2px;">⚠️ Problema de Teñido:</div>
        <div style="font-size: 11px; color: #78350f; line-height: 1.5;">Algodón amarillo absorbe índigo diferente = barrados en tela.</div>
      </div>
    </div>
  `
};

const showTooltip = (event, paramId) => {
  tooltipVisible.value = paramId;
  const el = event.target;
  const rect = el.getBoundingClientRect();
  
  // Ajustes de dimensiones
  const tooltipWidth = 320; 
  const tooltipHeightEstimate = 400; // Altura máxima estimada
  const gap = 12; // Espacio entre el icono y el tooltip

  const screenH = window.innerHeight;
  const screenW = window.innerWidth;
  
  // 1. Preferencia 1: Arriba
  // Si hay espacio arriba (rect.top > tooltipHeight)
  if (rect.top > tooltipHeightEstimate + gap) {
     tooltipPlacement.value = 'top';
     tooltipPosition.value = {
        top: `${rect.top - gap}px`,
        left: `${rect.left + rect.width / 2}px`
     };
  }
  // 2. Preferencia 2: Abajo (si no cabe arriba, pero cabe abajo)
  else if ((screenH - rect.bottom) > tooltipHeightEstimate + gap) {
     tooltipPlacement.value = 'bottom';
     tooltipPosition.value = {
        top: `${rect.bottom + gap}px`,
        left: `${rect.left + rect.width / 2}px`
     };
  }
  // 3. Fallback: Izquierda (tooltip a la izquierda del icono)
  else {
      tooltipPlacement.value = 'left';
      // Alineado al top del icono
       tooltipPosition.value = {
        top: `${rect.top}px`,
        left: `${rect.left - gap}px`
     };
  }
};

const hideTooltip = () => {
    tooltipVisible.value = null;
};

const fetchConfig = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/config/standards');
    const data = await res.json();
    if(data.success) {
      if(data.hilos.length) hilosConfig.value = data.hilos;
      
      let tols = data.tolerancias || [];
      // Asegurar que existan RD y +b
      const requiredParams = ['MIC', 'LEN', 'STR', 'ELG', 'RD', '+b'];
      requiredParams.forEach(p => {
         if (!tols.find(t => t.parametro === p)) {
            tols.push({
               parametro: p,
               version_nombre: currentVersion.value,
               valor_ideal_min: p === 'RD' ? 72 : 0,
               promedio_objetivo_max: p === '+b' ? 10.5 : null,
               limite_max_absoluto: p === '+b' ? 12.0 : null,
               rango_tol_min: p === 'RD' ? 68 : 0,
               rango_tol_max: p === 'RD' ? 70 : 0,
               porcentaje_min_ideal: 80
            });
         }
      });
      
      toleranciasConfig.value = tols;
      
      if(data.version_actual) currentVersion.value = data.version_actual;
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo cargar la configuración', 'error');
  }
};

const addHilo = () => {
  hilosConfig.value.push({
    titulo_ne: 'Nuevo',
    aplicacion: 'Trama',
    sci_min: 0,
    str_min: 0, 
    mic_min: 0,
    mic_max: 0,
    sf_max: 0
  });
};

const guardarCambios = async () => {
  saving.value = true;
  try {
    const payload = {
      version_nombre: currentVersion.value,
      hilos: hilosConfig.value,
      tolerancias: toleranciasConfig.value
    };

    const res = await fetch('http://localhost:3001/api/config/standards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if(result.success) {
      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: 'La configuración de estándares se ha actualizado correctamente.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      throw new Error(result.error);
    }
  } catch (e) {
    Swal.fire('Error al guardar', e.message, 'error');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchConfig();
});
</script>
