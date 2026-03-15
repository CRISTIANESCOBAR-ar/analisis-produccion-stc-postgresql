<template>
  <div class="flex flex-col h-screen bg-slate-50 overflow-hidden">

    <!-- ══════════════════════ HEADER ══════════════════════ -->
    <div class="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-base">🏭</span>
            Dashboard Mezcla → Hilo
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">Comparativa de calidad entre lotes — Semáforo de aptitud para Tejeduría</p>
        </div>
        <div v-if="rows.length > 0" class="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
          {{ lotesList.length }} lotes · {{ allNes.length }} título{{allNes.length !== 1 ? 's' : ''}}
        </div>
      </div>

      <!-- Inputs -->
      <div class="flex gap-3 items-end flex-wrap">
        <div class="flex-1 min-w-48">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">
            Lotes a comparar <span class="text-slate-400 normal-case font-normal">(separados por coma)</span>
          </label>
          <input v-model="lotesInput" type="text" placeholder="ej: 107, 108, 109"
            class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
            @keyup.enter="analizar" />
        </div>
        <div class="w-36">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Ne (opc.)</label>
          <input v-model="neFilter" type="text" placeholder="ej: 10/1"
            class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all" />
        </div>
        <button @click="analizar" :disabled="loading || !lotesInput.trim()"
          class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          :class="loading ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'">
          <span v-if="loading" class="animate-spin inline-block">⟳</span>
          <span v-else>📊</span>
          {{ loading ? 'Consultando...' : 'Comparar' }}
        </button>
      </div>
    </div>

    <!-- ══════════════════════ BODY ══════════════════════ -->
    <div class="flex-1 overflow-auto p-6 space-y-5">

      <!-- Estado inicial -->
      <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 py-16">
        <div class="text-6xl mb-4">🏭</div>
        <p class="text-lg font-semibold text-slate-500">Ingresá los lotes a comparar</p>
        <p class="text-sm mt-1">Ejemplo: <code class="bg-slate-100 px-2 py-0.5 rounded text-slate-600">107, 108, 109</code></p>
        <div class="mt-6 grid grid-cols-3 gap-4 text-center text-xs text-slate-400">
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">🌿</div><div class="font-medium text-slate-500">HVI Fibra</div>
            <div class="mt-1">STR · SCI · MIC · UHML</div>
          </div>
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">🧵</div><div class="font-medium text-slate-500">Uster Hilo</div>
            <div class="mt-1">CVm% · Neps · Vellosidad</div>
          </div>
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">⚡</div><div class="font-medium text-slate-500">Tensorapid</div>
            <div class="mt-1">Tenacidad · Elongación</div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-24 text-slate-400">
        <div class="text-center">
          <div class="text-5xl mb-4 animate-pulse">📊</div>
          <p class="font-medium text-slate-500">Consultando HVI + Uster + Tensorapid...</p>
        </div>
      </div>

      <!-- ── SEMÁFORO CARDS ── -->
      <div v-if="hasData">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wide">🚦 Semáforo de Aptitud</h2>
          <span class="text-xs text-slate-400">Evaluación por proceso</span>
        </div>
        <div class="grid gap-4" :class="lotesList.length <= 2 ? 'grid-cols-' + lotesList.length : lotesList.length === 3 ? 'grid-cols-3' : 'grid-cols-4'">
          <div v-for="mistura in lotesList" :key="`card-${mistura}`"
            class="bg-white rounded-2xl border-2 p-5 transition-all"
            :class="semaforo(mistura).borderClass">

            <!-- Card header -->
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-widest" :class="semaforo(mistura).textClass">
                    Lote FIAC {{ mistura }}
                  </span>
                  <span v-if="Number(mistura) === Number(loteActual)"
                    class="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">
                    ACTUAL
                  </span>
                </div>
                <div v-if="getMisturaReal(mistura)" class="text-[9px] text-slate-400 mt-0.5">
                  Mistura {{ getMisturaReal(mistura) }}
                </div>
                <div class="text-sm font-bold mt-0.5" :class="semaforo(mistura).textClass">
                  {{ semaforo(mistura).label }}
                </div>
              </div>
              <div class="text-3xl leading-none">{{ semaforo(mistura).icon }}</div>
            </div>

            <!-- Key metrics grid -->
            <div class="grid grid-cols-2 gap-1.5 text-xs mb-3">
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">STR Fibra</div>
                <div class="font-bold" :class="thresholdClass(getHVI(mistura, 'str'), 27, 25, false)">
                  {{ fmt(getHVI(mistura, 'str')) }} <span class="font-normal text-slate-400">g/tex</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Tenacidad</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'tenacidad'), 16, 14.5, false)">
                  {{ fmt(getHiloFirst(mistura, 'tenacidad')) }} <span class="font-normal text-slate-400">cN/tx</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Neps +200%</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'neps_200'), 500, 700, true)">
                  {{ fmt(getHiloFirst(mistura, 'neps_200')) }} <span class="font-normal text-slate-400">/km</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">CVm%</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'cvm'), 12, 13, true)">
                  {{ fmt(getHiloFirst(mistura, 'cvm')) }}<span class="font-normal text-slate-400">%</span>
                </div>
              </div>
            </div>

            <!-- Issues -->
            <div v-if="semaforo(mistura).issues.length" class="space-y-1">
              <div v-for="issue in semaforo(mistura).issues" :key="issue"
                class="text-[10px] px-2 py-1 rounded flex items-start gap-1"
                :class="semaforo(mistura).level === 'rojo' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'">
                {{ issue }}
              </div>
            </div>
            <div v-else class="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1">
              ✓ Sin alertas críticas
            </div>

            <!-- Metadata -->
            <div class="mt-3 pt-3 border-t border-slate-100 text-[9px] text-slate-400 flex flex-wrap gap-3">
              <span>🧺 {{ getHVI(mistura, 'n_fardos') ?? '–' }} fardos consumidos</span>
              <span>🔄 {{ getHVI(mistura, 'n_secuencias') ?? '–' }} secuencias blendomat</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── CONTEXTO OPERATIVO CARDAS ── -->
      <div v-if="hasData && cardasContext" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span>🧺</span> Contexto Operativo Cardas
            </h2>
            <p class="text-[10px] text-slate-400 mt-0.5">Resumen del último día importado de producción de cardas</p>
          </div>
          <span v-if="cardasContext.disponible" class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
            {{ cardasContext.resumen?.data_ref || 'S/D' }}
          </span>
          <span v-else class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
            Sin datos vinculables
          </span>
        </div>

        <div v-if="cardasContext.disponible" class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div class="bg-slate-50 rounded-lg p-3">
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">Máquinas</div>
              <div class="font-bold text-slate-700 text-base">{{ cardasContext.resumen?.maquinas ?? '–' }}</div>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">Filas activas</div>
              <div class="font-bold text-slate-700 text-base">{{ cardasContext.resumen?.filas_activas ?? '–' }} / {{ cardasContext.resumen?.filas ?? '–' }}</div>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">Efic. Calc Prom</div>
              <div class="font-bold text-slate-700 text-base">{{ fmt(cardasContext.resumen?.efic_calc_avg, 2) }}%</div>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">Prod. Informada</div>
              <div class="font-bold text-slate-700 text-base">{{ fmt(cardasContext.resumen?.prod_inform_total, 0) }} kg</div>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <div class="text-[10px] text-slate-400 uppercase tracking-wider">Cobertura dato</div>
              <div class="font-bold text-slate-700 text-base">{{ fmt(cardasContext.resumen?.cobertura_prod_pct, 1) }}%</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="border border-slate-100 rounded-xl overflow-hidden">
              <div class="px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">Turnos</div>
              <table class="w-full text-[11px]">
                <thead class="text-slate-400 border-b border-slate-100">
                  <tr>
                    <th class="text-left px-3 py-2">Turno</th>
                    <th class="text-right px-3 py-2">Efic Calc%</th>
                    <th class="text-right px-3 py-2">Prod Inform</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in (cardasContext.turnos || [])" :key="`carda-turno-${t.turno}`" class="border-t border-slate-50">
                    <td class="px-3 py-2 font-bold text-slate-600">{{ t.turno }}</td>
                    <td class="px-3 py-2 text-right font-mono" :class="Number(t.efic_calc_avg) < 85 ? 'text-red-600' : 'text-slate-700'">
                      {{ fmt(t.efic_calc_avg, 2) }}
                    </td>
                    <td class="px-3 py-2 text-right font-mono text-slate-600">{{ fmt(t.prod_inform_total, 0) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="border border-slate-100 rounded-xl overflow-hidden">
              <div class="px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">Máquinas más inestables</div>
              <table class="w-full text-[11px]">
                <thead class="text-slate-400 border-b border-slate-100">
                  <tr>
                    <th class="text-left px-3 py-2">Máquina</th>
                    <th class="text-right px-3 py-2">Efic Calc%</th>
                    <th class="text-right px-3 py-2">Prod Inform</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in (cardasContext.maquinasCriticas || [])" :key="`carda-maq-${m.maquina}`" class="border-t border-slate-50">
                    <td class="px-3 py-2 font-bold text-slate-600">{{ m.maquina }}</td>
                    <td class="px-3 py-2 text-right font-mono" :class="Number(m.efic_calc_avg) < 85 ? 'text-red-600' : 'text-slate-700'">
                      {{ fmt(m.efic_calc_avg, 2) }}
                    </td>
                    <td class="px-3 py-2 text-right font-mono text-slate-600">{{ fmt(m.prod_inform_total, 0) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="cardasContext.calidadDato" class="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Calidad de dato: {{ cardasContext.calidadDato.prod_inform_cero || 0 }} filas con producción 0 ·
            {{ cardasContext.calidadDato.efic_calc_cero || 0 }} filas con eficiencia 0 ·
            {{ cardasContext.calidadDato.rpm_cero || 0 }} filas con RPM 0.
          </div>
        </div>

        <div v-else class="p-6 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
          ⚠️ {{ cardasContext.motivo || 'No se pudo construir contexto de cardas con los datos importados.' }}
        </div>
      </div>

      <!-- ── TABLA COMPARATIVA ── -->
      <div v-if="hasData" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
            <span>📋</span> Tabla Comparativa
          </h2>
          <div class="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-widest">
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-200 border border-emerald-400 inline-block"></span>Óptimo
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-400 inline-block"></span>Precaución
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-red-200 border border-red-400 inline-block"></span>Crítico
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-600 border-b border-slate-100">
                <th class="text-left px-5 py-3 font-bold w-52 text-slate-500">Variable</th>
                <th v-for="mistura in lotesList" :key="`th-${mistura}`"
                  class="text-center px-4 py-3 font-bold min-w-28"
                  :class="Number(mistura) === Number(loteActual) ? 'bg-blue-50 text-blue-700' : 'text-slate-600'">
                  Lote {{ mistura }}
                  <span v-if="Number(mistura) === Number(loteActual)"
                    class="ml-1 text-[8px] bg-blue-200 text-blue-800 rounded px-1">actual</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- ── HVI Section ── -->
              <tr class="bg-blue-50/50">
                <td colspan="100" class="px-5 py-2 font-bold text-blue-600 text-[10px] uppercase tracking-widest">
                  🌿 Fibra — HVI
                </td>
              </tr>
              <tr v-for="fila in HVI_ROWS" :key="`hvi-row-${fila.key}`"
                class="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                <td class="px-5 py-2.5 text-slate-600 font-medium">
                  {{ fila.label }}
                  <div v-if="fila.unit" class="text-[9px] text-slate-400">{{ fila.unit }}</div>
                </td>
                <td v-for="(mistura, idx) in lotesList" :key="`hvi-${mistura}-${fila.key}`"
                  class="px-4 py-2.5 text-center font-mono"
                  :class="[
                    Number(mistura) === Number(loteActual) ? 'bg-blue-50/40' : '',
                    fila.thresholds ? cellBg(getHVI(mistura, fila.key), fila.thresholds[0], fila.thresholds[1], fila.inverse) : ''
                  ]">
                  <span class="font-bold text-slate-700">
                    {{ fmt(getHVI(mistura, fila.key), fila.dec) }}
                  </span>
                  <span v-if="idx > 0 && getHVI(lotesList[0], fila.key) != null && getHVI(mistura, fila.key) != null"
                    class="ml-1 text-[9px]" :class="trendClass(getHVI(lotesList[0], fila.key), getHVI(mistura, fila.key), fila.inverse)">
                    {{ trendArrow(getHVI(lotesList[0], fila.key), getHVI(mistura, fila.key)) }}
                  </span>
                </td>
              </tr>

              <!-- ── Hilo section per Ne ── -->
              <template v-for="neItem in allNes" :key="`ne-${neItem.key}`">
                <tr class="bg-purple-50/50">
                  <td colspan="100" class="px-5 py-2 font-bold text-purple-600 text-[10px] uppercase tracking-widest">
                    🧵 Hilo — Ne {{ neItem.label }}{{ neItem.isFlame ? '' : ' / 1' }} (Uster + Tensorapid)
                  </td>
                </tr>
                <tr v-for="fila in HILO_ROWS" :key="`hilo-${neItem.key}-${fila.key}`"
                  class="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td class="px-5 py-2.5 text-slate-600 font-medium">
                    {{ fila.label }}
                    <div v-if="fila.unit" class="text-[9px] text-slate-400">{{ fila.unit }}</div>
                  </td>
                  <td v-for="(mistura, idx) in lotesList" :key="`hilo-${mistura}-${neItem.key}-${fila.key}`"
                    class="px-4 py-2.5 text-center font-mono"
                    :class="[
                      Number(mistura) === Number(loteActual) ? 'bg-blue-50/40' : '',
                      getHilo(mistura, neItem.key, fila.key) != null && fila.thresholds
                        ? cellBg(getHilo(mistura, neItem.key, fila.key), fila.thresholds[0], fila.thresholds[1], fila.inverse) : ''
                    ]">
                    <template v-if="getHilo(mistura, neItem.key, fila.key) != null">
                      <span class="font-bold text-slate-700">
                        {{ fmt(getHilo(mistura, neItem.key, fila.key), fila.dec) }}
                      </span>
                      <span v-if="idx > 0 && getHilo(lotesList[0], neItem.key, fila.key) != null"
                        class="ml-1 text-[9px]"
                        :class="trendClass(getHilo(lotesList[0], neItem.key, fila.key), getHilo(mistura, neItem.key, fila.key), fila.inverse)">
                        {{ trendArrow(getHilo(lotesList[0], neItem.key, fila.key), getHilo(mistura, neItem.key, fila.key)) }}
                      </span>
                    </template>
                    <span v-else class="text-slate-200">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── NARRATIVA IA ── -->
      <div v-if="hasData" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span>✨</span> Informe con IA
            </h2>
            <p class="text-[10px] text-slate-400 mt-0.5">Análisis predictivo en lenguaje natural • Gemini 2.5 Flash con fallback local</p>
            <p v-if="modoLocalAutomatico" class="text-[10px] text-amber-600 mt-1 font-semibold">
              {{ geminiCuotaDiariaAgotada ? 'Modo local activo: límite diario de Gemini alcanzado (20/día).' : 'Modo local activo por indisponibilidad de Gemini.' }}
            </p>
          </div>
          <div class="flex items-end gap-2">
            <div class="flex flex-col">
              <label class="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">Día</label>
              <CustomDatepicker
                v-model="fechaCorte"
                :showButtons="false"
                placeholder="Selecciona una fecha"
              />
            </div>
            <span v-if="narrativaFuente" class="text-[10px] px-2 py-0.5 rounded-full font-bold"
              :class="narrativaFuente === 'gemini' ? 'bg-purple-100 text-purple-700' : narrativaFuente === 'cache' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'">
              {{ narrativaFuente === 'gemini' ? '✨ Gemini' : narrativaFuente === 'cache' ? '💾 Caché' : '⚡ Local' }}
            </span>
            <button @click="generarNarrativa(true)" :disabled="loadingNarrativa || !hasData"
              class="px-3 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600">
              ⚡ Local
            </button>
            <button v-if="modoLocalAutomatico" @click="probarGemini" :disabled="loadingNarrativa"
              class="px-3 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700">
              ✨ Probar Gemini
            </button>
            <button @click="generarNarrativa(false, narrativa ? true : false)" :disabled="loadingNarrativa"
              class="px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
              :class="loadingNarrativa ? 'bg-slate-200 text-slate-500' : modoLocalAutomatico ? 'bg-slate-500 hover:bg-slate-600 text-white' : narrativa ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'">
              <span v-if="loadingNarrativa" class="animate-spin inline-block">⟳</span>
              <span v-else>{{ modoLocalAutomatico ? '⚡' : (narrativa ? '↺' : '✨') }}</span>
              {{ loadingNarrativa ? 'Analizando...' : modoLocalAutomatico ? (narrativa ? 'Regenerar Local' : 'Generar Local') : (narrativa ? 'Regenerar' : 'Generar Informe') }}
            </button>
          </div>
        </div>

        <div class="p-6">
          <div v-if="!narrativa && !loadingNarrativa" class="text-center py-6 text-slate-400">
            <div class="text-3xl mb-2">✨</div>
            <p class="text-sm">Generá un resumen en lenguaje natural con análisis predictivo para producción</p>
            <p class="text-xs mt-1 text-slate-300">✨ Gemini — si hay cuota disponible • ⚡ Local — siempre disponible, instantáneo</p>
          </div>
          <div v-if="loadingNarrativa" class="flex items-center gap-3 text-slate-500 py-4">
            <span class="animate-spin text-xl inline-block">⟳</span>
            <span class="text-sm">Analizando datos...</span>
          </div>
          <div v-if="narrativaAviso && narrativa" class="text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3 flex items-center gap-2">
            <span>⚠️</span> {{ narrativaAviso }}
          </div>
          <div v-if="narrativa && !loadingNarrativa" class="relative group">
            <button @click="copiarNarrativa"
              class="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
              :class="narrativaCopiada ? 'bg-green-100 text-green-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'">
              <span>{{ narrativaCopiada ? '✓' : '📋' }}</span>
              {{ narrativaCopiada ? '¡Copiado!' : 'Copiar' }}
            </button>
            <div
              class="bg-slate-50 rounded-xl border border-slate-100 p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
              {{ narrativa }}
            </div>
          </div>
          <div v-if="narrativaError" class="text-red-600 text-sm bg-red-50 rounded-xl p-4 mt-3">
            ⚠️ {{ narrativaError }}
          </div>
        </div>
      </div>

      <!-- ══════════════════════ AUDITORÍA DE APTITUD POR PROCESO ══════════════════════ -->
      <div v-if="tablaAptitud.length > 0" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                <span>🔍</span> Auditoría de Aptitud por Proceso
              </h2>
              <p class="text-[10px] text-slate-400 mt-0.5">
                Lote FIAC {{ loteActual }} · Validación contra Matriz de Requisitos Mínimos · Urdidora → Índigo → Telar aire
              </p>
            </div>
            <div class="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-widest">
              <span class="flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-200 border border-emerald-400 inline-block"></span>Cumple
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-400 inline-block"></span>Precaución
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full bg-red-200 border border-red-400 inline-block"></span>No apto
              </span>
            </div>
          </div>
        </div>

        <!-- Tabla principal: Variables clave + Aptitud por proceso -->
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th class="text-left px-4 py-2.5 font-bold" rowspan="2">Ne</th>
                <th class="text-center px-3 py-2.5 font-bold" rowspan="2">Aplic.</th>
                <th class="text-center px-2 py-1.5 font-bold border-l border-slate-200" colspan="5">Variables de Hilo</th>
                <th class="text-center px-2 py-1.5 font-bold border-l border-r border-slate-200" colspan="3">Aptitud por Proceso</th>
                <th class="text-center px-3 py-2.5 font-bold" rowspan="2">Pasador</th>
                <th class="text-left px-3 py-2.5 font-bold" rowspan="2">Desvío Crítico</th>
              </tr>
              <tr class="bg-slate-50 text-[9px] text-slate-400 border-b border-slate-100">
                <th class="py-1.5 px-2 font-medium border-l border-slate-200">CVm%</th>
                <th class="py-1.5 px-2 font-medium">Neps +200%</th>
                <th class="py-1.5 px-2 font-medium">Tenac. cN/tex</th>
                <th class="py-1.5 px-2 font-medium">Elong. %</th>
                <th class="py-1.5 px-2 font-medium">H Vell.</th>
                <th class="py-1.5 px-2 font-medium border-l border-slate-200 bg-amber-50/40">🏭 Urdidora</th>
                <th class="py-1.5 px-2 font-medium bg-blue-50/40">🎨 Índigo</th>
                <th class="py-1.5 px-2 font-medium bg-purple-50/40 border-r border-slate-200">🔧 Telar</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tablaAptitud" :key="`apt-${row.neKey}`"
                class="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td class="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">Ne {{ row.neDisplay }}</td>
                <td class="px-3 py-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="row.app.startsWith('Urdimbre') ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'">
                    {{ row.app }}
                  </span>
                </td>
                <!-- Variables de hilo -->
                <td class="px-2 py-3 text-center font-mono border-l border-slate-100" :class="aptCellClass(row.ev.cvm)">
                  {{ row.vals.cvm != null ? row.vals.cvm.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-3 text-center font-mono" :class="aptCellClass(row.ev.neps_200)">
                  {{ row.vals.neps_200 != null ? row.vals.neps_200.toFixed(0) : '–' }}
                </td>
                <td class="px-2 py-3 text-center font-mono" :class="aptCellClass(row.ev.tenacidad)">
                  {{ row.vals.tenacidad != null ? row.vals.tenacidad.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-3 text-center font-mono" :class="aptCellClass(row.ev.elongacion)">
                  {{ row.vals.elongacion != null ? row.vals.elongacion.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-3 text-center font-mono" :class="aptCellClass(row.ev.vellosidad)">
                  {{ row.vals.vellosidad != null ? row.vals.vellosidad.toFixed(1) : '–' }}
                </td>
                <!-- Aptitud por proceso -->
                <td class="px-2 py-3 text-center border-l border-slate-100 bg-amber-50/10"
                  :title="row.procesos.URDIDORA !== 'na' ? 'Urdidora: elongación + tenacidad + delgados' : 'No aplica (Trama → solo Telar)'">
                  <div class="text-base leading-none">{{ aptProcIcon(row.procesos.URDIDORA) }}</div>
                  <div class="text-[8px] mt-0.5" :class="{ 'text-slate-300': row.procesos.URDIDORA === 'na' }">{{ aptProcLabel(row.procesos.URDIDORA) }}</div>
                </td>
                <td class="px-2 py-3 text-center bg-blue-50/10"
                  :title="row.procesos.INDIGO !== 'na' ? 'Índigo: neps + CVm% + vellosidad' : 'No aplica (Trama → solo Telar)'">
                  <div class="text-base leading-none">{{ aptProcIcon(row.procesos.INDIGO) }}</div>
                  <div class="text-[8px] mt-0.5" :class="{ 'text-slate-300': row.procesos.INDIGO === 'na' }">{{ aptProcLabel(row.procesos.INDIGO) }}</div>
                </td>
                <td class="px-2 py-3 text-center bg-purple-50/10 border-r border-slate-100"
                  :title="'Telar aire: tenacidad + elongación + CVm% + neps'">
                  <div class="text-base leading-none">{{ aptProcIcon(row.procesos.TELAR) }}</div>
                  <div class="text-[8px] mt-0.5">{{ aptProcLabel(row.procesos.TELAR) }}</div>
                </td>
                <!-- Pasador -->
                <td class="px-3 py-3 text-center">
                  <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap"
                    :class="aptPasadorClass(row.pasador)">
                    {{ row.pasador === 'aprobado' ? 'Sí ✓' : row.pasador === 'condicional' ? 'Revisar' : 'No ✗' }}
                  </span>
                </td>
                <!-- Desvío crítico -->
                <td class="px-3 py-3 text-[10px] max-w-52">
                  <template v-if="row.desvios.length || row.hviAlerts.length">
                    <div v-for="d in row.desvios" :key="d.key" class="text-red-600 font-medium">
                      {{ aptDesvioLabel(d.key) }}: {{ d.val != null ? d.val.toFixed(1) : '?' }}
                      {{ d.tipo === 'min' ? '↓ mín' : '↑ máx' }} {{ d.req }}
                    </div>
                    <div v-for="a in row.hviAlerts" :key="a" class="text-amber-600">🌿 {{ a }}</div>
                  </template>
                  <span v-else class="text-emerald-500 font-medium">✓ Sin desvíos</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Detalle Uster + Tensorapid completo -->
        <div class="px-6 py-3 border-t border-slate-100">
          <h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            📊 Detalle Uster + Tensorapid
            <span class="font-normal text-slate-400 normal-case">— Lote FIAC {{ loteActual }}, promedios por título</span>
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-[10px] font-mono">
              <thead>
                <tr class="text-slate-400 border-b border-slate-100">
                  <th class="text-left px-2 py-1.5 font-bold">Ne</th>
                  <th class="text-center px-2 py-1.5">CVm%</th>
                  <th class="text-center px-2 py-1.5">Delg−30%</th>
                  <th class="text-center px-2 py-1.5">Delg−40%</th>
                  <th class="text-center px-2 py-1.5">Delg−50%</th>
                  <th class="text-center px-2 py-1.5">Grue+35%</th>
                  <th class="text-center px-2 py-1.5">Grue+50%</th>
                  <th class="text-center px-2 py-1.5">Neps+140%</th>
                  <th class="text-center px-2 py-1.5">Neps+200%</th>
                  <th class="text-center px-2 py-1.5">Neps+280%</th>
                  <th class="text-center px-2 py-1.5">H Vell.</th>
                  <th class="text-center px-2 py-1.5">Fuerza B</th>
                  <th class="text-center px-2 py-1.5">Elong%</th>
                  <th class="text-center px-2 py-1.5">Tenac.</th>
                  <th class="text-center px-2 py-1.5">Trabajo B</th>
                </tr>
                <tr class="text-[8px] text-slate-300 border-b border-slate-50">
                  <th></th>
                  <th class="py-0.5">%</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">/km</th>
                  <th class="py-0.5">H</th>
                  <th class="py-0.5">cN</th>
                  <th class="py-0.5">%</th>
                  <th class="py-0.5">cN/tex</th>
                  <th class="py-0.5">cN·cm</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in tablaAptitud" :key="`det-${row.neKey}`"
                  class="border-t border-slate-50 hover:bg-slate-50/70 transition-colors">
                  <td class="px-2 py-1.5 font-bold text-slate-600">{{ row.neDisplay }}</td>
                  <td class="px-2 py-1.5 text-center" :class="aptCellClass(row.ev.cvm)">{{ row.vals.cvm != null ? row.vals.cvm.toFixed(2) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.thin_30 != null ? row.vals.thin_30.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.thin_40 != null ? row.vals.thin_40.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.thin_50 != null ? row.vals.thin_50.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.thick_35 != null ? row.vals.thick_35.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.thick_50 != null ? row.vals.thick_50.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.neps_140 != null ? row.vals.neps_140.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center" :class="aptCellClass(row.ev.neps_200)">{{ row.vals.neps_200 != null ? row.vals.neps_200.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.neps_280 != null ? row.vals.neps_280.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center" :class="aptCellClass(row.ev.vellosidad)">{{ row.vals.vellosidad != null ? row.vals.vellosidad.toFixed(2) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.fuerza_b != null ? row.vals.fuerza_b.toFixed(1) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center" :class="aptCellClass(row.ev.elongacion)">{{ row.vals.elongacion != null ? row.vals.elongacion.toFixed(2) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center" :class="aptCellClass(row.ev.tenacidad)">{{ row.vals.tenacidad != null ? row.vals.tenacidad.toFixed(2) : '–' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ row.vals.trabajo_b != null ? row.vals.trabajo_b.toFixed(1) : '–' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Fibra HVI resumen -->
        <div class="px-6 py-3 border-t border-slate-100 bg-blue-50/30">
          <div class="flex items-center gap-6 text-xs text-slate-600 flex-wrap">
            <span class="font-bold text-blue-600 text-[10px] uppercase tracking-wide shrink-0">🌿 HVI Fibra Lote {{ loteActual }}:</span>
            <span>STR <strong>{{ fmt(getHVI(loteActual, 'str')) }}</strong> g/tex</span>
            <span>SCI <strong>{{ fmt(getHVI(loteActual, 'sci'), 1) }}</strong></span>
            <span>MIC <strong>{{ fmt(getHVI(loteActual, 'mic'), 3) }}</strong></span>
            <span>UHML <strong>{{ fmt(getHVI(loteActual, 'uhml')) }}</strong> mm</span>
            <span>UI <strong>{{ fmt(getHVI(loteActual, 'ui')) }}</strong>%</span>
            <span>ELG <strong>{{ fmt(getHVI(loteActual, 'elg_fibra')) }}</strong>%</span>
          </div>
        </div>

        <!-- Comentarios de Planta -->
        <div v-if="tablaAptitud.some(r => r.comentarios.length > 0)" class="px-6 py-4 border-t border-slate-100 space-y-1.5">
          <h3 class="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            💬 Comentarios de Planta
            <span class="text-[9px] font-normal text-slate-400 normal-case">(vocabulario de hilandería)</span>
          </h3>
          <div v-for="row in tablaAptitud" :key="`com-${row.neKey}`">
            <div v-if="row.comentarios.length" class="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 flex items-start gap-3">
              <span class="font-bold text-slate-500 shrink-0 font-mono inline-block" :style="{ width: `${comentarioTituloWidthCh}ch` }">Ne {{ row.neDisplay }}:</span>
              <div class="min-w-0 flex-1 space-y-0.5">
                <div v-for="(com, ci) in row.comentarios" :key="ci">{{ com }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Botón Alerta WhatsApp -->
        <div class="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
          <button @click="copiarAlertaWhatsApp"
            class="px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
            :class="whatsappCopiado
              ? 'bg-emerald-600 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'">
            <span v-if="whatsappCopiado">✓</span>
            <span v-else>📋</span>
            {{ whatsappCopiado ? '¡Copiado al portapapeles!' : 'Copiar Alerta WhatsApp' }}
          </button>
          <span class="text-[10px] text-slate-400">
            Genera un resumen de alertas en formato WhatsApp listo para enviar a jefes de sección
          </span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import CustomDatepicker from '@/components/CustomDatepicker.vue'

function defaultYesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ── Utilidad de caché ─────────────────────────────────────────────────────
function hashPayload(obj) {
  const str = JSON.stringify(obj)
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// ── State ──────────────────────────────────────────────────────────────────
const LS_KEY        = 'dmh_lotesInput'
const lotesInput    = ref(localStorage.getItem(LS_KEY) ?? '107, 108, 109')
watch(lotesInput, v => localStorage.setItem(LS_KEY, v))
const neFilter      = ref('')
const loading       = ref(false)
const rows          = ref([])
const proveedores   = ref([])
const cardasContext = ref(null)
const narrativa     = ref('')
const narrativaError= ref('')
const narrativaFuente = ref('')   // 'gemini' | 'local'
const narrativaAviso  = ref('')
const loadingNarrativa = ref(false)
const modoLocalAutomatico = ref(false)
const geminiCuotaDiariaAgotada = ref(false)
const whatsappCopiado = ref(false)
const narrativaCopiada = ref(false)
const fechaCorte = ref(defaultYesterdayISO())

watch(fechaCorte, () => {
  narrativa.value = ''
  narrativaError.value = ''
  narrativaFuente.value = ''
  narrativaAviso.value = ''
  geminiCuotaDiariaAgotada.value = false
})

async function copiarNarrativa() {
  try {
    await navigator.clipboard.writeText(narrativa.value)
    narrativaCopiada.value = true
    setTimeout(() => { narrativaCopiada.value = false }, 2500)
  } catch {
    // Fallback para entornos sin clipboard API
    const el = document.createElement('textarea')
    el.value = narrativa.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    narrativaCopiada.value = true
    setTimeout(() => { narrativaCopiada.value = false }, 2500)
  }
}

// ── Definición de filas de tabla ──────────────────────────────────────────
const HVI_ROWS = [
  { key: 'str',       label: 'STR — Tenacidad Fibra', unit: 'g/tex',   dec: 2, thresholds: [27, 25],   inverse: false },
  { key: 'sci',       label: 'SCI — Índice Hilabilidad', unit: '',      dec: 1, thresholds: [145, 130], inverse: false },
  { key: 'mic',       label: 'MIC — Finura / Madurez', unit: 'mic',    dec: 3, thresholds: null,       inverse: false },
  { key: 'uhml',      label: 'UHML — Longitud', unit: 'mm',            dec: 2, thresholds: null,       inverse: false },
  { key: 'ui',        label: 'UI — Uniformidad Fibra', unit: '%',      dec: 2, thresholds: [84, 82],   inverse: false },
  { key: 'elg_fibra', label: 'ELG — Elong. Fibra', unit: '%',          dec: 2, thresholds: null,       inverse: false },
  { key: 'n_fardos',  label: 'Fardos analizados', unit: '',            dec: 0, thresholds: null,       inverse: false },
]

const HILO_ROWS = [
  { key: 'tenacidad',  label: 'Tenacidad', unit: 'cN/tex', dec: 2, thresholds: [16, 14.5],  inverse: false },
  { key: 'elongacion', label: 'Elongación', unit: '%',     dec: 2, thresholds: [8, 7.5],    inverse: false },
  { key: 'cvm',        label: 'CVm% — Irregularidad', unit: '%', dec: 2, thresholds: [12, 13], inverse: true },
  { key: 'vellosidad', label: 'H — Vellosidad', unit: '',  dec: 2, thresholds: null,         inverse: true },
  { key: 'neps_200',   label: 'Neps +200%', unit: '/km',  dec: 1, thresholds: [500, 700],   inverse: true },
  { key: 'thin_50',    label: 'Puntos Delgados −50%', unit: '/km', dec: 1, thresholds: null, inverse: true },
  { key: 'thick_50',   label: 'Puntos Gruesos +50%', unit: '/km', dec: 1, thresholds: null,  inverse: true },
  { key: 'n_uster',      label: 'Ensayos Uster (por Ne)', unit: '', dec: 0, thresholds: null, inverse: false },
]

// ── Matriz de Requisitos Mínimos — Denim ──────────────────────────────────
// ok = umbral bueno (verde), w = umbral precaución (amarillo); fuera de w = crítico (rojo)
// t: 'min' → valor mayor = mejor; 'max' → valor menor = mejor
const MATRIZ_REQUISITOS = {
  '7':    { app: 'Trama',    dest: ['TELAR'], sciMin: 115, strMin: 24,  umb: { tenacidad: { ok: 14.0, w: 13.0, t: 'min' }, elongacion: { ok: 7.0, w: 6.0, t: 'min' }, cvm: { ok: 13.5, w: 14.5, t: 'max' }, neps_200: { ok: 700, w: 850, t: 'max' }, vellosidad: { ok: 7.0, w: 8.0, t: 'max' } } },
  '9':    { app: 'Trama',    dest: ['TELAR'], sciMin: 120, strMin: 25,  umb: { tenacidad: { ok: 14.5, w: 13.5, t: 'min' }, elongacion: { ok: 7.0, w: 6.5, t: 'min' }, cvm: { ok: 13.0, w: 14.0, t: 'max' }, neps_200: { ok: 600, w: 750, t: 'max' }, vellosidad: { ok: 6.5, w: 7.5, t: 'max' } } },
  '10':   { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'], sciMin: 130, strMin: 26, umb: { tenacidad: { ok: 16.0, w: 15.0, t: 'min' }, elongacion: { ok: 8.0, w: 7.5, t: 'min' }, cvm: { ok: 12.0, w: 13.0, t: 'max' }, neps_200: { ok: 500, w: 650, t: 'max' }, vellosidad: { ok: 6.0, w: 7.0, t: 'max' } } },
  '12.5': { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'], sciMin: 135, strMin: 27, umb: { tenacidad: { ok: 16.5, w: 15.5, t: 'min' }, elongacion: { ok: 8.0, w: 7.5, t: 'min' }, cvm: { ok: 11.5, w: 12.5, t: 'max' }, neps_200: { ok: 450, w: 600, t: 'max' }, vellosidad: { ok: 5.5, w: 6.5, t: 'max' } } },
  '14':   { app: 'Urdimbre', dest: ['URDIDORA','INDIGO','TELAR'], sciMin: 140, strMin: 28, umb: { tenacidad: { ok: 17.0, w: 16.0, t: 'min' }, elongacion: { ok: 8.5, w: 8.0, t: 'min' }, cvm: { ok: 11.0, w: 12.0, t: 'max' }, neps_200: { ok: 400, w: 550, t: 'max' }, vellosidad: { ok: 5.0, w: 6.0, t: 'max' } } },
}

const FLAME_UMB_AJUSTES = {
  cvm: { ok: 18.0, w: 20.0, t: 'max' },
  neps_200: { ok: 700, w: 850, t: 'max' },
}

function resolveMatrizBaseByNe(neValue) {
  if (!Number.isFinite(neValue)) return null
  let bestKey = null
  let bestNum = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const key of Object.keys(MATRIZ_REQUISITOS)) {
    const num = parseFloat(key)
    if (!Number.isFinite(num)) continue
    const dist = Math.abs(num - neValue)
    if (dist < bestDist || (Math.abs(dist - bestDist) < 1e-9 && num > (bestNum ?? -Infinity))) {
      bestDist = dist
      bestNum = num
      bestKey = key
    }
  }

  return bestDist <= 2 ? bestKey : null
}

function getMatrizRequisitos(neValue, isFlame = false) {
  const key = resolveMatrizBaseByNe(neValue)
  if (!key) return null

  const base = MATRIZ_REQUISITOS[key]
  if (!base || !isFlame || neValue < 9) return base

  return {
    ...base,
    app: 'Urdimbre Flame',
    umb: {
      ...base.umb,
      ...FLAME_UMB_AJUSTES,
    },
  }
}
// Variables críticas por proceso productivo
const PROC_VARS = {
  URDIDORA: { label: '🏭 Urdidora',   vars: ['elongacion', 'tenacidad', 'thin_50'], tip: 'Tensión de urdido — elongación y resistencia críticas' },
  INDIGO:   { label: '🎨 Índigo',      vars: ['neps_200', 'cvm', 'vellosidad'],      tip: 'Teñido en manta — neps y uniformidad de masa' },
  TELAR:    { label: '🔧 Telar aire',  vars: ['tenacidad', 'elongacion', 'cvm', 'neps_200'], tip: 'Alta velocidad — exige tenacidad, CVm% y limpieza' },
}

function getProcVarsForRow(proc, isFlame = false) {
  const base = PROC_VARS[proc]
  if (!base || !isFlame) return base

  if (proc === 'INDIGO') {
    return { ...base, vars: ['neps_200', 'vellosidad'] }
  }
  if (proc === 'TELAR') {
    return { ...base, vars: ['tenacidad', 'elongacion', 'neps_200'] }
  }
  return base
}

// ── Computed ───────────────────────────────────────────────────────────────
const hasData     = computed(() => rows.value.length > 0)
const lotesList   = computed(() => [...new Set(rows.value.map(r => r.mistura))].sort((a, b) => Number(a) - Number(b)))
const loteActual  = computed(() => lotesList.value.length ? lotesList.value[lotesList.value.length - 1] : null)

function parseFlameFlag(value) {
  if (value === true || value === false) return value
  if (typeof value === 'number') return value === 1
  const text = String(value ?? '').trim().toLowerCase()
  return text === 'true' || text === '1' || text === 't' || text === 'yes'
}

function buildNeKey(ne, isFlame) {
  return `${String(ne)}|${isFlame ? 'F' : 'L'}`
}

function formatNeDisplay(ne, isFlame) {
  return `${String(ne)}${isFlame ? ' FLAME' : ''}`
}

const allNes      = computed(() => {
  const map = new Map()
  for (const row of rows.value) {
    if (row.ne == null) continue
    const ne = String(row.ne)
    const isFlame = parseFlameFlag(row.is_flame)
    const key = buildNeKey(ne, isFlame)
    if (!map.has(key)) {
      map.set(key, { key, ne, isFlame, label: formatNeDisplay(ne, isFlame) })
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = parseFloat(a.ne)
    const db = parseFloat(b.ne)
    if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db
    if (a.isFlame !== b.isFlame) return a.isFlame ? 1 : -1
    return a.label.localeCompare(b.label)
  })
})

// ── Helpers de datos ──────────────────────────────────────────────────────
function getHVI(mistura, key) {
  const row = rows.value.find(r => String(r.mistura) === String(mistura))
  if (!row) return null
  const v = row[key]
  return v != null ? parseFloat(v) : null
}

function getHilo(mistura, neKey, key) {
  const row = rows.value.find(r =>
    String(r.mistura) === String(mistura) &&
    buildNeKey(r.ne, parseFlameFlag(r.is_flame)) === String(neKey)
  )
  if (!row) return null
  const v = row[key]
  return v != null ? parseFloat(v) : null
}

function getHiloFirst(mistura, key) {
  const neRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  if (!neRows.length) return null
  // Promedio del primer Ne disponible (o el único)
  const first = neRows[0]
  return first[key] != null ? parseFloat(first[key]) : null
}

function getMisturaReal(mistura) {
  const row = rows.value.find(r => String(r.mistura) === String(mistura))
  return row?.mistura_real ?? null
}

function getHiloCount(mistura) {
  // n_secuencias viene de hvi_agg: secuencias de blendomat con DT_ENTRADA_PROD != null
  const row = rows.value.find(r => String(r.mistura) === String(mistura))
  if (row?.n_secuencias != null) return Number(row.n_secuencias)
  // fallback: suma de n_uster por Ne
  const neRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  return neRows.reduce((acc, r) => acc + (Number(r.n_uster) || 0), 0) || '–'
}

function fmt(val, dec = 2) {
  if (val == null || isNaN(val)) return '–'
  return Number(val).toFixed(dec)
}

// ── Semáforo ──────────────────────────────────────────────────────────────
function semaforo(mistura) {
  const hiloRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  let level = 'verde'
  const issues = []

  for (const r of hiloRows) {
    const rowIsFlame = parseFlameFlag(r.is_flame)
    const neNum = parseFloat(String(r.ne))
    const mat = getMatrizRequisitos(neNum, rowIsFlame)
    const app = mat?.app || (neNum <= 9 ? 'Trama' : (rowIsFlame ? 'Urdimbre Flame' : 'Urdimbre'))
    const ten = r.tenacidad != null ? parseFloat(r.tenacidad) : null
    const elo = r.elongacion != null ? parseFloat(r.elongacion) : null
    const nps = r.neps_200 != null ? parseFloat(r.neps_200) : null
    const cvm = r.cvm != null ? parseFloat(r.cvm) : null
    const neTxt = formatNeDisplay(r.ne, rowIsFlame)
    const cvmWarn = mat?.umb?.cvm?.w ?? (rowIsFlame ? 20.0 : 12.5)
    const cvmCrit = cvmWarn + (rowIsFlame ? 0.8 : 0.6)
    const tenEval = evalUmbral(ten, mat?.umb?.tenacidad)
    const eloEval = evalUmbral(elo, mat?.umb?.elongacion)

    if (ten != null) {
      if (app.startsWith('Urdimbre') && ten < 16.0) {
        level = 'rojo'
        if (ten < 14.5) {
          issues.push(`Ne ${neTxt}: Tenacidad CRÍTICA (${ten.toFixed(2)} cN/tex < 14.5) — Alto riesgo de rotura en batea Benninger.`)
        } else {
          issues.push(`Ne ${neTxt}: Tenacidad ${ten.toFixed(2)} cN/tex (<16) — precaución en el engomado Benninger.`)
        }
      } else if (app === 'Trama' && ten >= 16.5) {
        issues.push(`Ne ${neTxt}: Tenacidad ${ten.toFixed(2)} cN/tex — APTO telar Toyota (830 RPM).`)
      } else if (tenEval === 'crit') {
        level = 'rojo'
        issues.push(`Ne ${neTxt}: Tenacidad ${ten.toFixed(2)} cN/tex — fuera de matriz de aptitud.`)
      } else if (tenEval === 'warn') {
        if (level === 'verde') level = 'amarillo'
        issues.push(`Ne ${neTxt}: Tenacidad ${ten.toFixed(2)} cN/tex — margen mecánico ajustado.`)
      }
    }

    if (elo != null) {
      if (app.startsWith('Urdimbre') && elo < 8.0) {
        if (elo < 7.5) {
          level = 'rojo'
          issues.push(`Ne ${neTxt}: Elongación ${elo.toFixed(2)}% — RIESGO de rotura en urdidora/engomadora Benninger.`)
        } else {
          if (level === 'verde') level = 'amarillo'
          issues.push(`Ne ${neTxt}: Elongación ${elo.toFixed(2)}% — vigilar estiramiento en batea.`)
        }
      } else if (app === 'Trama' && elo >= 8.5) {
        // Para trama no es crítico pero se reconoce buena absorción
      } else if (eloEval === 'warn') {
        if (level === 'verde') level = 'amarillo'
        issues.push(`Ne ${neTxt}: Elongación ${elo.toFixed(2)}% — vigilar stretch programado.`)
      }
    }

    if (nps != null) {
      if (nps < 150) {
        issues.push(`Ne ${neTxt}: Neps ${nps.toFixed(1)}/km — hilo muy limpio para Índigo.`)
      } else if (nps > (rowIsFlame ? 850 : 700)) {
        level = 'rojo'
        issues.push(`Ne ${neTxt}: Neps ${nps}/km — riesgo en Índigo`)
      } else if (rowIsFlame && nps > 700) {
        if (level === 'verde') level = 'amarillo'
        issues.push(`Ne ${neTxt}: Neps ${nps}/km — vigilar estabilidad de efecto`)
      }
    }

    if (cvm != null) {
      if (cvm > cvmCrit) {
        if (level !== 'rojo') level = 'rojo'
        issues.push(`Ne ${neTxt}: CVm% ${cvm.toFixed(2)} > ${cvmCrit.toFixed(2)} — alto riesgo de barreado en índigo.`)
      } else if (cvm > cvmWarn) {
        if (level === 'verde') level = 'amarillo'
        issues.push(`Ne ${neTxt}: CVm% ${cvm.toFixed(2)} sobre estándar (${cvmWarn.toFixed(2)}) — ${rowIsFlame ? 'controlar estabilidad visual flame' : 'masa irregular en teñido'}.`)
      }
    }
  }

  const mic = getHVI(mistura, 'mic')
  if (mic != null) {
    if (mic > 4.5) {
      if (level === 'verde') level = 'amarillo'
      issues.push(`MIC ${mic.toFixed(2)}: menor superficie específica de fibra, riesgo de teñido anular en cajas de inmersión Benninger.`)
    } else if (mic < 3.8) {
      if (level === 'verde') level = 'amarillo'
      issues.push(`MIC ${mic.toFixed(2)}: fibra inmadura/fina, riesgo de neps de color en índigo.`)
    }
  }

  // Si no hay datos de hilo, evaluar solo por HVI STR
  if (hiloRows.length === 0) {
    const str = getHVI(mistura, 'str')
    if (str != null) {
      if (str < 25.0) { level = 'rojo'; issues.push(`STR ${str} g/tex — límite bajo`) }
      else if (str < 27.0) { if (level === 'verde') level = 'amarillo'; issues.push(`STR ${str} g/tex — margen ajustado`) }
    }
    if (!issues.length) issues.push('Solo datos HVI disponibles')
  }

  return {
    level,
    issues: issues.slice(0, 4),
    icon:        { verde: '✅', amarillo: '⚠️', rojo: '🔴' }[level],
    label:       { verde: 'APTO TELAR', amarillo: 'PRECAUCIÓN', rojo: 'CRÍTICO' }[level],
    borderClass: { verde: 'border-emerald-300 shadow-emerald-50', amarillo: 'border-amber-300 shadow-amber-50', rojo: 'border-red-300 shadow-red-50' }[level],
    textClass:   { verde: 'text-emerald-700', amarillo: 'text-amber-700', rojo: 'text-red-700' }[level],
  }
}

// ── Color helpers ─────────────────────────────────────────────────────────
// thresholds: [bueno, minimo] donde valores > bueno = verde, entre minimo-bueno = amarillo, < minimo = rojo
// inverse = true invierte la lógica (menor = mejor, ej: neps)
function thresholdClass(val, good, warn, inverse = false) {
  if (val == null) return 'text-slate-400'
  const v = parseFloat(val)
  if (inverse) {
    if (v <= good)  return 'text-emerald-600'
    if (v <= warn)  return 'text-amber-600'
    return 'text-red-600'
  } else {
    if (v >= good)  return 'text-emerald-600'
    if (v >= warn)  return 'text-amber-600'
    return 'text-red-600'
  }
}

function cellBg(val, good, warn, inverse = false) {
  if (val == null) return ''
  const v = parseFloat(val)
  if (inverse) {
    if (v <= good)  return 'bg-emerald-50'
    if (v <= warn)  return 'bg-amber-50'
    return 'bg-red-50'
  } else {
    if (v >= good)  return 'bg-emerald-50'
    if (v >= warn)  return 'bg-amber-50'
    return 'bg-red-50'
  }
}

function trendArrow(base, current) {
  if (base == null || current == null) return ''
  const diff = parseFloat(current) - parseFloat(base)
  if (Math.abs(diff) < 0.01) return '='
  return diff > 0 ? '↑' : '↓'
}

function trendClass(base, current, inverse = false) {
  if (base == null || current == null) return 'text-slate-300'
  const diff = parseFloat(current) - parseFloat(base)
  if (Math.abs(diff) < 0.01) return 'text-slate-400'
  const better = inverse ? diff < 0 : diff > 0
  return better ? 'text-emerald-500' : 'text-red-400'
}

// ── Auditoría de Aptitud por Proceso ──────────────────────────────────────
function evalUmbral(val, umbral) {
  if (val == null || !umbral) return 'sin-dato'
  if (umbral.t === 'min') return val >= umbral.ok ? 'ok' : val >= umbral.w ? 'warn' : 'crit'
  return val <= umbral.ok ? 'ok' : val <= umbral.w ? 'warn' : 'crit'
}

function aptCellClass(estado) {
  return {
    'ok':       'bg-emerald-50 text-emerald-700 font-bold',
    'warn':     'bg-amber-50 text-amber-700 font-bold',
    'crit':     'bg-red-50 text-red-700 font-bold',
    'sin-dato': 'text-slate-300',
    'na':       'text-slate-200',
  }[estado] || 'text-slate-400'
}

function aptProcIcon(estado) {
  return { 'ok': '✅', 'warn': '⚠️', 'crit': '🔴', 'na': '—', 'sin-dato': '?' }[estado] || '?'
}

function aptProcLabel(estado) {
  return { 'ok': 'Apto', 'warn': 'Revisar', 'crit': 'No apto', 'na': 'N/A', 'sin-dato': 'S/D' }[estado] || '–'
}

function aptPasadorClass(p) {
  return {
    'aprobado':    'bg-emerald-100 text-emerald-800 border border-emerald-300',
    'condicional': 'bg-amber-100 text-amber-800 border border-amber-300',
    'rechazado':   'bg-red-100 text-red-800 border border-red-300',
  }[p] || 'bg-slate-100 text-slate-500'
}

function aptDesvioLabel(key) {
  return { cvm: 'CVm%', neps_200: 'Neps +200%', tenacidad: 'Tenac.', elongacion: 'Elong.', vellosidad: 'Vell. H' }[key] || key
}

function generarComentarioPlanta(ne, app, vals, hvi, isFlame = false) {
  const coms = []
  const neNum = parseFloat(String(ne).replace(',', '.'))
  const mat = getMatrizRequisitos(neNum, isFlame)
  const cvmWarn = mat?.umb?.cvm?.w ?? (isFlame ? 20.0 : 12.5)

  // Tenacidad — vocabulario de planta
  if (vals.tenacidad != null) {
    if (app.startsWith('Urdimbre') && vals.tenacidad < 16.0) {
      coms.push(`⚠️ Tenacidad ${vals.tenacidad.toFixed(1)} cN/tex (<16) en urdimbre. Se esperan paradas por rotura de cabos en batea.`)
    } else if (vals.tenacidad >= 18) {
      coms.push(`Va sobrado de fuerza (${vals.tenacidad.toFixed(1)} cN/tex). Hilo robusto para alta exigencia.`)
    } else if (vals.tenacidad >= 16) {
      coms.push(`Tenacidad sólida (${vals.tenacidad.toFixed(1)} cN/tex). Margen razonable para línea Benninger.`)
    } else if (vals.tenacidad >= 14.5) {
      coms.push(`Tenacidad justa (${vals.tenacidad.toFixed(1)} cN/tex). Sin reserva ante picos de tensión.`)
    } else {
      coms.push(`⚠️ Tenacidad crítica (${vals.tenacidad.toFixed(1)} cN/tex). Alta probabilidad de rotura.`)
    }
  }

  // CVm% para Trama — barreado
  if (app === 'Trama' && vals.cvm != null) {
    if (vals.cvm > cvmWarn + 0.6) coms.push(`CVm ${vals.cvm.toFixed(1)}% muy por encima del estándar (${cvmWarn.toFixed(1)}%). Barreado visible con índigo.`)
    else if (vals.cvm > cvmWarn) coms.push(`CVm ${vals.cvm.toFixed(1)}% sobre estándar (${cvmWarn.toFixed(1)}%). Ojo con barreado si se acelera la corrida.`)
    else coms.push(`Masa estable (CVm ${vals.cvm.toFixed(1)}%). Sin riesgo de barreado.`)
  }

  // CVm% para Urdimbre — uniformidad
  if (app.startsWith('Urdimbre') && vals.cvm != null) {
    if (isFlame) {
      if (vals.cvm > 20) coms.push(`CVm ${vals.cvm.toFixed(1)}% — variación flame fuera de banda. Revisar receta y estiraje de fantasía.`)
      else if (vals.cvm > 18) coms.push(`CVm ${vals.cvm.toFixed(1)}% — efecto flame intenso; monitorear estabilidad visual entre partidas.`)
      else coms.push(`CVm ${vals.cvm.toFixed(1)}% — variación consistente con hilo flame, sin impacto estructural relevante.`)
    } else if (vals.cvm > cvmWarn + 0.6) {
      coms.push(`CVm ${vals.cvm.toFixed(1)}% — fuera de estándar de título (${cvmWarn.toFixed(1)}%). Alto riesgo de barreado en índigo.`)
    } else if (vals.cvm > cvmWarn) {
      coms.push(`CVm ${vals.cvm.toFixed(1)}% — por encima del estándar (${cvmWarn.toFixed(1)}%). Vigilar uniformidad en slashing.`)
    }
  }

  // Elongación para Urdimbre
  if (app.startsWith('Urdimbre') && vals.elongacion != null) {
    if (vals.elongacion >= 8.5) coms.push(`Elongación ${vals.elongacion.toFixed(1)}%: buena reserva elástica para stretch programado.`)
    else if (vals.elongacion >= 8.0) coms.push(`Elongación ${vals.elongacion.toFixed(1)}%: cumple mínimo operativo para control de tensión Benninger.`)
    else if (vals.elongacion >= 7.5) coms.push(`Elongación ${vals.elongacion.toFixed(1)}% (<8): riesgo en rodillos exprimidores y cajas de oxidación.`)
    else coms.push(`⚠️ Elongación ${vals.elongacion.toFixed(1)}% muy baja: alto riesgo de rotura bajo tensión constante de manta.`)
  }

  // Neps para Índigo
  if (app.startsWith('Urdimbre') && vals.neps_200 != null) {
    if (vals.neps_200 < 200) coms.push(`Hilo muy limpio para Índigo (Neps ${vals.neps_200.toFixed(0)}/km). Teñido uniforme.`)
    else if (vals.neps_200 < 500) coms.push(`Neps aceptables para Índigo (${vals.neps_200.toFixed(0)}/km).`)
    else if (vals.neps_200 < (isFlame ? 850 : 700)) coms.push(`Neps en zona de riesgo para Índigo (${vals.neps_200.toFixed(0)}/km). Posibles puntos claros en teñido.`)
    else coms.push(`⚠️ Neps muy altos (${vals.neps_200.toFixed(0)}/km). Van a saltar en el Índigo — colorante desparejo.`)
  }
  // MIC — fibra
  const mic = hvi.mic != null ? parseFloat(hvi.mic) : null
  if (mic != null && !isNaN(mic)) {
    if (mic > 4.5) coms.push(`MIC ${mic.toFixed(2)} (>4.5): menor superficie específica. Riesgo de teñido anular por pobre penetración en cajas Benninger.`)
    else if (mic < 3.8) coms.push(`MIC ${mic.toFixed(2)} (<3.8): riesgo de neps de color y puntos claros en índigo.`)
  }

  // STR fibra
  const str = hvi.str != null ? parseFloat(hvi.str) : null
  if (str != null && !isNaN(str)) {
    if (str > 32) coms.push(`Fibra con STR ${str.toFixed(1)} g/tex — va sobrada de fuerza. Impacto positivo directo en tenacidad.`)
    else if (str < 25) coms.push(`STR ${str.toFixed(1)} g/tex — fibra débil. Limita la tenacidad que se puede lograr con cualquier título.`)
  }
  return coms
}

const tablaAptitud = computed(() => {
  if (!hasData.value || !loteActual.value) return []
  const actual = Number(loteActual.value)
  const hilos = rows.value.filter(r => Number(r.mistura) === actual && r.ne != null)
  const hvi = rows.value.find(r => Number(r.mistura) === actual) || {}

  return hilos.map(h => {
    const ne = String(h.ne)
    const isFlame = parseFlameFlag(h.is_flame)
    const neDisplay = formatNeDisplay(ne, isFlame)
    const neKey = buildNeKey(ne, isFlame)
    const nNum = parseFloat(ne)
    const mat = getMatrizRequisitos(nNum, isFlame)
    const app = mat?.app || (nNum <= 9 ? 'Trama' : (isFlame ? 'Urdimbre Flame' : 'Urdimbre'))
    const dest = mat?.dest || (nNum <= 9 ? ['TELAR'] : ['URDIDORA', 'INDIGO', 'TELAR'])
    const umb = mat?.umb || {}

    const pf = (v) => v != null ? parseFloat(v) : null
    const vals = {
      cvm: pf(h.cvm), neps_200: pf(h.neps_200), neps_140: pf(h.neps_140), neps_280: pf(h.neps_280),
      thin_30: pf(h.thin_30), thin_40: pf(h.thin_40), thin_50: pf(h.thin_50),
      thick_35: pf(h.thick_35), thick_50: pf(h.thick_50),
      vellosidad: pf(h.vellosidad), tenacidad: pf(h.tenacidad), elongacion: pf(h.elongacion),
      fuerza_b: pf(h.fuerza_b), trabajo_b: pf(h.trabajo_b),
    }

    // Evaluar cada variable contra la matriz
    const ev = {}
    const desvios = []
    for (const [k, u] of Object.entries(umb)) {
      ev[k] = evalUmbral(vals[k], u)
      if (ev[k] === 'crit') desvios.push({ key: k, val: vals[k], req: u.ok, tipo: u.t })
    }

    // Chequeo HVI fibra
    const hviAlerts = []
    const str = pf(hvi.str), sci = pf(hvi.sci)
    if (mat?.strMin && str != null && str < mat.strMin) hviAlerts.push(`STR ${str.toFixed(1)} < ${mat.strMin} g/tex`)
    if (mat?.sciMin && sci != null && sci < mat.sciMin) hviAlerts.push(`SCI ${sci.toFixed(0)} < ${mat.sciMin}`)

    // Evaluación por proceso
    const procesos = {}
    for (const proc of Object.keys(PROC_VARS)) {
      const cfg = getProcVarsForRow(proc, isFlame)
      if (!dest.includes(proc)) { procesos[proc] = 'na'; continue }
      const results = cfg.vars.map(k => ev[k] || (vals[k] != null ? 'ok' : 'sin-dato')).filter(r => r !== 'sin-dato')
      if (!results.length) { procesos[proc] = 'sin-dato'; continue }
      procesos[proc] = results.includes('crit') ? 'crit' : results.includes('warn') ? 'warn' : 'ok'
    }

    // Estado global
    const allP = Object.values(procesos)
    const pasador = allP.includes('crit') ? 'rechazado' : (allP.includes('warn') || hviAlerts.length > 0) ? 'condicional' : 'aprobado'

    const comentarios = generarComentarioPlanta(neDisplay, app, vals, hvi, isFlame)

    return { ne, neDisplay, neKey, isFlame, app, dest, vals, ev, procesos, pasador, desvios, hviAlerts, comentarios, nota: mat?.nota || '' }
  })
})

const comentarioTituloWidthCh = computed(() => {
  const maxLen = tablaAptitud.value
    .filter(r => r.comentarios.length > 0)
    .map(r => `Ne ${r.neDisplay}:`.length)
    .reduce((m, len) => Math.max(m, len), 0)
  return Math.max(8, maxLen)
})

// ── Alerta WhatsApp — clipboard ───────────────────────────────────────────
function generarAlertaWhatsApp() {
  if (!tablaAptitud.value.length || !loteActual.value) return ''
  const actual = Number(loteActual.value)
  const hvi = rows.value.find(r => Number(r.mistura) === actual) || {}
  const pf = v => v != null ? parseFloat(v) : null
  const str = pf(hvi.str), sci = pf(hvi.sci), mic = pf(hvi.mic), uhml = pf(hvi.uhml)
  const f = (v, d = 1) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '–'

  const hayAlerta = tablaAptitud.value.some(r => r.pasador !== 'aprobado')
  const ico = hayAlerta ? '⚠️' : '✅'

  const lines = [
    `${ico} *ALERTA CALIDAD - LOTE FIAC ${actual}*`,
    `_${new Date().toLocaleDateString('es-AR')} · Dashboard Mezcla→Hilo_`,
    '',
  ]

  for (const row of tablaAptitud.value) {
    const { ne, neDisplay, app, vals, pasador, desvios, hviAlerts, isFlame } = row
    const nNum = parseFloat(ne)
    const mat = getMatrizRequisitos(nNum, isFlame)
    const cvmWarn = mat?.umb?.cvm?.w ?? (isFlame ? 20.0 : 12.5)

    // Icono de estado
    const neIco = pasador === 'rechazado' ? '🔴' : pasador === 'condicional' ? '⚠️' : '✅'
    lines.push(`${neIco} *Ne ${neDisplay} (${app})*:`)

    if (pasador === 'aprobado' && !hviAlerts.length) {
      lines.push(`✅ Todos los parámetros dentro de la Matriz. Sin observaciones.`)
      lines.push('')
      continue
    }

    // 1) Alerta de elongación para urdimbre
    if (app.startsWith('Urdimbre') && vals.elongacion != null && vals.elongacion < 8.0) {
      const critico = vals.elongacion < 7.5
      lines.push(`🧵 ${critico ? '¡ATENCIÓN' : 'Precaución'} en Urdido/Índigo: Elongación *${f(vals.elongacion)}%* (<8). Riesgo en exprimidores y cajas de oxidación por tensión constante.`)
      lines.push(`📍 *Acción:* bajar stretch programado y reducir velocidad de línea hasta estabilizar.`)
    }

    // 2) Alerta de tenacidad para urdimbre/telar
    if (vals.tenacidad != null && app.startsWith('Urdimbre')) {
      if (vals.tenacidad < 16.0) {
        lines.push(`🔴 Tenacidad *${f(vals.tenacidad)} cN/tex* en urdimbre (<16). Se anticipan paradas por rotura de cabos en batea.`)
        lines.push(`📍 *Acción:* reducir velocidad y tensión mientras se corrige mezcla/proceso.`)
      } else if (vals.tenacidad >= 18) {
        lines.push(`💪 Tenacidad *${f(vals.tenacidad)} cN/tex* — va sobrado de fuerza. Sin drama en ningún proceso.`)
      }
    }

    // 3) Correlación de riesgo: fibra débil + hilo OK
    const fibraDebil = (mat?.sciMin && sci != null && sci < mat.sciMin) || (mat?.strMin && str != null && str < mat.strMin)
    const hiloOk = vals.tenacidad != null && vals.tenacidad >= (mat?.umb?.tenacidad?.ok || 16)
    if (fibraDebil && hiloOk) {
      const sciTxt = sci != null ? `SCI ${f(sci, 0)}` : ''
      const strTxt = str != null ? `STR ${f(str)}` : ''
      const matRef = mat?.sciMin ? `Matriz pide SCI≥${mat.sciMin}` : ''
      lines.push(`📉 *CORRELACIÓN DE RIESGO:* Estamos logrando tenacidad de ${f(vals.tenacidad)} con ${[sciTxt, strTxt].filter(Boolean).join(' y ')} (${matRef}). La calidad es _prestada por el proceso_, la fibra no está ayudando. Ante cualquier salto térmico en planta, el hilo se cae.`)
    } else if (fibraDebil) {
      lines.push(`📉 *Fibra por debajo de la Matriz:* ${hviAlerts.join(' / ')}. Impacto directo en estabilidad del proceso.`)
    }

    // 4) CVm% vs estándar de título — barreado
    if (!isFlame && vals.cvm != null && vals.cvm > cvmWarn) {
      lines.push(`📊 CVm% *${f(vals.cvm)}%* > estándar *${f(cvmWarn)}%* para Ne ${neDisplay}. Riesgo de barreado que se intensifica con índigo.`)
      lines.push(`📍 *Acción:* evitar velocidad pico y revisar uniformidad de alimentación/estiraje.`)
    }

    // 5) MIC — absorción de tinte
    if (mic != null && !isNaN(mic)) {
      if (mic > 4.5) {
        lines.push(`🎨 *ÍNDIGO / TINTURA:* MIC *${f(mic, 2)}* (>4.5). Menor superficie específica, con riesgo de teñido anular y pobre penetración en cajas Benninger.`)
      } else if (mic < 3.8) {
        lines.push(`🎨 *ÍNDIGO / TINTURA:* MIC *${f(mic, 2)}* (<3.8). Riesgo de neps de color y puntos claros.`)
      }
    }

    // 6) Neps altos para Índigo
    if (app.startsWith('Urdimbre') && vals.neps_200 != null && vals.neps_200 > (isFlame ? 700 : 500)) {
      lines.push(`🧶 Neps +200% en *${f(vals.neps_200, 0)}/km*. Puntos claros en Índigo. ${vals.neps_200 > 700 ? 'Evaluar ajuste de cardas urgente.' : 'Monitorear partida.'}`)
    }

    // Desvíos críticos restantes no cubiertos arriba
    const covered = new Set(['elongacion', 'tenacidad', 'cvm', 'neps_200'])
    const extra = desvios.filter(d => !covered.has(d.key))
    if (extra.length) {
      lines.push(`⚠️ Otros desvíos: ${extra.map(d => `${d.key} ${f(d.val)} ${d.tipo === 'min' ? '<' : '>'} ${d.req}`).join(', ')}`)
    }

    lines.push('')
  }

  // Resumen HVI
  lines.push(`🌿 *HVI Lote ${actual}:* STR ${f(str)} g/tex | SCI ${f(sci, 0)} | MIC ${f(mic, 2)} | UHML ${f(uhml)} mm`)
  lines.push('')

  // Estado global
  const globalRechazado = tablaAptitud.value.some(r => r.pasador === 'rechazado')
  const globalCondicional = tablaAptitud.value.some(r => r.pasador === 'condicional')
  if (globalRechazado) {
    lines.push(`🔴 *ESTADO: CRÍTICO — revisar antes de continuar producción*`)
  } else if (globalCondicional) {
    lines.push(`⚠️ *ESTADO: PRECAUCIÓN — monitoreo intensivo recomendado*`)
  } else {
    lines.push(`✅ *ESTADO: APROBADO — producción sin restricciones*`)
  }

  lines.push(`_Generado por STC Dashboard · ${new Date().toLocaleString('es-AR')}_`)

  return lines.join('\n')
}

async function copiarAlertaWhatsApp() {
  const texto = generarAlertaWhatsApp()
  if (!texto) return
  try {
    await navigator.clipboard.writeText(texto)
    whatsappCopiado.value = true
    setTimeout(() => { whatsappCopiado.value = false }, 2500)
  } catch (err) {
    // Fallback para navegadores sin clipboard API
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    whatsappCopiado.value = true
    setTimeout(() => { whatsappCopiado.value = false }, 2500)
  }
}

// ── API calls ─────────────────────────────────────────────────────────────
async function analizar() {
  if (!lotesInput.value.trim() || loading.value) return
  loading.value = true
  rows.value = []
  cardasContext.value = null
  narrativa.value = ''
  narrativaError.value = ''

  try {
    const lotesClean = lotesInput.value.replace(/[^0-9,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, '')
    const params = new URLSearchParams({ lotes: lotesClean })
    if (neFilter.value.trim()) params.set('ne', neFilter.value.trim())

    const res = await fetch(`/api/dashboard/mezcla-lotes?${params}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al obtener datos')
    rows.value = data.rows || []
    proveedores.value = data.proveedores || []
    cardasContext.value = data.cardas || null
  } catch (err) {
    console.error('[DashboardMezclaHilo]', err)
    rows.value = []
    cardasContext.value = null
  } finally {
    loading.value = false
  }
}

async function generarNarrativa(soloLocal = false, forzar = false) {
  if (loadingNarrativa.value || !rows.value.length) return
  const usarLocal = soloLocal || modoLocalAutomatico.value

  // ── Caché: solo para llamadas Gemini, no locales ni forzadas ──
  const cachePayload = {
    rows: rows.value,
    proveedores: proveedores.value,
    loteActual: loteActual.value,
    fechaCorte: fechaCorte.value,
    modo: usarLocal ? 'local' : 'gemini'
  }
  const cacheKey = 'dmh_narr_' + hashPayload(cachePayload)

  if (!usarLocal && !forzar) {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const c = JSON.parse(cached)
        narrativa.value       = c.narrativa
        narrativaFuente.value = 'cache'
        narrativaAviso.value  = ''
        narrativaError.value  = ''
        geminiCuotaDiariaAgotada.value = false
        return
      }
    } catch { /* localStorage no disponible */ }
  }

  loadingNarrativa.value = true
  narrativa.value = ''
  narrativaError.value = ''
  narrativaFuente.value = ''
  narrativaAviso.value = ''
  geminiCuotaDiariaAgotada.value = false

  try {
    const res = await fetch('/api/dashboard/narrativa-lotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows.value,
        proveedores: proveedores.value,
        loteActual: loteActual.value,
        fechaCorte: fechaCorte.value,
        modo: usarLocal ? 'local' : undefined
      })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al generar')
    narrativa.value = data.narrativa
    narrativaFuente.value = data.fuente || 'local'
    narrativaAviso.value = data.aviso || ''
    geminiCuotaDiariaAgotada.value = data.geminiEstado === 'quota-daily' || /l[ií]mite diario|20\/d[ií]a/i.test(data.aviso || '')
    if ((data.fuente === 'local') && (/gemini no disponible|l[ií]mite diario/i.test(data.aviso || ''))) {
      modoLocalAutomatico.value = true
    } else if (data.fuente === 'gemini') {
      modoLocalAutomatico.value = false
      geminiCuotaDiariaAgotada.value = false
    }

    // Guardar en caché solo si respondió Gemini
    if (!usarLocal && data.fuente === 'gemini') {
      try { localStorage.setItem(cacheKey, JSON.stringify({ narrativa: data.narrativa })) } catch { /* cuota LS */ }
    }
  } catch (err) {
    narrativaError.value = err.message
    if (/quota|429|gemini/i.test(err.message || '')) {
      modoLocalAutomatico.value = true
    }
  } finally {
    loadingNarrativa.value = false
  }
}

function probarGemini() {
  if (loadingNarrativa.value) return
  modoLocalAutomatico.value = false
  geminiCuotaDiariaAgotada.value = false
  generarNarrativa(false, true)
}
</script>
