<template>
  <div ref="auditRef" class="verificar-contrato bg-white text-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 max-w-7xl mx-auto overflow-hidden">
    
    <!-- Loading State -->
    <div v-if="cargando" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
      <p class="text-slate-500 font-bold animate-pulse">Auditando Lote contra Estándares...</p>
    </div>

    <div v-else>
      <!-- Header del Reporte -->
      <header class="mb-8 pb-6 border-b border-slate-100 flex flex-col gap-6">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight">
                Auditoría de Cumplimiento Contractual
                <span class="text-indigo-600 block text-sm font-bold uppercase tracking-widest mt-1">Análisis de Penalización y Rechazo</span>
              </h2>
            </div>
          </div>

          <div class="flex items-center gap-4">
            
            <!-- Grado Argentino Badge (S.A.) -->
            <div v-if="argentineGrade" class="relative group cursor-help">
                <div class="px-5 py-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm flex items-center gap-3 hover:border-indigo-300 transition-colors">
                    <div class="flex flex-col items-start">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grado Sugerido (S.A.)</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xl font-black text-slate-800">{{ argentineGrade.finalGrade }}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Tooltip Desglose -->
                <div class="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0">
                    <h4 class="text-sm font-bold text-slate-800 mb-2 border-b pb-2">Desglose Técnico</h4>
                    
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">Color (Rd, +b):</span>
                            <!-- Color Grade is min(Rd, +b) -->
                            <span class="font-mono font-bold" :class="getGradeColorClass(technicalGradeColor)">
                                {{ technicalGradeColor }}
                            </span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">Basura (Tr):</span>
                            <span class="font-mono font-bold" :class="getGradeColorClass(argentineGrade.components.trash.grade)">
                                {{ argentineGrade.components.trash.grade }}
                            </span>
                        </div>
                        <div class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                            <span class="font-bold text-slate-700">Veredicto Final:</span>
                            <span class="font-black text-indigo-600">{{ argentineGrade.finalGrade }}</span>
                        </div>
                    </div>
                    
                    <div class="mt-3 bg-slate-50 p-2 rounded text-xs text-slate-600 leading-snug font-mono border border-slate-200">
                       {{ argentineGrade.diagnostic }}
                    </div>
                </div>
            </div>

            <!-- Veredicto Global Badge (Existente) -->
            <div class="px-6 py-3 rounded-xl border-2 shadow-sm uppercase font-black tracking-widest text-sm flex items-center gap-3"
                 :class="veredictoGlobalClass">

              <span class="text-2xl">{{ veredictoGlobalIcon }}</span>
              {{ veredictoGlobalTexto }}
            </div>
          </div>
        </div>

        <!-- Metadata Resumida -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs">
           <div>
             <span class="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Lote / Fardos</span>
             <span class="text-slate-800 font-black font-mono text-base">{{ metadata.loteEntrada || 'N/A' }} ({{ pacas.length }})</span>
           </div>
           <div>
             <span class="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Configuración</span>
             <span class="text-indigo-600 font-bold">{{ activeVersion || 'Estándar 2026' }}</span>
           </div>
           <div class="col-span-2">
             <span class="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Estado Preeliminar</span>
             <div class="flex gap-4 mt-1">
                <span class="text-[11px] font-bold" :class="esHomogeneo ? 'text-green-600' : 'text-red-600'">
                  {{ esHomogeneo ? '✅ Mezcla Homogénea (Apta para Producción)' : '❌ Mezcla Irregular (Riesgo Operativo)' }}
                </span>
                <span class="text-[11px] font-bold" :class="cumpleComercial ? 'text-green-600' : 'text-red-600'">
                  {{ cumpleComercial ? '✅ Cumplimiento Comercial' : '❌ Incumplimiento Contractual' }}
                </span>
             </div>
           </div>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- SECCIÓN IZQUIERDA: Comparativa Promedios (Sidebar) -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
            <div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wide">Promedio Contrato vs Real</h3>
              <span class="text-[10px] text-slate-400 font-bold">AVG CHECK</span>
            </div>
            <div class="p-4 space-y-5">
              <div v-for="(res, param) in auditResultsFiltered" :key="param" class="relative group">
                <div class="flex justify-between items-end mb-1">
                  <span class="font-black text-slate-500 text-xs uppercase">{{ param }}</span>
                  <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded"
                     :class="getPromedioStatusClass(res)">
                     {{ getPromedioStatusText(res) }}
                  </span>
                </div>
                
                <div class="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 relative overflow-hidden">
                   <!-- Indicador de Desviación Visual (Barra de fondo) -->
                   <div class="absolute bottom-0 left-0 h-1 bg-current transition-all" 
                        :style="{ width: '100%' }"
                        :class="getPromedioStatusColor(res)"></div>

                   <div class="flex flex-col items-start z-10">
                      <span class="text-[9px] text-slate-400 font-bold uppercase">Objetivo</span>
                      <span class="text-xs font-medium text-slate-600 font-mono">
                        {{ formatTarget(res.targets) }}
                      </span>
                   </div>
                   
                   <div class="text-xl text-slate-300 font-light">vs</div>

                   <div class="flex flex-col items-end z-10">
                      <span class="text-[9px] text-slate-400 font-bold uppercase">Real</span>
                      <span class="text-xl font-black font-mono" :class="getPromedioStatusColorText(res)">
                        {{ res.avg }}
                      </span>
                   </div>
                </div>
                
                <p v-if="res.status === 'RECHAZO' && !isDistributionOnlyFail(res)" class="text-[10px] text-red-500 mt-1 font-medium pl-1">
                   🚨 Desviación de promedio significativa. Aplica penalización comercial.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN CENTRAL/DERECHA: Análisis de Tolerancia y Hard Caps -->
        <div class="lg:col-span-2 space-y-6">
          
          <!-- Card de Distribución (Exclusión por Penalización) -->
          <div class="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
             <div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wide">Zona de Penalización (Distribución)</h3>
              <span class="text-[10px] text-slate-400 font-bold">TOLERANCIA {{ activeVersion }}</span>
            </div>
            
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div v-for="(res, param) in auditResultsFiltered" :key="'dist-'+param" 
                    class="p-4 rounded-xl border bg-slate-50/50 flex flex-col justify-between"
                    :class="(res.distribution && res.distribution.outliersPct > (100 - (res.targets.minIdealPct || 80))) ? 'border-red-200 bg-red-50' : 'border-slate-200'">
                  
                  <div class="flex justify-between items-start mb-2">
                     <span class="font-black text-slate-700">{{ param }}</span>
                     <span class="text-[10px] font-bold px-2 py-1 rounded bg-white border"
                           :class="(res.distribution && res.distribution.outliersPct > (100 - (res.targets.minIdealPct || 80))) ? 'text-red-600 border-red-200' : 'text-slate-500 border-slate-200'">
                        {{ res.distribution ? res.distribution.outliersPct : 0 }}% Fuera
                     </span>
                  </div>

                  <div class="relative pt-2" v-if="res.distribution">
                     <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full transition-all duration-1000" 
                             :style="{ width: Math.min((res.distribution ? res.distribution.outliersPct : 0) * 2, 100) + '%' }"
                             :class="(res.distribution && res.distribution.outliersPct > (100 - (res.targets.minIdealPct || 80))) ? 'bg-red-500' : 'bg-green-500'"></div>
                     </div>
                     <div class="flex justify-between mt-1 text-[9px] font-bold text-slate-400">
                        <span>0%</span>
                        <span>Max {{ 100 - (res.targets.minIdealPct || 80) }}%</span>
                     </div>
                  </div>
                  <div v-else class="relative pt-2">
                     <span class="text-[9px] text-slate-400 italic">Sin datos de distribución</span>
                  </div>

                  <p v-if="res.distribution && res.distribution.outliersPct > (100 - (res.targets.minIdealPct || 80))" class="text-[10px] text-red-600 font-bold mt-2">
                    ⛔ Exceso de fardos en zona de penalización. Lote Heterogéneo.
                  </p>
               </div>
            </div>
          </div>

          <!-- Tabla de Violaciones Hard Cap -->
          <div class="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
             <div class="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <h3 class="font-bold text-red-800 text-sm uppercase tracking-wide">Fardos Rechazados (Hard Cap / Tolerancia)</h3>
              <span class="text-[10px] text-red-400 font-bold">EXCLUSIÓN INDIVIDUAL</span>
            </div>
            
            <div class="overflow-x-auto max-h-60">
               <table v-if="failedBalesList.length > 0" class="w-full text-left text-xs">
                 <thead class="bg-slate-50 sticky top-0 text-slate-500 font-bold uppercase">
                   <tr>
                     <th class="px-4 py-2">Fardo</th>
                     <th class="px-4 py-2">Parámetro</th>
                     <th class="px-4 py-2 text-right">Valor</th>
                     <th class="px-4 py-2">Motivo</th>
                   </tr>
                 </thead>
                 <tbody class="divide-y divide-slate-100">
                   <tr v-for="(fb, i) in failedBalesList" :key="i" class="hover:bg-red-50/50">
                      <td class="px-4 py-2 font-mono font-bold text-slate-700">{{ fb.id }}</td>
                      <td class="px-4 py-2 font-black text-slate-800">{{ fb.param }}</td>
                      <td class="px-4 py-2 text-right font-mono text-red-600 font-bold">{{ fb.val }}</td>
                      <td class="px-4 py-2">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                              :class="fb.reason.includes('Hard') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'">
                          {{ fb.reason }}
                        </span>
                      </td>
                   </tr>
                 </tbody>
               </table>
               <div v-else class="p-8 text-center text-slate-400 font-medium italic">
                 ✨ Ningún fardo ha violado los límites absolutos ni de tolerancia.
               </div>
            </div>
          </div>
        
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";

const props = defineProps({
  pacas: {
    type: Array,
    required: true
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
});

const cargando = ref(true);
const auditData = ref(null);
const activeVersion = ref('');

// Mapeo inverso de backend results
// auditResult structure: { overallStatus, details, parameterResults: { MIC: {...}, STR: {...} } }

// Computed para filtrar resultados relevantes
const auditResultsFiltered = computed(() => {
  if (!auditData.value || !auditData.value.parameterResults) return {};
  return auditData.value.parameterResults;
});

// Lista plana de fardos fallidos para la tabla
const failedBalesList = computed(() => {
  if (!auditData.value) return [];
  const list = [];
  Object.entries(auditData.value.parameterResults).forEach(([param, res]) => {
     if (res.failedBales && res.failedBales.length > 0) {
        res.failedBales.forEach(b => {
           list.push({ ...b, param });
        });
     }
  });
  return list;
});

// Lógica de "Mezcla Homogénea" vs "Cumplimiento Comercial"
const esHomogeneo = computed(() => {
   if (!auditData.value) return true;
   // Homogeneidad depende de Distribución (Tolerance)
   // Si hay detalles sobre "Dispersión Alta" o "Outliers", es NO homogéneo
   const hasDistribIssues = auditData.value.details.some(d => d.includes('Dispersión') || d.includes('fuera de rango'));
   return !hasDistribIssues;
});

const cumpleComercial = computed(() => {
   if (!auditData.value) return true;
   // Cumplimiento comercial depende de PROMEDIOS y HARD CAPS
   // Si falla por Average o Hard Cap, es NO comercial.
   // Chequeamos status general pero excluimos si el fallo es SOLO por distribución
   // Hack: Check details
   const nonDistribFailures = auditData.value.details.filter(d => !d.includes('Dispersión') && !d.includes('fuera de rango'));
   if (auditData.value.overallStatus === 'RECHAZO' && nonDistribFailures.length > 0) return false;
   return true;
});


const veredictoGlobalTexto = computed(() => {
  if (!auditData.value) return '---';
  return auditData.value.overallStatus === 'IDEAL' ? 'APROBADO' : auditData.value.overallStatus;
});

const veredictoGlobalClass = computed(() => {
  if (!auditData.value) return '';
  const s = auditData.value.overallStatus;
  if (s === 'IDEAL') return 'bg-green-100 border-green-200 text-green-700';
  if (s === 'RECHAZO') return 'bg-red-100 border-red-200 text-red-700';
  return 'bg-amber-100 border-amber-200 text-amber-700';
});

const veredictoGlobalIcon = computed(() => {
  if (!auditData.value) return '❔';
  return auditData.value.overallStatus === 'IDEAL' ? '✅' : auditData.value.overallStatus === 'RECHAZO' ? '⛔' : '⚠️';
});

// Grado Argentino Computed
const argentineGrade = computed(() => {
    return auditData.value ? auditData.value.argentineGrade : null;
});

const technicalGradeColor = computed(() => {
    if (!argentineGrade.value) return '-';
    // Logic: Min score between Rd and +b
    const rdScore = argentineGrade.value.components.rd.score;
    const pbScore = argentineGrade.value.components.plusB.score;
    const minScore = Math.min(rdScore, pbScore);
    
    // Find label match (assuming we don't have the definitions here, we use what we have)
    // Easier way: Compare labels if scores match?
    // We only have the labels in the components.
    if (rdScore === minScore) return argentineGrade.value.components.rd.grade;
    return argentineGrade.value.components.plusB.grade;
});

function getGradeColorClass(grade) {
    if (!grade) return 'text-slate-400';
    if (grade.startsWith('C')) return 'text-green-600';
    if (grade.startsWith('D')) return 'text-amber-600';
    return 'text-red-600';
}


// Helpers UI
function getPromedioStatusClass(res) {
   if (res.status === 'IDEAL') return 'bg-green-100 text-green-700';
   if (res.status === 'RECHAZO') return 'bg-red-100 text-red-700';
   return 'bg-amber-100 text-amber-700';
}
function getPromedioStatusColor(res) {
   if (res.status === 'IDEAL') return 'bg-green-500';
   if (res.status === 'RECHAZO') return 'bg-red-500';
   return 'bg-amber-500';
}
function getPromedioStatusColorText(res) {
    if (res.status === 'IDEAL') return 'text-green-600';
    if (res.status === 'RECHAZO') return 'text-red-600';
    return 'text-amber-600';
}
function getPromedioStatusText(res) {
   return res.status;
}

function formatTarget(t) {
  if (!t) return 'N/A';
  if (t.minAvg) return `> ${t.minAvg}`;
  if (t.maxAvg) return `< ${t.maxAvg}`;
  return '---';
}

function isDistributionOnlyFail(res) {
    // Si el estado es RECHAZO pero no hay HardCap violations y el promedio está OK (teóricamente)
    // Simplificación: Check issues text
    return res.issues.every(i => i.includes('Dispersión'));
}


// API Call
const realizarAuditoria = async () => {
    if (!props.pacas || props.pacas.length === 0) return;
    cargando.value = true;
    try {
        const response = await fetch('http://localhost:3001/api/config/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bales: props.pacas.map(b => ({ ...b, LOTE: b.fardo })), // Map fardo to LOTE specific expected by backend if needed
            version_nombre: 'Estándar 2026' // O param configurable
          })
        });
        const json = await response.json();
        if (json.success) {
            auditData.value = json.data;
        }
    } catch (e) {
        console.error("Error auditando:", e);
    } finally {
        cargando.value = false;
    }
};

onMounted(() => {
    realizarAuditoria();
});

watch(() => props.pacas, () => {
    realizarAuditoria();
}, { deep: true });

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.verificar-contrato { font-family: 'Inter', sans-serif; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
</style>
