<template>
  <section class="memo-shell rounded-xl border px-4 py-4" :class="globalPanelClass">
    <div class="flex items-start justify-between gap-3 flex-wrap border-b border-slate-700/70 pb-3">
      <div>
        <p class="memo-kicker">Diagnostico de Ingenieria</p>
        <h3 class="memo-title">
          Partida
          <strong class="tech-value">{{ partidaLabel }}</strong>
        </h3>
      </div>
      <span class="status-pill" :class="globalStatusClass">{{ globalStatusLabel }}</span>
    </div>

    <div class="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
      <article class="memo-block">
        <p class="memo-block-title">Estatus Global</p>
        <p class="memo-text" :class="globalTextClass" v-html="narrativaGlobal"></p>
      </article>

      <article class="memo-block">
        <p class="memo-block-title">Analisis de Teñibilidad</p>
        <p class="memo-text" :class="tinturaRisk ? 'text-amber-200' : 'text-emerald-200'" v-html="narrativaColor"></p>
      </article>

      <article class="memo-block">
        <p class="memo-block-title">Comportamiento Mecanico</p>
        <p class="memo-text" :class="mechanicalTextClass" v-html="narrativaMecanica"></p>
        <p class="memo-text mt-2" :class="resilienceTextClass" v-html="narrativaResiliencia"></p>

        <div class="mt-3 border-t border-slate-700/70 pt-3">
          <p class="memo-block-title">Accion Sugerida por Ingenieria</p>
          <ul class="action-list mt-2">
            <li v-for="(item, idx) in accionesSugeridas" :key="idx" class="memo-text" v-html="item"></li>
          </ul>
        </div>
      </article>
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
  }
})

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const micValue = computed(() => parseNumber(props.mic))
const presionValue = computed(() => parseNumber(props.presionExprimido))
const tenacidadValue = computed(() => parseNumber(props.tenacidad))
const residualValue = computed(() => Number(props.elongacionResidual || 0))
const humedadValue = computed(() => parseNumber(props.humedadSalida))
const plegadorValue = computed(() => parseNumber(props.tensionPlegador))

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

const tensionJumpPct = computed(() => {
  const base = Number(tensionBase.value || 0)
  const plegador = Number(plegadorValue.value || 0)
  if (!base || !plegador) return 0
  return ((plegador - base) / base) * 100
})

const tinturaRisk = computed(() => {
  return Number(micValue.value) > 4.5 && Number(presionValue.value) > 60
})

const tensionRisk = computed(() => tensionJumpPct.value > 60)
const humedadCritica = computed(() => Number.isFinite(humedadValue.value) && Number(humedadValue.value) <= 6)
const humedadOptima = computed(() => Number.isFinite(humedadValue.value) && Number(humedadValue.value) > 6.5)
const resilienceExtremeRisk = computed(() => Number.isFinite(tenacidadValue.value) && Number(tenacidadValue.value) < 15.5 && residualValue.value < 5)
const resilienceGood = computed(() => Number.isFinite(tenacidadValue.value) && Number(tenacidadValue.value) >= 16.5 && residualValue.value >= 5)

const globalStatus = computed(() => {
  if (resilienceExtremeRisk.value || (humedadCritica.value && (tensionRisk.value || tinturaRisk.value))) return 'Critico'
  if (tinturaRisk.value || tensionRisk.value || !resilienceGood.value) return 'Riesgo'
  return 'Apto'
})

const globalStatusLabel = computed(() => {
  if (globalStatus.value === 'Critico') return '🔴 CRITICO / AJUSTE INMEDIATO'
  if (globalStatus.value === 'Riesgo') return '🟠 RIESGO / INTERVENCION RECOMENDADA'
  return '🟢 APTO / OPERACION ESTABLE'
})

const narrativaGlobal = computed(() => {
  if (globalStatus.value === 'Critico') {
    return 'Estamos ante una partida de contradicciones tecnicas: el hilo muestra fortaleza en laboratorio, pero la configuracion actual de proceso lo empuja a una ventana de falla evitable en tejeduria.'
  }
  if (globalStatus.value === 'Riesgo') {
    return 'La partida es operable con alertas: existe capacidad mecanica base, pero el balance entre teñibilidad, humedad y carga de tension necesita correcciones preventivas.'
  }
  return 'La partida se mantiene estable: los pilares de resistencia, elasticidad y proceso quimico estan alineados para tejeduria continua.'
})

const globalStatusClass = computed(() => {
  if (globalStatus.value === 'Critico') return 'status-critical'
  if (globalStatus.value === 'Riesgo') return 'status-risk'
  return 'status-ok'
})

const globalTextClass = computed(() => {
  if (globalStatus.value === 'Critico') return 'text-rose-200'
  if (globalStatus.value === 'Riesgo') return 'text-amber-200'
  return 'text-emerald-200'
})

const resilienceTextClass = computed(() => {
  if (resilienceExtremeRisk.value) return 'text-rose-200'
  if (resilienceGood.value) return 'text-emerald-200'
  return 'text-amber-200'
})

const mechanicalTextClass = computed(() => {
  if (humedadCritica.value || tensionRisk.value) return 'text-rose-200'
  if (humedadOptima.value) return 'text-emerald-200'
  return 'text-amber-200'
})

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

const narrativaColor = computed(() => {
  const mic = techValue(micValue.value, 2)
  const presion = techValue(presionValue.value, 1, 'kN')

  if (tinturaRisk.value) {
    return `⚠️ Riesgo de Tintura: Fibra gruesa con alta presion de exprimido; peligro de teñido superficial (Ring Dyeing) y baja penetracion de indigo. Con MIC ${mic} y presión ${presion}, aumenta la dificultad de difusion del leuco-indigo hacia el nucleo.`
  }

  if (Number(micValue.value) > 4.5) {
    return `MIC ${mic} indica fibra gruesa; aunque la presion actual (${presion}) no dispara alarma severa, persiste riesgo de Ring Dyeing y dificultad de difusion del leuco-indigo si se incrementa carga en foulards.`
  }

  return `La relacion MIC (${mic}) y presión de exprimido (${presion}) favorece una penetracion de indigo mas uniforme, con menor probabilidad de teñido anular.`
})

const narrativaMecanica = computed(() => {
  const residual = techValue(residualValue.value, 2, '%')
  const base = techValue(tensionBase.value, 0, 'N')
  const plegador = techValue(plegadorValue.value, 0, 'N')
  const salto = techValue(tensionJumpPct.value, 1, '%')
  const humedad = techValue(humedadValue.value, 1, '%')

  let texto = `La reserva elastica observada (${residual}) debe leerse junto al esfuerzo de traccion: la tension base (${base}) salta hasta el plegador S800 en ${plegador}, equivalente a un incremento de ${salto}. `

  if (tensionRisk.value) {
    texto += '⚠️ Tension Elevada: El incremento de tension hacia el plegador (S800) esta fatigando el hilo. Revisar estirajes en zona de secado. '
  }

  if (humedadCritica.value) {
    texto += `Con humedad de salida en ${humedad}, el hilo entra en estado de cristalizacion y fragilidad; la elasticidad disponible pierde efectividad real ante impactos del telar.`
    return texto
  }

  if (humedadOptima.value) {
    texto += `La humedad de salida (${humedad}) confirma un acondicionamiento optimo, mejorando la capacidad de absorcion de choque en tejeduria.`
    return texto
  }

  texto += `La humedad de salida (${humedad}) esta en zona intermedia; se recomienda ajuste fino para evitar endurecimiento progresivo del hilo.`
  return texto
})

const narrativaResiliencia = computed(() => {
  const tenacidad = techValue(tenacidadValue.value, 2, 'cN/tex')
  const residual = techValue(residualValue.value, 2, '%')

  if (resilienceExtremeRisk.value) {
    return `🚨 RIESGO EXTREMO: Hilo debil y sin elasticidad. No apto para urdimbre. Tenacidad ${tenacidad} con residual ${residual}.`
  }

  if (resilienceGood.value) {
    return `✅ Resiliencia Mecanica: La alta tenacidad compensa el estiraje acumulado, asegurando un comportamiento estable en tejeduria. Registro actual: ${tenacidad} y residual ${residual}.`
  }

  return `⚠️ Resiliencia en vigilancia: combinacion intermedia entre tenacidad (${tenacidad}) y elongacion residual (${residual}); mantener monitoreo de roturas en telar.`
})

const accionesSugeridas = computed(() => {
  const acciones = []

  if (humedadCritica.value) {
    acciones.push(`Hidratacion: elevar humedad de salida hacia <strong class="tech-value">7,0 %</strong> para recuperar mano y flexibilidad del hilo antes de fijacion de goma.`)
  }

  if (tensionRisk.value) {
    acciones.push(`Tensiones: aliviar carga sobre plegador S800 corrigiendo stretch en secado; salto actual estimado en <strong class="tech-value">${formatNumber(tensionJumpPct.value, 1)} %</strong>.`)
  }

  if (tinturaRisk.value) {
    acciones.push('Quimica: evaluar reduccion de presion de exprimido a <strong class="tech-value">60,0 kN</strong> o aumentar pre-humectado para mejorar apertura de fibra con MIC alto.')
  }

  if (!acciones.length) {
    acciones.push('Mantener setpoints actuales y monitoreo de tendencia para sostener estabilidad de tejeduria y teñibilidad.')
  }

  return acciones
})

const globalPanelClass = computed(() => {
  if (globalStatus.value === 'Critico') return 'border-rose-500/40 bg-rose-500/10'
  if (globalStatus.value === 'Riesgo') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-emerald-500/40 bg-emerald-500/10'
})
</script>

<style scoped>
.memo-shell {
  background:
    linear-gradient(145deg, rgba(2, 6, 23, 0.92) 0%, rgba(15, 23, 42, 0.88) 100%),
    repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.035) 0px, rgba(148, 163, 184, 0.035) 1px, transparent 1px, transparent 28px);
}

.memo-kicker {
  color: #94a3b8;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.memo-title {
  margin-top: 0.2rem;
  color: #e2e8f0;
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
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.35);
}

.status-risk {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
}

.status-critical {
  color: #fecdd3;
  background: rgba(244, 63, 94, 0.2);
  border-color: rgba(244, 63, 94, 0.42);
}

.memo-block {
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.5);
  padding: 0.8rem 0.85rem;
}

.memo-block-title {
  color: #94a3b8;
  font-size: 0.69rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.memo-text {
  margin-top: 0.45rem;
  font-size: 0.83rem;
  line-height: 1.5;
}

:deep(.tech-value) {
  color: #f8fafc;
  font-weight: 700;
  font-family: 'IBM Plex Mono', 'Consolas', 'Courier New', monospace;
  font-size: 0.83em;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.32rem;
  padding: 0.04rem 0.3rem;
}

.action-list {
  margin: 0;
  padding-left: 1.05rem;
  display: grid;
  gap: 0.45rem;
}
</style>
