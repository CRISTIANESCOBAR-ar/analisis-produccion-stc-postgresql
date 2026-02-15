<template>
  <div class="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200 max-w-6xl mx-auto my-8">
    <div class="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">
            Comparativa de Calidad HVI
            <span class="text-indigo-600 block text-sm font-bold uppercase tracking-widest mt-1">Muestra Aprobada vs. Entrega de Lote</span>
          </h2>
        </div>
      </div>
      <button 
        @click="cargarDatos" 
        :disabled="cargando"
        class="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
      >
        <span v-if="cargando" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        {{ cargando ? 'Consultando...' : 'Actualizar Comparativa' }}
      </button>
    </div>

    <!-- Alertas Globales -->
    <div v-if="alertasCriticas.length > 0" class="mb-8 space-y-3">
      <div v-for="(alerta, idx) in alertasCriticas" :key="idx" 
           class="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-4 animate-pulse">
        <span class="text-2xl">⚠️</span>
        <div>
          <p class="text-red-800 font-black text-sm uppercase">Reclamo Pendiente: Lote {{ alerta.lote }}</p>
          <p class="text-red-600 text-xs font-medium">La entrega es inferior a la muestra en {{ alerta.detalle_var }}</p>
        </div>
      </div>
    </div>

    <div class="overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-500 font-black uppercase tracking-tighter text-[10px] border-b border-slate-100">
            <th class="px-6 py-4">Lote / Muestra</th>
            <th class="px-4 py-4 text-center">SCI (Mue | Ent)</th>
            <th class="px-4 py-4 text-center">STR (Mue | Ent)</th>
            <th class="px-4 py-4 text-center">SF % (Mue | Ent)</th>
            <th class="px-4 py-4 text-center">Var. Crítica</th>
            <th class="px-6 py-4 text-center">Estado de Aceptación</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="item in comparativa" :key="item.lote" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-6 py-5">
              <div class="flex flex-col">
                <span class="text-slate-900 font-black text-sm">Lote: {{ item.lote }}</span>
                <span class="text-slate-400 font-bold text-[10px] uppercase">Ref. Muestra: {{ item.muestra }}</span>
              </div>
            </td>
            <td class="px-4 py-5 text-center">
              <div class="flex flex-col items-center">
                <span class="text-slate-700 font-bold border-b border-slate-100 pb-1 mb-1 w-full">{{ item.sci_mue }} | {{ item.sci_ent }}</span>
                <span :class="['text-[10px] font-black uppercase', getVarClass(item.var_sci)]">{{ item.var_sci }}</span>
              </div>
            </td>
            <td class="px-4 py-5 text-center">
              <div class="flex flex-col items-center">
                <span class="text-slate-700 font-bold border-b border-slate-100 pb-1 mb-1 w-full">{{ item.str_mue }} | {{ item.str_ent }}</span>
                <span :class="['text-[10px] font-black uppercase', getVarClass(item.var_str)]">{{ item.var_str }}</span>
              </div>
            </td>
            <td class="px-4 py-5 text-center">
              <div class="flex flex-col items-center">
                <span class="text-slate-700 font-bold border-b border-slate-100 pb-1 mb-1 w-full">{{ item.sf_mue }} | {{ item.sf_ent }}</span>
                <span :class="['text-[10px] font-black uppercase', getVarClass(item.var_sf, true)]">{{ item.var_sf }}</span>
              </div>
            </td>
            <td class="px-4 py-5 text-center max-w-50">
              <span v-if="item.critico" class="text-[10px] text-red-600 font-black uppercase leading-tight">
                {{ item.alerta }}
              </span>
              <span v-else class="text-[10px] text-slate-400 font-bold italic">Dentro de norma</span>
            </td>
            <td class="px-6 py-5 text-center">
              <div :class="['px-4 py-2 rounded-xl text-[10px] font-black border tracking-widest transition-all', 
                           item.critico ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200 shadow-sm']">
                {{ item.estado }}
              </div>
            </td>
          </tr>
          <tr v-if="comparativa.length === 0 && !cargando">
            <td colspan="6" class="px-6 py-20 text-center text-slate-400 font-bold italic">
               No se encontraron vinculaciones tipo 'Muestra' vs 'Entrega' registradas.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const comparativa = ref([]);
const cargando = ref(false);

const cargarDatos = async () => {
  cargando.value = true;
  try {
    const response = await fetch('/api/hvi/comparacion-muestra');
    const data = await response.json();
    if (data.success) {
      comparativa.value = data.data;
    }
  } catch (error) {
    console.error('Error cargando comparativa HVI:', error);
  } finally {
    cargando.value = false;
  }
};

const alertasCriticas = computed(() => {
  return comparativa.value
    .filter(c => c.critico)
    .map(c => {
      const vars = [];
      if (parseFloat(c.var_sci) < -5) vars.push(`SCI (${c.var_sci})`);
      if (parseFloat(c.var_str) < -5) vars.push(`STR (${c.var_str})`);
      if (parseFloat(c.var_sf) > 5) vars.push(`SF (${c.var_sf})`);
      return { 
        lote: c.lote, 
        detalle_var: vars.join(', ')
      };
    });
});

const getVarClass = (val, inverse = false) => {
  const num = parseFloat(val);
  if (inverse) {
    return num > 5 ? 'text-red-600' : num > 2 ? 'text-orange-500' : 'text-green-600';
  }
  return num < -5 ? 'text-red-600' : num < -2 ? 'text-orange-500' : 'text-green-600';
};

onMounted(() => {
  cargarDatos();
});
</script>
