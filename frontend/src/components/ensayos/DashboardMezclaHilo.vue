<template>
  <div class="flex flex-col h-screen bg-slate-50 overflow-hidden">

    <!-- ══════════════════════ HEADER ══════════════════════ -->
    <div class="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="min-w-72">
          <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-base">🏭</span>
            Dashboard Mezcla → Hilo
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">Comparativa de calidad entre lotes — Semáforo de aptitud para Tejeduría</p>
        </div>
        <div class="flex items-end gap-3 flex-wrap ml-auto w-full sm:w-auto">
          <div class="flex-1 min-w-56 sm:w-80">
            <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">
              Lote o lotes a comparar <span class="text-slate-400 normal-case font-normal">(separados por coma)</span>
            </label>
            <input v-model="lotesInput" type="text" placeholder="ej: 107, 108, 109"
              class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
              @keyup.enter="analizar" />
          </div>
          <div class="w-36">
            <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Día dashboard</label>
            <CustomDatepicker
              v-model="fechaCorte"
              :showButtons="false"
              placeholder="Fecha"
            />
          </div>
          <button @click="analizar" :disabled="loading || !lotesInput.trim()"
            class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            :class="loading ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'">
            <span v-if="loading" class="animate-spin inline-block">⟳</span>
            <span v-else>📊</span>
            {{ loading ? 'Consultando...' : 'Comparar' }}
          </button>
          <div v-if="rows.length > 0" class="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg font-mono whitespace-nowrap">
            {{ lotesList.length }} lotes · {{ allNes.length }} título{{allNes.length !== 1 ? 's' : ''}}
          </div>
        </div>
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

      <div v-if="hasData && aptitudUrdimbreActual.length" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span>🚫</span> Aptitud de Urdimbre
            </h2>
            <p class="text-[10px] text-slate-400 mt-0.5">Bloqueo Benninger por Tenacidad + Trabajo B y control de eta contra ventana comparable</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
            Matriz {{ QUALITY_MATRIX_VERSION }}
          </span>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="item in aptitudUrdimbreActual"
            :key="`warp-${item.neDisplay}`"
            class="rounded-xl border p-4"
            :class="item.meta.className">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-bold uppercase tracking-wide">Ne {{ item.neDisplay }}</div>
                <div class="text-sm font-bold mt-1">{{ item.meta.icon }} {{ item.meta.label }}</div>
              </div>
              <span v-if="item.blocked" class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/70 text-red-700 border border-red-200">
                Bloqueado
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 mt-4 text-[11px]">
              <div class="bg-white/70 rounded-lg p-2">
                <div class="text-[9px] uppercase tracking-wider text-slate-400">Tenacidad</div>
                <div class="font-bold">{{ item.tenacidad != null ? item.tenacidad.toFixed(2) : '–' }}</div>
              </div>
              <div class="bg-white/70 rounded-lg p-2">
                <div class="text-[9px] uppercase tracking-wider text-slate-400">Trabajo B</div>
                <div class="font-bold">{{ item.trabajoB != null ? item.trabajoB.toFixed(2) : '–' }}</div>
              </div>
              <div class="bg-white/70 rounded-lg p-2">
                <div class="text-[9px] uppercase tracking-wider text-slate-400">eta</div>
                <div class="font-bold">{{ item.eta != null ? item.eta.toFixed(1) + '%' : '–' }}</div>
              </div>
            </div>

            <div class="mt-3 text-[11px] leading-relaxed">
              <div v-if="item.baselineEta != null">Ref comparable eta: {{ item.baselineEta.toFixed(1) }}%</div>
              <div v-if="item.reasons.includes('trabajo_b')">Trabajo B por debajo de banda de urdimbre.</div>
              <div v-if="item.reasons.includes('tenacidad')">Tenacidad debajo de la reserva mecanica esperada.</div>
              <div v-if="item.reasons.includes('eta')">La fibra rinde peor que la ventana comparable para este Ne.</div>
              <div v-if="!item.reasons.length">Sin desvios relevantes para urdimbre.</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasData && sideImbalanceActual.length" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span>↔️</span> Balance LI/LP Diario
            </h2>
            <p class="text-[10px] text-slate-400 mt-0.5">Comparación por título en thin -30% para detectar lado dominante y desbalance de proceso</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span v-if="sideImbalanceCritCount > 0"
              class="text-[10px] px-2.5 py-1 rounded-full font-bold bg-red-100 text-red-700 animate-pulse">
              🔴 {{ sideImbalanceCritCount }} CRÍTICO{{ sideImbalanceCritCount > 1 ? 'S' : '' }}
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              Corte {{ fmtDateDdMm(fechaCorte) }}
            </span>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="item in sideImbalanceActual"
            :key="`side-${item.neKey}`"
            class="rounded-xl border p-4"
            :class="item.evaluation.state === 'crit'
              ? 'border-red-300 bg-red-50 text-red-800 ring-2 ring-red-400/50 ring-offset-1'
              : item.evaluation.state === 'warn'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : item.evaluation.state === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-500'">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-xs font-bold uppercase tracking-wide">Ne {{ item.neDisplay }}</div>
                <div class="text-[10px] mt-1">Fecha {{ fmtDateDdMm(item.dateKey) }}</div>
              </div>
              <div class="text-sm font-bold">
                {{ item.evaluation.state === 'crit' ? '🔴 Crítico' : item.evaluation.state === 'warn' ? '⚠️ Revisar' : item.evaluation.state === 'ok' ? '✅ Balanceado' : '— Sin dato' }}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-4 text-[11px]">
              <!-- LP box – resaltado si LP es el lado dominante y no está OK -->
              <div class="rounded-lg p-2"
                :class="item.evaluation.dominantSide === 'LP' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato'
                  ? (item.evaluation.state === 'crit' ? 'bg-red-200 ring-1 ring-red-500/60' : 'bg-amber-100 ring-1 ring-amber-400/60')
                  : 'bg-white/70'">
                <div class="text-[9px] uppercase tracking-wider font-semibold"
                  :class="item.evaluation.dominantSide === 'LP' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato' ? 'opacity-100' : 'text-slate-400'">
                  LP thin-30{{ item.evaluation.dominantSide === 'LP' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato' ? ' ▲' : '' }}
                </div>
                <div class="font-bold">{{ item.evaluation.lpThin30 != null ? item.evaluation.lpThin30.toFixed(1) : '–' }}</div>
              </div>
              <!-- LI box – resaltado si LI es el lado dominante y no está OK -->
              <div class="rounded-lg p-2"
                :class="item.evaluation.dominantSide === 'LI' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato'
                  ? (item.evaluation.state === 'crit' ? 'bg-red-200 ring-1 ring-red-500/60' : 'bg-amber-100 ring-1 ring-amber-400/60')
                  : 'bg-white/70'">
                <div class="text-[9px] uppercase tracking-wider font-semibold"
                  :class="item.evaluation.dominantSide === 'LI' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato' ? 'opacity-100' : 'text-slate-400'">
                  LI thin-30{{ item.evaluation.dominantSide === 'LI' && item.evaluation.state !== 'ok' && item.evaluation.state !== 'sin-dato' ? ' ▲' : '' }}
                </div>
                <div class="font-bold">{{ item.evaluation.liThin30 != null ? item.evaluation.liThin30.toFixed(1) : '–' }}</div>
              </div>
            </div>

            <div class="mt-3 text-[11px] leading-relaxed">
              <div class="flex items-center gap-2 flex-wrap">
                <span>Δ thin-30: {{ item.evaluation.deltaPct != null ? item.evaluation.deltaPct.toFixed(1) + '%' : 'S/D' }}</span>
                <!-- Badge lado dominante prominente -->
                <span v-if="item.evaluation.dominantSide && item.evaluation.dominantSide !== 'EQ'"
                  class="text-[11px] font-black px-2 py-0.5 rounded-md tracking-widest leading-tight"
                  :class="item.evaluation.state === 'crit' ? 'bg-red-600 text-white' : item.evaluation.state === 'warn' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'">
                  {{ item.evaluation.dominantSide }}
                </span>
                <span v-else-if="item.evaluation.dominantSide === 'EQ'" class="text-[11px] font-medium text-emerald-600">↔ EQ</span>
              </div>
              <div v-if="item.evaluation.neps140DeltaPct != null" class="mt-1">Δ Neps+140: {{ item.evaluation.neps140DeltaPct.toFixed(1) }}%</div>
            </div>
          </div>
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
            <div class="absolute top-3 right-3 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button v-if="ultimoPromptGemini" @click="copiarPromptGemini"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                :class="promptGeminiCopiado ? 'bg-cyan-100 text-cyan-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'">
                <span>{{ promptGeminiCopiado ? '✓' : '🧠' }}</span>
                {{ promptGeminiCopiado ? 'Prompt copiado' : 'Copiar Prompt' }}
              </button>
              <button v-if="ultimoPayloadNarrativa" @click="copiarPayloadNarrativa"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                :class="payloadNarrativaCopiado ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'">
                <span>{{ payloadNarrativaCopiado ? '✓' : '{}' }}</span>
                {{ payloadNarrativaCopiado ? 'JSON copiado' : 'Copiar JSON' }}
              </button>
              <button @click="copiarNarrativa"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                :class="narrativaCopiada ? 'bg-green-100 text-green-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'">
                <span>{{ narrativaCopiada ? '✓' : '📋' }}</span>
                {{ narrativaCopiada ? '¡Copiado!' : 'Copiar' }}
              </button>
            </div>
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
                <th class="text-center px-3 py-2.5 font-bold" rowspan="2">LI/LP día</th>
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
                <td class="px-3 py-3 text-center text-[10px]">
                  <template v-if="row.sideEval && row.sideEval.state !== 'sin-dato'">
                    <div class="flex flex-col items-center gap-0.5">
                      <span class="text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider leading-tight"
                        :class="row.sideEval.state === 'crit' ? 'bg-red-600 text-white' : row.sideEval.state === 'warn' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'">
                        {{ row.sideEval.dominantSide === 'EQ' ? 'EQ' : row.sideEval.dominantSide || 'S/D' }}
                      </span>
                      <div class="text-[10px] text-slate-500">Δ {{ row.sideEval.deltaPct != null ? row.sideEval.deltaPct.toFixed(1) + '%' : 'S/D' }}</div>
                    </div>
                  </template>
                  <span v-else class="text-slate-300">N/D</span>
                </td>
                <!-- Desvío crítico -->
                <td class="px-3 py-3 text-[10px] max-w-52">
                  <template v-if="row.desvios.length || row.hviAlerts.length || row.sideAlerts.length">
                    <div v-for="d in row.desvios" :key="d.key" class="text-red-600 font-medium">
                      {{ aptDesvioLabel(d.key) }}: {{ d.val != null ? d.val.toFixed(1) : '?' }}
                      {{ d.tipo === 'min' ? '↓ mín' : '↑ máx' }} {{ d.req }}
                    </div>
                    <div v-for="a in row.hviAlerts" :key="a" class="text-amber-600">🌿 {{ a }}</div>
                    <div v-for="a in row.sideAlerts" :key="a" class="text-indigo-600">↔️ {{ a }}</div>
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
import {
  QUALITY_MATRIX_VERSION,
  HVI_ROW_DEFS as SHARED_HVI_ROW_DEFS,
  HILO_ROW_DEFS as SHARED_HILO_ROW_DEFS,
  PROC_VARS,
  getProcVarsForRow,
  getMatrizRequisitos,
  evalUmbral,
  computeEta,
  evaluateBenningerAptitude,
  evaluateSideImbalance,
} from '@shared/qualityMatrix.js'

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
const LS_KEY_FECHA  = 'dmh_fechaCorte'
const loading       = ref(false)
const rows          = ref([])
const proveedores   = ref([])
const sideDaily     = ref([])
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
const promptGeminiCopiado = ref(false)
const payloadNarrativaCopiado = ref(false)
const ultimoPromptGemini = ref('')
const ultimoPayloadNarrativa = ref(null)
const fechaCorte = ref(localStorage.getItem(LS_KEY_FECHA) ?? defaultYesterdayISO())

watch(fechaCorte, async () => {
  localStorage.setItem(LS_KEY_FECHA, fechaCorte.value)
  narrativa.value = ''
  narrativaError.value = ''
  narrativaFuente.value = ''
  narrativaAviso.value = ''
  geminiCuotaDiariaAgotada.value = false
  ultimoPromptGemini.value = ''
  promptGeminiCopiado.value = false
  ultimoPayloadNarrativa.value = null
  payloadNarrativaCopiado.value = false

  // El datepicker en header gobierna el dashboard completo.
  if (rows.value.length > 0 && !loading.value) {
    await analizar()
  }
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

async function copiarPromptGemini() {
  if (!ultimoPromptGemini.value) return
  try {
    await navigator.clipboard.writeText(ultimoPromptGemini.value)
    promptGeminiCopiado.value = true
    setTimeout(() => { promptGeminiCopiado.value = false }, 2500)
  } catch {
    const el = document.createElement('textarea')
    el.value = ultimoPromptGemini.value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    promptGeminiCopiado.value = true
    setTimeout(() => { promptGeminiCopiado.value = false }, 2500)
  }
}

async function copiarPayloadNarrativa() {
  if (!ultimoPayloadNarrativa.value) return
  const payload = JSON.stringify(ultimoPayloadNarrativa.value, null, 2)
  try {
    await navigator.clipboard.writeText(payload)
    payloadNarrativaCopiado.value = true
    setTimeout(() => { payloadNarrativaCopiado.value = false }, 2500)
  } catch {
    const el = document.createElement('textarea')
    el.value = payload
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    payloadNarrativaCopiado.value = true
    setTimeout(() => { payloadNarrativaCopiado.value = false }, 2500)
  }
}

function buildNarrativaPayload(modo) {
  return {
    rows: rows.value,
    proveedores: proveedores.value,
    sideDaily: sideDaily.value,
    cardas: cardasContext.value,
    loteActual: loteActual.value,
    fechaCorte: fechaCorte.value,
    modo,
  }
}

// ── Definición de filas de tabla ──────────────────────────────────────────
const HVI_ROWS = SHARED_HVI_ROW_DEFS
const HILO_ROWS = SHARED_HILO_ROW_DEFS

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

function toDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const br = raw.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{2}|\d{4})/)
  if (br) {
    const dd = br[1].padStart(2, '0')
    const mm = br[2].padStart(2, '0')
    const yy = br[3].length === 2
      ? String((Number(br[3]) >= 70 ? 1900 : 2000) + Number(br[3]))
      : br[3]
    return `${yy}-${mm}-${dd}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function fmtDateDdMm(value) {
  const key = toDateKey(value)
  return key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : 'S/D'
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

const aptitudUrdimbreActual = computed(() => {
  if (!hasData.value || !loteActual.value) return []
  const actual = Number(loteActual.value)
  const hviActual = rows.value.find(r => Number(r.mistura) === actual) || {}
  const strFibraActual = hviActual?.str != null ? parseFloat(hviActual.str) : null
  const urdimbresActuales = rows.value.filter(r => Number(r.mistura) === actual && r.ne != null && parseFloat(r.ne) >= 10)

  return urdimbresActuales.map((row) => {
    const isFlame = parseFlameFlag(row.is_flame)
    const neValue = parseFloat(row.ne)
    const referenceEtas = rows.value
      .filter(r => Number(r.mistura) !== actual && String(r.ne) === String(row.ne) && parseFlameFlag(r.is_flame) === isFlame)
      .map(r => {
        const refHvi = rows.value.find(h => Number(h.mistura) === Number(r.mistura))
        return computeEta(refHvi?.str, r.tenacidad)
      })
      .filter(v => v != null)

    const evaluation = evaluateBenningerAptitude({
      neValue,
      isFlame,
      tenacidad: row.tenacidad,
      trabajoB: row.trabajo_b,
      strFibra: strFibraActual,
      referenceEtas,
    })

    const stateMeta = {
      ok: {
        label: 'Apto urdimbre',
        icon: '✅',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      },
      warn: {
        label: 'Revisar Benninger',
        icon: '⚠️',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      },
      crit: {
        label: evaluation.blocked ? 'Bloqueo Benninger' : 'Riesgo alto',
        icon: evaluation.blocked ? '🚫' : '🔴',
        className: 'border-red-200 bg-red-50 text-red-800',
      },
      na: {
        label: 'No aplica',
        icon: '—',
        className: 'border-slate-200 bg-slate-50 text-slate-500',
      },
    }[evaluation.state] || {
      label: 'Sin dato',
      icon: '?',
      className: 'border-slate-200 bg-slate-50 text-slate-500',
    }

    return {
      neDisplay: formatNeDisplay(row.ne, isFlame),
      tenacidad: row.tenacidad != null ? parseFloat(row.tenacidad) : null,
      trabajoB: row.trabajo_b != null ? parseFloat(row.trabajo_b) : null,
      eta: evaluation.eta,
      baselineEta: evaluation.baselineEta,
      blocked: evaluation.blocked,
      state: evaluation.state,
      reasons: evaluation.reasons,
      meta: stateMeta,
    }
  })
})

const sideImbalanceActual = computed(() => {
  if (!hasData.value || !loteActual.value || !sideDaily.value.length) return []

  const actual = Number(loteActual.value)
  const corteKey = toDateKey(fechaCorte.value)
  const grouped = new Map()

  for (const row of sideDaily.value) {
    if (Number(row.mistura) !== actual) continue
    const side = String(row.side || '').trim().toUpperCase()
    if (side !== 'LI' && side !== 'LP') continue

    const isFlame = parseFlameFlag(row.is_flame)
    const neKey = buildNeKey(row.ne, isFlame)
    const dateKey = toDateKey(row.fecha) || toDateKey(row.fecha_txt)
    if (!dateKey) continue

    const mapKey = `${neKey}|${dateKey}`
    if (!grouped.has(mapKey)) {
      grouped.set(mapKey, {
        neKey,
        ne: row.ne,
        isFlame,
        dateKey,
        fechaTxt: row.fecha_txt || fmtDateDdMm(row.fecha),
        LI: null,
        LP: null,
      })
    }
    grouped.get(mapKey)[side] = row
  }

  const byNe = new Map()
  for (const item of grouped.values()) {
    if (!byNe.has(item.neKey)) byNe.set(item.neKey, [])
    byNe.get(item.neKey).push(item)
  }

  const sideRows = []
  for (const [neKey, entries] of byNe.entries()) {
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    const chosen = (() => {
      if (!corteKey) return entries[entries.length - 1]
      const prevOrEqual = entries.filter(x => x.dateKey <= corteKey)
      return (prevOrEqual.length ? prevOrEqual[prevOrEqual.length - 1] : entries[entries.length - 1])
    })()
    if (!chosen) continue

    const evaluation = evaluateSideImbalance({ left: chosen.LI, right: chosen.LP })
    sideRows.push({
      neKey,
      neDisplay: formatNeDisplay(chosen.ne, chosen.isFlame),
      dateKey: chosen.dateKey,
      fechaTxt: chosen.fechaTxt || fmtDateDdMm(chosen.dateKey),
      evaluation,
      left: chosen.LI,
      right: chosen.LP,
    })
  }

  const severity = { crit: 3, warn: 2, ok: 1, 'sin-dato': 0 }
  return sideRows.sort((a, b) => {
    const d = (severity[b.evaluation?.state] ?? 0) - (severity[a.evaluation?.state] ?? 0)
    if (d !== 0) return d
    return parseFloat(String(b.neDisplay)) - parseFloat(String(a.neDisplay))
  })
})

const sideImbalanceByNeKey = computed(() => {
  const map = new Map()
  for (const item of sideImbalanceActual.value) map.set(item.neKey, item)
  return map
})

const sideImbalanceCritCount = computed(() =>
  sideImbalanceActual.value.filter(i => i.evaluation?.state === 'crit').length
)

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
    const trabajoB = r.trabajo_b != null ? parseFloat(r.trabajo_b) : null
    const strFibra = getHVI(mistura, 'str')
    const neTxt = formatNeDisplay(r.ne, rowIsFlame)
    const cvmWarn = mat?.umb?.cvm?.w ?? (rowIsFlame ? 20.0 : 12.5)
    const cvmCrit = cvmWarn + (rowIsFlame ? 0.8 : 0.6)
    const tenEval = evalUmbral(ten, mat?.umb?.tenacidad)
    const eloEval = evalUmbral(elo, mat?.umb?.elongacion)
    const referenceEtas = rows.value
      .filter(other => Number(other.mistura) !== Number(mistura) && String(other.ne) === String(r.ne) && parseFlameFlag(other.is_flame) === rowIsFlame)
      .map(other => {
        const refStr = getHVI(other.mistura, 'str')
        return computeEta(refStr, other.tenacidad)
      })
      .filter(v => v != null)
    const benningerEval = evaluateBenningerAptitude({
      neValue: neNum,
      isFlame: rowIsFlame,
      tenacidad: ten,
      trabajoB,
      strFibra,
      referenceEtas,
    })

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

    if (benningerEval.state === 'crit') {
      level = 'rojo'
      if (benningerEval.blocked) {
        issues.push(`Ne ${neTxt}: bloqueo Benninger por Tenacidad/Trabajo B fuera de banda.`)
      } else if (benningerEval.reasons.includes('trabajo_b')) {
        issues.push(`Ne ${neTxt}: Trabajo B comprometido para urdimbre/Benninger.`)
      } else if (benningerEval.reasons.includes('eta')) {
        issues.push(`Ne ${neTxt}: eta por debajo de la ventana comparable.`)
      }
    } else if (benningerEval.state === 'warn') {
      if (level === 'verde') level = 'amarillo'
      issues.push(`Ne ${neTxt}: aptitud Benninger en observacion (${benningerEval.reasons.join(', ')}).`)
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
  return {
    cvm: 'CVm%',
    neps_200: 'Neps +200%',
    tenacidad: 'Tenac.',
    elongacion: 'Elong.',
    vellosidad: 'Vell. H',
    side_imbalance: 'Δ LI/LP thin-30',
  }[key] || key
}

const tablaAptitud = computed(() => {
  if (!hasData.value || !loteActual.value) return []
  const actual = Number(loteActual.value)
  const hilos = rows.value.filter(r => Number(r.mistura) === actual && r.ne != null)
  const hvi = rows.value.find(r => Number(r.mistura) === actual) || {}
  const sideMap = sideImbalanceByNeKey.value

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
    const sideRow = sideMap.get(neKey) || null
    const sideEval = sideRow?.evaluation || null

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

    const sideAlerts = []
    if (app.startsWith('Urdimbre') && sideEval && sideEval.state !== 'sin-dato') {
      const dom = sideEval.dominantSide === 'EQ' ? 'equilibrado' : `${sideEval.dominantSide} dominante`
      if (sideEval.state === 'crit') {
        procesos.URDIDORA = 'crit'
        desvios.push({ key: 'side_imbalance', val: sideEval.deltaPct, req: 15, tipo: 'max' })
        sideAlerts.push(`Desbalance crítico ${dom} (Δ ${sideEval.deltaPct?.toFixed(1) || 'S/D'}%).`)
      } else if (sideEval.state === 'warn') {
        if (procesos.URDIDORA !== 'crit') procesos.URDIDORA = 'warn'
        sideAlerts.push(`Desbalance LI/LP en vigilancia ${dom} (Δ ${sideEval.deltaPct?.toFixed(1) || 'S/D'}%).`)
      }
    }

    // Estado global
    const allP = Object.values(procesos)
    const pasador = allP.includes('crit') ? 'rechazado' : (allP.includes('warn') || hviAlerts.length > 0) ? 'condicional' : 'aprobado'

    return {
      ne,
      neDisplay,
      neKey,
      isFlame,
      app,
      dest,
      vals,
      ev,
      procesos,
      pasador,
      desvios,
      hviAlerts,
      sideEval,
      sideAlerts,
      nota: mat?.nota || '',
    }
  })
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
  sideDaily.value = []
  cardasContext.value = null
  narrativa.value = ''
  narrativaError.value = ''
  ultimoPromptGemini.value = ''
  promptGeminiCopiado.value = false
  ultimoPayloadNarrativa.value = null
  payloadNarrativaCopiado.value = false

  try {
    const lotesClean = lotesInput.value.replace(/[^0-9,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, '')
    const params = new URLSearchParams({ lotes: lotesClean })
    if (fechaCorte.value) params.set('fecha', fechaCorte.value)

    const res = await fetch(`/api/dashboard/mezcla-lotes?${params}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al obtener datos')
    rows.value = data.rows || []
    proveedores.value = data.proveedores || []
    sideDaily.value = data.sideDaily || []
    cardasContext.value = data.cardas || null
  } catch (err) {
    console.error('[DashboardMezclaHilo]', err)
    rows.value = []
    sideDaily.value = []
    cardasContext.value = null
  } finally {
    loading.value = false
  }
}

async function generarNarrativa(soloLocal = false, forzar = false) {
  if (loadingNarrativa.value || !rows.value.length) return
  const usarLocal = soloLocal || modoLocalAutomatico.value
  const payload = buildNarrativaPayload(usarLocal ? 'local' : 'gemini')
  ultimoPromptGemini.value = ''
  promptGeminiCopiado.value = false
  ultimoPayloadNarrativa.value = payload
  payloadNarrativaCopiado.value = false

  // ── Caché: solo para llamadas Gemini, no locales ni forzadas ──
  const cachePayload = payload
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
        ultimoPromptGemini.value = typeof c.promptGemini === 'string' ? c.promptGemini : ''
        promptGeminiCopiado.value = false
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
      body: JSON.stringify(usarLocal ? payload : { ...payload, modo: undefined })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al generar')
    narrativa.value = data.narrativa
    narrativaFuente.value = data.fuente || 'local'
    narrativaAviso.value = data.aviso || ''
    ultimoPromptGemini.value = typeof data.promptGemini === 'string' ? data.promptGemini : ''
    promptGeminiCopiado.value = false
    geminiCuotaDiariaAgotada.value = data.geminiEstado === 'quota-daily' || /l[ií]mite diario|20\/d[ií]a/i.test(data.aviso || '')
    if ((data.fuente === 'local') && (/gemini no disponible|l[ií]mite diario/i.test(data.aviso || ''))) {
      modoLocalAutomatico.value = true
    } else if (data.fuente === 'gemini') {
      modoLocalAutomatico.value = false
      geminiCuotaDiariaAgotada.value = false
    }

    // Guardar en caché solo si respondió Gemini
    if (!usarLocal && data.fuente === 'gemini') {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          narrativa: data.narrativa,
          promptGemini: ultimoPromptGemini.value,
        }))
      } catch { /* cuota LS */ }
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
