<template>
  <section class="impact-report rounded-2xl border border-slate-300 bg-white p-5 shadow-lg">
    <div class="flex items-start justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
      <div>
        <p class="report-kicker">Dictamen de Auditoria Operativa</p>
        <h3 class="report-title">
          Dictamen Tecnico | Partida
          <strong class="tech-value">{{ partidaLabel }}</strong>
        </h3>
      </div>
      <span class="status-pill" :class="globalStatusClass">{{ globalStatusLabel }}</span>
    </div>

    <div class="report-body mt-4">
      <section class="sip-block">
        <h4 class="sip-title">1. Resumen Ejecutivo (Dashboard)</h4>
        <div class="sip-grid">
          <article class="sip-card">
            <p class="sip-label">Estado de la Partida</p>
            <p class="sip-value" :class="globalTextClass">{{ globalStatusLabel }}</p>
            <p class="sip-note" v-html="narrativaGlobal"></p>
          </article>

          <article class="sip-card">
            <p class="sip-label">Eficiencia Operativa</p>
            <p class="sip-value" :class="eficienciaOperativa.className">
              Marcha {{ formatNumber(eficienciaOperativa.marchaPct, 1) }}% | Parado/Lento {{ formatNumber(eficienciaOperativa.paradaPct, 1) }}%
            </p>
            <p class="sip-note">
              {{ operParadasCount }} paradas, {{ operSlowCount }} ciclos de velocidad lenta, {{ gomaLoadAlerts }} alertas de goma.
            </p>
          </article>

          <article class="sip-card">
            <p class="sip-label">KPI de Calidad</p>
            <p class="sip-value" :class="micPresionCompatibilidad.className">
              MIC {{ formatNumber(micValue, 2) }} vs Presion {{ formatNumber(presionValue, 1) }} kN
            </p>
            <p class="sip-note">{{ micPresionCompatibilidad.message }}</p>
          </article>
        </div>

        <p v-if="amlCelResumen" class="report-line text-slate-700 mt-3">
          <strong>Resumen AML/CEL:</strong>
          <span class="tab-indent"></span>
          {{ amlCelResumen }}
        </p>
      </section>

      <section class="sip-block">
        <h4 class="sip-title">2. Analisis Tecnico de la Condicion (S.I.P. - Situacion e Impacto)</h4>
        <p class="report-line" :class="tinturaTextClass">
          <strong>Interaccion Fibra-Colorante:</strong>
          <span class="tab-indent"></span>
          <span v-html="sipInteraccionFibra"></span>
        </p>

        <p class="report-line" :class="mecanicaTextClass">
          <strong>Dinamica Mecanica:</strong>
          <span class="tab-indent"></span>
          <span v-html="sipDinamicaMecanica"></span>
        </p>
      </section>

      <section class="sip-block">
        <h4 class="sip-title">3. Hallazgos de Desviacion (Datos brutos procesados)</h4>

        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="px-3 py-2 text-left">Hora</th>
                <th class="px-3 py-2 text-left">Tipo</th>
                <th class="px-3 py-2 text-left">Codigo</th>
                <th class="px-3 py-2 text-left">Detalle</th>
                <th class="px-3 py-2 text-left">Severidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in criticalEvents" :key="event.key" class="border-t border-slate-200">
                <td class="px-3 py-2 font-medium text-slate-700">{{ event.hora }}</td>
                <td class="px-3 py-2 text-slate-700">{{ event.tipo }}</td>
                <td class="px-3 py-2 text-slate-700">{{ event.codigo }}</td>
                <td class="px-3 py-2 text-slate-700">{{ event.detalle }}</td>
                <td class="px-3 py-2" :class="event.severityClass">{{ event.severidad }}</td>
              </tr>
              <tr v-if="!criticalEvents.length">
                <td colspan="5" class="px-3 py-3 text-slate-500">Sin eventos criticos para la corrida auditada.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th class="px-3 py-2 text-left">Setpoint</th>
                <th class="px-3 py-2 text-left">Objetivo</th>
                <th class="px-3 py-2 text-left">Actual</th>
                <th class="px-3 py-2 text-left">Desviacion</th>
                <th class="px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in setpointRows" :key="row.name" class="border-t border-slate-200">
                <td class="px-3 py-2 font-medium text-slate-700">{{ row.name }}</td>
                <td class="px-3 py-2 text-slate-700">{{ row.target }}</td>
                <td class="px-3 py-2 text-slate-700">{{ row.actual }}</td>
                <td class="px-3 py-2 text-slate-700">{{ row.deviation }}</td>
                <td class="px-3 py-2" :class="row.stateClass">{{ row.state }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="sip-block">
        <h4 class="sip-title">4. Plan de Accion Correctiva (S.I.P. - Propuesta)</h4>

        <p class="sip-subtitle">Acciones inmediatas sobre la maquina</p>
        <ol class="action-list">
          <li v-for="(accion, idx) in machineActions" :key="`maquina-${idx}`">{{ accion }}</li>
        </ol>

        <p class="sip-subtitle mt-4">Acciones sobre el producto</p>
        <ol class="action-list">
          <li v-for="(accion, idx) in productActions" :key="`producto-${idx}`">{{ accion }}</li>
        </ol>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  partida: {
    type: String,
    default: ''
  },
  mic: {
    type: Number,
    default: null
  },
  presionExprimido: {
    type: Number,
    default: null
  },
  tenacidad: {
    type: Number,
    default: null
  },
  elongacionResidual: {
    type: Number,
    default: 0
  },
  humedadSalida: {
    type: Number,
    default: null
  },
  tensionPlegador: {
    type: Number,
    default: null
  },
  tensionTimeline: {
    type: Array,
    default: () => []
  },
  amlCel: {
    type: Object,
    default: () => ({
      total: 0,
      aml: 0,
      cel: 0,
      riesgo: 'bajo',
      codigos: [],
      recurrentes: [],
      eventos: []
    })
  }
})

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatNumber(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'N/D'
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

function techValue(value, decimals = 2, unit = '') {
  const numberText = formatNumber(value, decimals)
  const suffix = unit ? ` ${unit}` : ''
  return `<strong class="tech-value">${numberText}${suffix}</strong>`
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHour(value) {
  const m = String(value || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
  return m ? m[0].slice(0, 5) : null
}

const micValue = computed(() => parseNumber(props.mic))
const presionValue = computed(() => parseNumber(props.presionExprimido))
const tenacidadValue = computed(() => parseNumber(props.tenacidad))
const residualValue = computed(() => Number(props.elongacionResidual || 0))
const humedadValue = computed(() => parseNumber(props.humedadSalida))
const plegadorValue = computed(() => parseNumber(props.tensionPlegador))
const amlCelValue = computed(() => (props.amlCel && typeof props.amlCel === 'object' ? props.amlCel : {}))
const amlCelResumen = computed(() => String(amlCelValue.value?.resumen || '').trim())

const timeline = computed(() => {
  if (!Array.isArray(props.tensionTimeline)) return []
  return props.tensionTimeline
    .map((item) => {
      const punto = String(item?.punto || '').trim()
      const tensionN = parseNumber(item?.tensionN)
      if (!punto || !Number.isFinite(tensionN)) return null
      return { punto, tensionN }
    })
    .filter(Boolean)
})

const tensionBase = computed(() => {
  const m12 = timeline.value.find((item) => /M12|BATEA/i.test(item.punto))
  if (m12) return m12.tensionN
  return timeline.value[0]?.tensionN ?? null
})

const partidaLabel = computed(() => String(props.partida || '').trim() || 'N/D')

const amlCelEvents = computed(() => {
  const source = Array.isArray(amlCelValue.value?.eventosRelevantes)
    ? amlCelValue.value.eventosRelevantes
    : (Array.isArray(amlCelValue.value?.eventos) ? amlCelValue.value.eventos : [])
  return source
    .map((event) => {
      if (!event || typeof event !== 'object') return null
      const tipo = String(event.tipo || '').trim().toUpperCase() || null
      const codigo = String(event.codigo || '').trim().toUpperCase() || null
      const detalle = String(event.detalle || '').trim() || null
      const detalleNorm = normalizeText(detalle)
      const timestamp = String(event.timestamp || '').trim() || null
      const severidad = String(event.severidad || '').trim().toLowerCase() || 'medio'
      if (!tipo && !codigo && !detalle) return null
      return { tipo, codigo, detalle, detalleNorm, timestamp, severidad }
    })
    .filter(Boolean)
})

const amlCelRecurrentes = computed(() => {
  const source = Array.isArray(amlCelValue.value?.recurrentes) ? amlCelValue.value.recurrentes : []
  return source
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const codigo = String(item.codigo || '').trim().toUpperCase()
      const count = parseNumber(item.count)
      if (!codigo || !Number.isFinite(count)) return null
      return { codigo, count: Number(count) }
    })
    .filter(Boolean)
})

const amlCelCounts = computed(() => {
  const map = new Map()
  for (const event of amlCelEvents.value) {
    const code = String(event.codigo || '').toUpperCase()
    if (!code) continue
    map.set(code, (map.get(code) || 0) + 1)
  }
  for (const item of amlCelRecurrentes.value) {
    const prev = map.get(item.codigo) || 0
    map.set(item.codigo, Math.max(prev, item.count))
  }
  return map
})

const amlCelTotal = computed(() => {
  const direct = parseNumber(amlCelValue.value?.total)
  return Number.isFinite(direct) ? Number(direct) : amlCelEvents.value.length
})

const operParadasCount = computed(() => (
  amlCelEvents.value.filter((event) => /grelha\s+aberta|\bparada\b/.test(event.detalleNorm)).length
))

const operSlowCount = computed(() => (
  amlCelEvents.value.filter((event) => /velocidade\s+lenta|rasteje\s+velocidade/.test(event.detalleNorm)).length
))

const gomaLoadAlerts = computed(() => (
  amlCelEvents.value.filter((event) => event.codigo === 'S500' || /carg\s*a\s*de\s*goma/.test(event.detalleNorm)).length
))

const firstStopHour = computed(() => {
  const first = amlCelEvents.value.find((event) => /grelha\s+aberta|\bparada\b|velocidade\s+lenta/.test(event.detalleNorm))
  return extractHour(first?.timestamp)
})

const recurrentS800 = computed(() => Number(amlCelCounts.value.get('S800') || 0) >= 2)
const recurrentS500 = computed(() => Number(amlCelCounts.value.get('S500') || 0) >= 2)
const amlCelCritical = computed(() => {
  if (recurrentS800.value || recurrentS500.value) return true
  if (operParadasCount.value >= 2) return true
  if (operParadasCount.value >= 1 && operSlowCount.value >= 2) return true
  return false
})
const amlCelHigh = computed(() => {
  if (amlCelCritical.value) return true
  if (operParadasCount.value >= 1 || operSlowCount.value >= 1 || gomaLoadAlerts.value >= 1) return true
  return amlCelTotal.value >= 4
})

const tensionJumpPct = computed(() => {
  const base = Number(tensionBase.value || 0)
  const plegador = Number(plegadorValue.value || 0)
  if (!base || !plegador) return 0
  return ((plegador - base) / base) * 100
})

const tinturaRisk = computed(() => Number(micValue.value) > 4.5 && Number(presionValue.value) > 60)
const tensionRisk = computed(() => tensionJumpPct.value > 60)
const humedadCritica = computed(() => Number.isFinite(humedadValue.value) && Number(humedadValue.value) <= 6)
const humedadOptima = computed(() => Number.isFinite(humedadValue.value) && Number(humedadValue.value) > 6.5)
const resilienceExtremeRisk = computed(() => Number.isFinite(tenacidadValue.value) && Number(tenacidadValue.value) < 15.5 && residualValue.value < 5)
const resilienceGood = computed(() => Number.isFinite(tenacidadValue.value) && Number(tenacidadValue.value) >= 16.5 && residualValue.value >= 5)

const globalStatus = computed(() => {
  if (amlCelCritical.value) return 'Critico'
  if (resilienceExtremeRisk.value) return 'Critico'
  if (humedadCritica.value && (amlCelHigh.value || tensionRisk.value || tinturaRisk.value)) return 'Critico'
  if (amlCelHigh.value) return 'Riesgo'
  if (tinturaRisk.value || tensionRisk.value || !resilienceGood.value) return 'Riesgo'
  return 'Apto'
})

const globalStatusLabel = computed(() => {
  if (globalStatus.value === 'Critico') return '🔴 CRITICO / AJUSTE INMEDIATO'
  if (globalStatus.value === 'Riesgo') return '🟠 RIESGO / INTERVENCION RECOMENDADA'
  return '🟢 APTO / OPERACION ESTABLE'
})

const globalTextClass = computed(() => {
  if (globalStatus.value === 'Critico') return 'text-rose-700'
  if (globalStatus.value === 'Riesgo') return 'text-amber-700'
  return 'text-emerald-700'
})

const tinturaTextClass = computed(() => (tinturaRisk.value ? 'text-amber-700' : 'text-emerald-700'))

const mecanicaTextClass = computed(() => {
  if (humedadCritica.value || tensionRisk.value) return 'text-rose-700'
  if (humedadOptima.value) return 'text-emerald-700'
  return 'text-amber-700'
})

const amlCelTextClass = computed(() => {
  if (amlCelCritical.value) return 'text-rose-700'
  if (amlCelHigh.value) return 'text-amber-700'
  return 'text-emerald-700'
})

const resilienciaTextClass = computed(() => {
  if (resilienceExtremeRisk.value) return 'text-rose-700'
  if (resilienceGood.value) return 'text-emerald-700'
  return 'text-amber-700'
})

const narrativaGlobal = computed(() => {
  if (globalStatus.value === 'Critico') {
    if (amlCelCritical.value) {
      const horaTxt = firstStopHour.value ? ` a las ${techValue(firstStopHour.value, 0)}` : ''
      return `Se detectaron ${techValue(operParadasCount.value, 0)} paradas operativas${horaTxt} y ${techValue(operSlowCount.value, 0)} ciclos de velocidad lenta. Esta secuencia interrumpio la aplicacion de goma y genero picos de tension al reinicio del S800.`
    }
    return 'El proceso no cumple condicion estable de operacion: la fisica del hilo queda invalidada por hidratacion critica y regimen mecanico agresivo.'
  }
  if (globalStatus.value === 'Riesgo') {
    if (amlCelHigh.value) {
      return `La partida presenta inestabilidad operativa: ${techValue(operParadasCount.value, 0)} paradas y ${techValue(gomaLoadAlerts.value, 0)} alertas de carga de goma, con riesgo directo de variacion en pickup y tono.`
    }
    return 'La partida es operable con condicionamiento: requiere correccion de setpoints antes de liberar a produccion continua.'
  }
  return 'Operacion estable en la corrida auditada: no se registraron fallas operativas criticas que comprometan continuidad.'
})

const narrativaAmlCel = computed(() => {
  const paradas = techValue(operParadasCount.value, 0)
  const lentas = techValue(operSlowCount.value, 0)
  const goma = techValue(gomaLoadAlerts.value, 0)
  const s800 = techValue(Number(amlCelCounts.value.get('S800') || 0), 0)
  const s500 = techValue(Number(amlCelCounts.value.get('S500') || 0), 0)
  const presion = techValue(presionValue.value, 1, 'kN')
  const tension = techValue(plegadorValue.value, 0, 'N')
  const hora = firstStopHour.value ? ` a las ${techValue(firstStopHour.value, 0)}` : ''

  if (operParadasCount.value > 0 || operSlowCount.value > 0 || gomaLoadAlerts.value > 0) {
    return `Se detectaron ${paradas} paradas${hora}, ${lentas} eventos de velocidad lenta y ${goma} alertas de carga de goma (S800=${s800}, S500=${s500}). La secuencia parada-reinicio trabajó con presion ${presion} y tension de plegador ${tension}, elevando la variabilidad de pickup y comprometiendo uniformidad de teñido.`
  }
  if (amlCelTotal.value > 0) {
    return `Se registraron ${techValue(amlCelTotal.value, 0)} eventos AML/CEL sin evidencia de paro operativo; no se observa impacto severo en continuidad.`
  }
  return 'No se registraron fallas AML/CEL en la traza auditada de la corrida.'
})

const narrativaColor = computed(() => {
  const mic = techValue(micValue.value, 2)
  const presion = techValue(presionValue.value, 1, 'kN')

  if (amlCelHigh.value && (tinturaRisk.value || gomaLoadAlerts.value > 0)) {
    return `Con MIC ${mic}, presion ${presion} y fallas operativas de goma, la partida queda expuesta a barras de tono y baja penetracion de indigo.`
  }
  if (tinturaRisk.value) {
    return `Con MIC ${mic} y presion ${presion}, la condicion de exprimido es agresiva para difusión de leuco-indigo y aumenta riesgo de Ring Dyeing.`
  }
  if (Number(micValue.value) > 4.5) {
    return `MIC ${mic} indica fibra gruesa; la presion ${presion} exige control fino para evitar penetracion irregular.`
  }
  return `Balance MIC-presion controlado (MIC ${mic}, presion ${presion}), sin evidencia de desviacion de teñido en esta corrida.`
})

const narrativaMecanica = computed(() => {
  const residual = techValue(residualValue.value, 2, '%')
  const base = techValue(tensionBase.value, 0, 'N')
  const plegador = techValue(plegadorValue.value, 0, 'N')
  const salto = techValue(tensionJumpPct.value, 1, '%')
  const humedad = techValue(humedadValue.value, 1, '%')

  let texto = `Reserva elastica ${residual}; salto de tension ${base} -> ${plegador} (${salto}). `

  if (humedadCritica.value && amlCelHigh.value) {
    texto += `El proceso no cumple con estandares de hidratacion (${humedad}) debido a paradas recurrentes; ajustar setpoint de secado post-parada para evitar cristalizacion y rotura prematura.`
    return texto
  }

  if (humedadCritica.value) {
    texto += `Con humedad ${humedad}, el hilo queda fragil y pierde absorcion de choque.`
    return texto
  }

  if (tensionRisk.value) {
    texto += 'La rampa de tension hacia S800 acelera fatiga de urdimbre y reduce margen de seguridad en reinicios.'
    return texto
  }

  if (humedadOptima.value) {
    texto += `Humedad ${humedad}: condicion correcta para estabilidad de tejeduria.`
    return texto
  }

  texto += `Humedad ${humedad}: condicion intermedia, requiere ajuste fino de secado.`
  return texto
})

const narrativaResiliencia = computed(() => {
  const tenacidad = techValue(tenacidadValue.value, 2, 'cN/tex')
  const residual = techValue(residualValue.value, 2, '%')

  if (resilienceExtremeRisk.value) {
    return `Tenacidad ${tenacidad} y residual ${residual}: la estructura del hilo no sostiene regimen severo de telar.`
  }
  if (resilienceGood.value) {
    return `Tenacidad ${tenacidad} y residual ${residual}: base mecanica apta para continuidad.`
  }
  return `Tenacidad ${tenacidad} y residual ${residual}: condicion intermedia, sensible a variaciones de proceso.`
})

const accionesSugeridas = computed(() => {
  const acciones = []

  if (operParadasCount.value > 0) {
    acciones.push(`Eliminar causa de paradas por seguridad (grelha/paro) antes de liberar lote; registradas <strong class="tech-value">${formatNumber(operParadasCount.value, 0)}</strong> incidencias.`)
  }
  if (operSlowCount.value > 0) {
    acciones.push(`Corregir lazo de velocidad por ciclos de "velocidade lenta" (<strong class="tech-value">${formatNumber(operSlowCount.value, 0)}</strong> eventos) para evitar picos de tension al reinicio.`)
  }
  if (gomaLoadAlerts.value > 0) {
    acciones.push(`Recalibrar control de carga de goma S500 y validar viscosidad; se detectaron <strong class="tech-value">${formatNumber(gomaLoadAlerts.value, 0)}</strong> alertas.`)
  }
  if (humedadCritica.value) {
    acciones.push('Ajustar secado post-parada para sostener humedad de salida en <strong class="tech-value">7,0 %</strong> y cortar fragilidad por cristalizacion.')
  }
  if (tensionRisk.value) {
    acciones.push(`Reducir carga de S800; salto actual <strong class="tech-value">${formatNumber(tensionJumpPct.value, 1)} %</strong> supera banda segura.`)
  }
  if (tinturaRisk.value) {
    acciones.push('Bajar exprimido hacia <strong class="tech-value">60,0 kN</strong> o reforzar pre-humectado para estabilizar penetracion de indigo.')
  }
  if (resilienceExtremeRisk.value) {
    acciones.push('No liberar a telar continuo hasta recuperar margen mecanico de tenacidad/elongacion residual.')
  }
  if (!acciones.length) {
    acciones.push('Continuar con setpoints actuales; no se observaron fallas operativas criticas en el log auditado.')
  }

  return acciones
})

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
  if (!Number.isFinite(micValue.value) || !Number.isFinite(presionValue.value)) {
    return {
      className: 'text-slate-700',
      message: 'Sin datos suficientes para evaluar compatibilidad MIC-Presion.'
    }
  }

  if (Math.abs(Number(pressureDelta.value)) <= 1.5) {
    return {
      className: 'text-emerald-700',
      message: `Condicion compatible: presion dentro de banda para MIC ${formatNumber(micValue.value, 2)}.`
    }
  }

  if (Number(pressureDelta.value) > 1.5) {
    return {
      className: 'text-rose-700',
      message: `Presion alta para esta fibra. Objetivo local sugerido: ${formatNumber(micPressureTarget.value, 1)} kN.`
    }
  }

  return {
    className: 'text-amber-700',
    message: `Presion por debajo del objetivo local (${formatNumber(micPressureTarget.value, 1)} kN). Revisar pickup real.`
  }
})

const eficienciaOperativa = computed(() => {
  const penalizacion = (operParadasCount.value * 12) + (operSlowCount.value * 5) + (gomaLoadAlerts.value * 2)
  const paradaPct = Math.min(95, Math.max(0, penalizacion))
  const marchaPct = Math.max(5, 100 - paradaPct)

  if (marchaPct < 65) {
    return { marchaPct, paradaPct, className: 'text-rose-700' }
  }
  if (marchaPct < 80) {
    return { marchaPct, paradaPct, className: 'text-amber-700' }
  }
  return { marchaPct, paradaPct, className: 'text-emerald-700' }
})

const sipInteraccionFibra = computed(() => {
  const mic = techValue(micValue.value, 2)
  const presion = techValue(presionValue.value, 1, 'kN')
  const objetivo = Number.isFinite(micPressureTarget.value)
    ? techValue(micPressureTarget.value, 1, 'kN')
    : '<strong class="tech-value">N/D</strong>'

  if (Number(pressureDelta.value) > 1.5) {
    return `La presion de exprimido ${presion} es superior al objetivo local ${objetivo} para MIC ${mic}. Esta condicion aumenta migracion superficial y riesgo de Ring Dyeing.`
  }
  if (Number(pressureDelta.value) < -1.5) {
    return `La presion de exprimido ${presion} esta por debajo del objetivo local ${objetivo} para MIC ${mic}. Puede comprometer fijacion y tono final si no se compensa con control de pickup.`
  }
  return `Relacion MIC-Presion en zona compatible (MIC ${mic}, Presion ${presion}), con menor riesgo de desviacion de teñido por exprimido.`
})

const acumuladorAlerts = computed(() => (
  amlCelEvents.value.filter((event) => /acumulador/.test(event.detalleNorm)).length
))

const sipDinamicaMecanica = computed(() => {
  const salto = techValue(tensionJumpPct.value, 1, '%')
  const base = techValue(tensionBase.value, 0, 'N')
  const plegador = techValue(plegadorValue.value, 0, 'N')
  const acumulador = techValue(acumuladorAlerts.value, 0)

  if (tensionJumpPct.value > 40 || operParadasCount.value > 0 || operSlowCount.value > 0) {
    return `Se observa dinamica mecanica inestable: salto de tension ${salto} (${base} -> ${plegador}), ${techValue(operParadasCount.value, 0)} paradas y ${techValue(operSlowCount.value, 0)} ciclos lentos. Registros vinculados a acumulador: ${acumulador}.`
  }
  return `Dinamica mecanica estable: salto de tension ${salto} (${base} -> ${plegador}) y sin evidencia de uso critico del acumulador.`
})

const criticalEvents = computed(() => {
  return amlCelEvents.value
    .filter((event) => {
      if (!event.timestamp || !event.codigo || !event.detalle) return false
      if (event.severidad === 'critical' || event.severidad === 'alto') return true
      if (event.codigo === 'S800' || event.codigo === 'S500' || event.codigo === '1485') return true
      return /grelha\s+aberta|\bparada\b|velocidade\s+lenta|carg\s*a\s*de\s*goma/.test(event.detalleNorm)
    })
    .slice(0, 12)
    .map((event, idx) => {
      const severityNorm = String(event.severidad || '').toLowerCase()
      const severityClass = severityNorm === 'critical' || severityNorm === 'alto'
        ? 'text-rose-700 font-semibold'
        : (severityNorm === 'medio' ? 'text-amber-700 font-medium' : 'text-slate-700')

      return {
        key: `${event.codigo}-${event.timestamp}-${idx}`,
        hora: extractHour(event.timestamp) || event.timestamp,
        tipo: event.tipo,
        codigo: event.codigo,
        detalle: event.detalle,
        severidad: severityNorm || 'medio',
        severityClass
      }
    })
})

const setpointRows = computed(() => {
  const humedadObj = 7
  const humedadNow = Number.isFinite(humedadValue.value) ? humedadValue.value : null
  const humedadDev = Number.isFinite(humedadNow) ? Number((humedadNow - humedadObj).toFixed(2)) : null

  const gomaState = gomaLoadAlerts.value === 0 ? 'OK' : 'Desviado'
  const gomaClass = gomaLoadAlerts.value === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'

  const humedadState = !Number.isFinite(humedadNow)
    ? 'Sin dato'
    : (Math.abs(humedadDev) <= 0.4 ? 'OK' : 'Desviado')
  const humedadClass = !Number.isFinite(humedadNow)
    ? 'text-slate-600'
    : (Math.abs(humedadDev) <= 0.4 ? 'text-emerald-700' : 'text-rose-700 font-semibold')

  const presionState = !Number.isFinite(pressureDelta.value)
    ? 'Sin dato'
    : (Math.abs(pressureDelta.value) <= 1.5 ? 'OK' : 'Desviado')
  const presionClass = !Number.isFinite(pressureDelta.value)
    ? 'text-slate-600'
    : (Math.abs(pressureDelta.value) <= 1.5 ? 'text-emerald-700' : 'text-rose-700 font-semibold')

  return [
    {
      name: 'Goma',
      target: '0 alertas S500/1485',
      actual: `${formatNumber(gomaLoadAlerts.value, 0)} alertas`,
      deviation: `${formatNumber(gomaLoadAlerts.value, 0)} eventos`,
      state: gomaState,
      stateClass: gomaClass
    },
    {
      name: 'Humedad',
      target: '7.0 %',
      actual: Number.isFinite(humedadNow) ? `${formatNumber(humedadNow, 2)} %` : 'Sin dato',
      deviation: Number.isFinite(humedadDev)
        ? `${humedadDev > 0 ? '+' : ''}${formatNumber(humedadDev, 2)} %`
        : 'Sin dato',
      state: humedadState,
      stateClass: humedadClass
    },
    {
      name: 'Presion de exprimido',
      target: Number.isFinite(micPressureTarget.value)
        ? `${formatNumber(micPressureTarget.value, 1)} kN`
        : 'Sin dato',
      actual: Number.isFinite(presionValue.value) ? `${formatNumber(presionValue.value, 1)} kN` : 'Sin dato',
      deviation: Number.isFinite(pressureDelta.value)
        ? `${pressureDelta.value > 0 ? '+' : ''}${formatNumber(pressureDelta.value, 1)} kN`
        : 'Sin dato',
      state: presionState,
      stateClass: presionClass
    }
  ]
})

const machineActions = computed(() => {
  const actions = []

  if (Number(pressureDelta.value) > 1.5 && Number.isFinite(micPressureTarget.value)) {
    actions.push(`Ajustar presion de foulard a ${formatNumber(micPressureTarget.value, 1)} kN para alinear MIC y exprimido.`)
  }
  if (operParadasCount.value > 0 || operSlowCount.value > 0) {
    actions.push('Implementar rampa de aceleracion suave post-parada en S800 para reducir picos de tension.')
  }
  if (tensionJumpPct.value > 40) {
    actions.push(`Reducir salto de tension de plegador: actual ${formatNumber(tensionJumpPct.value, 1)}%, objetivo <= 40%.`)
  }
  if (gomaLoadAlerts.value > 0) {
    actions.push('Recalibrar lazo de carga de goma y verificar viscosidad/temperatura antes de reinicio.')
  }
  if (humedadCritica.value) {
    actions.push('Subir setpoint de humedad de salida hacia 7.0% para evitar fragilidad y cristalizacion del hilo.')
  }
  if (!actions.length) {
    actions.push('Mantener setpoints actuales y continuar monitoreo por turno.')
  }

  return actions
})

const productActions = computed(() => {
  const actions = []

  if (tinturaRisk.value || Number(pressureDelta.value) > 1.5) {
    actions.push('Retener lote para verificacion de ring dyeing y solidez al lavado antes de liberar.')
    actions.push('Evaluar correccion de tono o re-teñido segun resultado de laboratorio de acabado.')
  }

  if (resilienceExtremeRisk.value || tensionJumpPct.value > 60) {
    actions.push('Restringir uso en tejeduria continua hasta recuperar margen mecanico de hilo.')
  }

  if (!actions.length) {
    actions.push('Liberar con seguimiento reforzado de primera corrida en tejeduria.')
  }

  return actions
})

const narrativaAcciones = computed(() => {
  const lineas = accionesSugeridas.value.map((item) => `\t🔧 ${item}`).join('<br />')
  return `<strong>📌 Accion Sugerida por Ingenieria:</strong><span class="tab-indent"></span>${lineas}`
})

const globalStatusClass = computed(() => {
  if (globalStatus.value === 'Critico') return 'status-critical'
  if (globalStatus.value === 'Riesgo') return 'status-risk'
  return 'status-ok'
})
</script>

<style scoped>
.impact-report {
  background:
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%),
    repeating-linear-gradient(0deg, rgba(15, 23, 42, 0.03) 0px, rgba(15, 23, 42, 0.03) 1px, transparent 1px, transparent 30px);
}

.report-kicker {
  color: #334155;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.report-title {
  margin-top: 0.2rem;
  color: #0f172a;
  font-size: 1.02rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.26rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.status-ok {
  color: #166534;
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(21, 128, 61, 0.35);
}

.status-risk {
  color: #92400e;
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(217, 119, 6, 0.4);
}

.status-critical {
  color: #9f1239;
  background: rgba(244, 63, 94, 0.18);
  border-color: rgba(225, 29, 72, 0.4);
}

.report-body {
  display: grid;
  gap: 1rem;
}

.sip-block {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.75rem;
  padding: 0.8rem;
  background: rgba(248, 250, 252, 0.7);
}

.sip-title {
  margin: 0;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.sip-grid {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.6rem;
}

.sip-card {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.7rem;
  padding: 0.65rem;
  background: #ffffff;
}

.sip-label {
  margin: 0;
  color: #475569;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sip-value {
  margin: 0.25rem 0 0;
  color: #0f172a;
  font-size: 0.88rem;
  font-weight: 700;
}

.sip-note {
  margin: 0.25rem 0 0;
  color: #334155;
  font-size: 0.82rem;
  line-height: 1.45;
}

.sip-subtitle {
  margin: 0;
  color: #334155;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.action-list {
  margin: 0.45rem 0 0;
  padding-left: 1rem;
  color: #1e293b;
  display: grid;
  gap: 0.35rem;
  font-size: 0.86rem;
}

.report-line {
  margin: 0;
  color: #1e293b;
  font-size: 0.9rem;
  line-height: 1.62;
  border-left: 3px solid rgba(100, 116, 139, 0.28);
  padding-left: 0.85rem;
}

.tab-indent {
  display: inline-block;
  width: 1.2rem;
}

@media (min-width: 920px) {
  .sip-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

:deep(.tech-value) {
  color: #0f172a;
  font-weight: 700;
  font-family: 'IBM Plex Mono', 'Consolas', 'Courier New', monospace;
  font-size: 0.84em;
  background: rgba(226, 232, 240, 0.85);
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 0.32rem;
  padding: 0.04rem 0.3rem;
}
</style>
