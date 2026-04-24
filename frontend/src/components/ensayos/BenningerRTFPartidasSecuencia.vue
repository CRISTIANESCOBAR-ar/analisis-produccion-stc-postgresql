<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <main class="flex-1 p-4 md:p-6 pb-24 md:pb-8">
      <section class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2 text-xs">
          <h1 class="text-sm font-semibold text-slate-800 mr-3">Secuencia PARTIDA vs RTF Match</h1>

          <label class="text-slate-600">Partida inicio:</label>
          <input
            v-model="startPartida"
            type="text"
            class="w-28 rounded-lg border border-slate-300 px-2 py-1"
          />

          <label class="text-slate-600">Limite:</label>
          <input
            v-model.number="limit"
            type="number"
            min="50"
            max="2000"
            class="w-24 rounded-lg border border-slate-300 px-2 py-1"
          />

          <button
            @click="loadRows"
            :disabled="loading"
            class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
          >
            {{ loading ? 'Cargando...' : 'Recargar' }}
          </button>

          <button
            @click="pickRtfFolder"
            :disabled="loading || preloading"
            class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
            title="Precargar headers faltantes desde carpeta de RTF"
          >
            {{ preloading ? 'Precargando...' : 'Precargar headers faltantes (RTF)' }}
          </button>
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            directory
            multiple
            class="hidden"
            @change="onRtfFolderChange"
          />

          <label class="ml-2 inline-flex items-center gap-2 text-slate-700">
            <input v-model="showOnlySinMatch" type="checkbox" class="rounded" />
            Solo sin match
          </label>

          <span class="ml-auto text-slate-600">
            Total: {{ rows.length }} | Sin match: {{ sinMatchCount }} | Sugeridos aptos: {{ aptoCount }}
          </span>
        </div>

        <div v-if="error" class="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
          {{ error }}
        </div>
        <div v-if="preloadStatus" class="px-4 py-2 text-xs text-indigo-700 bg-indigo-50 border-b border-indigo-200">
          {{ preloadStatus }}
        </div>

        <div class="overflow-auto max-h-[75vh]">
          <table class="min-w-full text-[11px]">
            <thead class="sticky top-0 bg-slate-100 border-b border-slate-200">
              <tr>
                <th class="px-2 py-1 text-left">PARTIDA</th>
                <th class="px-2 py-1 text-left">BASE URDUME</th>
                <th class="px-2 py-1 text-left">DT_INICIO</th>
                <th class="px-2 py-1 text-left">HORA_INICIO</th>
                <th class="px-2 py-1 text-left">METRAGEM</th>
                <th class="px-2 py-1 text-left">VELOC</th>
                <th class="px-2 py-1 text-left">(NNN)</th>
                <th class="px-2 py-1 text-left">Comeco</th>
                <th class="px-2 py-1 text-left">Receita</th>
                <th class="px-2 py-1 text-left">1X014</th>
                <th class="px-2 py-1 text-left">1S102</th>
                <th class="px-2 py-1 text-left">MATCH</th>
                <th class="px-2 py-1 text-left">Candidato RTF (NNN)</th>
                <th class="px-2 py-1 text-left">Validación</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in displayRows"
                :key="row.partida"
                :class="row.hasMatch ? 'bg-white' : 'bg-rose-50'"
                class="border-b border-slate-100"
              >
                <td class="px-2 py-1 font-semibold text-slate-800">{{ row.partida || '-' }}</td>
                <td class="px-2 py-1 text-slate-700">{{ row.baseUrdume || '-' }}</td>
                <td class="px-2 py-1 text-slate-600">{{ row.dtInicio || '-' }}</td>
                <td class="px-2 py-1 text-slate-600">{{ row.horaInicio || '-' }}</td>
                <td class="px-2 py-1 text-slate-700">{{ formatNum(row.metragemTotal) }}</td>
                <td class="px-2 py-1 text-slate-700">{{ formatNum(row.velocMedia) }}</td>
                <td class="px-2 py-1 text-slate-800 font-mono">{{ row.rtfSeqLabel || '-' }}</td>
                <td class="px-2 py-1" :class="rtfFieldClass(row)">{{ displayComeco(row) }}</td>
                <td class="px-2 py-1" :class="rtfFieldClass(row)">{{ displayReceita(row) }}</td>
                <td class="px-2 py-1" :class="rtfFieldClass(row)">{{ display1X014(row) }}</td>
                <td class="px-2 py-1" :class="rtfFieldClass(row)">{{ display1S102(row) }}</td>
                <td class="px-2 py-1">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="row.hasMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                  >
                    {{ row.hasMatch ? 'MATCH' : 'SIN MATCH' }}
                  </span>
                </td>
                <td class="px-2 py-1 font-mono text-slate-800">{{ row.candidateSeqLabel || '-' }}</td>
                <td class="px-2 py-1">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="validationClass(row.validationStatus)"
                  >
                    {{ row.validationStatus || '-' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const startPartida = ref('0542101')
const limit = ref(500)
const loading = ref(false)
const error = ref('')
const rows = ref([])
const showOnlySinMatch = ref(false)
const seqCandidateMap = ref(new Map())
const folderInput = ref(null)
const preloading = ref(false)
const preloadStatus = ref('')

const RECEITA_MAP = {
  'U10(561)-4760': 'U10/1-4760561',
  'U12.5(560)-5696': 'U12.5-5696560',
  'U10+10F(561)-4760': '10+10F4760561',
  'U12(560)-5696': 'U12/1-5696560',
  'U10(920)-4760': 'U10/1-4760920',
  'U12.5(920)-5696': 'U12.5-5696920',
  'U12(561)-4760': 'U12/1-4760560',
  'U10+9,5F(498)-4760': 'U10+9F4760498'
}

const METROS_TOL = 0.15
const VELOC_TOL = 0.20

const sinMatchCount = computed(() => rows.value.filter((r) => !r.hasMatch).length)

const enrichedRows = computed(() => {
  const list = [...rows.value]
  const matchedIdx = []

  for (let i = 0; i < list.length; i++) {
    const seq = Number(list[i]?.rtfSeqIndex)
    if (list[i]?.hasMatch && Number.isFinite(seq) && seq > 0) {
      matchedIdx.push({ i, seq })
    }
  }

  function findPrev(i) {
    for (let k = matchedIdx.length - 1; k >= 0; k--) {
      if (matchedIdx[k].i < i) return matchedIdx[k]
    }
    return null
  }

  function findNext(i) {
    for (let k = 0; k < matchedIdx.length; k++) {
      if (matchedIdx[k].i > i) return matchedIdx[k]
    }
    return null
  }

  return list.map((row, i) => {
    if (row.hasMatch) {
      return {
        ...row,
        candidateSeq: null,
        candidateSeqLabel: '',
        validationStatus: 'MATCH'
      }
    }

    const prev = findPrev(i)
    const next = findNext(i)
    let candidateSeq = null

    if (prev && next) {
      const forward = prev.seq + (i - prev.i)
      if (forward < next.seq) candidateSeq = forward
    } else if (prev) {
      candidateSeq = prev.seq + (i - prev.i)
    } else if (next) {
      candidateSeq = next.seq - (next.i - i)
    }

    const candidateSeqLabel = Number.isFinite(candidateSeq) && candidateSeq > 0
      ? String(candidateSeq).padStart(3, '0')
      : ''

    const candidate = candidateSeq != null ? seqCandidateMap.value.get(candidateSeq) : null
    const validationStatus = getValidationStatus(row, candidateSeq, candidate)

    return {
      ...row,
      candidateSeq,
      candidateSeqLabel,
      validationStatus
    }
  })
})

const aptoCount = computed(() => enrichedRows.value.filter((r) => r.validationStatus === 'APTO').length)

const displayRows = computed(() => {
  if (!showOnlySinMatch.value) return enrichedRows.value
  return enrichedRows.value.filter((r) => !r.hasMatch)
})

function parseMetric(v) {
  if (v == null || v === '') return null
  const m = String(v).replace(/\./g, '').match(/([\d,]+)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseVelocity(v) {
  if (v == null || v === '') return null
  const m = String(v).match(/([\d,.]+)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function getValidationStatus(row, candidateSeq, candidate) {
  if (!row || row.hasMatch) return 'MATCH'
  if (!Number.isFinite(candidateSeq) || candidateSeq < 0) return 'SIN_ANCLA'
  if (!candidate) return 'SIN_RTF'

  const receita = String(candidate.receita || '').trim()
  const expectedBase = RECEITA_MAP[receita] || null
  const base = String(row.baseUrdume || '').trim()
  if (!expectedBase || expectedBase !== base) return 'RECEITA_FAIL'

  const dbMetros = Number(row.metragemTotal)
  const rtfMetros = parseMetric(candidate.metros)
  if (Number.isFinite(dbMetros) && dbMetros > 0 && Number.isFinite(rtfMetros)) {
    const d = Math.abs(rtfMetros - dbMetros) / dbMetros
    if (d > METROS_TOL) return 'METROS_FAIL'
  }

  const dbVel = Number(row.velocMedia)
  const rtfVel = parseVelocity(candidate.velMMin)
  if (Number.isFinite(dbVel) && dbVel > 0 && Number.isFinite(rtfVel)) {
    const d = Math.abs(rtfVel - dbVel) / dbVel
    if (d > VELOC_TOL) return 'VEL_WARN'
  }

  return 'APTO'
}

function validationClass(status) {
  if (status === 'MATCH') return 'bg-emerald-100 text-emerald-800'
  if (status === 'APTO') return 'bg-blue-100 text-blue-800'
  if (status === 'VEL_WARN') return 'bg-amber-100 text-amber-800'
  if (status === 'RECEITA_FAIL' || status === 'METROS_FAIL') return 'bg-rose-100 text-rose-800'
  return 'bg-slate-100 text-slate-700'
}


function getCandidateRow(row) {
  if (!row || !Number.isFinite(row.candidateSeq)) return null
  return seqCandidateMap.value.get(row.candidateSeq) || null
}

function displayComeco(row) {
  if (row?.rtfComeco) return row.rtfComeco
  const cand = getCandidateRow(row)
  return cand?.comeco || '-'
}

function displayReceita(row) {
  if (row?.rtfReceita) return row.rtfReceita
  const cand = getCandidateRow(row)
  return cand?.receita || '-'
}

function display1X014(row) {
  if (row?.rtf1X014) return row.rtf1X014
  const cand = getCandidateRow(row)
  return cand?.metros || '-'
}

function display1S102(row) {
  if (row?.rtf1S102) return row.rtf1S102
  const cand = getCandidateRow(row)
  return cand?.velMMin || '-'
}

function rtfFieldClass(row) {
  if (row?.hasMatch) return 'text-slate-700'
  const cand = getCandidateRow(row)
  return cand ? 'text-blue-700 font-medium' : 'text-slate-700'
}

function normalizeLoose(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function rtfToPlainText(rtf = '') {
  let text = String(rtf || '')
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16)
    return Number.isFinite(code) ? String.fromCharCode(code) : ''
  })
  text = text.replace(/\\par[d]?/g, '\n')
  text = text.replace(/\\tab/g, '\t')
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  text = text.replace(/[{}]/g, ' ')
  text = text.replace(/\r/g, '')
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text
}

async function readRtfFileText(file) {
  if (!file) return ''
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const decoded1252 = new TextDecoder('windows-1252').decode(bytes)
    const decodedUtf8 = new TextDecoder('utf-8').decode(bytes)
    const bad1252 = (decoded1252.match(/[Ã�]/g) || []).length
    const badUtf8 = (decodedUtf8.match(/[Ã�]/g) || []).length
    return badUtf8 < bad1252 ? decodedUtf8 : decoded1252
  } catch {
    return await file.text()
  }
}

function extractField(lines, keyLike) {
  const keyNorm = normalizeLoose(keyLike)
  for (const line of lines) {
    const parts = String(line || '').split(':')
    if (parts.length < 2) continue
    const left = normalizeLoose(parts[0])
    if (!left.includes(keyNorm)) continue
    return parts.slice(1).join(':').trim()
  }
  return ''
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function extractCodeNumber(lines, code) {
  const escaped = String(code || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*${escaped}\\s*:`, 'i')
  const codeLine = (Array.isArray(lines) ? lines : []).find((line) => re.test(String(line || ''))) || ''
  if (!codeLine) return null
  const rightSide = codeLine.split(':').slice(1).join(':')
  const matches = [...rightSide.matchAll(/-?[0-9]+(?:[.,][0-9]+)?/g)]
  if (!matches.length) return null
  return toNumberOrNull(matches[matches.length - 1][0])
}

function formatMetricFromCode(lines, code, unit) {
  const value = extractCodeNumber(lines, code)
  if (!Number.isFinite(value)) return ''
  return `${value} ${unit}`
}

function normalizeRtfDateTime(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  const m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?/)
  if (!m) return raw
  const [, dd, mm, yy, hh, mins] = m
  const fullYear = Number(yy) < 50 ? `20${yy}` : `19${yy}`
  return `${dd}/${mm}/${fullYear} ${hh}:${mins}`
}

function parseRtfHeaderLite(rawText) {
  const plain = rtfToPlainText(rawText)
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    comeco: normalizeRtfDateTime(extractField(lines, 'comeco')),
    receita: extractField(lines, 'receita'),
    metros: formatMetricFromCode(lines, '1x014', 'm'),
    velMMin: formatMetricFromCode(lines, '1s102', 'm/min')
  }
}

function extractRtfSeqIndex(name) {
  if (!name) return null
  const m = String(name).match(/\((\d{3})\)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function getMissingCandidateSeqs() {
  const seqs = new Set()
  for (const row of enrichedRows.value) {
    if (row?.hasMatch) continue
    if (!Number.isFinite(row?.candidateSeq) || row.candidateSeq <= 0) continue
    if (seqCandidateMap.value.has(row.candidateSeq)) continue
    seqs.add(row.candidateSeq)
  }
  return [...seqs].sort((a, b) => a - b)
}

function pickRtfFolder() {
  preloadStatus.value = ''
  folderInput.value?.click()
}

async function onRtfFolderChange(event) {
  try {
    preloading.value = true
    preloadStatus.value = ''

    const files = Array.from(event?.target?.files || [])
    if (!files.length) {
      preloadStatus.value = 'No se seleccionaron archivos RTF.'
      return
    }

    const missingSeqs = getMissingCandidateSeqs()
    if (!missingSeqs.length) {
      preloadStatus.value = 'No hay secuencias candidatas faltantes para precargar.'
      return
    }

    const needed = new Set(missingSeqs)
    const filesBySeq = new Map()
    for (const file of files) {
      const seq = extractRtfSeqIndex(file.name)
      if (!Number.isFinite(seq) || !needed.has(seq)) continue
      if (!filesBySeq.has(seq)) filesBySeq.set(seq, file)
    }

    const merged = new Map(seqCandidateMap.value)
    let loaded = 0
    let parsed = 0

    for (const seq of missingSeqs) {
      const file = filesBySeq.get(seq)
      if (!file) continue
      const raw = await readRtfFileText(file)
      const header = parseRtfHeaderLite(raw)
      merged.set(seq, {
        seqIndex: seq,
        sourceFile: file.name,
        partida: '',
        confidence: 'local_folder',
        comeco: header.comeco || '',
        receita: header.receita || '',
        metros: header.metros || '',
        velMMin: header.velMMin || ''
      })
      loaded += 1
      if (header.comeco || header.receita || header.metros || header.velMMin) parsed += 1
    }

    seqCandidateMap.value = merged
    const notFound = missingSeqs.length - loaded
    preloadStatus.value = `Precarga completada. Candidatos cargados: ${loaded}/${missingSeqs.length}. Con header util: ${parsed}. Sin archivo en carpeta: ${notFound}.`
  } catch (err) {
    preloadStatus.value = `Error en precarga local: ${err.message || 'desconocido'}`
  } finally {
    preloading.value = false
    if (event?.target) event.target.value = ''
  }
}

async function loadSeqCandidates() {
  const noMatchRows = enrichedRows.value.filter((r) => !r.hasMatch && Number.isFinite(r.candidateSeq) && r.candidateSeq > 0)
  if (!noMatchRows.length) {
    seqCandidateMap.value = new Map()
    return
  }

  const seqs = noMatchRows.map((r) => r.candidateSeq)
  const from = Math.min(...seqs)
  const to = Math.max(...seqs)

  const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
  const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

  const resp = await fetch(`${API_URL}/benninger-rtf/seq-range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()

  const map = new Map()
  for (const row of (data.rows || [])) {
    const key = Number(row.seqIndex)
    if (Number.isFinite(key)) map.set(key, row)
  }
  seqCandidateMap.value = map
}

function formatNum(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

async function loadRows() {
  try {
    loading.value = true
    error.value = ''

    const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
    const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

    const resp = await fetch(
      `${API_URL}/benninger-rtf/secuencia-match-partidas?startPartida=${encodeURIComponent(startPartida.value || '0542101')}&limit=${encodeURIComponent(limit.value || 500)}`
    )
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const data = await resp.json()
    rows.value = Array.isArray(data.rows) ? data.rows : []
    seqCandidateMap.value = new Map()
    await loadSeqCandidates()
  } catch (e) {
    rows.value = []
    seqCandidateMap.value = new Map()
    error.value = e.message || 'Error cargando secuencia de partidas.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRows()
})
</script>
