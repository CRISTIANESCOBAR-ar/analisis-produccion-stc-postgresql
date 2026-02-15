<template>
  <div ref="analizadorRef" class="analizador-hvi bg-white text-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 max-w-6xl mx-auto overflow-hidden">
    <!-- Header del Reporte -->
    <header class="mb-8 pb-6 border-b border-slate-100 flex flex-col gap-6">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">
              Análisis Técnico HVI
              <span class="text-blue-600 block text-sm font-bold uppercase tracking-widest mt-1">Matriz de Aptitud Denim Real</span>
            </h2>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Botón de Exportación -->
          <button 
            @click="exportarImagen"
            :disabled="exportando"
            class="group flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <span v-if="!exportando" class="text-xl">📸</span>
            <span v-else class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            {{ exportando ? 'Generando...' : 'Exportar Informe' }}
          </button>

          <div class="text-right px-6 py-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm hidden md:block">
            <span class="text-[10px] text-slate-400 uppercase font-black tracking-widest">Muestreo del Lote</span>
            <p class="text-3xl font-black text-slate-800 font-mono">{{ pacasValidas.length }} <span class="text-sm text-slate-400 font-medium">/ {{ pacas.length }} fardos</span></p>
          </div>
        </div>
      </div>

      <!-- Metadata del Lote (Estilo Ficha) -->
      <div v-if="metadata && metadata.loteEntrada" class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 text-xs shadow-inner relative overflow-hidden">
        <div class="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.618.309a2 2 0 01-1.84.09l-1.921-.64a2 2 0 00-1.611 0l-1.921.64a2 2 0 01-1.84-.09l-.618-.309a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547V21l3.586-3.586a2 2 0 012.828 0L24 21v-5.572z" />
          </svg>
        </div>
        <div class="space-y-1">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Lote Entrada:</span>
          <p class="text-blue-700 font-mono text-sm font-black">{{ metadata.loteEntrada }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Proveedor:</span>
          <p class="text-slate-700 font-bold truncate" :title="metadata.proveedor">{{ metadata.proveedor || 'N/A' }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Grado/Tipificación:</span>
          <p class="text-slate-700 font-bold">{{ metadata.grado || 'Standard' }}</p>
        </div>
        <div class="space-y-1 text-right">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Fecha Análisis:</span>
          <p class="text-slate-700 font-bold">{{ metadata.fecha || '---' }}</p>
        </div>
        <div class="space-y-1">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Colorimetría:</span>
          <div class="flex items-center gap-2">
            <span :class="['px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border', metadata.color ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-200 text-slate-500 border-slate-300']">{{ metadata.color || 'Sin color' }}</span>
            <span v-if="metadata.cort" class="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-black uppercase tracking-widest">CORT {{ metadata.cort }}</span>
          </div>
        </div>
        <div class="space-y-1 md:col-span-3">
          <span class="text-slate-400 uppercase font-black tracking-tighter text-[9px]">Observaciones del Consultor:</span>
          <p class="text-slate-600 italic font-medium border-l-2 border-slate-200 pl-3 leading-relaxed" :title="metadata.obs">{{ metadata.obs || 'No hay observaciones técnicas registradas para este lote.' }}</p>
        </div>
      </div>
      
      <!-- Alerta de desafío técnico (Estilo Tooltip Crítico) -->
      <div v-if="promedios.sci < 85 && pacasValidas.length > 0" 
           class="mt-6 p-5 bg-red-50 border border-red-200 rounded-2xl shadow-sm relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
        <div class="flex items-start gap-4">
          <span class="text-3xl">🚫</span>
          <div>
            <h3 class="font-black text-red-700 uppercase tracking-tight">ALERTA CRÍTICA: Fibra Fuera de Estándar</h3>
            <p class="text-sm text-red-600 mt-1 font-medium leading-relaxed">
              El índice SCI promedio ({{ promedios.sci.toFixed(1) }}) es insuficiente para procesos de hilatura industriales. 
              <strong>Riesgo inminente de ineficiencia operativa y rechazo de calidad.</strong>
            </p>
          </div>
        </div>
      </div>
    </header>

    <!-- Sección: Resumen Ejecutivo (Estilo Cards Blancas) -->
    <section class="mb-10">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-2 h-6 bg-blue-600 rounded-full"></div>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Resumen Ejecutivo de Fibra</h3>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div v-for="(valor, key) in promediosDisplay" :key="key"
             class="p-5 rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
             :class="getColorClase(key, valor.value)">
          <span class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{{ valor.label }}</span>
          <p class="text-3xl font-black mt-1 leading-none tracking-tighter text-slate-800">{{ valor.display }}</p>
          <div class="mt-3 flex items-center gap-1.5">
             <div class="w-2 h-2 rounded-full" :class="getColorBullet(key, valor.value)"></div>
             <span class="text-[11px] font-bold uppercase tracking-tight" :class="getColorTexto(key, valor.value)">{{ valor.estado }}</span>
          </div>
        </div>
        <!-- Card de Estabilidad de Mezcla -->
        <div class="p-5 rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
             :class="estabilidadMezcla.stdDev > 12 ? 'border-red-200 bg-red-50/50' : 'border-slate-100 bg-slate-50/10'">
          <span class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Estabilidad (SCI)</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-xs font-black text-slate-400">Δ</span>
            <p class="text-3xl font-black leading-none tracking-tighter text-slate-800">{{ estabilidadMezcla.delta.toFixed(0) }}</p>
          </div>
          <div class="mt-3 flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full shadow-sm" :class="estabilidadMezcla.stdDev > 12 ? 'bg-red-500 shadow-red-200' : 'bg-green-500 shadow-green-200'"></div>
            <span :class="['text-[11px] font-bold uppercase tracking-tight', estabilidadMezcla.stdDev > 12 ? 'text-red-600' : 'text-green-600']">
              {{ estabilidadMezcla.estado }} (SD: {{ estabilidadMezcla.stdDev.toFixed(1) }})
            </span>
          </div>
        </div>

        <!-- Bloque de Colorimetría (Riesgos de Teñido) -->
        <div class="p-5 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1"
             :class="colorimetriaRiesgo.esOpaca || colorimetriaRiesgo.riesgoShading ? 'border-amber-200 bg-amber-50/30 font-black' : 'border-slate-100 bg-slate-50/10'">
          <span class="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Análisis de Color (Rd/+b)</span>
          
          <div class="flex items-center gap-4 mt-2">
            <div v-if="colorimetriaRiesgo.esOpaca" class="flex flex-col">
               <span class="text-[8px] text-red-600 font-black uppercase">Fibra Opaca</span>
               <span class="text-xs font-black text-slate-800 tracking-tighter">Rd {{ colorimetriaRiesgo.rd.toFixed(1) }}</span>
            </div>
            <div v-if="colorimetriaRiesgo.riesgoShading" class="flex flex-col">
               <span class="text-[8px] text-amber-700 font-black uppercase">Riesgo Shading</span>
               <span class="text-xs font-black text-slate-800 tracking-tighter">+b {{ colorimetriaRiesgo.plusB.toFixed(1) }}</span>
            </div>
            <div v-if="!colorimetriaRiesgo.esOpaca && !colorimetriaRiesgo.riesgoShading" class="flex flex-col">
               <span class="text-[8px] text-green-600 font-black uppercase">Color Estable</span>
               <span class="text-xs font-bold text-slate-600 tracking-tighter">Apto Indigo</span>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-200/50">
            <p v-if="colorimetriaRiesgo.esOpaca || colorimetriaRiesgo.riesgoShading" class="text-[8px] leading-tight text-slate-600 uppercase font-bold">
              Inestabilidad en la absorción del colorante índigo. Riesgo de barramiento.
            </p>
            <p v-else class="text-[8px] leading-tight text-slate-500 uppercase font-bold">
              Uniformidad cromática garantizada para procesos continuos.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Sección: Matriz de Aptitud (Estilo Tooltip Industrial) -->
    <section class="mb-10">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-2 h-6 bg-purple-600 rounded-full"></div>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Matriz de Aptitud y Régimen de Hilatura</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div v-for="(diagnostico, idx) in diagnosticoTitulos" :key="idx"
             class="relative p-6 rounded-2xl bg-white border-2 shadow-sm transition-all hover:shadow-xl"
             :class="diagnostico.clase">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">{{ diagnostico.titulo }}</span>
            <span class="text-2xl">{{ diagnostico.icono }}</span>
          </div>
          
          <p class="text-sm font-bold text-slate-800 leading-tight mb-2">{{ diagnostico.texto }}</p>
          
          <div v-if="diagnostico.explicacionTecnica" class="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-3 relative overflow-hidden">
             <div class="absolute top-0 left-0 w-1 h-full bg-blue-400/50"></div>
             <p class="text-[11px] text-blue-800 font-medium italic leading-snug">
               <span class="font-black not-italic text-[9px] uppercase block mb-1">Fundamento Técnico:</span>
               {{ diagnostico.explicacionTecnica }}
             </p>
          </div>

          <div v-if="diagnostico.planInfo" class="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
             <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div class="flex flex-col">
                  <span class="text-[8px] text-slate-400 font-black uppercase">Régimen</span>
                  <span class="text-xs font-bold text-slate-700">{{ diagnostico.planInfo.rpm.toLocaleString() }} RPM</span>
                </div>
                <div class="flex flex-col text-right">
                  <span class="text-[8px] text-slate-400 font-black uppercase">Alfa</span>
                  <span class="text-xs font-bold text-slate-700">{{ diagnostico.planInfo.alfa }}</span>
                </div>
             </div>
             <div :class="['text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl text-center border shadow-sm', diagnostico.impactoClase]">
                {{ diagnostico.impactoTexto }}
             </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Sección: Análisis por Fardo -->
    <section class="mb-10">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-2 h-6 bg-red-600 rounded-full"></div>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Control Individual de Pacas</h3>
        </div>
        <div class="flex items-center gap-3">
          <button 
            @click="verTodasLasPacas = !verTodasLasPacas"
            v-if="mostrarAnalisisPorFardo"
            class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 transition-all shadow-sm active:scale-95"
          >
            {{ verTodasLasPacas ? "Solo Banderas Rojas" : "Ver Todas" }}
          </button>
          <button 
            @click="mostrarAnalisisPorFardo = !mostrarAnalisisPorFardo"
            class="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <span>{{ mostrarAnalisisPorFardo ? 'Colapsar Detalle' : `Ver Detalle (${pacasFiltradas.length})` }}</span>
            <span class="text-sm leading-none">{{ mostrarAnalisisPorFardo ? '➖' : '➕' }}</span>
          </button>
        </div>
      </div>

      <div v-if="mostrarAnalisisPorFardo" class="overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-2xl transition-all duration-500">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-500 font-black uppercase tracking-tighter text-[10px]">
                <th class="px-6 py-5 w-24 border-b border-slate-100">Fardo</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">SCI</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">MIC</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">MAT</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">SF</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">STR</th>
                <th class="px-4 py-5 w-16 text-center border-b border-slate-100">RD</th>
                <th class="px-6 py-5 border-b border-slate-100">Evaluación Diagnóstica</th>
              </tr>
              <!-- Fila de Referencia -->
              <tr class="bg-blue-50/50 text-blue-600 font-black uppercase tracking-widest text-[9px] border-y border-blue-100 shadow-inner">
                <td class="px-6 py-3 italic">OBJETIVO URDIMBRE</td>
                <td class="px-4 py-3 text-center">&gt; 112</td>
                <td class="px-4 py-3 text-center">3.8-4.5</td>
                <td class="px-4 py-3 text-center">&gt; 0.85</td>
                <td class="px-4 py-3 text-center">&lt; 9.0</td>
                <td class="px-4 py-3 text-center">&gt; 28.5</td>
                <td class="px-4 py-3 text-center">&gt; 72.0</td>
                <td class="px-6 py-3 font-bold">Referencia para Lotes Premium 12/1 a 16/1</td>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="paca in pacasFiltradas" :key="paca.fardo" 
                  class="hover:bg-slate-50/80 transition-colors group">
                <td class="px-6 py-4 font-mono text-slate-900 border-r border-slate-50 relative">
                  <span v-if="paca.tieneBanderaRoja" 
                        class="absolute left-0 top-0 w-1 h-full bg-red-500 rounded-r-full shadow-[2px_0_10px_rgba(239,68,68,0.3)]"></span>
                  <div class="font-black text-sm text-slate-700">#{{ paca.fardo }}</div>
                  <div v-if="paca.tieneBanderaRoja && paca.desviaciones.length > 0" class="text-[9px] text-red-500 font-black uppercase tracking-tighter mt-0.5">Crítico</div>
                </td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.sci.claseBgLight]">{{ paca.sci }}</td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.mic.claseBgLight]">{{ paca.mic }}</td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.mat.claseBgLight]">{{ paca.mat }}</td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.sf.claseBgLight]">{{ paca.sf }}</td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.str.claseBgLight]">{{ paca.str }}</td>
                <td :class="['px-4 py-4 font-black font-mono text-center text-sm border-x border-slate-50', paca.analisis.rd.claseBgLight]">{{ paca.rd }}</td>
                <td class="px-6 py-4">
                  <div class="mb-2 font-black text-slate-800 uppercase tracking-tight text-[11px] leading-tight">
                    {{ paca.aptitudTexto }}
                  </div>
                  <div class="flex flex-wrap gap-1.5 font-bold">
                    <span v-for="(desv, idx) in paca.desviaciones" :key="idx"
                          :class="['px-2 py-1 rounded-lg text-[9px] uppercase tracking-wide border shadow-sm', 
                                  desv.critica ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100']">
                      {{ desv.texto }}
                    </span>
                    <span v-if="paca.desviaciones.length === 0" class="text-green-600 italic text-[10px] font-black uppercase tracking-widest bg-green-50 px-3 py-1 rounded-lg border border-green-100">✓ Norma Técnica OK</span>
                  </div>
                </td>
              </tr>
              <tr v-if="pacasFiltradas.length === 0">
                <td colspan="8" class="px-6 py-16 text-center text-slate-400 font-bold italic">
                  {{ verTodasLasPacas ? "No hay datos válidos para procesar." : "No se detectan desviaciones críticas en este lote." }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Sección: Mitigación (Estilo Cards Coloreadas Suaves) -->
    <section v-if="necesitaMitigacion" class="mb-10">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-2 h-6 bg-cyan-600 rounded-full"></div>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Protocolo de Mitigación Operativa</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-cyan-50/50 border-2 border-cyan-100 rounded-2xl p-8 shadow-sm">
          <div class="flex items-center gap-2 mb-4">
            <span class="p-2 bg-cyan-600 rounded-lg text-white">⚙️</span>
            <p class="text-xs font-black text-cyan-800 uppercase tracking-widest leading-none">Ajustes de Maquina <br /><span class="text-[9px] text-cyan-600">(Hilatura)</span></p>
          </div>
          <ul class="space-y-3">
            <li v-for="(rec, idx) in recomendacionesMitigacion.maquina" :key="idx"
                class="flex items-start gap-4 text-xs text-slate-700 font-bold leading-relaxed group">
              <span class="text-cyan-600 group-hover:scale-125 transition-transform">✦</span> {{ rec }}
            </li>
          </ul>
        </div>
        <div class="bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl p-8 shadow-sm">
          <div class="flex items-center gap-2 mb-4">
            <span class="p-2 bg-indigo-600 rounded-lg text-white">🏢</span>
            <p class="text-xs font-black text-indigo-800 uppercase tracking-widest leading-none">Planta y Ambiente <br /><span class="text-[9px] text-indigo-600">(Preparación)</span></p>
          </div>
          <ul class="space-y-3">
            <li v-for="(rec, idx) in recomendacionesMitigacion.planta" :key="idx"
                class="flex items-start gap-4 text-xs text-slate-700 font-bold leading-relaxed group">
              <span class="text-indigo-600 group-hover:scale-125 transition-transform">✦</span> {{ rec }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Sección: Diagnóstico Final (Estilo Industrial Elite) -->
    <section class="mb-6">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-2 h-6 bg-green-600 rounded-full"></div>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Diagnóstico Final del Consultor</h3>
      </div>
      <div class="bg-white border border-slate-100 rounded-2xl p-10 shadow-2xl shadow-slate-200 relative overflow-hidden group">
        <div class="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-50/30 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-100/40 transition-all duration-1000"></div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
          <div>
            <h4 class="text-blue-600 font-black text-[10px] uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
              <span class="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></span>
              Performance en Hilandería
            </h4>
            <p class="text-sm text-slate-600 leading-loose font-medium whitespace-pre-line tracking-tight border-l-2 border-slate-100 pl-6">{{ diagnosticoFinal.hilanderia }}</p>
          </div>
          <div>
            <h4 class="text-purple-600 font-black text-[10px] uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
              <span class="w-2 h-2 bg-purple-600 rounded-full shadow-[0_0_8px_rgba(147,51,234,0.4)]"></span>
              Aptitud en Tintorería
            </h4>
            <p class="text-sm text-slate-600 leading-loose font-medium whitespace-pre-line tracking-tight border-l-2 border-slate-100 pl-6">{{ diagnosticoFinal.calidad }}</p>
          </div>
        </div>
        
        <div class="mt-12 pt-8 border-t border-slate-50 flex flex-col items-center">
          <span class="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mb-3">Conclusión Ejecutiva</span>
          <div class="px-10 py-4 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200 transform group-hover:scale-105 transition-transform duration-500">
            <p class="text-sm font-black text-white uppercase tracking-widest text-center">{{ diagnosticoFinal.conclusion }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest">
      <div class="flex items-center gap-4">
        <span>STC-PRODUCCIÓN V2.0</span>
        <span class="text-slate-200">|</span>
        <span>Módulo HVI Consultor</span>
      </div>
      <div class="flex items-center gap-2 bg-slate-50 px-4 py-1 rounded-full border border-slate-100 shadow-inner">
        <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <span class="text-slate-500 font-bold">{{ fechaAnalisis }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { toPng } from 'html-to-image';
import Swal from 'sweetalert2';

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
const mostrarAnalisisPorFardo = ref(true);
const exportando = ref(false);
const analizadorRef = ref(null);

const exportarImagen = async () => {
  if (!analizadorRef.value) return;
  
  exportando.value = true;
  
  try {
    // Pequeña pausa para asegurar que el DOM esté listo y mostrar el feedback visual
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const dataUrl = await toPng(analizadorRef.value, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: {
        borderRadius: '0' // Quitar redondeo externo para la imagen
      }
    });

    const link = document.createElement('a');
    link.download = `HVI_Análisis_${props.metadata?.loteEntrada || 'SinLote'}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = dataUrl;
    link.click();

    Swal.fire({
      icon: 'success',
      title: 'Reporte Exportado',
      text: 'La imagen del análisis se ha descargado correctamente.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  } catch (error) {
    console.error('Error al exportar imagen:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error de Exportación',
      text: 'No se pudo generar la imagen del reporte. Intente nuevamente.'
    });
  } finally {
    exportando.value = false;
  }
};

const PLAN_HILATURA_MES = {
  "12.5":     { rpm: 90000, alfa: 5.3, vel_mts: 122.00, criticidad: "ALTA" },
  "10":       { rpm: 80000, alfa: 5.3, vel_mts: 121.24, criticidad: "MEDIA" },
  "9.5Flame": { rpm: 80000, alfa: 5.4, vel_mts: 122.09, criticidad: "ALTA" },
  "10Flame":  { rpm: 72000, alfa: 5.3, vel_mts: 109.12, criticidad: "ALTA" },
  "9":        { rpm: 80000, alfa: 5.3, vel_mts: 127.80, criticidad: "MEDIA" },
  "7":        { rpm: 80000, alfa: 5.3, vel_mts: 144.91, criticidad: "BAJA" }
};

const DICCIONARIO_TEXTIL = {
  TITULOS: {
    FINOS_URDIMBRE: { key: "12.5", limite_sci: 112, limite_str: 28.5, rango: "12.5 Urdimbre", apto: "Apto para alta velocidad.", marginal: "Marginal para Urdimbre." },
    FLAME: { key: "10Flame", limite_sci: 102, limite_str: 26, rango: "10 Flame", apto: "Apto para efecto Slub.", marginal: "Marginal para Flame." },
    GRUESOS: { key: "7", limite_sci: 85, limite_str: 22, rango: "7 Gruesos", apto: "Ideal para Trama.", marginal: "Mínimo para OE." }
  },
  MITIGACION: {
    MAQUINA: [
      "No exceder las RPM indicas en el plan si el SCI es < 100.",
      "Ajustar el Alfa de torsión a 5.3-5.4 para compensar fibras con STR < 25.",
      "Revisar tensiones de bobinado para evitar roturas prematuras."
    ],
    PLANTA: [
      "Mantener Humedad Relativa estable entre 55-65%.",
      "Limpieza exhaustiva de órganos de estiraje y rotores cada 8 horas.",
      "Ajustar presión de rodillos en cardas para mejorar la apertura de fibras cortas.",
      "Revisar filtros de aspiración."
    ]
  },
  CONCLUSIONES: {
    URDIMBRE: "Lote Premium: Destinar preferencialmente a Urdimbre 12.5.",
    STANDARD: "Lote Estándar: Apto para Flame y Tramas.",
    RIESGO: "Lote de Riesgo: Solo para Gruesos con vigilancia estrecha.",
    RECHAZO: "Crítico: Consultar con Gerencia antes de cargar al Mix."
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

const pacasValidas = computed(() => {
  return props.pacas.filter(paca => validarPaca(paca).length === 0);
});

const promedios = computed(() => {
  if (pacasValidas.value.length === 0) return { sci: 0, str: 0, sf: 0, mic: 0, ui: 0, uhml: 0, rd: 0 };
  const campos = ["sci", "str", "sf", "mic", "ui", "uhml", "rd"];
  const sumas = {};
  campos.forEach(c => sumas[c] = 0);
  pacasValidas.value.forEach(paca => {
    campos.forEach(c => { sumas[c] += parseFloat(paca[c]); });
  });
  const resultado = {};
  campos.forEach(c => resultado[c] = sumas[c] / pacasValidas.value.length);
  return resultado;
});

const promediosDisplay = computed(() => {
  const p = promedios.value;
  return {
    sci: { label: "SCI", value: p.sci, display: p.sci.toFixed(1), estado: p.sci >= 112 ? "Excelente" : p.sci >= 102 ? "Apto Flame" : p.sci >= 85 ? "Apto Gruesos" : "Riesgo" },
    str: { label: "STR", value: p.str, display: p.str.toFixed(1), estado: p.str >= 28.5 ? "Urdimbre" : p.str >= 26 ? "Flame" : p.str >= 22 ? "Gruesos" : "Crítico" },
    mic: { label: "MIC", value: p.mic, display: p.mic.toFixed(2), estado: p.mic >= 3.8 && p.mic <= 4.2 ? "Ideal" : p.mic >= 3.5 && p.mic <= 4.9 ? "Aceptable" : "Riesgo" },
    sf: { label: "SF (%)", value: p.sf, display: p.sf.toFixed(1), estado: p.sf <= 9 ? "Ideal" : p.sf <= 11 ? "Aceptable" : "Alto" },
    rd: { label: "Rd", value: p.rd, display: p.rd.toFixed(1), estado: p.rd >= 74 ? "Premium" : p.rd >= 70 ? "Normal" : "Opaca" }
  };
});

const colorimetriaRiesgo = computed(() => {
  const p = promedios.value;
  // Calculamos promedio de +b si no está en promedios básicos
  let plusB = 0;
  if (pacasValidas.value.length > 0) {
    plusB = pacasValidas.value.reduce((acc, curr) => acc + (parseFloat(curr.plusB) || 0), 0) / pacasValidas.value.length;
  }
  
  return {
    rd: p.rd,
    plusB: plusB,
    esOpaca: p.rd < 70,
    riesgoShading: plusB > 11
  };
});

const estabilidadMezcla = computed(() => {
  if (pacasValidas.value.length < 2) return { delta: 0, stdDev: 0, estado: 'Insuficiente', alerta: '' };
  
  const scis = pacasValidas.value.map(p => parseFloat(p.sci));
  const max = Math.max(...scis);
  const min = Math.min(...scis);
  const delta = max - min;
  
  const media = scis.reduce((a, b) => a + b, 0) / scis.length;
  const varianza = scis.reduce((a, b) => a + Math.pow(b - media, 2), 0) / scis.length;
  const stdDev = Math.sqrt(varianza);
  
  const estado = stdDev > 12 ? 'Inestable' : 'Estable';
  let alerta = '';
  
  if (delta > 50) {
    alerta = 'ALERTA CRÍTICA DE MEZCLA: La brecha de calidad entre fardos es extrema. Obligatorio mezclar con un lote de alta uniformidad para evitar franjas de distinto tono o textura en el Denim (barrados).';
  } else if (delta >= 30) {
    alerta = 'Dispersión Moderada: Se recomienda alimentación alternada en la línea de apertura (fardos buenos vs fardos malos).';
  }
  
  return { delta, stdDev, estado, alerta };
});

const pacasAnalizadas = computed(() => {
  return pacasValidas.value.map(paca => {
    const sci = parseFloat(paca.sci);
    const mic = parseFloat(paca.mic);
    const mat = parseFloat(paca.mat);
    const sf = parseFloat(paca.sf);
    const str = parseFloat(paca.str);
    const rd = parseFloat(paca.rd);
    const plusB = parseFloat(paca.plusB) || 0;

    const desviaciones = [];
    let redFlag = false;

    // 1. Diagnóstico de Hilatura (Máquinas) - Basado en Límites de URDIEMBRE
    const LIMITES_URDIMBRE = { sci: 112, str: 28.5, sf: 9.0, mic_min: 3.8, mic_max: 4.5, rd: 72.0 };

    if (sci < LIMITES_URDIMBRE.sci) {
      desviaciones.push({ texto: `SCI Insuficiente (${sci.toFixed(0)}) < ${LIMITES_URDIMBRE.sci}`, critica: true });
      redFlag = true;
    }

    if (str < LIMITES_URDIMBRE.str) {
      desviaciones.push({ texto: `STR Débil (${str.toFixed(1)}) < ${LIMITES_URDIMBRE.str}`, critica: true });
      redFlag = true;
    }

    if (sf > LIMITES_URDIMBRE.sf) {
      desviaciones.push({ texto: `Fibra Corta ALTA (${sf.toFixed(1)}) > ${LIMITES_URDIMBRE.sf}`, critica: true });
      redFlag = true;
    }

    if (mic < LIMITES_URDIMBRE.mic_min || mic > LIMITES_URDIMBRE.mic_max) {
      desviaciones.push({ texto: `MIC Fuera de Rango (${mic.toFixed(2)})`, critica: true });
      redFlag = true;
    }

    if (rd < LIMITES_URDIMBRE.rd) {
      desviaciones.push({ texto: `Rd Baja (Opacidad) (${rd.toFixed(1)}) < ${LIMITES_URDIMBRE.rd}`, critica: false });
      redFlag = true;
    }

    if (plusB > 11) {
       desviaciones.push({ texto: `Riesgo Shading (+b ${plusB.toFixed(1)})`, critica: false });
       redFlag = true;
    }

    let machineAptitude = "";
    if (!redFlag) {
      machineAptitude = "Apto para Urdimbre (12.5 Ne).";
    } else if (sci >= 102 && str >= 26) {
      const plan = PLAN_HILATURA_MES["10Flame"];
      machineAptitude = `Apto para Flame. Vel. moderada (${(plan.rpm/1000).toFixed(0)}k RPM).`;
    } else {
      machineAptitude = "Apto solo para Gruesos (5/1-10/1).";
    }

    return {
      fardo: paca.fardo,
      sci: sci.toFixed(1),
      mic: mic.toFixed(2),
      mat: mat.toFixed(2),
      sf: sf.toFixed(1),
      str: str.toFixed(1),
      rd: rd.toFixed(1),
      tieneBanderaRoja: redFlag,
      aptitudTexto: machineAptitude,
      desviaciones,
      analisis: {
        sci: { claseBgLight: sci < 100 ? "bg-red-50 text-red-600" : sci < 112 ? "bg-yellow-50 text-yellow-600" : "text-green-600" },
        mic: { claseBgLight: (mic < 3.8 || mic > 4.5) ? "bg-orange-50 text-orange-600" : "text-slate-600 font-bold" },
        mat: { claseBgLight: mat < 0.85 ? "bg-yellow-50 text-yellow-600" : "text-slate-600 font-bold" },
        sf: { claseBgLight: sf > 9.0 ? "bg-yellow-50 text-yellow-600 font-black" : "text-slate-600 font-bold" },
        str: { claseBgLight: str < 28.5 ? "bg-red-50 text-red-600" : "text-slate-600 font-bold" },
        rd: { claseBgLight: rd < 72 ? "bg-red-50 text-red-600 font-black shadow-inner" : "text-slate-600 font-bold" }
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
    sci: v => v >= 112 ? "border-green-200 bg-green-50/20" : v >= 102 ? "border-slate-100" : v >= 85 ? "border-yellow-200 bg-yellow-50/20" : "border-red-200 bg-red-50/20",
    str: v => v >= 28.5 ? "border-green-200 bg-green-50/20" : v >= 26 ? "border-slate-100" : v >= 22 ? "border-yellow-200 bg-yellow-50/20" : "border-red-200 bg-red-50/20",
    mic: v => v >= 3.8 && v <= 4.2 ? "border-green-200 bg-green-50/20" : (v < 3.4 || v > 5.0) ? "border-orange-200 bg-orange-50/20" : "border-slate-100",
    sf: v => v <= 9 ? "border-green-200 bg-green-50/20" : v <= 11 ? "border-slate-100" : "border-yellow-200 bg-yellow-50/20"
  };
  return reglas[key] ? reglas[key](valor) : "border-slate-100";
}

function getColorBullet(key, valor) {
  const reglas = {
    sci: v => v >= 112 ? "bg-green-500 shadow-green-200" : v >= 102 ? "bg-slate-400" : v >= 85 ? "bg-yellow-500" : "bg-red-500",
    str: v => v >= 28.5 ? "bg-green-500 shadow-green-200" : v >= 26 ? "bg-slate-400" : v >= 22 ? "bg-yellow-500" : "bg-red-500",
    mic: v => v >= 3.8 && v <= 4.2 ? "bg-green-500 shadow-green-200" : (v < 3.4 || v > 5.0) ? "bg-orange-500" : "bg-slate-400",
    sf: v => v <= 9 ? "bg-green-500 shadow-green-200" : v <= 11 ? "bg-slate-400" : "bg-yellow-500"
  };
  return reglas[key] ? reglas[key](valor) : "bg-slate-400";
}

function getColorTexto(key, valor) {
  const reglas = {
    sci: v => v >= 112 ? "text-green-600" : v >= 102 ? "text-slate-500" : v >= 85 ? "text-yellow-600" : "text-red-600",
    str: v => v >= 28.5 ? "text-green-600" : v >= 26 ? "text-slate-500" : v >= 22 ? "text-yellow-600" : "text-red-600",
    mic: v => v >= 3.8 && v <= 4.2 ? "text-green-600" : (v < 3.4 || v > 5.0) ? "text-orange-600" : "text-slate-500",
    sf: v => v <= 9 ? "text-green-600" : v <= 11 ? "text-slate-500" : "text-yellow-600"
  };
  return reglas[key] ? reglas[key](valor) : "text-slate-500";
}

const diagnosticoTitulos = computed(() => {
  const p = promedios.value;
  const tit = DICCIONARIO_TEXTIL.TITULOS;
  const resultado = [];
  
  Object.keys(tit).forEach(k => {
    const t = tit[k];
    const plan = PLAN_HILATURA_MES[t.key];
    let clase = "border-red-200 shadow-red-50/50 hover:border-red-300";
    let icono = "❌";
    let impactoTexto = "Riesgo de Paro Crítico";
    let impactoClase = "bg-red-50 text-red-700 border-red-200";

    let explicacionTecnica = "";

    if (p.sci >= t.limite_sci && p.str >= (t.limite_str || 0)) {
        clase = "border-green-200 shadow-green-50/50 hover:border-green-300";
        icono = "✅";
        impactoTexto = "Eficiencia Proyectada > 94%";
        impactoClase = "bg-green-50 text-green-700 border-green-200";
    } else if (p.sci >= t.limite_sci - 5) {
        clase = "border-yellow-200 shadow-yellow-50/50 hover:border-yellow-300";
        icono = "⚠️";
        impactoTexto = "Vigilancia en Salida de Rotor";
        impactoClase = "bg-yellow-50 text-yellow-700 border-yellow-200";
    }

    // Análisis de Aptitud por Título (El 'Por qué')
    if (t.key === "7" || t.key === "10Flame" || t.key === "9") {
       explicacionTecnica = "Apto por Cohesión de Masa: En estos títulos gruesos, el alto número de fibras en el núcleo del hilo compensa la baja resistencia individual (STR) detectada.";
    } else if (t.key === "12.5") {
       if (p.sf > 13) {
         explicacionTecnica = "Peligro de Puntos Delgados: Con un SF > 13%, el hilo de urdimbre presentará irregularidades de masa que causarán cortes por tensión en el telar.";
       } else {
         explicacionTecnica = "Estabilidad en Urdimbre: La longitud y resistencia de la fibra aseguran un proceso fluido en el engomado y tejido.";
       }
    }

    resultado.push({ 
        titulo: `${t.rango}`, 
        texto: p.sci >= t.limite_sci ? t.apto : t.marginal, 
        clase, 
        icono,
        planInfo: plan,
        impactoTexto,
        impactoClase,
        explicacionTecnica
    });
  });

  return resultado;
});

const necesitaMitigacion = computed(() => (promedios.value.str < 24 || promedios.value.sf > 11 || promedios.value.mic < 3.5));
const recomendacionesMitigacion = computed(() => ({
  maquina: DICCIONARIO_TEXTIL.MITIGACION.MAQUINA,
  planta: DICCIONARIO_TEXTIL.MITIGACION.PLANTA
}));

const diagnosticoFinal = computed(() => {
  if (pacasValidas.value.length === 0) return { hilanderia: "Sin datos.", calidad: "Sin datos.", conclusion: "DESCONOCIDA" };
  const p = promedios.value;
  const concl = DICCIONARIO_TEXTIL.CONCLUSIONES;
  
  const stabilityAlerta = estabilidadMezcla.value.alerta ? `\n\nALERTA DE MEZCLA:\n${estabilidadMezcla.value.alerta}` : "";

  const hilanderia = (p.sci < 100 
    ? "SCI promedio insuficiente para régimen de 90k RPM. Se prevé saturación de rotores y baja eficiencia operativa. Recomendación: Reducción de carga mecánica a 72k RPM."
    : "Fibra con SCI y STR equilibrados para el plan mensual. Capacidad de respuesta óptima ante regímenes de 80k-90k RPM sin comprometer la continuidad operativa.") + stabilityAlerta;
    
  const calidad = p.mic < 3.4 || p.rd < 65
    ? `RIESGO DE CALIDAD EN DENIM: Micronaire bajo (${p.mic.toFixed(2)}) indica inmadurez celular avanzada; alto riesgo de 'puntos blancos' y neps durante la absorción del colorante índigo. El RD de ${p.rd.toFixed(1)} confirma degradación por factores climáticos que afectará la solidez.`
    : "Parámetros de madurez y reflectancia óptimos. Capacidad de absorción de índigo superior, garantizando tonalidades profundas y tacto premium en el acabado final del tejido.";

  const conclusion = p.sci >= 112 && p.mic >= 3.8 ? concl.URDIMBRE : p.sci >= 102 ? concl.STANDARD : concl.RIESGO;

  return { hilanderia, calidad, conclusion };
});

const fechaAnalisis = computed(() => new Date().toLocaleString("es-ES", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.analizador-hvi { font-family: 'Inter', sans-serif; }
/* Scrollbar suave */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
