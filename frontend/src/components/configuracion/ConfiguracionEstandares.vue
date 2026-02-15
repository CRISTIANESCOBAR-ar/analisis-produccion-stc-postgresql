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
        
        <div class="p-6 flex flex-col gap-6">
          <p class="text-xs text-slate-500 leading-relaxed">
            Habilita la <b>inteligencia de mezclado</b>. El sistema validará que el lote cumpla con la homogeneidad entes de sugerir su uso.
          </p>

          <div v-for="(tol, idx) in toleranciasConfig" :key="idx" class="relative pl-4 border-l-4 border-amber-400 bg-amber-50/50 p-4 rounded-r-lg">
            <div class="flex justify-between items-start mb-2">
              <span class="font-black text-slate-700 text-sm">{{ tol.parametro }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 bg-white rounded border border-amber-200 text-amber-600">
                Regla {{ tol.porcentaje_min_ideal }}/{{ 100 - tol.porcentaje_min_ideal }}
              </span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label class="block text-slate-400 mb-1">Ideal ({{ tol.porcentaje_min_ideal }}%)</label>
                <div class="flex items-center gap-1">
                   <span class="font-bold text-slate-600">></span>
                   <input type="number"Step="0.1" v-model.number="tol.valor_ideal_min" class="w-full bg-white border border-amber-200 rounded px-2 py-1 text-slate-800 font-bold focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
              </div>
              
              <div>
                <label class="block text-slate-400 mb-1">Tolerancia ({{ 100 - tol.porcentaje_min_ideal }}%)</label>
                <div class="flex items-center gap-1">
                   <input type="number" step="0.1" v-model.number="tol.rango_tol_min" class="w-16 bg-white border border-slate-200 rounded px-1 py-1 text-center" />
                   <span class="text-slate-400">-</span>
                   <input type="number" step="0.1" v-model.number="tol.rango_tol_max" class="w-16 bg-white border border-slate-200 rounded px-1 py-1 text-center" />
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

const fetchConfig = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/config/standards');
    const data = await res.json();
    if(data.success) {
      if(data.hilos.length) hilosConfig.value = data.hilos;
      if(data.tolerancias.length) toleranciasConfig.value = data.tolerancias;
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
