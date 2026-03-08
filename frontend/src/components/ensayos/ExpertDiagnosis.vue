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
      <p class="report-line" :class="globalTextClass">
        <strong>🧭 Estatus Global:</strong>
        <span class="tab-indent"></span>
        <span v-html="narrativaGlobal"></span>
      </p>

      <p class="report-line" :class="amlCelTextClass">
        <strong>🚨 Fallas Operativas (AML/CEL):</strong>
        <span class="tab-indent"></span>
        <span v-html="narrativaAmlCel"></span>
      </p>

      <p class="report-line" :class="tinturaTextClass">
        <strong>🎨 Analisis de Teñibilidad:</strong>
        <span class="tab-indent"></span>
        <span v-html="narrativaColor"></span>
      </p>

      <p class="report-line" :class="mecanicaTextClass">
        <strong>🛠️ Comportamiento Mecanico:</strong>
        <span class="tab-indent"></span>
        <span v-html="narrativaMecanica"></span>
      </p>

      <p class="report-line" :class="resilienciaTextClass">
        <strong>🧵 Balance de Resiliencia:</strong>
        <span class="tab-indent"></span>
        <span v-html="narrativaResiliencia"></span>
      </p>

      <p class="report-line text-slate-700" v-html="narrativaAcciones"></p>
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
  const source = Array.isArray(amlCelValue.value?.eventos) ? amlCelValue.value.eventos : []
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
  gap: 0.55rem;
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
