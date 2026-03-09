<template>
  <div class="benninger-impact min-h-screen p-4 md:p-6">
    <div class="mx-auto max-w-7xl space-y-6">
      <header class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-xl">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <label for="partida" class="text-xs uppercase tracking-[0.12em] text-slate-300">Partida</label>
            <input
              id="partida"
              v-model="partidaInput"
              type="text"
              maxlength="7"
              class="w-[10ch] rounded-lg border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
              @keydown.enter.prevent="applyPartidaFilter"
            />
            <button
              class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
              :disabled="loading"
              @click="applyPartidaFilter"
            >
              {{ loading ? 'Cargando...' : 'Cargar' }}
            </button>
          </div>

          <p class="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Analisis Benninger</p>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <span class="header-chip"><span class="text-slate-400">Partida activa:</span> {{ matchInfo?.partida || '-' }}</span>
          <span class="header-chip"><span class="text-slate-400">Lotes:</span> {{ matchLotesLabel }}</span>
          <span class="header-chip"><span class="text-slate-400">Uster:</span> {{ referencias?.uster?.testnr || '-' }}</span>
          <span class="header-chip"><span class="text-slate-400">TensoRapid:</span> {{ referencias?.tensorapid?.testnr || '-' }}</span>
        </div>

        <p v-if="errorMessage" class="mt-3 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {{ errorMessage }}
        </p>

        <div class="mt-4">
          <button
            class="rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 hover:border-cyan-400"
            @click="showTechnicalDetails = !showTechnicalDetails"
          >
            {{ showTechnicalDetails ? 'Ocultar Detalles Tecnicos' : 'Ver Detalles Tecnicos' }}
          </button>

          <div v-if="showTechnicalDetails" class="mt-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm font-medium text-slate-200">Mapa Tecnico de Variables</p>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <p><span class="text-slate-400">Estiraje aplicado:</span> 1S034</p>
              <p><span class="text-slate-400">Humedad de salida:</span> 1S068</p>
              <p><span class="text-slate-400">Tension plegador:</span> 1S054</p>
              <p><span class="text-slate-400">Goma real:</span> 1A41</p>
              <p><span class="text-slate-400">Velocidad:</span> 1S102</p>
              <p><span class="text-slate-400">Presion exprimido:</span> 1S086</p>
            </div>

            <p class="mt-4 text-sm font-medium text-slate-200">Objeto JSON de Entrada</p>
            <pre class="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-cyan-200">{{ jsonPreview }}</pre>
          </div>
        </div>
      </header>

      <section class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <div class="xl:w-full">
          <ExpertDiagnosis
            class="h-full"
            :partida="matchInfo?.partida || partidaInput"
            :mic="laboratorio.mic"
            :presion-exprimido="proceso.presionExprimido"
            :tenacidad="laboratorio.tenacidad"
            :elongacion-residual="elongacionResidual"
            :humedad-salida="proceso.humedadSalida"
            :tension-plegador="proceso.tensionPlegador"
            :tension-timeline="proceso.tensionTimeline"
            :aml-cel="proceso.amlCel"
            :aml-detail-events="amlDetailEvents"
          />
        </div>

        <article class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg xl:w-full">
          <h2 class="text-lg font-semibold text-slate-100">Barra Progresiva Apilada</h2>
          <p class="mt-1 text-xs text-slate-300">Total de barra = Elongacion Inicial del laboratorio (100%)</p>

          <div class="mt-4 space-y-2">
            <div class="h-5 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-950">
              <div class="flex h-full w-full">
                <div class="segment segment-estiraje" :style="{ width: `${stackedPct.danio}%` }"></div>
                <div class="segment segment-residual" :style="{ width: `${stackedPct.residual}%` }"></div>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div class="legend-chip"><span class="dot dot-inicial"></span> Total (Elongacion Inicial): {{ formatNumber(laboratorio.elongacionInicial, 2) }}%</div>
              <div class="legend-chip"><span class="dot dot-estiraje"></span> Dano por estiraje: {{ formatNumber(proceso.stretchAplicado, 2) }}%</div>
              <div class="legend-chip"><span class="dot dot-residual"></span> Residual real: {{ formatNumber(elongacionResidual, 2) }}%</div>
            </div>
          </div>

          <div class="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm font-medium text-slate-200">Insight de Aptitud</p>
            <p class="mt-2 text-sm" :class="residualTextClass">
              {{ residualMessage }}
            </p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-6">
        <article class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <h2 class="text-lg font-semibold text-slate-100">1. Header de Salud del Lote</h2>
            <span class="str-badge">
              STR fibra (HVI):
              <strong class="text-slate-100 ml-1">{{ Number.isFinite(parseNumber(laboratorio.str)) ? formatNumber(laboratorio.str, 2) : 'N/D' }}</strong>
            </span>
          </div>
          <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="kpi-card">
              <p class="kpi-label">Elongacion (TensoRapid)</p>
              <p class="kpi-value">{{ formatNumber(laboratorio.elongacionInicial, 2) }}%</p>
            </div>
            <div class="kpi-card">
              <p class="kpi-label">CVm (Uster)</p>
              <p class="kpi-value">{{ formatNumber(laboratorio.cvm, 2) }}%</p>
            </div>
            <div class="kpi-card" :class="tenacidadBadge.className">
              <p class="kpi-label">Tenacidad del Hilo (TensoRapid)</p>
              <p class="kpi-value" :class="tenacidadBadge.textClass">
                {{ tenacidadBadge.showValue ? `${formatNumber(tenacidadBadge.value, 2)} cN/tex` : tenacidadBadge.label }}
              </p>
              <p v-if="tenacidadBadge.showValue" class="mt-1 text-xs" :class="tenacidadBadge.textClass">{{ tenacidadBadge.label }}</p>
            </div>
          </div>

          <div class="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm font-medium text-slate-200">Radar de Potencial de Hilo</p>
            <div class="mt-3 h-72">
              <Radar :data="radarData" :options="radarOptions" />
            </div>
          </div>
        </article>
      </section>

      <section class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
        <h2 class="text-lg font-semibold text-slate-100">2. Analisis de Agresion Mecanica</h2>

        <div class="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <p class="text-sm font-medium text-slate-200">Widget Elongacion Residual (Corazon del Analisis)</p>
            <span class="text-xs font-semibold px-3 py-1 rounded-full" :class="residualBadgeClass">
              Residual {{ formatNumber(elongacionResidual, 2) }}%
            </span>
          </div>

          <div class="mt-3 h-6 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-900">
            <div class="flex h-full">
              <div class="segment segment-estiraje" :style="{ width: `${residualBarPct.estiraje}%` }"></div>
              <div
                class="segment"
                :class="residualSegmentClass"
                :style="{ width: `${residualBarPct.residual}%` }"
              ></div>
            </div>
          </div>
          <div class="mt-2 text-xs text-slate-300">
            Base laboratorio: {{ formatNumber(laboratorio.elongacionInicial, 2) }}% | Estiraje consumido: {{ formatNumber(proceso.stretchAplicado, 2) }}%
          </div>
        </div>

        <div class="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <p class="text-sm font-medium text-slate-200">Timeline de Tension (M12...S800 Plegador)</p>
          <div class="mt-3 h-80">
            <Line :data="timelineData" :options="timelineOptions" />
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <article class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
          <h2 class="text-lg font-semibold text-slate-100">3. Panel Quimico y Humedad</h2>

          <div class="mt-4 gauge-wrap rounded-xl border border-slate-700 bg-slate-950/80 p-4">
            <p class="text-sm font-medium text-slate-200">Gauge Humedad de Salida</p>
            <div class="mt-4 gauge-shell">
              <div class="gauge-ring"></div>
              <div class="gauge-needle" :style="{ transform: `translateX(-50%) rotate(${humedadNeedleDeg}deg)` }"></div>
              <div class="gauge-center"></div>
              <div class="gauge-value" :class="isHumedadCritica ? 'text-rose-300' : 'text-emerald-300'">
                {{ formatNumber(proceso.humedadSalida, 2) }}%
              </div>
            </div>
            <p class="mt-3 text-sm" :class="isHumedadCritica ? 'text-rose-300' : 'text-slate-300'">
              {{ isHumedadCritica ? 'Hilo Fragil/Cristalizado: humedad en 6.0% o menos.' : 'Humedad en rango operativo.' }}
            </p>
          </div>

          <div class="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm font-medium text-slate-200">Relacion MIC vs Presion</p>
            <table class="mt-3 w-full text-sm">
              <tbody>
                <tr class="border-b border-slate-700/70">
                  <td class="py-2 text-slate-300">MIC (laboratorio)</td>
                  <td class="py-2 text-right font-semibold text-slate-100">{{ formatNumber(laboratorio.mic, 2) }}</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-300">Presion exprimido (kN)</td>
                  <td class="py-2 text-right font-semibold text-slate-100">{{ formatNumber(proceso.presionExprimido, 1) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="mt-3 text-sm" :class="micPressureRisk ? 'text-amber-300' : 'text-emerald-300'">
              {{ micPressureInsight }}
            </p>
          </div>
        </article>

        <article class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
          <h2 class="text-lg font-semibold text-slate-100">Tabla de KPIs Clave</h2>
          <p class="mt-1 text-xs text-slate-300">Alertas de calidad calculadas con computed properties</p>

          <div class="mt-4 overflow-hidden rounded-xl border border-slate-700">
            <table class="w-full text-sm">
              <thead class="bg-slate-800/80 text-slate-200">
                <tr>
                  <th class="px-3 py-2 text-left">KPI</th>
                  <th class="px-3 py-2 text-right">Valor</th>
                  <th class="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody class="bg-slate-950/60">
                <tr class="border-t border-slate-800">
                  <td class="px-3 py-2 text-slate-300">Humedad de salida</td>
                  <td class="px-3 py-2 text-right font-semibold" :class="isHumedadCritica ? 'text-rose-300' : 'text-slate-100'">
                    {{ formatNumber(proceso.humedadSalida, 2) }}%
                  </td>
                  <td class="px-3 py-2" :class="isHumedadCritica ? 'text-rose-300' : 'text-emerald-300'">
                    {{ isHumedadCritica ? '⚠️ CRITICO/SECO' : 'OK' }}
                  </td>
                </tr>
                <tr class="border-t border-slate-800">
                  <td class="px-3 py-2 text-slate-300">Tension plegador</td>
                  <td class="px-3 py-2 text-right font-semibold" :class="isTensionCritica ? 'text-rose-300' : 'text-slate-100'">
                    {{ formatNumber(proceso.tensionPlegador, 0) }} N
                  </td>
                  <td class="px-3 py-2" :class="isTensionCritica ? 'text-rose-300' : 'text-emerald-300'">
                    {{ isTensionCritica ? 'Critico (> 3200N)' : 'OK' }}
                  </td>
                </tr>
                <tr class="border-t border-slate-800">
                  <td class="px-3 py-2 text-slate-300">Aplicacion de goma</td>
                  <td class="px-3 py-2 text-right font-semibold text-slate-100">{{ formatNumber(proceso.gomaReal, 2) }}%</td>
                  <td class="px-3 py-2 text-slate-300">Monitoreo</td>
                </tr>
                <tr class="border-t border-slate-800">
                  <td class="px-3 py-2 text-slate-300">Velocidad de linea</td>
                  <td class="px-3 py-2 text-right font-semibold text-slate-100">{{ formatNumber(proceso.velocidad, 1) }} m/min</td>
                  <td class="px-3 py-2 text-slate-300">Monitoreo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <!-- DICTAMEN DE INGENIERIA -->
      <section class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <h2 class="text-lg font-semibold text-slate-100">4. Dictamen de Ingenieria</h2>
          <div class="flex items-center gap-3 rounded-xl border px-4 py-2" :class="dictamenBannerClass">
            <span class="text-xl">{{ dictamenGlobal.emoji }}</span>
            <div>
              <p class="text-sm font-bold" :class="dictamenTextClass">{{ dictamenGlobal.estado }}</p>
              <p class="text-xs text-slate-400">Partida: {{ matchInfo?.partida || '-' }}</p>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Pilar Integridad -->
          <div class="rounded-xl border p-4" :class="pillarBorderClass(failurePillars.integridad.riesgo)">
            <div class="flex items-center gap-2">
              <span class="text-lg">🧵</span>
              <h3 class="text-sm font-semibold text-slate-100">Falla de Integridad</h3>
              <span class="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" :class="zoneRiskClass(failurePillars.integridad.riesgo)">
                {{ riesgoLabel(failurePillars.integridad.riesgo) }}
              </span>
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-slate-300">
              <p><span class="text-slate-400">Paradas registradas:</span> <strong :class="failurePillars.integridad.paradas > 0 ? 'text-rose-300' : 'text-slate-100'">{{ failurePillars.integridad.paradas }}</strong></p>
              <p><span class="text-slate-400">Ciclos vel. lenta:</span> <strong class="text-slate-100">{{ failurePillars.integridad.velocidadLenta }}x</strong></p>
              <p><span class="text-slate-400">Tension maxima:</span> <strong :class="failurePillars.integridad.maxTension > 3200 ? 'text-rose-300' : 'text-slate-100'">{{ formatNumber(failurePillars.integridad.maxTension, 0) }} N</strong></p>
              <p><span class="text-slate-400">Elongacion residual:</span> <strong :class="residualTextClass">{{ formatNumber(elongacionResidual, 2) }}%</strong></p>
            </div>
            <div class="mt-3 rounded-lg bg-slate-950/70 px-3 py-2">
              <p class="text-xs" :class="pillarTextClass(failurePillars.integridad.riesgo)">{{ failurePillars.integridad.impacto }}</p>
            </div>
          </div>

          <!-- Pilar Proteccion -->
          <div class="rounded-xl border p-4" :class="pillarBorderClass(failurePillars.proteccion.riesgo)">
            <div class="flex items-center gap-2">
              <span class="text-lg">🛡️</span>
              <h3 class="text-sm font-semibold text-slate-100">Falla de Proteccion</h3>
              <span class="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" :class="zoneRiskClass(failurePillars.proteccion.riesgo)">
                {{ riesgoLabel(failurePillars.proteccion.riesgo) }}
              </span>
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-slate-300">
              <p><span class="text-slate-400">Alertas S500 goma:</span> <strong :class="failurePillars.proteccion.gomaCount > 0 ? 'text-amber-300' : 'text-slate-100'">{{ failurePillars.proteccion.gomaCount }}</strong></p>
              <p><span class="text-slate-400">Eventos S800:</span> <strong class="text-slate-100">{{ failurePillars.proteccion.s800Count }}</strong></p>
              <p><span class="text-slate-400">Goma aplicada real:</span> <strong class="text-slate-100">{{ formatNumber(proceso.gomaReal, 2) }}%</strong></p>
              <p><span class="text-slate-400">Goma objetivo:</span> <strong class="text-slate-100">{{ formatNumber(proceso.gomaObjetivo, 2) }}%</strong></p>
            </div>
            <div class="mt-3 rounded-lg bg-slate-950/70 px-3 py-2">
              <p class="text-xs" :class="pillarTextClass(failurePillars.proteccion.riesgo)">{{ failurePillars.proteccion.impacto }}</p>
            </div>
          </div>

          <!-- Pilar Estetica -->
          <div class="rounded-xl border p-4" :class="pillarBorderClass(failurePillars.estetica.riesgo)">
            <div class="flex items-center gap-2">
              <span class="text-lg">🎨</span>
              <h3 class="text-sm font-semibold text-slate-100">Falla Estetica</h3>
              <span class="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" :class="zoneRiskClass(failurePillars.estetica.riesgo)">
                {{ riesgoLabel(failurePillars.estetica.riesgo) }}
              </span>
            </div>
            <div class="mt-3 space-y-1.5 text-xs text-slate-300">
              <p><span class="text-slate-400">Humedad salida:</span> <strong :class="isHumedadCritica ? 'text-rose-300' : 'text-slate-100'">{{ formatNumber(proceso.humedadSalida, 1) }}%</strong></p>
              <p><span class="text-slate-400">Presion exprimido:</span> <strong :class="proceso.presionExprimido > 90 ? 'text-amber-300' : 'text-slate-100'">{{ formatNumber(proceso.presionExprimido, 1) }} kN</strong></p>
              <p><span class="text-slate-400">MIC fibra:</span> <strong class="text-slate-100">{{ formatNumber(laboratorio.mic, 2) }}</strong></p>
              <p><span class="text-slate-400">Estiraje aplicado:</span> <strong class="text-slate-100">{{ formatNumber(proceso.stretchAplicado, 2) }}%</strong></p>
            </div>
            <div class="mt-3 rounded-lg bg-slate-950/70 px-3 py-2">
              <p class="text-xs" :class="pillarTextClass(failurePillars.estetica.riesgo)">{{ failurePillars.estetica.impacto }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- MAPA DE METROS CRITICOS -->
      <section class="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-lg">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-100">5. Mapa de Metros Criticos</h2>
            <p class="mt-1 text-xs text-slate-300">Distribucion de eventos AML por segmento — eje del analisis de riesgo en telar</p>
          </div>
          <span v-if="loadingAml" class="text-xs text-slate-400 animate-pulse">Cargando eventos...</span>
          <span v-else-if="amlDetailEvents.length" class="text-xs text-slate-400">{{ amlDetailEvents.length }} eventos AML</span>
        </div>

        <div v-if="meterZones.length" class="mt-5 overflow-x-auto rounded-xl border border-slate-700">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="bg-slate-800/80 text-slate-200">
              <tr>
                <th class="px-3 py-2.5 text-left font-semibold">Zona (m restantes)</th>
                <th class="px-3 py-2.5 text-center font-semibold">Riesgo en Telar</th>
                <th class="px-3 py-2.5 text-center font-semibold">Paradas</th>
                <th class="px-3 py-2.5 text-center font-semibold">Goma (S500)</th>
                <th class="px-3 py-2.5 text-center font-semibold">Eventos</th>
                <th class="px-3 py-2.5 text-left font-semibold">Causa Raiz</th>
                <th class="px-3 py-2.5 text-left font-semibold">Recomendacion Operativa</th>
              </tr>
            </thead>
            <tbody class="bg-slate-950/60 divide-y divide-slate-800">
              <tr
                v-for="z in meterZones"
                :key="`${z.lo}-${z.hi}`"
                :class="z.riesgo === 'muy_alto' ? 'bg-rose-950/20' : z.riesgo === 'alto' ? 'bg-amber-950/10' : ''"
              >
                <td class="px-3 py-2.5 font-mono text-sm text-slate-200 whitespace-nowrap">{{ z.lo }} – {{ z.hi }} m</td>
                <td class="px-3 py-2.5 text-center">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="zoneRiskClass(z.riesgo)">
                    {{ riesgoEmoji(z.riesgo) }} {{ riesgoLabel(z.riesgo) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-center font-bold" :class="z.paradas > 0 ? 'text-rose-300' : 'text-slate-600'">{{ z.paradas || '—' }}</td>
                <td class="px-3 py-2.5 text-center font-bold" :class="z.goma > 0 ? 'text-amber-300' : 'text-slate-600'">{{ z.goma || '—' }}</td>
                <td class="px-3 py-2.5 text-center text-slate-400 text-xs">{{ z.total }}</td>
                <td class="px-3 py-2.5 text-xs text-cyan-300/80">{{ z.causaRaiz }}</td>
                <td class="px-3 py-2.5 text-xs" :class="zoneRecoClass(z.riesgo)">{{ z.recomendacion }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else-if="!loadingAml && partidaInput" class="mt-4 text-sm text-slate-400">Sin eventos AML detallados para esta partida.</p>
        <p v-else-if="!loadingAml" class="mt-4 text-sm text-slate-500">Ingrese una partida para cargar el mapa de metros.</p>

        <!-- Visual bar strip -->
        <div v-if="meterZones.length" class="mt-5">
          <p class="text-xs text-slate-400 mb-2">Vista rapida — barra de riesgo por metro</p>
          <div class="flex h-6 w-full rounded-full overflow-hidden border border-slate-700 gap-px">
            <div
              v-for="z in meterZones"
              :key="`bar-${z.lo}`"
              :title="`${z.lo}-${z.hi}m: ${riesgoLabel(z.riesgo)} (${z.total} eventos)`"
              :style="{ flex: String(z.hi - z.lo) }"
              :class="zoneBarClass(z.riesgo)"
            ></div>
          </div>
          <div class="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>0 m</span>
            <span class="text-slate-400 text-[10px] tracking-wide">← metros restantes →</span>
            <span>{{ meterZones[meterZones.length - 1]?.hi || '' }} m</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Radar, Line } from 'vue-chartjs'
import ExpertDiagnosis from './ExpertDiagnosis.vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const route = useRoute()
const router = useRouter()

const defaultDataModel = {
  laboratorio: {
    elongacionInicial: null,
    cvm: null,
    tenacidad: null,
    neps: null,
    sci: null,
    mic: null,
    str: null,
    uhml: null,
    elg: null,
    rd: null,
    plusB: null
  },
  proceso: {
    stretchAplicado: null,
    humedadSalida: null,
    tensionPlegador: null,
    gomaReal: null,
    velocidad: null,
    presionExprimido: null,
    amlCel: {
      total: 0,
      aml: 0,
      cel: 0,
      riesgo: 'bajo',
      codigos: [],
      recurrentes: [],
      eventos: []
    },
    tensionTimeline: []
  }
}

const dataModel = ref(cloneDefaultDataModel())
const loading = ref(false)
const errorMessage = ref('')
const loadedSourceFile = ref('')
const partidaInput = ref('')
const matchInfo = ref(null)
const referencias = ref(null)
const showTechnicalDetails = ref(false)
const amlDetailEvents = ref([])
const loadingAml = ref(false)

const laboratorio = computed(() => dataModel.value.laboratorio)
const proceso = computed(() => dataModel.value.proceso)
const matchLotesLabel = computed(() => {
  const lotes = Array.isArray(matchInfo.value?.lotesFiacion) ? matchInfo.value.lotesFiacion : []
  return lotes.length ? lotes.join(', ') : '-'
})

const elongacionResidual = computed(() => {
  const residual = Number(laboratorio.value.elongacionInicial || 0) - Number(proceso.value.stretchAplicado || 0)
  return Number(residual.toFixed(3))
})

const isHumedadCritica = computed(() => Number(proceso.value.humedadSalida || 0) <= 6)
const isTensionCritica = computed(() => Number(proceso.value.tensionPlegador || 0) > 3200)
const residualLevel = computed(() => {
  const residual = Number(elongacionResidual.value || 0)
  if (residual > 5) return 'ok'
  if (residual >= 4) return 'warning'
  return 'critical'
})
const residualTextClass = computed(() => {
  if (residualLevel.value === 'ok') return 'text-emerald-300'
  if (residualLevel.value === 'warning') return 'text-amber-300'
  return 'text-rose-300'
})
const residualBadgeClass = computed(() => {
  if (residualLevel.value === 'ok') return 'bg-emerald-500/20 text-emerald-200'
  if (residualLevel.value === 'warning') return 'bg-amber-500/20 text-amber-200'
  return 'bg-rose-500/20 text-rose-200'
})
const residualSegmentClass = computed(() => {
  if (residualLevel.value === 'ok') return 'segment-residual-ok'
  if (residualLevel.value === 'warning') return 'segment-residual-warn'
  return 'segment-residual-risk'
})

const tenacidadBadge = computed(() => {
  const tenacidad = parseNumber(laboratorio.value.tenacidad)
  if (!Number.isFinite(tenacidad)) {
    return {
      label: 'Dato no disponible',
      className: 'kpi-neutral',
      textClass: 'text-slate-200',
      showValue: false,
      value: null
    }
  }
  if (tenacidad >= 16.5) return { label: 'Excelente', className: 'kpi-good', textClass: 'text-emerald-200', showValue: true, value: tenacidad }
  if (tenacidad >= 15.5) return { label: 'Aceptable', className: 'kpi-warn', textClass: 'text-amber-200', showValue: true, value: tenacidad }
  return { label: 'Riesgo de rotura', className: 'kpi-bad', textClass: 'text-rose-200', showValue: true, value: tenacidad }
})

const residualMessage = computed(() => {
  if (residualLevel.value === 'ok') {
    if (isHumedadCritica.value) {
      return 'Reserva elastica saludable, pero amenazada por baja hidratacion.'
    }
    return 'La reserva elastica del hilo se mantiene en zona saludable.'
  }
  if (residualLevel.value === 'warning') {
    if (isHumedadCritica.value) {
      return 'Reserva elastica en precaucion y con hidratacion critica; riesgo combinado para tejeduria.'
    }
    return 'Reserva elastica en zona de precaucion. Requiere seguimiento cercano en tejeduria.'
  }
  if (isHumedadCritica.value) {
    return 'Reserva elastica critica y humedad seca. Riesgo muy alto de rotura y paro de telar.'
  }
  return 'Reserva elastica critica. Riesgo alto de rotura y paro de telar.'
})

const stackedPct = computed(() => {
  const total = Math.max(0, Number(laboratorio.value.elongacionInicial || 0))
  const danio = Math.min(Math.max(0, Number(proceso.value.stretchAplicado || 0)), total)
  const residual = Math.max(0, total - danio)

  if (total <= 0) {
    return { danio: 0, residual: 0 }
  }

  return {
    danio: Number(((danio / total) * 100).toFixed(2)),
    residual: Number(((residual / total) * 100).toFixed(2))
  }
})

const residualBarPct = computed(() => {
  const total = Math.max(0, Number(laboratorio.value.elongacionInicial || 0))
  if (total <= 0) {
    return { estiraje: 0, residual: 0 }
  }

  const estiraje = Math.min(Math.max(0, Number(proceso.value.stretchAplicado || 0)), total)
  const residual = Math.max(0, total - estiraje)

  return {
    estiraje: Number(((estiraje / total) * 100).toFixed(2)),
    residual: Number(((residual / total) * 100).toFixed(2))
  }
})

const humedadNeedleDeg = computed(() => {
  const hum = Number(proceso.value.humedadSalida || 0)
  const clamped = Math.max(0, Math.min(12, hum))
  return Number(((clamped / 12) * 180 - 90).toFixed(2))
})

const micPressureRisk = computed(() => {
  const mic = Number(laboratorio.value.mic || 0)
  const pressure = Number(proceso.value.presionExprimido || 0)
  return mic >= 4.6 && pressure >= 70
})

const micPressureInsight = computed(() => {
  if (micPressureRisk.value) {
    return 'Aviso: MIC alto + Presion alta = riesgo de pobre penetracion de color.'
  }
  return 'Relacion MIC/Presion en zona controlada para Indigo.'
})

const radarScores = computed(() => {
  const tenacidadScore = Math.min(100, (Number(laboratorio.value.tenacidad || 0) / 35) * 100)
  const elongacionScore = Math.min(100, (Number(laboratorio.value.elongacionInicial || 0) / 12) * 100)
  const neps = Number(laboratorio.value.neps || 0)
  const limpiezaScore = Math.max(0, Math.min(100, 100 - (neps / 2.5)))
  return [tenacidadScore, elongacionScore, limpiezaScore].map((v) => Number(v.toFixed(2)))
})

const radarData = computed(() => ({
  labels: ['Tenacidad', 'Elongacion', 'Limpieza (Neps)'],
  datasets: [
    {
      label: 'Perfil de hilo',
      data: radarScores.value,
      borderColor: '#22d3ee',
      backgroundColor: 'rgba(34, 211, 238, 0.18)',
      pointBackgroundColor: '#67e8f9',
      pointBorderColor: '#0f172a',
      borderWidth: 2
    }
  ]
}))

const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#cbd5e1' }
    }
  },
  scales: {
    r: {
      min: 0,
      max: 100,
      ticks: {
        color: '#94a3b8',
        backdropColor: 'transparent',
        stepSize: 20
      },
      pointLabels: {
        color: '#e2e8f0'
      },
      grid: {
        color: 'rgba(148, 163, 184, 0.25)'
      },
      angleLines: {
        color: 'rgba(148, 163, 184, 0.25)'
      }
    }
  }
}

const timelineData = computed(() => ({
  labels: (proceso.value.tensionTimeline || []).map((p) => p.punto),
  datasets: [
    {
      label: 'Tension (N)',
      data: (proceso.value.tensionTimeline || []).map((p) => p.tensionN),
      borderColor: '#fb7185',
      backgroundColor: 'rgba(251, 113, 133, 0.2)',
      pointBackgroundColor: '#fda4af',
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.3,
      fill: true
    },
    {
      label: 'Umbral 3200N',
      data: (proceso.value.tensionTimeline || []).map(() => 3200),
      borderColor: 'rgba(248, 113, 113, 0.55)',
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false
    }
  ]
}))

const timelineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#cbd5e1' }
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: {
    x: {
      ticks: { color: '#cbd5e1' },
      grid: { color: 'rgba(148, 163, 184, 0.18)' }
    },
    y: {
      ticks: { color: '#cbd5e1' },
      grid: { color: 'rgba(148, 163, 184, 0.18)' },
      beginAtZero: false
    }
  }
}

const jsonPreview = computed(() => JSON.stringify(dataModel.value, null, 2))

watch(
  () => route.query.partida,
  async () => {
    const partida = getRoutePartida()
    partidaInput.value = partida
    await fetchImpactData(partida)
  },
  { immediate: true }
)

function cloneDefaultDataModel() {
  return {
    laboratorio: { ...defaultDataModel.laboratorio },
    proceso: {
      ...defaultDataModel.proceso,
      tensionTimeline: []
    }
  }
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeTimeline(timeline) {
  if (!Array.isArray(timeline)) return []
  return timeline
    .map((item) => {
      const punto = String(item?.punto || '').trim()
      const tensionN = parseNumber(item?.tensionN)
      if (!punto || !Number.isFinite(tensionN)) return null
      return { punto, tensionN }
    })
    .filter(Boolean)
}

function normalizeAmlCel(input) {
  const source = input && typeof input === 'object' ? input : {}
  const eventosSource = Array.isArray(source.eventos) ? source.eventos : []
  const recurrentesSource = Array.isArray(source.recurrentes) ? source.recurrentes : []
  const codigosSource = Array.isArray(source.codigos) ? source.codigos : []

  const eventos = eventosSource
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const tipo = String(row.tipo || '').trim().toUpperCase() || null
      const codigo = String(row.codigo || '').trim().toUpperCase() || null
      const detalle = String(row.detalle || '').trim() || null
      const timestamp = String(row.timestamp || '').trim() || null
      const severidad = String(row.severidad || '').trim().toLowerCase() || 'medio'
      if (!tipo && !codigo && !detalle) return null
      return { tipo, codigo, detalle, timestamp, severidad }
    })
    .filter(Boolean)

  const recurrentes = recurrentesSource
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const codigo = String(row.codigo || '').trim().toUpperCase()
      const count = parseNumber(row.count)
      if (!codigo || !Number.isFinite(count)) return null
      return { codigo, count: Number(count) }
    })
    .filter(Boolean)

  return {
    total: Number.isFinite(parseNumber(source.total)) ? Number(source.total) : eventos.length,
    aml: Number.isFinite(parseNumber(source.aml)) ? Number(source.aml) : eventos.filter((e) => e.tipo === 'AML').length,
    cel: Number.isFinite(parseNumber(source.cel)) ? Number(source.cel) : eventos.filter((e) => e.tipo === 'CEL').length,
    riesgo: String(source.riesgo || 'bajo').toLowerCase(),
    codigos: codigosSource.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean),
    recurrentes,
    eventos
  }
}

function normalizeApiPayload(payload) {
  const lab = payload?.laboratorio && typeof payload.laboratorio === 'object' ? payload.laboratorio : {}
  const proc = payload?.proceso && typeof payload.proceso === 'object' ? payload.proceso : {}

  return {
    laboratorio: {
      elongacionInicial: parseNumber(lab.elongacionInicial),
      cvm: parseNumber(lab.cvm),
      tenacidad: parseNumber(lab.tenacidad),
      neps: parseNumber(lab.neps),
      sci: parseNumber(lab.sci),
      mic: parseNumber(lab.mic),
      str: parseNumber(lab.str),
      uhml: parseNumber(lab.uhml),
      elg: parseNumber(lab.elg),
      rd: parseNumber(lab.rd),
      plusB: parseNumber(lab.plusB)
    },
    proceso: {
      stretchAplicado: parseNumber(proc.stretchAplicado),
      humedadSalida: parseNumber(proc.humedadSalida),
      tensionPlegador: parseNumber(proc.tensionPlegador),
      gomaReal: parseNumber(proc.gomaReal),
      velocidad: parseNumber(proc.velocidad),
      presionExprimido: parseNumber(proc.presionExprimido),
      amlCel: normalizeAmlCel(proc.amlCel),
      tensionTimeline: normalizeTimeline(proc.tensionTimeline)
    }
  }
}

function getRoutePartida() {
  const raw = route.query?.partida
  if (Array.isArray(raw)) return String(raw[0] || '').trim()
  return String(raw || '').trim()
}

async function fetchImpactData(partida) {
  loading.value = true
  errorMessage.value = ''

  const url = partida
    ? `/api/benninger-impacto?partida=${encodeURIComponent(partida)}`
    : '/api/benninger-impacto'

  try {
    const response = await fetch(url)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Error ${response.status}`)
    }

    dataModel.value = normalizeApiPayload(payload)
    loadedSourceFile.value = String(payload?.sourceFile || '')
    matchInfo.value = payload?.match || null
    referencias.value = payload?.referencias || null
    fetchAmlDetailLogs(partida)
  } catch (err) {
    dataModel.value = cloneDefaultDataModel()
    loadedSourceFile.value = ''
    matchInfo.value = null
    referencias.value = null
    errorMessage.value = `No se pudo cargar analisis Benninger: ${err.message}`
  } finally {
    loading.value = false
  }
}

// ── Failure pillars ────────────────────────────────────────────────────────
const failurePillars = computed(() => {
  const aml = proceso.value.amlCel
  const recurrentes = Array.isArray(aml.recurrentes) ? aml.recurrentes : []

  function countCode(code) {
    return recurrentes.find((r) => r.codigo === code)?.count || 0
  }

  const paradasCount = countCode('E3030') + countCode('E1010')
  const velocidadLentaCount = countCode('E1012') + countCode('E3032')
  const gomaCount = countCode('S500') + countCode('1485')
  const s800Count = countCode('S800')
  const maxTension = Math.max(0, ...(proceso.value.tensionTimeline || []).map((t) => Number(t.tensionN) || 0))

  const integridadRiesgo = paradasCount >= 3 || maxTension > 3200 ? 'muy_alto'
    : paradasCount >= 1 || maxTension > 3000 ? 'alto'
    : velocidadLentaCount >= 5 ? 'medio'
    : 'bajo'

  const proteccionRiesgo = gomaCount >= 8 ? 'muy_alto'
    : gomaCount >= 4 ? 'alto'
    : gomaCount >= 1 ? 'medio'
    : 'bajo'

  const esteticaRiesgo = isHumedadCritica.value && Number(proceso.value.presionExprimido || 0) > 90 ? 'alto'
    : isHumedadCritica.value ? 'medio'
    : 'bajo'

  return {
    integridad: {
      riesgo: integridadRiesgo,
      paradas: paradasCount,
      velocidadLenta: velocidadLentaCount,
      maxTension,
      impacto: paradasCount >= 2
        ? `${paradasCount} paradas con ciclos termicos repetidos. Hilo pierde elongacion en zonas de paro \u2014 alta probabilidad de rotura al subir velocidad en telar.`
        : paradasCount === 1
        ? 'Una parada registrada. Monitorear el tramo afectado en telar.'
        : 'Sin paradas. Integridad mecanica controlada.'
    },
    proteccion: {
      riesgo: proteccionRiesgo,
      gomaCount,
      s800Count,
      impacto: gomaCount >= 4
        ? `${gomaCount} alertas de carga de goma (S500). Tramos sin pelicula protectora adecuada \u2014 riesgo de pelusa y cortes por friccion en telar.`
        : gomaCount >= 1
        ? `${gomaCount} alerta(s) de goma. Monitorear deposicion en puntos de reinicio.`
        : 'Proteccion quimica dentro del rango operativo.'
    },
    estetica: {
      riesgo: esteticaRiesgo,
      impacto: isHumedadCritica.value
        ? `Hilo seco (${proceso.value.humedadSalida}%). Riesgo de barre de color y rigidez tactil. El hilo "chato" puede presentar tonalidad desigual.`
        : 'Aspecto estetico dentro del rango operativo. Humedad adecuada.'
    }
  }
})

const dictamenGlobal = computed(() => {
  const scoreMap = { bajo: 0, medio: 1, alto: 2, muy_alto: 3 }
  const p = failurePillars.value
  const maxScore = Math.max(
    scoreMap[p.integridad.riesgo] || 0,
    scoreMap[p.proteccion.riesgo] || 0,
    scoreMap[p.estetica.riesgo] || 0
  )
  if (maxScore >= 3) return { estado: 'RECHAZO TECNICO', color: 'rose', emoji: '🔴' }
  if (maxScore === 2) return { estado: 'USO RESTRINGIDO', color: 'rose', emoji: '🔴' }
  if (maxScore === 1) return { estado: 'USO CONDICIONADO', color: 'amber', emoji: '🟡' }
  return { estado: 'PROCESO APTO', color: 'emerald', emoji: '🟢' }
})

const dictamenBannerClass = computed(() => {
  const c = dictamenGlobal.value.color
  if (c === 'rose') return 'border-rose-500/40 bg-rose-500/10'
  if (c === 'amber') return 'border-amber-400/40 bg-amber-500/10'
  return 'border-emerald-500/40 bg-emerald-500/10'
})

const dictamenTextClass = computed(() => {
  const c = dictamenGlobal.value.color
  if (c === 'rose') return 'text-rose-300'
  if (c === 'amber') return 'text-amber-300'
  return 'text-emerald-300'
})

// ── Meter zone map ──────────────────────────────────────────────────────────
const meterZones = computed(() => {
  const events = amlDetailEvents.value
  if (!events.length) return []

  const maxMeter = Math.max(...events.map((e) => Number(e.meter_pos) || 0))
  if (maxMeter <= 0) return []

  const BUCKET = maxMeter <= 1000 ? 100 : maxMeter <= 3000 ? 200 : 500
  const buckets = []

  for (let lo = 0; lo < maxMeter; lo += BUCKET) {
    const hi = Math.min(lo + BUCKET, maxMeter + 1)
    const inBucket = events.filter((e) => {
      const m = Number(e.meter_pos) || 0
      return m >= lo && m < hi
    })
    if (!inBucket.length) continue

    const paradas = inBucket.filter((e) =>
      ['3030', '1010'].includes(String(e.event_code || '')) ||
      String(e.mensaje || '').toLowerCase().includes('parada')
    ).length

    const goma = inBucket.filter((e) =>
      String(e.codigo || '').toUpperCase() === 'S500' ||
      String(e.event_code || '') === '1485'
    ).length

    const criticos = inBucket.filter((e) => e.severidad === 'critico').length
    const altos = inBucket.filter((e) => e.severidad === 'alto').length
    const topCodes = [...new Set(inBucket.map((e) => e.codigo).filter(Boolean))].slice(0, 3)

    const riesgo = paradas >= 2 || criticos >= 6 ? 'muy_alto'
      : paradas === 1 || criticos >= 3 || goma >= 3 ? 'alto'
      : criticos >= 1 || altos >= 3 || goma >= 1 ? 'medio'
      : 'bajo'

    const causaRaiz = [
      paradas > 0 ? `${paradas} parada(s)` : '',
      goma > 0 ? `${goma} alerta(s) S500` : '',
      criticos > 0 && paradas === 0 && goma === 0 ? `${criticos} eventos criticos` : ''
    ].filter(Boolean).join(' + ') || topCodes.join(', ') || 'Eventos menores'

    const recomendacion = riesgo === 'muy_alto'
      ? '\ud83d\udea8 Reducir velocidad telar 50% \u2014 inspeccionar hilo antes de ingresar'
      : riesgo === 'alto'
      ? '\u26a0\ufe0f Monitorear pelusa y cortes \u2014 ajustar tension preventivamente'
      : riesgo === 'medio'
      ? '\ud83d\udc41\ufe0f Seguimiento cercano \u2014 anotar comportamiento en telar'
      : '\u2705 Proceder normal'

    buckets.push({ lo, hi, total: inBucket.length, paradas, goma, criticos, altos, topCodes, riesgo, causaRaiz, recomendacion })
  }

  return buckets.sort((a, b) => a.lo - b.lo)
})

// ── Style helpers ───────────────────────────────────────────────────────────
function riesgoLabel(r) {
  return { muy_alto: 'MUY ALTO', alto: 'ALTO', medio: 'MEDIO', bajo: 'BAJO' }[r] || r
}

function riesgoEmoji(r) {
  return { muy_alto: '🔴', alto: '🟠', medio: '🟡', bajo: '🟢' }[r] || ''
}

function zoneRiskClass(r) {
  if (r === 'muy_alto') return 'bg-rose-500/20 text-rose-200'
  if (r === 'alto') return 'bg-orange-500/20 text-orange-200'
  if (r === 'medio') return 'bg-amber-500/20 text-amber-200'
  return 'bg-emerald-500/15 text-emerald-300'
}

function zoneBarClass(r) {
  if (r === 'muy_alto') return 'bg-rose-600'
  if (r === 'alto') return 'bg-orange-500'
  if (r === 'medio') return 'bg-amber-400'
  return 'bg-emerald-600'
}

function zoneRecoClass(r) {
  if (r === 'muy_alto') return 'text-rose-300'
  if (r === 'alto') return 'text-orange-300'
  if (r === 'medio') return 'text-amber-300'
  return 'text-emerald-400'
}

function pillarBorderClass(r) {
  if (r === 'muy_alto' || r === 'alto') return 'border-rose-500/40 bg-rose-500/5'
  if (r === 'medio') return 'border-amber-400/40 bg-amber-500/5'
  return 'border-slate-700'
}

function pillarTextClass(r) {
  if (r === 'muy_alto' || r === 'alto') return 'text-rose-300'
  if (r === 'medio') return 'text-amber-300'
  return 'text-emerald-400'
}

async function fetchAmlDetailLogs(partida) {
  if (!partida) { amlDetailEvents.value = []; return }
  loadingAml.value = true
  try {
    const res = await fetch(`/api/benninger-rtf/logs?partida=${encodeURIComponent(partida)}&section=AML&limit=2000`)
    const data = await res.json().catch(() => ({}))
    amlDetailEvents.value = Array.isArray(data.rows) ? data.rows : []
  } catch {
    amlDetailEvents.value = []
  } finally {
    loadingAml.value = false
  }
}

function applyPartidaFilter() {
  const partida = String(partidaInput.value || '').trim()
  const nextQuery = { ...route.query }
  if (partida) nextQuery.partida = partida
  else delete nextQuery.partida
  router.replace({ query: nextQuery })
}

function formatNumber(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}
</script>

<style scoped>
.benninger-impact {
  --industrial-bg: #0b1117;
  --industrial-panel: #0f172a;
  --industrial-text: #e2e8f0;
  --industrial-muted: #94a3b8;
  --steel-line: #334155;
  --accent-cyan: #22d3ee;
  --accent-amber: #f59e0b;
  --accent-rose: #f43f5e;
  --accent-emerald: #22c55e;
  background:
    radial-gradient(circle at 14% 0%, rgba(34, 211, 238, 0.12), transparent 36%),
    radial-gradient(circle at 86% 100%, rgba(245, 158, 11, 0.13), transparent 40%),
    linear-gradient(145deg, #060b12 0%, var(--industrial-bg) 100%);
  color: var(--industrial-text);
  font-family: 'IBM Plex Sans', 'Segoe UI', Tahoma, sans-serif;
}

.kpi-card {
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 0.9rem;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.86) 0%, rgba(2, 6, 23, 0.88) 100%);
  padding: 0.8rem 0.95rem;
}

.header-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(71, 85, 105, 0.8);
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  background: rgba(2, 6, 23, 0.55);
}

.kpi-label {
  color: #94a3b8;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.kpi-value {
  color: #e2e8f0;
  margin-top: 0.2rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.kpi-good {
  border-color: rgba(16, 185, 129, 0.5);
  box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.2);
}

.kpi-warn {
  border-color: rgba(245, 158, 11, 0.55);
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.22);
}

.kpi-bad {
  border-color: rgba(244, 63, 94, 0.6);
  box-shadow: inset 0 0 0 1px rgba(244, 63, 94, 0.24);
}

.kpi-neutral {
  border-color: rgba(148, 163, 184, 0.5);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
}

.str-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(34, 211, 238, 0.45);
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  background: rgba(8, 47, 73, 0.38);
  color: #bae6fd;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.segment {
  height: 100%;
}

.segment-inicial {
  background: linear-gradient(90deg, #0ea5e9, #22d3ee);
}

.segment-estiraje {
  background: linear-gradient(90deg, #f97316, #f59e0b);
}

.segment-residual {
  background: linear-gradient(90deg, #16a34a, #22c55e);
}

.segment-residual-ok {
  background: linear-gradient(90deg, #15803d, #22c55e);
}

.segment-residual-warn {
  background: linear-gradient(90deg, #b45309, #f59e0b);
}

.segment-residual-risk {
  background: linear-gradient(90deg, #be123c, #f43f5e);
}

.legend-chip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(71, 85, 105, 0.7);
  border-radius: 0.55rem;
  padding: 0.45rem 0.6rem;
  background: rgba(15, 23, 42, 0.7);
  color: #cbd5e1;
}

.dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.dot-inicial {
  background: #22d3ee;
}

.dot-estiraje {
  background: #f59e0b;
}

.dot-residual {
  background: #22c55e;
}

.gauge-wrap {
  position: relative;
}

.gauge-shell {
  position: relative;
  height: 170px;
  overflow: hidden;
}

.gauge-ring {
  position: absolute;
  left: 50%;
  top: 55%;
  width: 250px;
  height: 250px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: conic-gradient(from 180deg, #ef4444 0deg, #f59e0b 90deg, #22c55e 180deg, transparent 180deg);
  mask: radial-gradient(circle at center, transparent 62%, #000 63%);
}

.gauge-needle {
  position: absolute;
  left: 50%;
  top: 66%;
  width: 4px;
  height: 76px;
  transform-origin: bottom center;
  border-radius: 999px;
  background: linear-gradient(180deg, #f8fafc 0%, #94a3b8 100%);
  box-shadow: 0 0 10px rgba(248, 250, 252, 0.35);
}

.gauge-center {
  position: absolute;
  left: 50%;
  top: 66%;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #e2e8f0;
  transform: translate(-50%, -50%);
}

.gauge-value {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  font-weight: 700;
  font-size: 1.2rem;
}
</style>
