<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-wrap items-end gap-3 mb-3">
        <div class="flex flex-col gap-1">
          <label for="loteInput" class="text-sm font-medium text-slate-700">Lote</label>
          <input
            id="loteInput"
            v-model="loteInput"
            type="text"
            placeholder="Ej: 109"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-36"
            @keydown.enter.prevent="analizarLote"
          />
        </div>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          :disabled="loading || !loteInput.trim()"
          @click="analizarLote"
        >
          {{ loading ? 'Analizando...' : 'Analizar lote' }}
        </button>
      </div>

      <div v-if="error" class="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        {{ error }}
      </div>

      <div v-if="analyzedLote && !loading" class="mb-3 text-sm text-slate-700">
        <span class="font-semibold">Lote analizado:</span> {{ analyzedLote }} ·
        <span class="font-semibold">Ensayos:</span> {{ filteredRows.length }}
      </div>

      <div v-if="reportText" class="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 overflow-auto">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span class="text-sm font-semibold text-slate-700">Informe generado</span>
          <button
            type="button"
            class="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
            :disabled="!reportText"
            @click="copiarInforme"
          >
            Copiar informe
          </button>
        </div>
        <div
          v-if="copyStatus"
          class="mb-3 px-3 py-2 rounded-lg text-xs"
          :class="copyStatusType === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'"
        >
          {{ copyStatus }}
        </div>
        <div class="text-slate-800 text-sm whitespace-pre-line leading-6">{{ reportText }}</div>
      </div>

      <div v-if="filteredRows.length > 0" class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200">
        <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
          <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
            <tr>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Fecha</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Lote</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">OE</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Ne</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvío %</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Titulo</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Estiraje</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Pasador</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">CVm %</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -30%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -40%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -50%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +35%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +50%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +140%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +280%</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Fuerza B</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Elong. %</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Tenac.</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Trabajo B</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">OBS</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Op. Uster</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Op. TensoRapid</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Uster</th>
              <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">TensoRapid</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.Uster" class="border-t border-slate-100 hover:bg-blue-50/30">
              <td class="px-2 py-1 text-center text-slate-700 whitespace-nowrap">{{ row.Fecha }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Lote }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.OE }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Ne }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Desvío %'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Titulo }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Estiraje }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Pasador }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['CVm %'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Delg -30%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Delg -40%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Delg -50%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Grue +35%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Grue +50%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Neps +140%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Neps +280%'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Fuerza B'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Elong. %'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Tenac.'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Trabajo B'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.OBS }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Op. Uster'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row['Op. TensoRapid'] }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.Uster }}</td>
              <td class="px-2 py-1 text-center text-slate-700">{{ row.TensoRapid }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="analyzedLote && !loading" class="text-sm text-slate-600 py-8 text-center">
        No se encontraron ensayos para el lote {{ analyzedLote }}.
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { fetchAllStatsData } from '../../services/dataService'

const loteInput = ref('')
const loading = ref(false)
const error = ref('')
const analyzedLote = ref('')
const filteredRows = ref([])
const reportText = ref('')
const copyStatus = ref('')
const copyStatusType = ref('success')
const cachedRows = ref([])
const cachedFibra = ref([])

function setCopyStatus(message, type = 'success') {
  copyStatus.value = message
  copyStatusType.value = type
  setTimeout(() => {
    if (copyStatus.value === message) {
      copyStatus.value = ''
    }
  }, 2200)
}

async function copiarInforme() {
  if (!reportText.value) return

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(reportText.value)
      setCopyStatus('Informe copiado al portapapeles.')
      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = reportText.value
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (!copied) throw new Error('copy-fallback-failed')
    setCopyStatus('Informe copiado al portapapeles.')
  } catch (copyError) {
    console.error('No se pudo copiar el informe:', copyError)
    setCopyStatus('No se pudo copiar automáticamente. Seleccione el texto y copie manualmente.', 'warning')
  }
}

function normalizeLote(value) {
  if (value == null) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const matchMiddle = raw.match(/[\s-](\d+)[\s-]/)
  if (matchMiddle && matchMiddle[1]) {
    return String(parseInt(matchMiddle[1], 10))
  }
  const digits = raw.replace(/\D/g, '')
  if (digits) return String(parseInt(digits, 10))
  return raw.toLowerCase()
}

function formatLote(value) {
  const norm = normalizeLote(value)
  return norm || ''
}

function formatOE(value) {
  if (!value) return ''
  const str = String(value).trim()
  const match = str.match(/^(\d+)\s*([A-Za-z]+)?/)
  if (!match) return str
  const numPart = parseInt(match[1], 10)
  const letterPart = match[2] ? match[2].substring(0, 2).toUpperCase() : ''
  return letterPart ? `${numPart} ${letterPart}` : String(numPart)
}

function formatNe(nomcount, matclass) {
  if (nomcount == null || nomcount === '') return ''
  const neNum = parseFloat(String(nomcount).trim())
  let ne = !Number.isNaN(neNum) ? String(parseFloat(String(neNum))) : String(nomcount).trim()
  if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
    ne += ' FLAME'
  }
  return ne
}

function formatEstiraje(value) {
  if (value == null || value === '') return '—'
  const n = parseFloat(String(value).trim())
  if (!Number.isNaN(n)) return String(parseFloat(String(value)))
  return String(value)
}

function parseDateValue(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate()
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = value > 1000000000000 ? new Date(value) : new Date(value * 1000)
    if (!Number.isNaN(d.getTime())) return d
  }
  const raw = String(value).trim()
  const eu = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (eu) {
    const day = parseInt(eu[1], 10)
    const month = parseInt(eu[2], 10) - 1
    let year = parseInt(eu[3], 10)
    if (year < 100) year += 2000
    const hour = eu[4] ? parseInt(eu[4], 10) : 0
    const minute = eu[5] ? parseInt(eu[5], 10) : 0
    const second = eu[6] ? parseInt(eu[6], 10) : 0
    const d = new Date(year, month, day, hour, minute, second)
    if (!Number.isNaN(d.getTime())) return d
  }
  const iso = new Date(raw)
  if (!Number.isNaN(iso.getTime())) return iso
  return null
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function toNumber(value) {
  if (value == null || value === '' || value === '—') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const raw = String(value).trim().replace(/\s+/g, '')
  if (!raw) return null

  // Solo dígitos/signo/punto -> parseo directo (ej: 8.8260)
  if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) {
    const direct = Number(raw)
    return Number.isFinite(direct) ? direct : null
  }

  // Solo dígitos/signo/coma -> interpretar coma como decimal (ej: 8,8260)
  if (/^[+-]?\d+(?:,\d+)?$/.test(raw)) {
    const commaDecimal = Number(raw.replace(',', '.'))
    return Number.isFinite(commaDecimal) ? commaDecimal : null
  }

  // Si trae ambos separadores, el último separador se interpreta como decimal.
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? '.' : ','
    const thousandSeparator = decimalSeparator === '.' ? ',' : '.'
    const normalized = raw
      .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.')
      .replace(/[^0-9.+\-eE]/g, '')
    const mixed = Number(normalized)
    return Number.isFinite(mixed) ? mixed : null
  }

  // Fallback defensivo
  const fallback = Number(raw.replace(/,/g, '.').replace(/[^0-9.+\-eE]/g, ''))
  return Number.isFinite(fallback) ? fallback : null
}

function avg(rows, field) {
  const values = rows
    .map((row) => toNumber(row[field]))
    .filter((value) => value !== null)
  if (values.length === 0) return '—'
  const value = values.reduce((acc, item) => acc + item, 0) / values.length
  return Number(value.toFixed(2)).toString()
}

function rangeStats(rows, field) {
  const values = rows
    .map((row) => toNumber(row[field]))
    .filter((value) => value !== null)
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((acc, item) => acc + item, 0) / values.length
  const tolerance = 1e-9
  const countMin = values.filter((value) => Math.abs(value - min) <= tolerance).length
  const countMax = values.filter((value) => Math.abs(value - max) <= tolerance).length
  return { min, max, mean, count: values.length, countMin, countMax }
}

function getOperatorForField(row, field) {
  const tensorFields = ['Elong. %', 'Tenac.', 'Fuerza B', 'Trabajo B']
  const preferTensor = tensorFields.includes(field)
  const preferred = preferTensor ? row['Op. TensoRapid'] : row['Op. Uster']
  const fallback = preferTensor ? row['Op. Uster'] : row['Op. TensoRapid']

  const first = String(preferred || '').trim()
  if (first && first !== '—') return first
  const second = String(fallback || '').trim()
  if (second && second !== '—') return second
  return 'operador no identificado'
}

function isolatedMinContext(rows, field, stats) {
  if (!stats) return null
  if (stats.count < 4 || stats.countMin !== 1) return null

  const tolerance = 1e-9
  const matches = rows.filter((row) => {
    const n = toNumber(row[field])
    return n !== null && Math.abs(n - stats.min) <= tolerance
  })

  if (matches.length !== 1) return null
  const sample = matches[0]
  return {
    fecha: sample.Fecha && sample.Fecha !== '—' ? sample.Fecha : 'fecha no disponible',
    operador: getOperatorForField(sample, field)
  }
}

function isolatedMinWarning(stats, context) {
  if (!stats) return ''
  if (stats.count < 4) return ''
  if (stats.countMin !== 1) return ''
  if (context) {
    return ` ⚠️ Nota: el mínimo corresponde a una sola muestra (posible caso aislado: ${context.fecha}, operador ${context.operador}).`
  }
  return ' ⚠️ Nota: el mínimo corresponde a una sola muestra (posible caso aislado).'
}

function textValue(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return Number(value.toFixed(2)).toString()
  const asNum = toNumber(value)
  if (asNum !== null) return Number(asNum.toFixed(2)).toString()
  return String(value)
}

function parseNumericForSort(neLabel) {
  const raw = String(neLabel || '')
  const match = raw.match(/\d+(?:\.\d+)?/)
  if (!match) return Number.POSITIVE_INFINITY
  return Number(match[0])
}

function getNeRole(neLabel) {
  const ne = String(neLabel).toLowerCase()
  if (ne.includes('flame')) return 'Flame'
  if (ne.includes('12.5')) return 'Urdimbre Fina'
  if (ne.includes('10')) return 'Urdimbre Estándar'
  if (ne.includes('7')) return 'Trama'
  return 'Proceso General'
}

function computeMicForLote(calidadFibraRows, loteNormalized) {
  const matching = (calidadFibraRows || []).filter((row) => {
    const mistura = normalizeLote(row.MISTURA)
    const loteFiac = normalizeLote(row.LOTE_FIAC)
    return mistura === loteNormalized || loteFiac === loteNormalized
  })
  if (matching.length === 0) return null

  let totalWeight = 0
  let weightedSum = 0
  const fallback = []

  matching.forEach((row) => {
    const mic = toNumber(row.MIC)
    if (mic === null) return
    fallback.push(mic)
    const weight = toNumber(row.PESO)
    if (weight !== null && weight > 0) {
      totalWeight += weight
      weightedSum += mic * weight
    }
  })

  if (totalWeight > 0) return weightedSum / totalWeight
  if (fallback.length === 0) return null
  return fallback.reduce((acc, item) => acc + item, 0) / fallback.length
}

function buildNarrativeReport(rows, lote, mic) {
  const dates = rows
    .map((row) => row._date)
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const periodStart = dates.length > 0 ? formatDate(dates[0]) : '—'
  const periodEnd = dates.length > 0 ? formatDate(dates[dates.length - 1]) : '—'

  const groups = new Map()
  rows.forEach((row) => {
    const ne = String(row.Ne || '—')
    if (!groups.has(ne)) groups.set(ne, [])
    groups.get(ne).push(row)
  })

  const sortedNes = Array.from(groups.keys()).sort((a, b) => parseNumericForSort(a) - parseNumericForSort(b))
  const sectionLines = []
  let priorityLine = 'Prioridad 1: Mantener el monitoreo diario del lote para sostener estabilidad.'

  sortedNes.forEach((neLabel) => {
    const neRows = groups.get(neLabel) || []
    const role = getNeRole(neLabel)
    const elong = rangeStats(neRows, 'Elong. %')
    const tenac = rangeStats(neRows, 'Tenac.')
    const cvm = rangeStats(neRows, 'CVm %')
    const trabajo = rangeStats(neRows, 'Trabajo B')
    const elongMinContext = isolatedMinContext(neRows, 'Elong. %', elong)
    const tenacMinContext = isolatedMinContext(neRows, 'Tenac.', tenac)

    const neLower = String(neLabel).toLowerCase()
    let icon = '✅'
    let zone = 'ESTABLE'
    let action = 'Sostener reglajes actuales y continuar control por turno.'

    if (neLower.includes('flame')) {
      icon = '🔥'
      zone = tenac && tenac.mean >= 16 ? 'EFECTO SEGURO' : 'CONTROLAR FLAMA'
      action = tenac && tenac.mean >= 16
        ? 'Mantener receta y tensión actual: el efecto flame no compromete estructura.'
        : 'Bajar variación de efecto flame y revisar estiraje para evitar pérdida de resistencia.'
    } else if (neLower.includes('12.5')) {
      const riskyElong = elong && elong.min < 8
      const riskyTenac = tenac && tenac.min < 15.5
      if (riskyElong || riskyTenac) {
        icon = '⚠️'
        zone = 'ZONA CRÍTICA'
        priorityLine = 'Prioridad 1: Monitorear roturas en Ne 12.5 por elongación ajustada y evitar sobre-tensión en filetero.'
        action = 'Cuidar tensiones en urdidora y evitar sobre-tensionar filetero; el hilo tiene poco margen de absorción de impacto.'
      } else {
        zone = 'VIGILADO'
        action = 'Mantener tensión moderada en urdidora y control fino de variación en tenacidad.'
      }
    } else if (neLower.includes('10')) {
      if (elong && tenac && elong.min >= 8.3 && tenac.mean >= 16) {
        icon = '✅'
        zone = 'ÓPTIMO'
        action = 'Apto para máxima velocidad en telares de aire. Hilo estable y noble en corrida.'
      } else {
        icon = '⚠️'
        zone = 'VIGILAR'
        action = 'Revisar tensiones y dispersión de tenacidad antes de subir velocidad de telar.'
      }
    } else if (neLower.includes('7')) {
      if (cvm && trabajo && cvm.mean <= 11 && trabajo.mean >= 28) {
        icon = '✅'
        zone = 'SOBRADO'
        action = 'Hilo fuerte y limpio. Sin riesgo operativo inmediato de cortes o barreado.'
      } else {
        icon = '⚠️'
        zone = 'ATENCIÓN'
        action = 'Ajustar limpieza y regularidad para estabilizar trama y evitar paradas puntuales.'
      }
    } else {
      if ((elong && elong.min < 8) || (tenac && tenac.min < 15)) {
        icon = '⚠️'
        zone = 'RIESGO'
        action = 'Ajustar tensión y revisar lote en laboratorio antes de exigir velocidad.'
      }
    }

    const operatorMap = new Map()
    neRows
      .flatMap((row) => [row['Op. Uster'], row['Op. TensoRapid']])
      .map((value) => String(value || '').trim())
      .filter((value) => value && value !== '—')
      .forEach((name) => {
        const key = name.toUpperCase()
        if (!operatorMap.has(key)) operatorMap.set(key, name)
      })
    const operators = Array.from(operatorMap.values())

    sectionLines.push(`${icon} Ne ${neLabel} (${role}) - ${zone}`)
    if (elong) {
      sectionLines.push(`• Elongación: Rango ${elong.min.toFixed(1)}% - ${elong.max.toFixed(1)}%. ${elong.min < 8 ? 'El hilo está seco y con poco margen de estiramiento.' : 'Comportamiento elástico estable para proceso.'}${isolatedMinWarning(elong, elongMinContext)}`)
    }
    if (tenac) {
      sectionLines.push(`• Tenacidad: Dispersión ${tenac.min.toFixed(1)} - ${tenac.max.toFixed(1)} cN/tex.${isolatedMinWarning(tenac, tenacMinContext)}`)
    }
    if (cvm && neLower.includes('7')) {
      sectionLines.push(`• CVm%: ${cvm.mean.toFixed(1)}. ${cvm.mean <= 11 ? 'Limpieza excelente.' : 'Aún hay ruido de regularidad para corregir.'}`)
    }
    if (trabajo && (neLower.includes('7') || neLower.includes('flame'))) {
      sectionLines.push(`• Trabajo B: ${trabajo.mean.toFixed(1)}.`)
    }
    sectionLines.push(`👉 ACCIÓN: ${action}`)
    if (operators.length > 0) {
      sectionLines.push(`👩‍🔬 Responsables: ${operators.join(' / ')}.`)
    }
    sectionLines.push('')
  })

  const delg50 = rangeStats(rows, 'Delg -50%')
  const neps140 = rangeStats(rows, 'Neps +140%')
  const neps280 = rangeStats(rows, 'Neps +280%')
  const desvio = rangeStats(rows, 'Desvío %')

  const ajustes = []
  if (delg50 && delg50.mean <= 0.2) {
    ajustes.push('• Puntos Delgados: Delg -50% prácticamente en cero. Mantener reglaje de pasador actual.')
  } else if (delg50) {
    ajustes.push(`• Puntos Delgados: Delg -50% en ${delg50.mean.toFixed(2)}. Ajustar pasador para reducir cortes en trama.`)
  }

  if (mic !== null) {
    if (mic >= 4.6) {
      ajustes.push(`• Índigo: MIC ${mic.toFixed(2)} alto; vigilar absorción de color y riesgo de diferencias de tono.`)
    } else {
      ajustes.push(`• Índigo: MIC ${mic.toFixed(2)} dentro de zona estable para teñido uniforme.`)
    }
  }

  if (neps140 && neps280 && neps140.mean < 200 && neps280.mean < 50) {
    ajustes.push('• Limpieza: Neps controlados; no se anticipan puntos blancos por suciedad de hilo.')
  }

  if (desvio) {
    const absMean = Math.abs(desvio.mean)
    ajustes.push(absMean <= 0.5
      ? `• Título: Desvío bajo control (±${absMean.toFixed(2)}%).`
      : `• Título: Desvío promedio en ±${absMean.toFixed(2)}%; revisar ajuste de título objetivo.`)
  }

  const mezcla = mic !== null
    ? `🧪 Mezcla: Lote ${lote} (HVI MIC ${mic.toFixed(2)})`
    : `🧪 Mezcla: Lote ${lote} (HVI MIC sin dato)`

  return [
    `📋 Informe de Auditoría Operativa: Lote ${lote}`,
    `📅 Periodo: ${periodStart} al ${periodEnd}`,
    mezcla,
    '',
    '⚠️ ALERTAS POR TÍTULO',
    '',
    ...sectionLines,
    '🛠️ AJUSTES DE PLANTA',
    ...ajustes,
    '',
    '🚀 CONCLUSIÓN',
    `Estado general: lote ${lote} bajo control, con seguimiento puntual en los títulos más sensibles.`,
    priorityLine,
    '',
    '📑 Generado por Control de Calidad - Laboratorio Uster/TensoRapid'
  ].join('\n')
}

function buildRowsFromStats(allDataFetched) {
  const parArr = Array.isArray(allDataFetched.usterPar) ? allDataFetched.usterPar : []
  const tblArr = Array.isArray(allDataFetched.usterTbl) ? allDataFetched.usterTbl : []
  const tensorTblArr = Array.isArray(allDataFetched.tensorapidTbl) ? allDataFetched.tensorapidTbl : []
  const tensorParArr = Array.isArray(allDataFetched.tensorapidPar) ? allDataFetched.tensorapidPar : []

  const tblByTestnr = new Map()
  tblArr.forEach((row) => {
    const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
    if (!testnr) return
    if (!tblByTestnr.has(testnr)) tblByTestnr.set(testnr, [])
    tblByTestnr.get(testnr).push(row)
  })

  const tensorTblByTestnr = new Map()
  tensorTblArr.forEach((row) => {
    const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
    if (!testnr) return
    if (!tensorTblByTestnr.has(testnr)) tensorTblByTestnr.set(testnr, [])
    tensorTblByTestnr.get(testnr).push(row)
  })

  const tensorParByUster = new Map()
  tensorParArr.forEach((row) => {
    const usterTestnr = String(row.USTER_TESTNR ?? row.uster_testnr ?? row.usterTestnr ?? '')
    if (!usterTestnr) return
    if (!tensorParByUster.has(usterTestnr)) tensorParByUster.set(usterTestnr, [])
    tensorParByUster.get(usterTestnr).push(row)
  })

  const rows = parArr.map((row) => {
    const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
    const tblRows = tblByTestnr.get(testnr) || []
    const tensorCandidates = tensorParByUster.get(testnr) || []
    const tensorPar = tensorCandidates.length > 0
      ? tensorCandidates.slice().sort((a, b) => {
          const da = parseDateValue(a.TIME_STAMP || a.time_stamp || a.CREATED_AT || 0)
          const db = parseDateValue(b.TIME_STAMP || b.time_stamp || b.CREATED_AT || 0)
          return (db?.getTime() || 0) - (da?.getTime() || 0)
        })[0]
      : null

    const tensorTblRows = tensorPar && tensorPar.TESTNR
      ? tensorTblByTestnr.get(String(tensorPar.TESTNR)) || []
      : []

    const dateObj = parseDateValue(row.TIME_STAMP || row.TIME || row.TIMESTAMP || row.CREATED_AT || row.Fecha || row.fecha)
    const neValue = toNumber(row.NOMCOUNT ?? row.Ne ?? row.NE)
    const tituloValue = toNumber(avg(tblRows, 'TITULO'))
    let desvioPercent = '—'
    if (neValue !== null && neValue > 0 && tituloValue !== null) {
      const desvio = ((neValue - tituloValue) / neValue) * 100
      const formatted = Number(desvio.toFixed(2))
      desvioPercent = `${desvio > 0 ? '+' : ''}${formatted}`
    }

    const tensorRapidTestnr = tensorPar && (tensorPar.TESTNR ?? tensorPar.testnr ?? tensorPar.Testnr)
      ? String(tensorPar.TESTNR ?? tensorPar.testnr ?? tensorPar.Testnr)
      : ''

    const laborantUster = String(row.LABORANT ?? row.Laborant ?? row.laborant ?? '').trim()
    const laborantTensor = tensorPar
      ? String(tensorPar.LABORANT ?? tensorPar.Laborant ?? tensorPar.laborant ?? '').trim()
      : ''

    return {
      _date: dateObj,
      Fecha: formatDate(dateObj),
      Lote: formatLote(row.LOTE || row.Lote || row.lote || ''),
      OE: formatOE(row.MASCHNR ?? row.OE ?? row.OE_NRO ?? row.OE_NRO_1 ?? row.oe ?? row.OE_NRO_PAR ?? ''),
      Ne: formatNe(row.NOMCOUNT ?? row.Ne ?? row.NE ?? row.TITULO ?? '', row.MATCLASS),
      'Desvío %': desvioPercent,
      Titulo: textValue(avg(tblRows, 'TITULO')),
      Estiraje: formatEstiraje(row.ESTIRAJE),
      Pasador: row.PASADOR || '—',
      'CVm %': textValue(avg(tblRows, 'CVM_PERCENT') !== '—' ? avg(tblRows, 'CVM_PERCENT') : avg(tblRows, 'CVM_%')),
      'Delg -30%': textValue(avg(tblRows, 'DELG_MINUS30_KM') !== '—' ? avg(tblRows, 'DELG_MINUS30_KM') : avg(tblRows, 'DELG_-30%')),
      'Delg -40%': textValue(avg(tblRows, 'DELG_MINUS40_KM') !== '—' ? avg(tblRows, 'DELG_MINUS40_KM') : avg(tblRows, 'DELG_-40%')),
      'Delg -50%': textValue(avg(tblRows, 'DELG_MINUS50_KM') !== '—' ? avg(tblRows, 'DELG_MINUS50_KM') : avg(tblRows, 'DELG_-50%')),
      'Grue +35%': textValue(avg(tblRows, 'GRUE_35_KM') !== '—' ? avg(tblRows, 'GRUE_35_KM') : avg(tblRows, 'GRUE_+35%')),
      'Grue +50%': textValue(avg(tblRows, 'GRUE_50_KM') !== '—' ? avg(tblRows, 'GRUE_50_KM') : avg(tblRows, 'GRUE_+50%')),
      'Neps +140%': textValue(avg(tblRows, 'NEPS_140_KM') !== '—' ? avg(tblRows, 'NEPS_140_KM') : avg(tblRows, 'NEPS_+140%')),
      'Neps +280%': textValue(avg(tblRows, 'NEPS_280_KM') !== '—' ? avg(tblRows, 'NEPS_280_KM') : avg(tblRows, 'NEPS_+280%')),
      'Fuerza B': textValue(avg(tensorTblRows, 'FUERZA_B')),
      'Elong. %': textValue(avg(tensorTblRows, 'ELONGACION')),
      'Tenac.': textValue(avg(tensorTblRows, 'TENACIDAD')),
      'Trabajo B': textValue(avg(tensorTblRows, 'TRABAJO')),
      OBS: String(row.OBS ?? row.OBSERVACION ?? row.OBSERVACAO ?? row.obs ?? '').trim() || '—',
      'Op. Uster': laborantUster || '—',
      'Op. TensoRapid': laborantTensor || '—',
      Uster: testnr,
      TensoRapid: tensorRapidTestnr || '—'
    }
  })

  rows.sort((a, b) => {
    const da = a._date instanceof Date ? a._date.getTime() : 0
    const db = b._date instanceof Date ? b._date.getTime() : 0
    if (db !== da) return db - da
    return String(b.Uster).localeCompare(String(a.Uster), undefined, { numeric: true })
  })

  const seen = new Set()
  return rows.filter((row) => {
    const key = String(row.Uster || '').trim()
    if (!key || !seen.has(key)) {
      seen.add(key)
      return true
    }
    return false
  })
}

async function ensureDataLoaded() {
  if (cachedRows.value.length > 0) return
  const allDataFetched = await fetchAllStatsData()
  cachedRows.value = buildRowsFromStats(allDataFetched)
  cachedFibra.value = Array.isArray(allDataFetched.calidadFibra) ? allDataFetched.calidadFibra : []
}

async function analizarLote() {
  error.value = ''
  reportText.value = ''
  copyStatus.value = ''
  filteredRows.value = []

  const loteNormalized = normalizeLote(loteInput.value)
  analyzedLote.value = loteNormalized

  if (!loteNormalized) {
    error.value = 'Ingrese un lote válido.'
    return
  }

  loading.value = true
  try {
    await ensureDataLoaded()
    const matches = cachedRows.value.filter((row) => normalizeLote(row.Lote) === loteNormalized)
    filteredRows.value = matches

    if (matches.length === 0) {
      error.value = `No se encontraron ensayos para el lote ${loteNormalized}.`
      return
    }

    const mic = computeMicForLote(cachedFibra.value, loteNormalized)
    reportText.value = buildNarrativeReport(matches, loteNormalized, mic)
  } catch (loadError) {
    console.error('Error analizando lote:', loadError)
    error.value = 'No se pudieron cargar los datos para generar el informe.'
  } finally {
    loading.value = false
  }
}
</script>