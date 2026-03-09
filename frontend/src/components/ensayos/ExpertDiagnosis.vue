<template>
  <section class="impact-report rounded-2xl border border-slate-300 bg-white p-5 shadow-lg">
    <div class="flex items-start justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
      <div>
        <p class="report-kicker">Dictamen de Auditoria Operativa</p>
        <h3 class="report-title">
          Dictamen Tecnico | Partida
          <strong class="tech-value">{{ partidaLabel }}</strong>
        </h3>
        <p class="mt-1 text-xs text-slate-400">
          Analisis post-proceso Benninger — proyeccion de impacto en tejeduria
          <template v-if="sourceFile">
            &nbsp;&middot;&nbsp;
            <button
              @click="openRtfFile"
              class="text-cyan-600 hover:text-cyan-800 hover:underline font-medium"
              :title="'Abrir ' + sourceFile"
            >&#128196; {{ sourceFile }}</button>
          </template>
        </p>
      </div>
      <span class="status-pill" :class="globalStatusClass">{{ globalStatusLabel }}</span>
    </div>

    <div class="report-body mt-4">

      <!-- BANNER RESUMEN -->
      <section class="sip-block">
        <h4 class="sip-title">1. Resumen Ejecutivo</h4>
        <div class="sip-grid">
          <article class="sip-card">
            <p class="sip-label">Estado del Proceso</p>
            <p class="sip-value" :class="globalTextClass">{{ globalStatusLabel }}</p>
            <p class="sip-note" v-html="narrativaGlobal"></p>
          </article>
          <article class="sip-card">
            <p class="sip-label">Dinamica Operativa</p>
            <p class="sip-value" :class="eficienciaOperativa.className">
              Marcha {{ fmtN(eficienciaOperativa.marchaPct, 1) }}% | Parado/Lento {{ fmtN(eficienciaOperativa.paradaPct, 1) }}%
            </p>
            <p class="sip-note">
              <template v-if="paradasReales.length">
                {{ paradasReales.length }} parada(s) — {{ totalParadaSeg }}s detenida.
              </template>
              <template v-else>Sin paradas operativas detectadas.</template>
              <template v-if="operSlowCount"> {{ operSlowCount }} ciclo(s) vel. lenta.</template>
              <template v-if="gomaLoadAlerts"> {{ gomaLoadAlerts }} alerta(s) goma.</template>
              <template v-if="!paradasReales.length &amp;&amp; !operSlowCount &amp;&amp; !gomaLoadAlerts &amp;&amp; allValidEvents.length">
                {{ allValidEvents.length }} eventos AML procesados.
              </template>
            </p>
          </article>
          <article class="sip-card">
            <p class="sip-label">KPI de Tintura</p>
            <p class="sip-value" :class="micPresionCompatibilidad.className">
              MIC {{ fmtN(micValue, 2) }} vs Presion {{ fmtN(presionValue, 1) }} kN
            </p>
            <p class="sip-note">{{ micPresionCompatibilidad.message }}</p>
          </article>
        </div>
      </section>

      <!-- 3 PILARES -->
      <section class="sip-block">
        <h4 class="sip-title">2. Diagnostico por Pilar de Falla</h4>
        <p class="mt-1 text-xs text-slate-500">
          Perspectiva de tejar: el exterior de la bobina (metro B.0) entra primero al telar.
          T.X = metro de telar (T.0 = primera trama tejida).
        </p>

        <!-- Pilar Integridad -->
        <div class="pilar-block mt-3" :class="pilarClass(pilarIntegridad.nivel)">
          <div class="pilar-header">
            <span>🧵</span>
            <h5 class="pilar-title">Falla de Integridad — Cortes en telar</h5>
            <span class="pilar-badge" :class="pilarBadgeClass(pilarIntegridad.nivel)">{{ nivelLabel(pilarIntegridad.nivel) }}</span>
          </div>
          <div class="pilar-body">
            <div class="pilar-dato">
              <p class="pilar-dato-label">Dato objetivo</p>
              <p class="pilar-dato-value" v-html="pilarIntegridad.dato"></p>
            </div>
            <div class="pilar-impacto">
              <p class="pilar-dato-label">Impacto en telar</p>
              <p class="pilar-dato-value text-slate-700" v-html="pilarIntegridad.impacto"></p>
            </div>
          </div>
          <div v-if="paradasReales.length" class="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-xs">
              <thead class="bg-slate-100 text-slate-600">
                <tr>
                  <th class="px-2 py-1.5 text-left">H. inicio</th>
                  <th class="px-2 py-1.5 text-left">H. fin</th>
                  <th class="px-2 py-1.5 text-right">Durac. (s)</th>
                  <th class="px-2 py-1.5 text-right">Metro telar</th>
                  <th class="px-2 py-1.5 text-left">Tipo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in paradasReales" :key="p.key" class="border-t border-slate-200">
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ p.horaInicio }}</td>
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ p.horaFin }}</td>
                  <td class="px-2 py-1.5 text-right font-bold" :class="Number(p.durSeg) > 60 ? 'text-rose-700' : 'text-amber-700'">{{ p.durSeg }}</td>
                  <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800">{{ p.metroTelar !== null ? 'T.' + p.metroTelar + 'm' : '—' }}</td>
                  <td class="px-2 py-1.5 text-slate-600">{{ p.tipo }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pilar Proteccion -->
        <div class="pilar-block mt-3" :class="pilarClass(pilarProteccion.nivel)">
          <div class="pilar-header">
            <span>🛡️</span>
            <h5 class="pilar-title">Falla de Proteccion — Pelusa y abrasion</h5>
            <span class="pilar-badge" :class="pilarBadgeClass(pilarProteccion.nivel)">{{ nivelLabel(pilarProteccion.nivel) }}</span>
          </div>
          <div class="pilar-body">
            <div class="pilar-dato">
              <p class="pilar-dato-label">Dato objetivo</p>
              <p class="pilar-dato-value" v-html="pilarProteccion.dato"></p>
            </div>
            <div class="pilar-impacto">
              <p class="pilar-dato-label">Impacto en telar</p>
              <p class="pilar-dato-value text-slate-700" v-html="pilarProteccion.impacto"></p>
            </div>
          </div>
          <div v-if="gomaEventosTelar.length" class="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-xs">
              <thead class="bg-slate-100 text-slate-600">
                <tr>
                  <th class="px-2 py-1.5 text-left">Hora</th>
                  <th class="px-2 py-1.5 text-right">Metro telar</th>
                  <th class="px-2 py-1.5 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in gomaEventosTelar.slice(0, 8)" :key="g.key" class="border-t border-slate-200">
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ g.hora }}</td>
                  <td class="px-2 py-1.5 text-right font-mono font-bold text-amber-700">{{ g.metroTelar !== null ? 'T.' + g.metroTelar + 'm' : '—' }}</td>
                  <td class="px-2 py-1.5 text-slate-600">{{ g.detalle }}</td>
                </tr>
                <tr v-if="gomaEventosTelar.length > 8" class="border-t border-slate-100">
                  <td colspan="3" class="px-2 py-1 text-slate-400 italic">... y {{ gomaEventosTelar.length - 8 }} alertas mas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pilar Estetica -->
        <div class="pilar-block mt-3" :class="pilarClass(pilarEstetica.nivel)">
          <div class="pilar-header">
            <span>🎨</span>
            <h5 class="pilar-title">Falla Estetica — Barre y rigidez</h5>
            <span class="pilar-badge" :class="pilarBadgeClass(pilarEstetica.nivel)">{{ nivelLabel(pilarEstetica.nivel) }}</span>
          </div>
          <div class="pilar-body">
            <div class="pilar-dato">
              <p class="pilar-dato-label">Dato objetivo</p>
              <p class="pilar-dato-value" v-html="pilarEstetica.dato"></p>
            </div>
            <div class="pilar-impacto">
              <p class="pilar-dato-label">Impacto en telar</p>
              <p class="pilar-dato-value text-slate-700" v-html="pilarEstetica.impacto"></p>
            </div>
          </div>
        </div>
      </section>

      <!-- MAPA DE METROS EN TELAR -->
      <section class="sip-block">
        <h4 class="sip-title">3. Mapa de Riesgo en Telar</h4>
        <p class="mt-1 text-xs text-slate-500">
          T.X = metro de telar. T.0 = primera trama tejida. B.0 (exterior bobina) → T.0.
        </p>
        <div v-if="meterZonesTelar.length" class="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full min-w-[560px] text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="px-3 py-2 text-left">Zona en Telar</th>
                <th class="px-3 py-2 text-center">Riesgo</th>
                <th class="px-3 py-2 text-center">Paradas</th>
                <th class="px-3 py-2 text-center">Goma</th>
                <th class="px-3 py-2 text-center">Eventos</th>
                <th class="px-3 py-2 text-left">Causa Raiz</th>
                <th class="px-3 py-2 text-left">Recomendacion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr
                v-for="z in meterZonesTelar"
                :key="`tz-${z.lo}`"
                :class="z.riesgo === 'muy_alto' ? 'bg-rose-50' : z.riesgo === 'alto' ? 'bg-orange-50' : z.riesgo === 'medio' ? 'bg-amber-50/60' : ''"
              >
                <td class="px-3 py-2 font-mono text-xs text-slate-800 whitespace-nowrap">T.{{ z.lo }}–T.{{ z.hi }}m</td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="riesgoChipClass(z.riesgo)">
                    {{ riesgoEmoji(z.riesgo) }} {{ riesgoLabel(z.riesgo) }}
                  </span>
                </td>
                <td class="px-3 py-2 text-center font-bold text-sm" :class="z.paradas > 0 ? 'text-rose-700' : 'text-slate-400'">{{ z.paradas || '—' }}</td>
                <td class="px-3 py-2 text-center font-bold text-sm" :class="z.goma > 0 ? 'text-amber-700' : 'text-slate-400'">{{ z.goma || '—' }}</td>
                <td class="px-3 py-2 text-center">
                  <span
                    v-tippy="{ content: bucketTooltipHtml(z), allowHTML: true, delay: 0, maxWidth: 520, placement: 'left', theme: 'light', interactive: true }"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-help bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >{{ z.total }} <span class="text-slate-400">ⓘ</span></span>
                </td>
                <td class="px-3 py-2 text-xs text-slate-700">{{ z.causaRaiz }}</td>
                <td class="px-3 py-2 text-xs" :class="recoClass(z.riesgo)">{{ z.recomendacion }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="meterZonesTelar.length" class="mt-4">
          <p class="text-xs text-slate-400 mb-1.5">Vista rapida — riesgo por tramo de telar</p>
          <div class="flex h-5 w-full rounded-full overflow-hidden border border-slate-200 gap-px">
            <div
              v-for="z in meterZonesTelar"
              :key="`bar-${z.lo}`"
              :title="`T.${z.lo}-T.${z.hi}m: ${riesgoLabel(z.riesgo)} (${z.total} eventos)`"
              :style="{ flex: String(z.hi - z.lo) }"
              :class="barClass(z.riesgo)"
            ></div>
          </div>
          <div class="mt-1 flex justify-between text-xs text-slate-400">
            <span>← T.0 inicio telar</span>
            <span>fin bobina T.{{ meterZonesTelar[meterZonesTelar.length - 1]?.hi }}m →</span>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-slate-400">Sin datos de eventos AML detallados para construir el mapa.</p>
      </section>

      <!-- PLAN DE ACCION -->
      <section class="sip-block">
        <h4 class="sip-title">4. Plan de Accion Correctiva</h4>
        <p class="sip-subtitle mt-2">En maquina (proxima corrida)</p>
        <ol class="action-list">
          <li v-for="(a, i) in machineActions" :key="`m-${i}`" v-html="a"></li>
        </ol>
        <p class="sip-subtitle mt-4">En producto (bobina actual)</p>
        <ol class="action-list">
          <li v-for="(a, i) in productActions" :key="`p-${i}`" v-html="a"></li>
        </ol>
      </section>

    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  partida: { type: String, default: '' },
  mic: { type: Number, default: null },
  presionExprimido: { type: Number, default: null },
  tenacidad: { type: Number, default: null },
  elongacionResidual: { type: Number, default: 0 },
  humedadSalida: { type: Number, default: null },
  tensionPlegador: { type: Number, default: null },
  tensionTimeline: { type: Array, default: () => [] },
  amlCel: {
    type: Object,
    default: () => ({ total: 0, aml: 0, cel: 0, riesgo: 'bajo', codigos: [], recurrentes: [], eventos: [] })
  },
  // Eventos AML detallados con meter_pos real (de tb_benninger_rtf_eventos)
  amlDetailEvents: { type: Array, default: () => [] },
  sourceFile: { type: String, default: '' },
  rawRtfText: { type: String, default: '' }
})

function openRtfFile() {
  if (!props.sourceFile) return
  window.open(`/api/benninger-rtf/file?sourceFile=${encodeURIComponent(props.sourceFile)}`, '_blank')
}

// ── Utilidades ──────────────────────────────────────────────────────────────
function parseN(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v); return Number.isFinite(n) ? n : null
}
function fmtN(v, dec = 2) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function tv(v, dec = 2, unit = '') {
  return `<strong class="tech-value">${fmtN(v, dec)}${unit ? ' ' + unit : ''}</strong>`
}
function hhmm(ts) {
  if (!ts) return null
  const s = String(ts)
  const m = s.match(/T?(\d{2}:\d{2})/)
  return m ? m[1] : (s.slice(11, 16) || null)
}
function diffSec(ts1, ts2) {
  if (!ts1 || !ts2) return null
  const d1 = new Date(ts1), d2 = new Date(ts2)
  if (isNaN(d1) || isNaN(d2)) return null
  return Math.round(Math.abs(d2 - d1) / 1000)
}

// ── Valores base ────────────────────────────────────────────────────────────
const micValue     = computed(() => parseN(props.mic))
const presionValue = computed(() => parseN(props.presionExprimido))
const tenacidadValue = computed(() => parseN(props.tenacidad))
const residualValue  = computed(() => Number(props.elongacionResidual || 0))
const humedadValue   = computed(() => parseN(props.humedadSalida))
const plegadorValue  = computed(() => parseN(props.tensionPlegador))
const partidaLabel   = computed(() => String(props.partida || '').trim() || '—')

const timeline = computed(() =>
  (props.tensionTimeline || [])
    .map(item => { const t = parseN(item?.tensionN); return t !== null ? { punto: String(item.punto || ''), tensionN: t } : null })
    .filter(Boolean)
)
const tensionBase = computed(() => {
  const m12 = timeline.value.find(t => /M12|BATEA/i.test(t.punto))
  return m12?.tensionN ?? timeline.value[0]?.tensionN ?? null
})
const tensionJumpPct = computed(() => {
  const base = Number(tensionBase.value || 0), pleg = Number(plegadorValue.value || 0)
  if (!base || !pleg) return 0
  return ((pleg - base) / base) * 100
})

// ── Eventos AML detallados ──────────────────────────────────────────────────
// meter_pos = metros restantes en el plegador (countdown: ~2149→0)
// meter_pos=0 es exterior de la bobina = primero que entra al telar (T.0)

// Todos los eventos válidos — sin filtro de meter_pos (para conteos)
const allValidEvents = computed(() =>
  (props.amlDetailEvents || []).filter(e => e != null)
)

// Solo eventos con metro conocido — para tablas y mapa de metros
const rawDetailEvents = computed(() =>
  allValidEvents.value.filter(e => parseN(e.meter_pos) !== null && parseN(e.meter_pos) >= 0)
)

// Normaliza mensaje para comparación (elimina tildes, minúsculas)
function normMsg(e) {
  return String(e.mensaje || e.descripcion_parada || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// metro en telar = meter_pos (ya está orientado: 0=exterior=primero en telar)
function metroTelar(meterPos) { return Math.round(Number(meterPos) || 0) }

// ── Paradas reales con duración ─────────────────────────────────────────────
// Detección por patrón en mensaje (Benninger usa portugués: "parada", "grelha aberta")
const paradasReales = computed(() => {
  const raw = []
  for (const e of allValidEvents.value) {
    const msg = normMsg(e)
    // Parada = contiene "parada" o "grelha aberta", pero NO es un evento de producción
    const esParada = (/parada|grelha\s*aberta/.test(msg)) &&
                     !(/producao|producção|produccion/.test(msg))
    if (!esParada) continue
    const mPos = parseN(e.meter_pos)
    raw.push({
      key: `${e.codigo}-${e.timestamp_ts}-${e.line_no}`,
      horaInicio: hhmm(e.timestamp_ts) || '—',
      horaFin: hhmm(e.timestamp_end_ts) || '—',
      durSeg: diffSec(e.timestamp_ts, e.timestamp_end_ts) ?? '—',
      metroTelar: mPos !== null ? metroTelar(mPos) : null,
      tipo: String(e.codigo || 'Parada'),
      meterPos: mPos
    })
  }
  // Dedup: misma hora + mismo tipo (S1 y S3 pueden reportar la misma parada)
  const unique = []
  for (const p of raw) {
    if (!unique.find(u => u.horaInicio === p.horaInicio && u.tipo === p.tipo)) unique.push(p)
  }
  return unique.sort((a, b) => (a.meterPos ?? Infinity) - (b.meterPos ?? Infinity))
})

const totalParadaSeg = computed(() =>
  paradasReales.value.reduce((acc, p) => acc + (Number(p.durSeg) || 0), 0)
)

// ── Alertas de goma ─────────────────────────────────────────────────────────
const gomaEventosTelar = computed(() =>
  allValidEvents.value
    .filter(e => {
      const msg = normMsg(e)
      return /carga\s*de\s*goma|s\s*500/.test(msg) || String(e.event_code || '') === '1485'
    })
    .map((e, idx) => ({
      key: `goma-${idx}`,
      hora: hhmm(e.timestamp_ts) || '—',
      metroTelar: parseN(e.meter_pos) !== null ? metroTelar(e.meter_pos) : null,
      detalle: String(e.mensaje || '').slice(0, 50)
    }))
    .sort((a, b) => (a.metroTelar ?? Infinity) - (b.metroTelar ?? Infinity))
)
const gomaLoadAlerts = computed(() => gomaEventosTelar.value.length)

const operSlowCount = computed(() =>
  allValidEvents.value.filter(e => /velocidade\s*lenta|rasteje/.test(normMsg(e))).length
)

// ── Flags de riesgo ─────────────────────────────────────────────────────────
const micPressureTarget = computed(() => {
  if (!Number.isFinite(micValue.value)) return null
  if (micValue.value <= 4.2) return 58
  if (micValue.value <= 4.8) return 60
  return 62
})
const pressureDelta = computed(() => {
  if (!Number.isFinite(micPressureTarget.value) || !Number.isFinite(presionValue.value)) return null
  return Number((presionValue.value - micPressureTarget.value).toFixed(1))
})
const micPresionCompatibilidad = computed(() => {
  if (!Number.isFinite(micValue.value) || !Number.isFinite(presionValue.value))
    return { className: 'text-slate-700', message: 'Sin datos suficientes para evaluar compatibilidad MIC-Presion.' }
  if (Math.abs(Number(pressureDelta.value)) <= 1.5)
    return { className: 'text-emerald-700', message: `Condicion compatible: presion dentro de banda para MIC ${fmtN(micValue.value, 2)}.` }
  if (Number(pressureDelta.value) > 1.5)
    return { className: 'text-rose-700', message: `Presion alta para este MIC. Objetivo local sugerido: ${fmtN(micPressureTarget.value, 1)} kN.` }
  return { className: 'text-amber-700', message: `Presion por debajo del objetivo local (${fmtN(micPressureTarget.value, 1)} kN). Revisar pickup real.` }
})

const humedadCritica = computed(() => Number.isFinite(humedadValue.value) && humedadValue.value <= 6)
// tinturaRisk: la presion supera en mas de 15 kN el objetivo local para este MIC (cualquier finura)
const tinturaRisk    = computed(() => Number.isFinite(pressureDelta.value) && pressureDelta.value > 15)
const tensionRisk    = computed(() => tensionJumpPct.value > 60)
const resilienceRisk = computed(() => Number.isFinite(tenacidadValue.value) && tenacidadValue.value < 15.5 && residualValue.value < 5)

// ── Estado global ───────────────────────────────────────────────────────────
const globalStatus = computed(() => {
  if (paradasReales.value.length >= 2 || (paradasReales.value.length >= 1 && gomaLoadAlerts.value >= 4)) return 'Critico'
  if (resilienceRisk.value) return 'Critico'
  if (humedadCritica.value && (paradasReales.value.length >= 1 || tensionRisk.value)) return 'Critico'
  if (humedadCritica.value && tinturaRisk.value) return 'Critico'
  if (paradasReales.value.length >= 1 || gomaLoadAlerts.value >= 4 || tinturaRisk.value || tensionRisk.value) return 'Riesgo'
  return 'Apto'
})
const globalStatusLabel = computed(() => {
  if (globalStatus.value === 'Critico') return '🔴 CRITICO / AJUSTE INMEDIATO'
  if (globalStatus.value === 'Riesgo')  return '🟠 RIESGO / INTERVENCION RECOMENDADA'
  return '🟢 APTO / OPERACION ESTABLE'
})
const globalTextClass = computed(() => ({ Critico: 'text-rose-700', Riesgo: 'text-amber-700', Apto: 'text-emerald-700' }[globalStatus.value]))
const globalStatusClass = computed(() => ({ Critico: 'status-critical', Riesgo: 'status-risk', Apto: 'status-ok' }[globalStatus.value]))

// ── Narrativa global ────────────────────────────────────────────────────────
const narrativaGlobal = computed(() => {
  const nP = tv(paradasReales.value.length, 0)
  const nG = tv(gomaLoadAlerts.value, 0)
  const tSeg = tv(totalParadaSeg.value, 0, 's')
  const hayEventosAml = allValidEvents.value.length > 0

  if (globalStatus.value === 'Critico') {
    if (paradasReales.value.length >= 1)
      return `Durante la corrida se registraron ${nP} parada(s) con ${tSeg} de maquina detenida y ${nG} alertas de goma. Al reiniciar, la tension de plegador genera picos mecanicos que fragilizaron los tramos de reinicio. El hilo llega al telar con zonas criticas desde los primeros metros.`
    return `El hilo presenta condicion mecanica comprometida: reserva elastica insuficiente y humedad critica. Riesgo alto de corte en telar al alcanzar velocidad nominal.`
  }
  if (globalStatus.value === 'Riesgo') {
    // Riesgo por paradas/goma operativas
    if (paradasReales.value.length >= 1 || gomaLoadAlerts.value >= 2)
      return `Se registraron ${nP} parada(s) y ${nG} alertas de goma. Los tramos de reinicio quedaron con menor proteccion quimica. Monitoreo cercano en tejeduria.`
    // Riesgo por tintura (MIC vs presion)
    if (tinturaRisk.value)
      return `MIC ${tv(micValue.value, 2)} con presion ${tv(presionValue.value, 1, 'kN')} supera el objetivo local para esta finura. Riesgo de Ring Dyeing y penetracion irregular de indigo. Sin paradas operativas detectadas${hayEventosAml ? '' : ' (sin log AML disponible)'}.`
    // Riesgo por tension mecanica
    if (tensionRisk.value)
      return `Salto de tension de ${tv(tensionJumpPct.value, 1, '%')} sobre la linea base. La rampa agresiva puede generar fatiga de urdimbre en telar aunque no hubo paradas operativas.`
    return `Condicion de riesgo detectada en los parametros de proceso. Verificar setpoints antes de liberar a tejeduria.`
  }
  return `Corrida estable: sin paradas criticas, sin alertas de goma significativas. El hilo llega al telar en condicion apta para produccion continua.`
})

// ── Eficiencia operativa ────────────────────────────────────────────────────
const eficienciaOperativa = computed(() => {
  const pen = (paradasReales.value.length * 12) + (operSlowCount.value * 5) + (gomaLoadAlerts.value * 2)
  const paradaPct = Math.min(95, Math.max(0, pen))
  const marchaPct = Math.max(5, 100 - paradaPct)
  const cls = marchaPct < 65 ? 'text-rose-700' : marchaPct < 80 ? 'text-amber-700' : 'text-emerald-700'
  return { marchaPct, paradaPct, className: cls }
})

// ── Pilares ─────────────────────────────────────────────────────────────────
const pilarIntegridad = computed(() => {
  const n = paradasReales.value.length
  const tSeg = totalParadaSeg.value
  if (n >= 2 || (n >= 1 && tSeg > 90)) {
    return {
      nivel: 'muy_alto',
      dato: `${tv(n, 0)} parada(s) — detenida ${tv(tSeg, 0, 's')}. Tension plegador ${tv(plegadorValue.value, 0, 'N')}, salto ${tv(tensionJumpPct.value, 1, '%')}.`,
      impacto: `El hilo permanecio frio y tensado durante la parada. Al reiniciar, el pico mecanico genero fatiga localizada. En telar, esos tramos tenderan a cortar al subir velocidad por encima del 70% nominal. Elongacion residual: ${tv(residualValue.value, 2, '%')}.`
    }
  }
  if (n === 1) {
    return {
      nivel: 'alto',
      dato: `${tv(n, 0)} parada — detenida ${tv(tSeg, 0, 's')}. Tension plegador ${tv(plegadorValue.value, 0, 'N')}.`,
      impacto: `Zona de transicion termica generada por la parada. En telar, monitorear el tramo correspondiente y reducir velocidad preventivamente.`
    }
  }
  if (tensionRisk.value) {
    return {
      nivel: 'medio',
      dato: `Sin paradas. Salto de tension ${tv(tensionJumpPct.value, 1, '%')} (base ${tv(tensionBase.value, 0, 'N')} → plegador ${tv(plegadorValue.value, 0, 'N')}).`,
      impacto: `La rampa de tension es agresiva. Sin paradas que agraven la fatiga, el riesgo de corte es moderado pero presente en velocidades altas.`
    }
  }
  if (humedadCritica.value) {
    return {
      nivel: 'medio',
      dato: `Sin paradas. Humedad salida ${tv(humedadValue.value, 1, '%')} — hilo en limite de sobre-secado.`,
      impacto: `El exceso de secado reduce la plasticidad y aumenta la fragilidad de la fibra. En telar, mayor tendencia a corte en tramos de alta tension y en cruces de laminas.`
    }
  }
  return {
    nivel: 'bajo',
    dato: `Sin paradas. Salto de tension ${tv(tensionJumpPct.value, 1, '%')}. Elongacion residual ${tv(residualValue.value, 2, '%')}.`,
    impacto: `Dinamica mecanica estable durante la corrida. El hilo llega al telar con su margen elastico integro.`
  }
})

const pilarProteccion = computed(() => {
  const n = gomaLoadAlerts.value
  if (n >= 8) {
    return {
      nivel: 'muy_alto',
      dato: `${tv(n, 0)} alertas S500 — carga de goma fuera de tolerancia en multiples reinicios.`,
      impacto: `Tramos de 10–20m sin pelicula de goma adecuada despues de cada reinicio. En telar: pelusa, quiebre de fibra por friccion en lizos y aumento de cortes de urdimbre.`
    }
  }
  if (n >= 3) {
    return {
      nivel: 'alto',
      dato: `${tv(n, 0)} alertas S500 en reinicios posteriores a paradas.`,
      impacto: `Los tramos de reinicio tienen menor cobertura de goma. Riesgo de pelusa y cortes por abrasion. Limpiar guias periodicamente.`
    }
  }
  if (n >= 1) {
    return {
      nivel: 'medio',
      dato: `${tv(n, 0)} alerta(s) S500 puntual(es).`,
      impacto: `Cobertura de goma mayormente adecuada. Los tramos afectados son menores. Monitorear pelusa sin necesidad de intervencion inmediata.`
    }
  }
  return {
    nivel: 'bajo',
    dato: `Sin alertas S500. Aplicacion de goma dentro del rango nominal.`,
    impacto: `El hilo llega al telar con pelicula protectora uniforme. Sin riesgo de pelusa por deficiencia de goma.`
  }
})

const pilarEstetica = computed(() => {
  if (humedadCritica.value && tinturaRisk.value) {
    return {
      nivel: 'alto',
      dato: `Humedad salida ${tv(humedadValue.value, 1, '%')} (critico ≤ 6%). Presion ${tv(presionValue.value, 1, 'kN')} por encima del objetivo para MIC ${tv(micValue.value, 2)}.`,
      impacto: `Doble riesgo: hilo seco absorbe colorante de forma irregular + presion alta genero migracion superficial de indigo. Posible barre de color y tacto rigido.`
    }
  }
  if (humedadCritica.value) {
    return {
      nivel: 'medio',
      dato: `Humedad salida ${tv(humedadValue.value, 1, '%')} — en el limite critico (objetivo: 7%).`,
      impacto: `Falta de plasticidad aumenta tension de trabajo en telar. Puede generar diferencia de brillo entre tramos normales y tramos de parada.`
    }
  }
  if (tinturaRisk.value) {
    return {
      nivel: 'medio',
      dato: `MIC ${tv(micValue.value, 2)} con presion ${tv(presionValue.value, 1, 'kN')} — supera objetivo local para esta finura.`,
      impacto: `Riesgo de Ring Dyeing: indigo penetro superficialmente con mayor densidad. En lavados puede haber mayor decoloracion diferencial.`
    }
  }
  return {
    nivel: 'bajo',
    dato: `Humedad ${tv(humedadValue.value, 1, '%')}. Presion ${tv(presionValue.value, 1, 'kN')} compatible con MIC ${tv(micValue.value, 2)}.`,
    impacto: `Sin desviaciones esteticas detectadas. El hilo llega al telar en condicion de absorcion y brillo dentro de lo esperado.`
  }
})

// ── Mapa de metros en telar ─────────────────────────────────────────────────
// meter_pos=0 es exterior bobina = T.0 (primer metro en telar)
const meterZonesTelar = computed(() => {
  // Para el mapa de metros solo usamos eventos CON metro conocido
  const events = rawDetailEvents.value
  if (!events.length) return []
  const validMeters = events.map(e => Number(e.meter_pos) || 0).filter(m => m >= 0)
  const maxM = validMeters.length ? Math.max(...validMeters) : 0
  if (maxM <= 0) return []

  const BUCKET = maxM <= 500 ? 50 : maxM <= 1500 ? 100 : maxM <= 3000 ? 200 : 300
  const buckets = []

  for (let lo = 0; lo < maxM; lo += BUCKET) {
    const hi = Math.min(lo + BUCKET, maxM + 1)
    const inBucket = events.filter(e => { const m = Number(e.meter_pos) || 0; return m >= lo && m < hi })
    if (!inBucket.length) continue

    const paradas  = inBucket.filter(e => ['E3030', 'E1010'].includes(String(e.codigo || '').toUpperCase())).length
    const goma     = inBucket.filter(e => String(e.codigo || '').toUpperCase() === 'S500' || String(e.event_code || '') === '1485').length
    const criticos = inBucket.filter(e => e.severidad === 'critico').length
    const lentos   = inBucket.filter(e => ['E1011', 'E3031', 'E1012', 'E3032'].includes(String(e.codigo || '').toUpperCase())).length
    const eventos  = [...inBucket].sort((a, b) => (Number(a.meter_pos) || 0) - (Number(b.meter_pos) || 0))

    const riesgo = paradas >= 1 || (goma >= 2 && criticos >= 3) ? 'muy_alto'
      : goma >= 2 || criticos >= 3 ? 'alto'
      : goma >= 1 || criticos >= 1 || lentos >= 2 ? 'medio'
      : 'bajo'

    const causaRaiz = [
      paradas > 0 ? `${paradas} parada(s)` : '',
      goma > 0    ? `${goma} alerta(s) goma` : '',
      lentos > 0 && paradas === 0 && goma === 0 ? `${lentos} ciclos lentos` : ''
    ].filter(Boolean).join(' + ') || 'Eventos menores'

    const recomendacion = riesgo === 'muy_alto' ? '🚨 Reducir velocidad 50% — inspeccionar antes de ingresar'
      : riesgo === 'alto'     ? '⚠️ Monitorear pelusa y tension — limpieza preventiva'
      : riesgo === 'medio'    ? '👁️ Seguimiento cercano — anotar cortes'
      : '✅ Proceder normal'

    buckets.push({ lo, hi, total: inBucket.length, paradas, goma, criticos, lentos, riesgo, causaRaiz, recomendacion, eventos })
  }

  return buckets.sort((a, b) => a.lo - b.lo)
})
function bucketTooltipHtml(z) {
  const severityIcon = (e) => {
    const cod = String(e.codigo || '').toUpperCase()
    if (['E3030','E1010'].includes(cod)) return '🔴'
    if (cod === 'S500' || String(e.event_code||'') === '1485') return '🟠'
    if (['E1011','E3031','E1012','E3032'].includes(cod)) return '🟡'
    if (e.severidad === 'critico') return '🔴'
    return '⚪'
  }
  const rows = z.eventos.slice(0, 25).map(e => {
    const m   = Math.round(Number(e.meter_pos) || 0)
    const cod = String(e.codigo || e.event_code || '—').toUpperCase()
    const sub = String(e.subsistema || e.subsystem || '').slice(0,6)
    const msg = String(e.mensaje || e.descripcion_parada || '').slice(0, 48)
    return `<tr style="border-top:1px solid #e2e8f0">
      <td style="padding:2px 6px;font-weight:600;white-space:nowrap">${severityIcon(e)} T.${m}m</td>
      <td style="padding:2px 6px;font-family:monospace;white-space:nowrap">${cod}</td>
      <td style="padding:2px 6px;color:#64748b;white-space:nowrap">${sub}</td>
      <td style="padding:2px 6px;color:#374151;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${msg}">${msg || '—'}</td>
    </tr>`
  }).join('')
  const extra = z.eventos.length > 25 ? `<tr><td colspan="4" style="padding:4px 6px;color:#94a3b8;font-style:italic">… y ${z.eventos.length - 25} eventos más</td></tr>` : ''
  return `<div style="font-size:12px;min-width:380px">
    <div style="font-weight:700;margin-bottom:6px;color:#1e293b">📍 T.${z.lo}–T.${z.hi}m &nbsp;·&nbsp; ${z.total} evento(s)</div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#f1f5f9;color:#475569">
        <th style="padding:3px 6px;text-align:left">Metro</th>
        <th style="padding:3px 6px;text-align:left">Código</th>
        <th style="padding:3px 6px;text-align:left">Sub.</th>
        <th style="padding:3px 6px;text-align:left">Mensaje</th>
      </tr></thead>
      <tbody>${rows}${extra}</tbody>
    </table>
  </div>`
}
// ── Acciones ────────────────────────────────────────────────────────────────
const machineActions = computed(() => {
  const a = []
  if (Number(pressureDelta.value) > 1.5 && Number.isFinite(micPressureTarget.value))
    a.push(`Bajar presion de exprimido a ${tv(micPressureTarget.value, 1, 'kN')} para alinear con MIC ${tv(micValue.value, 2)}.`)
  if (paradasReales.value.length > 0)
    a.push(`Implementar rampa de aceleracion suave post-parada en S800 para reducir el pico de tension al reinicio (actual: ${tv(plegadorValue.value, 0, 'N')}).`)
  if (gomaLoadAlerts.value > 0)
    a.push(`Verificar viscosidad y temperatura de goma S500 antes del arranque — ${tv(gomaLoadAlerts.value, 0)} alerta(s) en esta corrida.`)
  if (humedadCritica.value)
    a.push('Subir setpoint de humedad de salida hacia 7,0% — el hilo salio seco, fragilizando los tramos de parada.')
  if (!a.length) a.push('Mantener setpoints actuales. Sin desviaciones criticas en esta corrida.')
  return a
})

const productActions = computed(() => {
  const a = []
  if (globalStatus.value === 'Critico') {
    a.push(`Marcar bobina como <strong class="tech-value">USO RESTRINGIDO</strong> — no liberar a telar de alta velocidad sin revision previa.`)
    if (paradasReales.value.length > 0) {
      const metros = paradasReales.value.map(p => `T.${p.metroTelar}m`).join(', ')
      a.push(`Comunicar al tejedor los tramos de riesgo: ${metros}. Reducir velocidad al 50% al ingresar esas zonas.`)
    }
    if (tinturaRisk.value)
      a.push('Retener muestra para evaluacion de ring dyeing y solidez al lavado antes de liberar a acabado.')
  } else if (globalStatus.value === 'Riesgo') {
    a.push('Liberar con nota de seguimiento: anotar cortes y pelusa durante el tejido.')
    if (tinturaRisk.value)
      a.push('Retener muestra para evaluacion de ring dyeing y solidez al lavado antes de liberar a acabado.')
    if (gomaLoadAlerts.value > 0)
      a.push('Inspeccionar guias de urdimbre en telar al inicio — riesgo de acumulacion de pelusa.')
  } else {
    a.push('Liberar a tejeduria con seguimiento estandar de primera corrida.')
  }
  return a
})

// ── Helpers de estilo ────────────────────────────────────────────────────────
function nivelLabel(n) { return { muy_alto: 'MUY ALTO', alto: 'ALTO', medio: 'MEDIO', bajo: 'BAJO' }[n] || n }
function riesgoLabel(n) { return nivelLabel(n) }
function riesgoEmoji(n) { return { muy_alto: '🔴', alto: '🟠', medio: '🟡', bajo: '🟢' }[n] || '' }
function pilarClass(n) {
  if (n === 'muy_alto' || n === 'alto') return 'pilar-critical'
  if (n === 'medio') return 'pilar-warn'
  return 'pilar-ok'
}
function pilarBadgeClass(n) {
  if (n === 'muy_alto' || n === 'alto') return 'badge-critical'
  if (n === 'medio') return 'badge-warn'
  return 'badge-ok'
}
function riesgoChipClass(n) {
  if (n === 'muy_alto') return 'bg-rose-100 text-rose-800'
  if (n === 'alto')     return 'bg-orange-100 text-orange-800'
  if (n === 'medio')    return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}
function recoClass(n) {
  if (n === 'muy_alto') return 'text-rose-700 font-semibold'
  if (n === 'alto')     return 'text-orange-700'
  if (n === 'medio')    return 'text-amber-700'
  return 'text-emerald-700'
}
function barClass(n) {
  if (n === 'muy_alto') return 'bg-rose-600'
  if (n === 'alto')     return 'bg-orange-500'
  if (n === 'medio')    return 'bg-amber-400'
  return 'bg-emerald-500'
}
</script>

<style scoped>
.impact-report {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}
.report-kicker {
  color: #334155; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;
}
.report-title {
  margin-top: 0.2rem; color: #0f172a; font-size: 1.02rem; font-weight: 600;
}
.status-pill {
  display: inline-flex; align-items: center; border-radius: 999px;
  padding: 0.26rem 0.7rem; font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid transparent;
}
.status-ok       { color: #166534; background: rgba(34,197,94,.16); border-color: rgba(21,128,61,.35); }
.status-risk     { color: #92400e; background: rgba(245,158,11,.2); border-color: rgba(217,119,6,.4); }
.status-critical { color: #9f1239; background: rgba(244,63,94,.18); border-color: rgba(225,29,72,.4); }
.report-body { display: grid; gap: 1rem; }
.sip-block {
  border: 1px solid rgba(148,163,184,.3); border-radius: 0.75rem;
  padding: 0.8rem; background: rgba(248,250,252,.7);
}
.sip-title { margin: 0; color: #0f172a; font-size: 0.9rem; font-weight: 700; }
.sip-subtitle { margin: 0; color: #334155; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.sip-grid {
  margin-top: 0.7rem; display: grid; gap: 0.6rem;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
@media (min-width: 920px) { .sip-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.sip-card { border: 1px solid rgba(148,163,184,.3); border-radius: 0.7rem; padding: 0.65rem; background: #ffffff; }
.sip-label { margin: 0; color: #475569; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
.sip-value { margin: 0.25rem 0 0; color: #0f172a; font-size: 0.88rem; font-weight: 700; }
.sip-note  { margin: 0.25rem 0 0; color: #334155; font-size: 0.82rem; line-height: 1.45; }
/* Pilares */
.pilar-block  { border-left: 4px solid #94a3b8; border-radius: 0.6rem; padding: 0.75rem; background: #f8fafc; }
.pilar-critical { border-left-color: #e11d48; background: #fff1f2; }
.pilar-warn     { border-left-color: #d97706; background: #fffbeb; }
.pilar-ok       { border-left-color: #16a34a; background: #f0fdf4; }
.pilar-header { display: flex; align-items: center; gap: 0.45rem; }
.pilar-title  { flex: 1; margin: 0; font-size: 0.86rem; font-weight: 700; color: #0f172a; }
.pilar-badge  { font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; }
.badge-critical { background: rgba(225,29,72,.15); color: #9f1239; }
.badge-warn     { background: rgba(217,119,6,.15);  color: #92400e; }
.badge-ok       { background: rgba(22,163,74,.15);  color: #166534; }
.pilar-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-top: 0.55rem; }
@media (max-width: 640px) { .pilar-body { grid-template-columns: 1fr; } }
.pilar-dato, .pilar-impacto {
  padding: 0.5rem; border-radius: 0.4rem;
  background: rgba(255,255,255,.8); border: 1px solid rgba(148,163,184,.25);
}
.pilar-dato-label { margin: 0; font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; }
.pilar-dato-value { margin: 0.25rem 0 0; font-size: 0.83rem; line-height: 1.42; color: #1e293b; }
.action-list { margin: 0.45rem 0 0; padding-left: 1rem; color: #1e293b; display: grid; gap: 0.35rem; font-size: 0.86rem; line-height: 1.5; }
:deep(.tech-value) {
  color: #0f172a; font-weight: 700;
  font-family: 'IBM Plex Mono', 'Consolas', monospace; font-size: 0.84em;
  background: rgba(226,232,240,.85); border: 1px solid rgba(100,116,139,.35);
  border-radius: 0.32rem; padding: 0.04rem 0.3rem;
}
</style>
