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
        <div class="text-slate-800">
          <div
            v-for="(line, index) in reportLines"
            :key="`report-line-${index}`"
            :class="reportLineClass(line)"
          >
            <template v-if="line === ''">&nbsp;</template>
            <template v-else>{{ line }}</template>
          </div>
        </div>
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
import { computed, ref } from 'vue'
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

const reportLines = computed(() => {
  if (!reportText.value) return []
  return reportText.value.split('\n')
})

function reportLineClass(line) {
  const value = String(line || '')

  if (value.trim() === '') {
    return 'leading-3'
  }

  if (/^(?:⚠️|✅|🔥|🧵)\s+Ne\s+/i.test(value)) {
    return 'text-[15px] font-bold leading-6 text-slate-900'
  }

  if (/^(?:📋|📅|👷|📌|🧪|⚙️|🎛️|📑)/.test(value)) {
    return 'text-sm font-semibold leading-6 text-slate-800'
  }

  return 'text-sm leading-6 text-slate-800'
}

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
  if (ne.includes('flame')) return 'Urdimbre Flame'
  if (ne.includes('12.5')) return 'Urdimbre Fina'
  if (ne.includes('10')) return 'Urdimbre Estándar'
  if (ne.includes('7')) return 'Trama'
  return 'Proceso General'
}

const MATRIZ_AUDITORIA = {
  '7':    { app: 'Trama',    umb: { tenacidad: { ok: 14.0, w: 13.0, t: 'min' }, elongacion: { ok: 7.0, w: 6.0, t: 'min' }, cvm: { ok: 13.5, w: 14.5, t: 'max' } } },
  '9':    { app: 'Trama',    umb: { tenacidad: { ok: 14.5, w: 13.5, t: 'min' }, elongacion: { ok: 7.0, w: 6.5, t: 'min' }, cvm: { ok: 13.0, w: 14.0, t: 'max' } } },
  '10':   { app: 'Urdimbre', umb: { tenacidad: { ok: 16.0, w: 15.0, t: 'min' }, elongacion: { ok: 8.0, w: 7.5, t: 'min' }, cvm: { ok: 12.0, w: 13.0, t: 'max' } } },
  '12.5': { app: 'Urdimbre', umb: { tenacidad: { ok: 16.5, w: 15.5, t: 'min' }, elongacion: { ok: 8.0, w: 7.5, t: 'min' }, cvm: { ok: 11.5, w: 12.5, t: 'max' } } },
  '14':   { app: 'Urdimbre', umb: { tenacidad: { ok: 17.0, w: 16.0, t: 'min' }, elongacion: { ok: 8.5, w: 8.0, t: 'min' }, cvm: { ok: 11.0, w: 12.0, t: 'max' } } },
}

function resolveMatrizAuditoriaKey(neValue) {
  if (!Number.isFinite(neValue)) return null

  let bestKey = null
  let bestNum = null
  let bestDist = Number.POSITIVE_INFINITY

  Object.keys(MATRIZ_AUDITORIA).forEach((key) => {
    const num = parseFloat(key)
    if (!Number.isFinite(num)) return
    const dist = Math.abs(num - neValue)
    if (dist < bestDist || (Math.abs(dist - bestDist) < 1e-9 && num > (bestNum ?? -Infinity))) {
      bestDist = dist
      bestNum = num
      bestKey = key
    }
  })

  return bestDist <= 2 ? bestKey : null
}

function getMatrizAuditoria(neValue, isFlame = false) {
  const key = resolveMatrizAuditoriaKey(neValue)
  if (!key) return null

  const base = MATRIZ_AUDITORIA[key]
  if (!base || !isFlame || neValue < 9) return base

  return {
    ...base,
    app: 'Urdimbre Flame',
    umb: {
      ...base.umb,
      cvm: { ok: 18.0, w: 20.0, t: 'max' }
    }
  }
}

function evalUmbralAuditoria(value, umbral) {
  if (!Number.isFinite(value) || !umbral) return 'sin-dato'
  if (umbral.t === 'min') {
    if (value >= umbral.ok) return 'ok'
    if (value >= umbral.w) return 'warn'
    return 'crit'
  }
  if (value <= umbral.ok) return 'ok'
  if (value <= umbral.w) return 'warn'
  return 'crit'
}

function computeMicForLote(calidadFibraRows, loteNormalized) {
  const matching = (calidadFibraRows || []).filter((row) => normalizeLote(row.LOTE_FIAC) === loteNormalized)
  if (matching.length === 0) return null

  const values = matching
    .map((row) => toNumber(row.MIC))
    .filter((value) => value !== null)

  if (values.length === 0) return null
  return values.reduce((acc, item) => acc + item, 0) / values.length
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
  const titleAssessments = []
  const rejectedTitles = []
  const conditionalTitles = []

  sortedNes.forEach((neLabel) => {
    const neRows = groups.get(neLabel) || []
    const elong = rangeStats(neRows, 'Elong. %')
    const tenac = rangeStats(neRows, 'Tenac.')
    const cvm = rangeStats(neRows, 'CVm %')
    const neps140 = rangeStats(neRows, 'Neps +140%')
    const neps280 = rangeStats(neRows, 'Neps +280%')

    const neLower = String(neLabel).toLowerCase()
    const isFlame = neLower.includes('flame')
    const neNum = parseNumericForSort(neLabel)
    const matriz = getMatrizAuditoria(neNum, isFlame)
    const app = matriz?.app || getNeRole(neLabel)
    const cvmWarn = matriz?.umb?.cvm?.w ?? (isFlame ? 20.0 : 12.5)

    const evals = []
    if (matriz?.umb?.tenacidad && tenac) evals.push(evalUmbralAuditoria(tenac.mean, matriz.umb.tenacidad))
    if (matriz?.umb?.elongacion && elong) evals.push(evalUmbralAuditoria(elong.mean, matriz.umb.elongacion))
    if (matriz?.umb?.cvm && cvm) evals.push(evalUmbralAuditoria(cvm.mean, matriz.umb.cvm))

    const hasCrit = evals.includes('crit')
    const hasWarn = !hasCrit && evals.includes('warn')
    const status = hasCrit ? 'RECHAZADO' : hasWarn ? 'CONDICIONAL' : 'APROBADO'

    if (status === 'RECHAZADO') rejectedTitles.push(`Ne ${neLabel}`)
    if (status === 'CONDICIONAL') conditionalTitles.push(`Ne ${neLabel}`)

    const isUrdimbre = app.startsWith('Urdimbre') || neNum >= 10
    const elongRisk = Boolean(elong && elong.mean < 8.0)
    const tenacidadRisk = Boolean(isUrdimbre && tenac && tenac.mean < 16.0)
    const cvmRisk = Boolean(cvm && cvm.mean > cvmWarn)

    titleAssessments.push({
      neLabel,
      app,
      isFlame,
      status,
      isUrdimbre,
      elong,
      tenac,
      cvm,
      neps140,
      neps280,
      cvmWarn,
      elongRisk,
      tenacidadRisk,
      cvmRisk,
    })
  })

  const tenibilidad = []
  const hasUrdimbreTitles = titleAssessments.some((item) => item.isUrdimbre)
  const TELAR_MODELO_TRAMA = 'Toyota JA2S-190TP-EF-T710'
  const TELAR_RPM_TRAMA = 830

  if (mic === null) {
    tenibilidad.push('• MIC sin dato: no se puede cerrar diagnóstico de afinidad tintórea en cajas Benninger.')
  } else if (mic > 4.5) {
    if (hasUrdimbreTitles) {
      tenibilidad.push(`• MIC ${mic.toFixed(2)} (>4.5): fibra con menor superficie específica. Aumenta riesgo de teñido anular y pobre penetración en cajas de inmersión Benninger (aplica a títulos de urdimbre).`)
    } else {
      tenibilidad.push(`• MIC ${mic.toFixed(2)} (>4.5): lote de trama (sin paso por Benninger). Se espera hilo más rígido y mayor fricción dinámica; vigilar continuidad en telar de aire ${TELAR_MODELO_TRAMA} a ${TELAR_RPM_TRAMA} RPM.`)
    }
  } else if (mic < 3.8) {
    if (hasUrdimbreTitles) {
      tenibilidad.push(`• MIC ${mic.toFixed(2)} (<3.8): fibra más inmadura/fina. Sube probabilidad de neps de color y puntos claros en índigo.`)
    } else {
      tenibilidad.push(`• MIC ${mic.toFixed(2)} (<3.8): lote de trama (sin Benninger). Riesgo de neps/irregularidad visual y variación de limpieza en telar de aire ${TELAR_MODELO_TRAMA}.`)
    }
  } else {
    if (hasUrdimbreTitles) {
      tenibilidad.push(`• MIC ${mic.toFixed(2)}: ventana balanceada para penetración y build-up de índigo en slashing.`)
    } else {
      tenibilidad.push(`• MIC ${mic.toFixed(2)}: rango estable para lote de trama; no se anticipa impacto crítico por finura en telar de aire ${TELAR_MODELO_TRAMA}.`)
    }
  }

  titleAssessments.forEach((item) => {
    if (!item.cvm || item.isFlame) return
    if (item.cvmRisk) {
      tenibilidad.push(`• Ne ${item.neLabel}: CVm ${item.cvm.mean.toFixed(2)}% > estándar ${item.cvmWarn.toFixed(2)}%. Riesgo de barreado que se intensifica con el color índigo.`)
    }
  })

  const lowMicWithHighNeps = mic !== null && mic < 3.8 && titleAssessments.some((item) => {
    if (!item.neps280) return false
    return item.neps280.mean > 60
  })
  if (lowMicWithHighNeps) {
    tenibilidad.push('• MIC bajo + Neps elevados: escenario típico de neps de color, revisar limpieza y preparación antes de liberar lote.')
  }
  if (tenibilidad.length === 0) {
    tenibilidad.push('• Sin alertas de teñibilidad para las variables disponibles.')
  }

  const mecanico = []
  titleAssessments.forEach((item) => {
    const icon = item.status === 'RECHAZADO' ? '🔴' : item.status === 'CONDICIONAL' ? '⚠️' : '✅'
    const tramo = `${icon} Ne ${item.neLabel} (${item.app}):`
    const detalles = []

    if (item.elong) {
      if (item.isUrdimbre && item.elongRisk) {
        detalles.push(`elongación ${item.elong.mean.toFixed(2)}% (<8.0): riesgo en rodillos exprimidores y cajas de oxidación por tensión constante de manta`)
      } else if (item.isUrdimbre) {
        detalles.push(`elongación ${item.elong.mean.toFixed(2)}%: elasticidad suficiente para el stretch programado de Benninger`)
      } else if (item.elong.mean < 7.0) {
        detalles.push(`elongación ${item.elong.mean.toFixed(2)}%: baja para trama; riesgo de mayor tasa de rotura en telar de aire ${TELAR_MODELO_TRAMA} a ${TELAR_RPM_TRAMA} RPM`)
      } else {
        detalles.push(`elongación ${item.elong.mean.toFixed(2)}%: comportamiento elástico estable para trama en telar de aire ${TELAR_MODELO_TRAMA} a ${TELAR_RPM_TRAMA} RPM`)
      }
    }

    if (item.tenac && item.isUrdimbre) {
      if (item.tenacidadRisk) {
        detalles.push(`tenacidad ${item.tenac.mean.toFixed(2)} cN/tex (<16.0): probables paradas por rotura de cabos en batea`)
      } else {
        detalles.push(`tenacidad ${item.tenac.mean.toFixed(2)} cN/tex: margen mecánico compatible con línea`)
      }
    } else if (item.tenac) {
      if (item.tenac.mean < 14.0) {
        detalles.push(`tenacidad ${item.tenac.mean.toFixed(2)} cN/tex: nivel bajo para trama a ${TELAR_RPM_TRAMA} RPM, posible incremento de paradas en telar`)
      } else {
        detalles.push(`tenacidad ${item.tenac.mean.toFixed(2)} cN/tex: margen suficiente para estabilidad de inserción en ${TELAR_MODELO_TRAMA}`)
      }
    }

    if (detalles.length === 0) {
      detalles.push('sin datos mecánicos suficientes para cerrar diagnóstico')
    }

    mecanico.push(`${tramo} ${detalles.join(' | ')}.`)
  })

  const configuracion = []
  const hasHighMic = mic !== null && mic > 4.5
  const hasLowMic = mic !== null && mic < 3.8
  const hasElongRisk = titleAssessments.some((item) => item.elongRisk)
  const hasTenRisk = titleAssessments.some((item) => item.tenacidadRisk)
  const hasCvmRisk = titleAssessments.some((item) => item.cvmRisk && !item.isFlame)

  if (hasHighMic && hasUrdimbreTitles) {
    configuracion.push('• Ajustar presión de exprimido a la baja y/o bajar velocidad de línea para ganar tiempo de difusión y reducir riesgo de anular.')
  } else if (hasHighMic) {
    configuracion.push(`• Trama sin Benninger: mantener presión de planta y priorizar reducción de paros en telar ${TELAR_MODELO_TRAMA} (830 RPM) con control de tensión y limpieza de urdido/tejeduría.`)
  }
  if (hasLowMic && hasUrdimbreTitles) {
    configuracion.push('• Mantener presión de exprimido moderada y reforzar filtración/limpieza para controlar neps de color en cajas y oxidación.')
  } else if (hasLowMic) {
    configuracion.push(`• Trama con MIC bajo: reforzar control de neps y limpieza para evitar defectos visuales y paradas en telar ${TELAR_MODELO_TRAMA}.`)
  }
  if (hasElongRisk || hasTenRisk) {
    configuracion.push('• Reducir stretch programado y velocidad de corrida hasta recuperar elongación >= 8% y tenacidad >= 16 cN/tex en urdimbre.')
  }
  if (hasCvmRisk) {
    configuracion.push('• Para títulos con CVm fuera de estándar, evitar velocidades pico y sostener rampas suaves para minimizar barreado en índigo.')
  }
  if (!configuracion.length) {
    configuracion.push('• Mantener set points actuales de presión y velocidad; el lote muestra comportamiento estable para slashing Benninger.')
  }

  const priorityLine = rejectedTitles.length > 0
    ? `Prioridad 1: Detener liberación automática en ${rejectedTitles.join(' / ')} hasta corregir desvíos de matriz.`
    : conditionalTitles.length > 0
      ? `Prioridad 1: Monitorear de cerca ${conditionalTitles.join(' / ')} para evitar escalada a rechazo.`
      : 'Prioridad 1: Mantener el monitoreo diario del lote para sostener estabilidad.'

  const estadoGeneralLine = rejectedTitles.length > 0
    ? `Estado general: lote ${lote} con títulos rechazados bajo matriz operativa; requiere ajuste antes de continuidad plena.`
    : conditionalTitles.length > 0
      ? `Estado general: lote ${lote} en condición de seguimiento intensivo, sin desvíos críticos en este corte.`
      : `Estado general: lote ${lote} bajo control y apto para continuidad operativa.`

  return [
    `📋 Informe Predictivo - Slashing Benninger: Lote ${lote}`,
    `📅 Periodo: ${periodStart} al ${periodEnd}`,
    '👷 Rol técnico: Ingeniería de Procesos Tintorería Índigo (análisis local)',
    `📌 Estado global: ${rejectedTitles.length > 0 ? 'RECHAZADO' : conditionalTitles.length > 0 ? 'CONDICIONAL' : 'APROBADO'}`,
    '',
    '🧪 Análisis de Teñibilidad',
    ...tenibilidad,
    '',
    '⚙️ Comportamiento Mecánico en Línea',
    ...mecanico,
    '',
    '🎛️ Configuración Sugerida',
    ...configuracion,
    '',
    estadoGeneralLine,
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