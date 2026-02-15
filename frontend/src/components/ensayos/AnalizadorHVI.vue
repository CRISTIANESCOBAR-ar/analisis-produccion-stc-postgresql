<template>
  <div class="analizador-hvi bg-slate-900 text-slate-100 rounded-xl p-6 shadow-2xl border border-slate-700">
    <!-- Header del Reporte -->
    <header class="mb-6 pb-4 border-b border-slate-600">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <span class="p-2 bg-blue-600 rounded-lg">📊</span>
            Análisis Técnico HVI (Matriz Denim)
          </h2>
          <p class="text-sm text-slate-400 mt-1">Evaluación de Aptitud de Fibra para Hilatura</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-500">Pacas analizadas</span>
          <p class="text-2xl font-bold text-blue-400">{{ pacasValidas.length }} <span class="text-sm text-slate-500">/ {{ pacas.length }}</span></p>
        </div>
      </div>

      <!-- Metadata del Lote -->
      <div v-if="metadata && metadata.loteEntrada" class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 text-xs">
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">Lote:</span>
          <p class="text-blue-300 font-mono text-sm">{{ metadata.loteEntrada }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">Proveedor:</span>
          <p class="text-slate-200 truncate" :title="metadata.proveedor">{{ metadata.proveedor || 'No especificado' }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">Grado:</span>
          <p class="text-slate-200">{{ metadata.grado || '---' }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">Fecha:</span>
          <p class="text-slate-200">{{ metadata.fecha || '---' }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">Color:</span>
          <span :class="['px-2 py-0.5 rounded text-[10px] font-bold', metadata.color ? 'bg-amber-600/20 text-amber-300 border border-amber-600/30' : 'text-slate-500']">{{ metadata.color || 'Sin color' }}</span>
        </div>
        <div class="space-y-1">
          <span class="text-slate-500 uppercase font-semibold">CORT:</span>
          <p class="text-slate-200">{{ metadata.cort || '---' }}</p>
        </div>
        <div class="space-y-1 md:col-span-2">
          <span class="text-slate-500 uppercase font-semibold">Observaciones:</span>
          <p class="text-slate-400 italic truncate" :title="metadata.obs">{{ metadata.obs || 'Sin observaciones adicionales' }}</p>
        </div>
      </div>
      
      <!-- Alerta de desafío técnico -->
      <div v-if="promedios.sci < 85 && pacasValidas.length > 0" 
           class="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
        <div class="flex items-start gap-3">
          <span class="text-2xl">⚠️</span>
          <div>
            <h3 class="font-bold text-red-300">ALERTA: Fibra No Apta para Producción Estándar</h3>
            <p class="text-sm text-red-200 mt-1">
              El índice SCI promedio del lote ({{ promedios.sci.toFixed(1) }}) está por debajo del mínimo para GRUESOS (85). 
              Alto riesgo de roturas masivas y baja eficiencia.
            </p>
          </div>
        </div>
      </div>
    </header>

    <!-- Sección: Datos Inconsistentes -->
    <section v-if="pacasExcluidas.length > 0" class="mb-6">
      <h3 class="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        Datos Inconsistentes Detectados
      </h3>
      <div class="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
        <p class="text-sm text-amber-200 mb-2">
          Los siguientes fardos presentan valores fuera de rango físico y fueron excluidos del análisis:
        </p>
        <div class="flex flex-wrap gap-2">
          <span v-for="paca in pacasExcluidas" :key="paca.fardo"
                class="px-2 py-1 bg-amber-800/50 text-amber-200 rounded text-xs">
            Fardo #{{ paca.fardo }}: {{ paca.motivo }}
          </span>
        </div>
      </div>
    </section>

    <!-- Sección: Resumen Ejecutivo -->
    <section class="mb-6">
      <h3 class="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-blue-400"></span>
        Resumen Ejecutivo (Promedios)
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="(valor, key) in promediosDisplay" :key="key"
             :class="['p-3 rounded-lg border', getColorClase(key, valor.value)]">
          <span class="text-xs text-slate-400 uppercase">{{ valor.label }}</span>
          <p class="text-xl font-bold mt-1">{{ valor.display }}</p>
          <span class="text-xs" :class="getColorTexto(key, valor.value)">{{ valor.estado }}</span>
        </div>
      </div>
    </section>

    <!-- Sección: Diagnóstico de Títulos -->
    <section class="mb-6">
      <h3 class="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-purple-400"></span>
        Matriz de Aptitud (Producción Real)
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div v-for="(diagnostico, idx) in diagnosticoTitulos" :key="idx"
             :class="['p-4 rounded-lg border-l-4', diagnostico.clase]">
          <div class="flex items-center gap-2 mb-1">
            <span>{{ diagnostico.icono }}</span>
            <span class="font-semibold">{{ diagnostico.titulo }}</span>
          </div>
          <p class="text-xs text-slate-300">{{ diagnostico.texto }}</p>
        </div>
      </div>
    </section>

    <!-- Sección: Análisis por Fardo (Individual) -->
    <section class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-400"></span>
          Análisis por Fardo
        </h3>
        <button 
          @click="verTodasLasPacas = !verTodasLasPacas"
          class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-600 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
        >
          {{ verTodasLasPacas ? "Mostrar solo Banderas Rojas" : "Ver todas las pacas" }}
        </button>
      </div>

      <div class="overflow-hidden border border-slate-700 rounded-xl bg-slate-800 shadow-inner">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-700/50 text-slate-300 text-center">
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-24 text-left">Fardo</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">SCI</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">MIC</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">MAT</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">SF</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">STR</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider w-16">RD</th>
                <th class="px-4 py-3 font-bold uppercase tracking-wider text-left">Aptitud y Desviaciones</th>
              </tr>
              <!-- Fila de Referencia (FINOS) -->
              <tr class="bg-blue-900/20 text-blue-300 font-mono border-y border-slate-700 text-center">
                <td class="px-4 py-2 font-bold italic text-left">PARÁMETROS (FINOS)</td>
                <td class="px-4 py-2">> 112</td>
                <td class="px-4 py-2">3.8 - 4.5</td>
                <td class="px-4 py-2">> 0.85</td>
                <td class="px-4 py-2">< 9.0</td>
                <td class="px-4 py-2">> 28.5</td>
                <td class="px-4 py-2">> 72.0</td>
                <td class="px-4 py-2 text-[10px] text-blue-400 text-left uppercase">Límites para Urdimbre (12/1-16/1)</td>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="paca in pacasFiltradas" :key="paca.fardo" 
                  class="hover:bg-slate-700/30 transition-colors group text-center">
                <td class="px-4 py-2.5 font-mono text-slate-300 relative text-left whitespace-nowrap">
                  <span v-if="paca.tieneBanderaRoja" 
                        class="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-red-500 rounded-full"></span>
                  #{{ paca.fardo }}
                </td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.sci.claseBg]">{{ paca.sci }}</td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.mic.claseBg]">{{ paca.mic }}</td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.mat.claseBg]">{{ paca.mat }}</td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.sf.claseBg]">{{ paca.sf }}</td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.str.claseBg]">{{ paca.str }}</td>
                <td :class="['px-4 py-2.5 font-medium border-x border-slate-700/50', paca.analisis.rd.claseBg]">{{ paca.rd }}</td>
                <td class="px-4 py-2.5 text-left text-[11px] leading-tight max-w-sm">
                  <div class="mb-1.5 font-semibold text-slate-200">
                    {{ paca.aptitudTexto }}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="(desv, idx) in paca.desviaciones" :key="idx"
                          :class="['px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap', 
                                  desv.critica ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300']">
                      {{ desv.texto }}
                    </span>
                    <span v-if="paca.desviaciones.length === 0" class="text-slate-500 italic">Parámetros dentro de norma</span>
                  </div>
                </td>
              </tr>
              <tr v-if="pacasFiltradas.length === 0">
                <td colspan="8" class="px-4 py-12 text-center text-slate-500 italic">
                  {{ verTodasLasPacas ? "No se encontraron pacas válidas" : "No se detectaron pacas con Banderas Rojas (Fino/Urdimbre)" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Sección: Mitigación -->
    <section v-if="necesitaMitigacion" class="mb-6">
      <h3 class="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
        Recomendaciones Técnicas (Mitigación)
      </h3>
      <div class="bg-cyan-900/30 border border-cyan-700 rounded-lg p-4">
        <p class="text-sm text-cyan-200 mb-3">
          <strong>Plan de Acción</strong> sugerido para este lote:
        </p>
        <ul class="space-y-2">
          <li v-for="(rec, idx) in recomendacionesMitigacion" :key="idx"
              class="flex items-start gap-2 text-sm text-slate-300">
            <span class="text-cyan-400">→</span>
            {{ rec }}
          </li>
        </ul>
      </div>
    </section>

    <!-- Sección: Diagnóstico Final Narrativo -->
    <section class="mb-4">
      <h3 class="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-400"></span>
        Diagnóstico Final del Consultor Técnico
      </h3>
      <div class="bg-slate-800 border border-slate-600 rounded-lg p-5">
        <div class="prose prose-invert prose-sm max-w-none">
          <p class="text-slate-200 leading-relaxed whitespace-pre-line">{{ diagnosticoFinal }}</p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="pt-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
      <span>Análisis Estructural HVI · Optimizado para Denim</span>
      <span>{{ fechaAnalisis }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  pacas: {
    type: Array,
    required: true,
    default: () => []
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
});

const verTodasLasPacas = ref(false);

const DICCIONARIO_TEXTIL = {
  TITULOS: {
    FINOS_URDIMBRE: {
      limite_sci: 112,
      limite_str: 28.5,
      rango: "12/1 a 16/1",
      apto: "Fibra excelente para Urdimbre y Finos. Alta tenacidad y SCI óptimo.",
      marginal: "Fibra en el límite para Urdimbre. Monitorear roturas en urdido.",
      no_apto: "Baja tenacidad/SCI para Urdimbre. Riesgo de eficiencia en tejeduría."
    },
    FLAME: {
      limite_sci: 102,
      limite_str: 26,
      rango: "9.5 y 10 Flame",
      apto: "Apta para hilos Flame. Resistencia adecuada para el efecto Slub.",
      marginal: "Marginal para Flame. Puede requerir mayor torsión.",
      no_apto: "No recomendada para Flame. Riesgo de puntos débiles."
    },
    GRUESOS: {
      limite_sci: 85,
      limite_str: 22,
      rango: "5/1 a 10/1",
      apto: "Ideal para títulos gruesos (Trama/Open-End).",
      marginal: "Aceptable para gruesos con control de desperdicio.",
      no_apto: "Incluso para gruesos, el SCI es deficientemente bajo."
    }
  },
  MITIGACION: {
    STR_BAJO: [
      "Reducir velocidad de estiraje en la mechera un 10-15%.",
      "Aumentar torsión en el hilo para compensar la debilidad de la fibra.",
      "Considerar mezcla con algodón de STR > 30 g/tex en proporción 70/30.",
      "Revisar humedad relativa en sala de hilatura (óptimo: 55-65%)."
    ],
    SF_ALTO: [
      "Aumentar presión de rodillos en la carda para mejor apertura.",
      "Revisar ajuste de la barra de cuchillas en la peinadora.",
      "Considerar pasaje de manuar adicional."
    ],
    MIC_IRREGULAR: [
      "Realizar clasificación manual previa para evitar barrados en tintura.",
      "Ajustar mezcla para estabilizar el MIC promedio entre 3.8-4.2.",
      "Informar a tintorería sobre variabilidad de absorción esperada."
    ]
  },
  CONCLUSIONES: {
    EXCELENTE: "Fibra de ALTA APTITUD para URDIEMBRE. Calidad superior.",
    BUENO: "Lote balanceado. APTO para FLAME y GRUESOS sin restricciones.",
    REGULAR: "Lote marginal. Solo recomendado para GRUESOS/TRAMA.",
    CRITICO: "ALERTA: Solo apto para TÍTULOS MUY GRUESOS con baja eficiencia.",
    RECHAZAR: "RECHAZO TÉCNICO: Parámetros inferiores a la matriz de aptitud mínima."
  }
};

const LIMITES_FISICOS = {
  sci: { min: 20, max: 200, nombre: "SCI" },
  str: { min: 15, max: 50, nombre: "STR" },
  sf: { min: 3, max: 20, nombre: "SF" },
  mic: { min: 2.5, max: 7, nombre: "MIC" },
  ui: { min: 70, max: 95, nombre: "UI" },
  uhml: { min: 20, max: 40, nombre: "UHML" },
  rd: { min: 50, max: 90, nombre: "RD" },
  plusB: { min: 3, max: 20, nombre: "+b" },
  mst: { min: 3, max: 12, nombre: "MST" },
  mat: { min: 0.70, max: 0.98, nombre: "MAT" },
  elg: { min: 3, max: 10, nombre: "ELG" },
  trAr: { min: 0, max: 5, nombre: "TrAR" }
};

function validarPaca(paca) {
  const problemas = [];
  for (const [campo, limites] of Object.entries(LIMITES_FISICOS)) {
    const valor = parseFloat(paca[campo]);
    if (isNaN(valor) || valor === 0) {
      problemas.push(`${limites.nombre} nulo/cero`);
    } else if (valor < limites.min || valor > limites.max) {
      problemas.push(`${limites.nombre} fuera de rango`);
    }
  }
  return problemas;
}

const pacasExcluidas = computed(() => {
  return props.pacas
    .map(paca => {
      const problemas = validarPaca(paca);
      return problemas.length > 0 ? { fardo: paca.fardo, motivo: problemas.join(", ") } : null;
    })
    .filter(Boolean);
});

const pacasValidas = computed(() => {
  return props.pacas.filter(paca => validarPaca(paca).length === 0);
});

const promedios = computed(() => {
  if (pacasValidas.value.length === 0) {
    return { sci: 0, str: 0, sf: 0, mic: 0, ui: 0, uhml: 0, rd: 0, plusB: 0 };
  }
  const campos = ["sci", "str", "sf", "mic", "ui", "uhml", "rd", "plusB"];
  const sumas = {};
  const conteos = {};
  campos.forEach(campo => { sumas[campo] = 0; conteos[campo] = 0; });
  pacasValidas.value.forEach(paca => {
    campos.forEach(campo => {
      const val = parseFloat(paca[campo]);
      if (!isNaN(val) && val > 0) { sumas[campo] += val; conteos[campo]++; }
    });
  });
  const resultado = {};
  campos.forEach(campo => { resultado[campo] = conteos[campo] > 0 ? sumas[campo] / conteos[campo] : 0; });
  return resultado;
});

const promediosDisplay = computed(() => {
  const p = promedios.value;
  return {
    sci: { label: "SCI", value: p.sci, display: p.sci.toFixed(1), estado: p.sci >= 112 ? "Excelente" : p.sci >= 102 ? "Apto Flame" : p.sci >= 85 ? "Apto Gruesos" : "Riesgo" },
    str: { label: "STR", value: p.str, display: p.str.toFixed(1), estado: p.str >= 28.5 ? "Urdimbre" : p.str >= 26 ? "Flame" : p.str >= 22 ? "Gruesos" : "Crítico" },
    mic: { label: "MIC", value: p.mic, display: p.mic.toFixed(2), estado: p.mic >= 3.8 && p.mic <= 4.2 ? "Ideal" : p.mic >= 3.5 && p.mic <= 4.9 ? "Aceptable" : "Riesgo" },
    sf: { label: "SF (%)", value: p.sf, display: p.sf.toFixed(1), estado: p.sf <= 9 ? "Ideal" : p.sf <= 11 ? "Aceptable" : "Alto" }
  };
});

const pacasAnalizadas = computed(() => {
  return pacasValidas.value.map(paca => {
    const sci = parseFloat(paca.sci);
    const mic = parseFloat(paca.mic);
    const mat = parseFloat(paca.mat);
    const sf = parseFloat(paca.sf);
    const str = parseFloat(paca.str);
    const rd = parseFloat(paca.rd);

    const desviaciones = [];
    let redFlag = false;

    // Lógica de Aptitud Real
    let aptitudTexto = "";
    if (sci >= 112 && str >= 28.5) {
      aptitudTexto = "Apto para Finos/Urdimbre (12/1-16/1), Flame y Gruesos.";
    } else if (sci >= 102 && str >= 26) {
      aptitudTexto = "Apto para Flame (9.5-10) y Gruesos, pero NO para Finos.";
      if (sci < 112 || str < 28.5) redFlag = true;
    } else if (sci >= 85 && str >= 22) {
      aptitudTexto = "Apto para Gruesos (5/1-10/1), pero NO para Urdimbre o Flame.";
      redFlag = true;
    } else {
      aptitudTexto = "NO APTO para hilatura estándar (Matrix mínima no alcanzada).";
      redFlag = true;
    }

    // Alertas por parámetro (Banderas Rojas)
    if (sci < 85) desviaciones.push({ texto: "SCI Insuficiente (<85)", critica: true });
    if (str < 22) desviaciones.push({ texto: "STR Crítico (<22)", critica: true });
    if (mic < 3.4 || mic > 5.0) desviaciones.push({ texto: "MIC Fuera Rango Industrial", critica: true });
    if (sf > 13.5) desviaciones.push({ texto: "SF Crítico (>13.5%)", critica: true });
    if (mat < 0.75) desviaciones.push({ texto: "Inmadurez detectada", critica: true });

    return {
      fardo: paca.fardo,
      sci: sci.toFixed(1),
      mic: mic.toFixed(2),
      mat: mat.toFixed(2),
      sf: sf.toFixed(1),
      str: str.toFixed(1),
      rd: rd.toFixed(1),
      tieneBanderaRoja: redFlag,
      aptitudTexto,
      desviaciones,
      analisis: {
        sci: { claseBg: sci < 85 ? "bg-red-500/20 text-red-300" : sci < 112 ? "bg-yellow-500/10 text-yellow-300" : "text-green-400" },
        mic: { claseBg: (mic < 3.4 || mic > 5.0) ? "bg-red-500/20 text-red-300" : (mic < 3.5 || mic > 4.9) ? "bg-yellow-500/10 text-yellow-300" : "text-slate-300" },
        mat: { claseBg: mat < 0.75 ? "bg-red-500/20 text-red-300" : mat < 0.85 ? "bg-yellow-500/10 text-yellow-300" : "text-slate-300" },
        sf: { claseBg: sf > 13.5 ? "bg-red-500/20 text-red-300" : sf > 9.0 ? "bg-yellow-500/10 text-yellow-300" : "text-slate-300" },
        str: { claseBg: str < 22 ? "bg-red-500/20 text-red-300" : str < 28.5 ? "bg-yellow-500/10 text-yellow-300" : "text-green-400" },
        rd: { claseBg: rd < 65 ? "bg-red-500/20 text-red-300" : rd < 72 ? "bg-yellow-500/10 text-yellow-300" : "text-slate-300" }
      }
    };
  });
});

const pacasFiltradas = computed(() => {
  if (verTodasLasPacas.value) return pacasAnalizadas.value;
  return pacasAnalizadas.value.filter(p => p.tieneBanderaRoja);
});

function getColorClase(key, valor) {
  const reglas = {
    sci: v => v >= 112 ? "bg-green-900/50 border-green-500" : v >= 102 ? "bg-slate-800 border-slate-600" : v >= 85 ? "bg-yellow-900/50 border-yellow-500" : "bg-red-900/50 border-red-500",
    str: v => v >= 28.5 ? "bg-green-900/50 border-green-500" : v >= 26 ? "bg-slate-800 border-slate-600" : v >= 22 ? "bg-yellow-900/50 border-yellow-500" : "bg-red-900/50 border-red-500",
    mic: v => v >= 3.8 && v <= 4.2 ? "bg-green-900/50 border-green-500" : v >= 3.5 && v <= 4.9 ? "bg-slate-800 border-slate-600" : "bg-yellow-900/50 border-yellow-500",
    sf: v => v <= 9 ? "bg-green-900/50 border-green-500" : v <= 11 ? "bg-slate-800 border-slate-600" : "bg-yellow-900/50 border-yellow-500"
  };
  return reglas[key] ? reglas[key](valor) : "bg-slate-800 border-slate-600";
}

function getColorTexto(key, valor) {
  const reglas = {
    sci: v => v >= 112 ? "text-green-400" : v >= 102 ? "text-slate-400" : v >= 85 ? "text-yellow-400" : "text-red-400",
    str: v => v >= 28.5 ? "text-green-400" : v >= 26 ? "text-slate-400" : v >= 22 ? "text-yellow-400" : "text-red-400",
    mic: v => v >= 3.8 && v <= 4.2 ? "text-green-400" : v >= 3.5 && v <= 4.9 ? "text-slate-400" : "text-yellow-400",
    sf: v => v <= 9 ? "text-green-400" : v <= 11 ? "text-slate-400" : "text-yellow-400"
  };
  return reglas[key] ? reglas[key](valor) : "text-slate-400";
}

const diagnosticoTitulos = computed(() => {
  const sci = promedios.value.sci;
  const str = promedios.value.str;
  const tit = DICCIONARIO_TEXTIL.TITULOS;
  const resultado = [];
  
  // FINOS / URDIEMBRE
  if (sci >= tit.FINOS_URDIMBRE.limite_sci && str >= tit.FINOS_URDIMBRE.limite_str) 
    resultado.push({ titulo: "Finos/Urdimbre (12/1-16/1)", texto: tit.FINOS_URDIMBRE.apto, clase: "border-green-500 bg-green-900/30", icono: "✅" });
  else if (sci >= tit.FINOS_URDIMBRE.limite_sci - 5) 
    resultado.push({ titulo: "Finos/Urdimbre (12/1-16/1)", texto: tit.FINOS_URDIMBRE.marginal, clase: "border-yellow-500 bg-yellow-900/30", icono: "⚠️" });
  else 
    resultado.push({ titulo: "Finos/Urdimbre (12/1-16/1)", texto: tit.FINOS_URDIMBRE.no_apto, clase: "border-red-500 bg-red-900/30", icono: "❌" });

  // FLAME
  if (sci >= tit.FLAME.limite_sci && str >= tit.FLAME.limite_str)
    resultado.push({ titulo: "Flame (9.5 - 10)", texto: tit.FLAME.apto, clase: "border-green-500 bg-green-900/30", icono: "✅" });
  else if (sci >= tit.FLAME.limite_sci - 5)
    resultado.push({ titulo: "Flame (9.5 - 10)", texto: tit.FLAME.marginal, clase: "border-yellow-500 bg-yellow-900/30", icono: "⚠️" });
  else
    resultado.push({ titulo: "Flame (9.5 - 10)", texto: tit.FLAME.no_apto, clase: "border-red-500 bg-red-900/30", icono: "❌" });

  // GRUESOS
  if (sci >= tit.GRUESOS.limite_sci)
    resultado.push({ titulo: "Gruesos (5/1 - 10/1)", texto: tit.GRUESOS.apto, clase: "border-green-500 bg-green-900/30", icono: "✅" });
  else
    resultado.push({ titulo: "Gruesos (5/1 - 10/1)", texto: tit.GRUESOS.no_apto, clase: "border-red-500 bg-red-900/30", icono: "❌" });

  return resultado;
});

const necesitaMitigacion = computed(() => (promedios.value.str < 24 || promedios.value.sf > 11) && pacasValidas.value.length > 0);
const recomendacionesMitigacion = computed(() => {
  const recs = [];
  if (promedios.value.str < 24) recs.push(...DICCIONARIO_TEXTIL.MITIGACION.STR_BAJO);
  if (promedios.value.sf > 11) recs.push(...DICCIONARIO_TEXTIL.MITIGACION.SF_ALTO);
  const mics = pacasValidas.value.map(p => parseFloat(p.mic)).filter(v => !isNaN(v));
  if (mics.length > 0 && (Math.max(...mics) - Math.min(...mics) > 1.2)) recs.push(...DICCIONARIO_TEXTIL.MITIGACION.MIC_IRREGULAR);
  return recs;
});

const diagnosticoFinal = computed(() => {
  if (pacasValidas.value.length === 0) return "No hay datos suficientes para un juicio técnico.";
  const p = promedios.value;
  const concl = DICCIONARIO_TEXTIL.CONCLUSIONES;
  let parrafos = [`Auditoría Técnica: ${pacasValidas.value.length} fardos validados bajo Matriz Denim.`];
  
  if (p.sci >= 112 && p.str >= 28.5) parrafos.push("El lote califica globalmente para la línea de alta calidad (Urdimbre).");
  else if (p.sci >= 102) parrafos.push("El lote es apto para Flame y Tramas, pero insuficiente para Urdimbre estándar.");
  else parrafos.push("Atención: El lote presenta debilidades estructurales (SCI/STR) que limitan su uso a títulos gruesos.");

  const flags = pacasAnalizadas.value.filter(p => p.tieneBanderaRoja).length;
  if (flags > 0) parrafos.push(`Se detectaron ${flags} fardos con Banderas Rojas que comprometen la homogeneidad.`);

  parrafos.push(p.sci >= 112 && p.str >= 28.5 ? concl.EXCELENTE : p.sci >= 102 ? concl.BUENO : p.sci >= 85 ? concl.REGULAR : concl.CRITICO);
  return parrafos.join("\n\n");
});

const fechaAnalisis = computed(() => new Date().toLocaleString("es-ES"));
</script>

<style scoped>
.analizador-hvi { font-family: "Inter", sans-serif; }
.prose p { margin-bottom: 0.5rem; }
</style>
