/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getImportStatus, importCSV, importAll, importSpecificTables, importForceAll, renameduplicateHeaders, getTableColumns, compareColumns, addColumnsToTable } from './import-manager.js'
import configStandardsRouter from './config-standards.js';
import { optimizeBlend } from './services/blendomat-optimizer.js';
import {
  getMatrizRequisitos,
  evalUmbral,
  computeEta,
  evaluateBenningerAptitude,
  evaluateSideImbalance,
  buildNarrativaMatrixPromptBlock,
  buildBenningerPromptBlock,
} from '../shared/qualityMatrix.js';

const { Pool } = pg
const app = express()

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rutas de configuración
app.use('/api/config', configStandardsRouter);

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function looksLikeWindowsPath(p) {
  if (!p) return false
  // Drive letter (C:\...) or UNC (\\server\share)
  return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)
}

function sanitizeCsvFolder(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  // Si el backend corre en Linux (contenedor/servidor), una ruta Windows no existe.
  if (process.platform !== 'win32' && looksLikeWindowsPath(value)) return ''
  return value
}

function defaultCsvFolder() {
  // Windows dev histórico: C:\STC\CSV
  // Linux/Container: montar volumen en /data/csv
  const envFolder = String(process.env.CSV_FOLDER || '').trim()
  if (envFolder) return envFolder
  return process.platform === 'win32' ? 'C:\\STC\\CSV' : '/data/csv'
}

function resolveCsvFolderFromReq(req) {
  const q = sanitizeCsvFolder(req?.query?.csvFolder)
  if (q) return q
  return defaultCsvFolder()
}

function resolveCsvFolderFromBody(req) {
  const b = sanitizeCsvFolder(req?.body?.csvFolder)
  if (b) return b
  return defaultCsvFolder()
}

// =====================================================
// CONFIGURACIÓN DATABASE
// =====================================================
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

function hrMs() {
  return Number(process.hrtime.bigint()) / 1_000_000
}

// Helper: query wrapper
async function query(text, params, label) {
  const start = hrMs()
  const res = await pool.query(text, params)
  const duration = hrMs() - start
  const tag = label ? ` [${label}]` : ''
  const rows = Array.isArray(res?.rows) ? res.rows.length : res?.rowCount
  console.log(`✓ Query${tag} in ${duration.toFixed(1)}ms (rows=${rows ?? 'n/a'})`)
  return res
}

// Helper: obtener cliente para transacciones
async function getClient() {
  return await pool.connect()
}

// Helper: convertir claves a mayúsculas (compatibilidad Oracle/carga-datos-docker)
function uppercaseKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(uppercaseKeys)
  const result = {}
  for (const key of Object.keys(obj)) {
    result[key.toUpperCase()] = obj[key]
  }
  return result
}

// Helper: formatear números
function formatNumber(val) {
  if (val === null || val === undefined || val === '') return val
  const num = parseFloat(val)
  if (isNaN(num)) return val
  return String(parseFloat(num.toFixed(2)))
}

function formatTimestampEsAr24(date = new Date()) {
  return new Date(date).toLocaleString('es-AR', {
    timeZone: process.env.REPORT_TIME_ZONE || 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatOeMachineCode(value) {
  const raw = String(value || '').trim().replace(/^#/, '')
  if (!raw) return ''

  const sp = raw.search(/\s/)
  const baseRaw = sp === -1 ? raw : raw.slice(0, sp)
  const suffix = sp === -1 ? '' : raw.slice(sp + 1).trim().slice(0, 2)

  const digits = baseRaw.replace(/\D/g, '')
  if (!digits) return raw

  const core = digits.length > 2 ? digits.slice(-2) : digits
  const num = parseInt(core, 10)
  const base = Number.isFinite(num) ? String(num) : String(parseInt(digits, 10))
  return suffix ? `${base} ${suffix}` : base
}

function formatEstirajeDisplay(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'S/D'
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num))
  return num.toFixed(2).replace(/\.?0+$/, '')
}

function formatEstirajeSpan(avgValue, minValue, maxValue) {
  const avg = Number(avgValue)
  const min = Number(minValue)
  const max = Number(maxValue)
  const hasAvg = Number.isFinite(avg)
  const hasMin = Number.isFinite(min)
  const hasMax = Number.isFinite(max)

  if (hasMin && hasMax) {
    if (Math.abs(max - min) >= 0.01) {
      return `${formatEstirajeDisplay(min)}-${formatEstirajeDisplay(max)}`
    }
    return formatEstirajeDisplay(hasAvg ? avg : min)
  }
  if (hasAvg) return formatEstirajeDisplay(avg)
  return 'S/D'
}

function formatEstirajeBySide(rowLike) {
  if (!rowLike) return 'S/D'

  const lp = Number(rowLike.estiraje_lp_avg)
  const li = Number(rowLike.estiraje_li_avg)
  const hasLp = Number.isFinite(lp)
  const hasLi = Number.isFinite(li)

  if (hasLp || hasLi) {
    const parts = []
    if (hasLp) {
      parts.push(`LP ${formatEstirajeSpan(rowLike.estiraje_lp_avg, rowLike.estiraje_lp_min, rowLike.estiraje_lp_max)}`)
    }
    if (hasLi) {
      parts.push(`LI ${formatEstirajeSpan(rowLike.estiraje_li_avg, rowLike.estiraje_li_min, rowLike.estiraje_li_max)}`)
    }
    return parts.join(' | ')
  }

  const maquinasTxt = String(rowLike.maquinas || '').toUpperCase()
  const hasLpMaq = /(^|\s)LP($|\s)/.test(maquinasTxt)
  const hasLiMaq = /(^|\s)(LI|LIM)($|\s)/.test(maquinasTxt)
  if (hasLpMaq && hasLiMaq) {
    const min = Number(rowLike.estiraje_min)
    const max = Number(rowLike.estiraje_max)
    if (Number.isFinite(min) && Number.isFinite(max) && Math.abs(max - min) >= 0.01) {
      return `LP ${formatEstirajeDisplay(max)} | LI ${formatEstirajeDisplay(min)}`
    }
  }

  return formatEstirajeSpan(rowLike.estiraje_avg, rowLike.estiraje_min, rowLike.estiraje_max)
}

function normalizeNarrativaGemini(text) {
  if (text == null) return ''
  let out = String(text)
  const romanToInt = (romanRaw) => {
    const roman = String(romanRaw || '').toUpperCase().trim()
    const map = { I: 1, V: 5, X: 10 }
    let total = 0
    let prev = 0
    for (let i = roman.length - 1; i >= 0; i--) {
      const val = map[roman[i]] || 0
      if (val < prev) total -= val
      else {
        total += val
        prev = val
      }
    }
    return total || null
  }

  // Uniforma bullets para mantener el estilo de salida esperado (Opcion 1)
  out = out.replace(/^\s*\*\s+/gm, '- ')

  // Regla temporal: ocultar CVm OE cuando viene como 0.00/no util para decision.
  out = out
    .split('\n')
    .filter((line) => !/\bcvm\b[^\n]*\boe\b[^\n]*0[\.,]00/i.test(line) && !/0[\.,]00[^\n]*\bcvm\b[^\n]*\boe\b/i.test(line))
    .join('\n')

  out = out.replace(/\s*\|\s*CVM\s*0[\.,]00\b/gi, '')
  out = out.replace(/\bCVm(?:_OE)?\s*(?:en\s*OE)?\s*=?\s*0[\.,]00(?:\s*\([^\)]*\))?/gi, '')

  // Normaliza etiquetas de maquina para planta: OE 050409 / OE R60 010 -> OE 9 / OE 10
  out = out.replace(/\bOpen\s*End\s*(I{1,3}|IV|V)\b/gi, (_, roman) => {
    const n = romanToInt(roman)
    return n ? `OE ${n}` : 'OE'
  })
  out = out.replace(/\bRieter\s*R?60\s*(?:N[°ºo]?\s*)?0*(\d{2,3})(?:\s*(LP|LI))?\b/gi, (_, n, side) => {
    const num = parseInt(String(n).slice(-2), 10)
    const suf = side ? ` ${String(side).toUpperCase()}` : ''
    return `OE ${num}${suf}`
  })
  out = out.replace(/\bOE\s+[A-Z0-9]+\s+0*(\d{2,3})\b/gi, (_, n) => `OE ${parseInt(String(n).slice(-2), 10)}`)
  out = out.replace(/\bOE\s*\(\s*(\d{5,6})\s*\)/gi, (_, n) => `OE ${parseInt(String(n).slice(-2), 10)}`)
  out = out.replace(/\bOE\s+0*(\d{5,6})\b/gi, (_, n) => `OE ${parseInt(String(n).slice(-2), 10)}`)

  // Evita ruido visual cuando el modelo genera fila UI totalmente vacia
  out = out.replace(/^\s*HVI\s*UI\s*\(%\)\s+N\/D\s+N\/D\s+N\/D\s*$/gmi, '')
  out = out.replace(/^\s*UI\s*fibra\s*\(%\)\s+N\/D\s+N\/D\s+N\/D\s*$/gmi, '')
  out = out.replace(/\n{3,}/g, '\n\n')

  return out
}

// Helpers SQL (PostgreSQL): parseo robusto de fechas/números desde TEXT
function sqlParseDate(colIdent) {
  // Soporta D/M/YYYY o DD/MM/YYYY y YYYY-MM-DD (opcional con hora)
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^[0-3]?[0-9]/[0-1]?[0-9]/[0-9]{4}(\\s|$)' THEN to_date(
        lpad(split_part(split_part(${colIdent}, ' ', 1), '/', 1), 2, '0') || '/' ||
        lpad(split_part(split_part(${colIdent}, ' ', 1), '/', 2), 2, '0') || '/' ||
        split_part(split_part(${colIdent}, ' ', 1), '/', 3),
        'DD/MM/YYYY'
      )
      WHEN ${colIdent} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${colIdent} from 1 for 10)::date
      ELSE NULL
    END
  )`
}

function sqlParseNumber(colIdent) {
  // Convierte TEXT numérico con '.' o ',' decimal; ignora valores no numéricos.
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

function sqlParseNumberIntl(colIdent) {
  // Soporta números en formato europeo con separador de miles '.' y decimal ',' (ej: 1.980,00)
  // y también formatos simples (ej: 1980.00 o 1980,00).
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' THEN replace(replace(${colIdent}, '.', ''), ',', '.')::numeric
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

function sqlBuildTimestamp(dateColIdent, timeColIdent) {
  const dateExpr = sqlParseDate(dateColIdent)
  return `(
    CASE
      WHEN ${dateExpr} IS NULL THEN NULL
      ELSE to_timestamp(
        to_char(${dateExpr}, 'YYYY-MM-DD') || ' ' || COALESCE(
          CASE
            WHEN btrim(COALESCE(${timeColIdent}, '')) ~ '^[0-2][0-9]:[0-5][0-9]$' THEN btrim(${timeColIdent}) || ':00'
            WHEN btrim(COALESCE(${timeColIdent}, '')) ~ '^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$' THEN btrim(${timeColIdent})
            ELSE NULL
          END,
          '00:00:00'
        ),
        'YYYY-MM-DD HH24:MI:SS'
      )
    END
  )`
}

function parseBenningerDateTime(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  const m = value.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null

  let year = Number(m[3])
  if (!Number.isFinite(year)) return null
  if (year < 100) year += 2000

  const dd = String(Number(m[1])).padStart(2, '0')
  const mm = String(Number(m[2])).padStart(2, '0')
  const yyyy = String(year).padStart(4, '0')
  const hh = String(Number(m[4])).padStart(2, '0')
  const mi = String(Number(m[5])).padStart(2, '0')
  const ss = String(Number(m[6] || '0')).padStart(2, '0')

  return {
    raw: value,
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}:${ss}`,
    sqlTimestamp: `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }
}

function parseBenningerDurationSeconds(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return null

  const dhms = value.match(/d\s*:\s*(\d+)\s*,?\s*h\s*:\s*(\d+)\s*,?\s*m\s*:\s*(\d+)\s*,?\s*s\s*:\s*(\d+)/i)
  if (dhms) {
    const d = Number(dhms[1])
    const h = Number(dhms[2])
    const m = Number(dhms[3])
    const s = Number(dhms[4])
    return (d * 86400) + (h * 3600) + (m * 60) + s
  }

  const hms = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (hms) {
    const h = Number(hms[1])
    const m = Number(hms[2])
    const s = Number(hms[3] || '0')
    return (h * 3600) + (m * 60) + s
  }

  return null
}

function normalizeDigitsKey(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  return digits.replace(/^0+/, '') || '0'
}

function deriveRoladaFromPartida(partida) {
  const digits = String(partida || '').replace(/\D/g, '')
  if (!digits) return null
  const right6 = digits.slice(-6)
  if (right6.length < 4) return null
  return normalizeDigitsKey(right6.slice(0, 4))
}

function computeBenningerMatchScore({ startDiffSec, endDiffSec, durationDiffSec }) {
  const safeStart = Number.isFinite(startDiffSec) ? Math.max(0, startDiffSec) : Number.POSITIVE_INFINITY
  const safeEnd = Number.isFinite(endDiffSec) ? Math.max(0, endDiffSec) : null
  const safeDuration = Number.isFinite(durationDiffSec) ? Math.max(0, durationDiffSec) : null

  const startPenalty = Number.isFinite(safeStart) ? Math.min(70, (safeStart / 60) * 2.0) : 70
  const endPenalty = Number.isFinite(safeEnd) ? Math.min(20, (safeEnd / 60) * 0.8) : 0
  const durationPenalty = Number.isFinite(safeDuration) ? Math.min(10, (safeDuration / 60) * 0.4) : 0

  const score = 100 - startPenalty - endPenalty - durationPenalty
  return Math.max(0, Math.min(100, Number(score.toFixed(2))))
}

function classifyBenningerConfidence(bestScore, scoreGap) {
  if (!Number.isFinite(bestScore)) return 'none'
  if (bestScore >= 85 && scoreGap >= 12) return 'high'
  if (bestScore >= 70) return 'medium'
  if (bestScore >= 55) return 'low'
  return 'none'
}

function roundNullable(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Number(n.toFixed(decimals))
}

function buildFibraSummaryFromLots(lotes, fibraByLot) {
  const lotList = Array.isArray(lotes) ? lotes.filter(Boolean) : []
  if (!lotList.length) return null

  let totalWeight = 0
  let sumMic = 0
  let sumStr = 0
  let sumUhml = 0
  let sumSci = 0
  let sumElg = 0
  let sumRd = 0
  let sumPlusB = 0
  let hasAny = false

  for (const lote of lotList) {
    const row = fibraByLot.get(lote)
    if (!row) continue

    const w = Number(row.muestras)
    if (!Number.isFinite(w) || w <= 0) continue

    totalWeight += w
    sumMic += (Number(row.mic) || 0) * w
    sumStr += (Number(row.str) || 0) * w
    sumUhml += (Number(row.uhml) || 0) * w
    sumSci += (Number(row.sci) || 0) * w
    sumElg += (Number(row.elg) || 0) * w
    sumRd += (Number(row.rd) || 0) * w
    sumPlusB += (Number(row.plusB) || 0) * w
    hasAny = true
  }

  if (!hasAny || totalWeight <= 0) return null

  return {
    lotes: lotList,
    muestras: totalWeight,
    mic: roundNullable(sumMic / totalWeight, 3),
    str: roundNullable(sumStr / totalWeight, 3),
    uhml: roundNullable(sumUhml / totalWeight, 3),
    sci: roundNullable(sumSci / totalWeight, 3),
    elg: roundNullable(sumElg / totalWeight, 3),
    rd: roundNullable(sumRd / totalWeight, 3),
    plusB: roundNullable(sumPlusB / totalWeight, 3)
  }
}

function parseLooseNumber(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const value = String(raw).trim()
  if (!value) return null
  const m = value.match(/-?[0-9]+(?:[.,][0-9]+)?/)
  if (!m) return null
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function pickHeaderNumber(header, keys) {
  if (!header || typeof header !== 'object') return null
  for (const key of keys) {
    if (!(key in header)) continue
    const n = parseLooseNumber(header[key])
    if (Number.isFinite(n)) return n
  }
  return null
}

function normalizeTimelineEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  const punto = String(entry.punto || entry.point || '').trim()
  const tensionN = parseLooseNumber(entry.tensionN ?? entry.tension ?? entry.value)
  if (!punto || !Number.isFinite(tensionN)) return null
  return { punto, tensionN: Number(tensionN.toFixed(2)) }
}

function buildTimelineFromHeader(header, tensionPlegador) {
  const source = Array.isArray(header?.tensionTimeline)
    ? header.tensionTimeline.map(normalizeTimelineEntry).filter(Boolean)
    : []
  if (source.length) return source

  const map = [
    ['M12', ['tensionM12', 'tension_1S002', '1S002']],
    ['M13', ['tensionM13', 'tension_1S003', '1S003']],
    ['M14', ['tensionM14', 'tension_1S004', '1S004']],
    ['M15', ['tensionM15', 'tension_1S005', '1S005']],
    ['M17', ['tensionM17', 'tension_2S007', '2S007']],
    ['M18', ['tensionM18', 'tension_2S008', '2S008']],
    ['M20', ['tensionM20', 'tension_1S009', '1S009']],
    ['M21', ['tensionM21', 'tension_1S010', '1S010']],
    ['M22', ['tensionM22', 'tension_1S011', '1S011']],
    ['M24', ['tensionM24', 'tension_1S012', '1S012']],
    ['M25', ['tensionM25', 'tension_1S013', '1S013']],
    ['M26', ['tensionM26', 'tension_1S014', '1S014']],
    ['S800', ['tensionPlegador', 'tension_1S054', '1S054']]
  ]

  const out = []
  for (const [punto, keys] of map) {
    const nRaw = pickHeaderNumber(header, keys)
    if (!Number.isFinite(nRaw)) continue
    // Same unit normalization as humedadSalida/tensionPlegador: raw < 500 → ×100 (hectonewton → N)
    const n = nRaw > 0 && nRaw < 500 ? nRaw * 100 : nRaw
    out.push({ punto, tensionN: Number(n.toFixed(2)) })
  }

  if (!out.length && Number.isFinite(tensionPlegador)) {
    out.push({ punto: 'S800', tensionN: Number(tensionPlegador.toFixed(2)) })
  }

  return out
}

const BENNINGER_AML_CEL_MAX_EVENTS = 40
const BENNINGER_RTF_PARSE_VERSION = 'rtf-full-v1'
const BENNINGER_AML_CEL_RELEVANT = /(?:\bAML\b|\bCEL\b|\bS\d{3}\b|grelha\s+aberta|parada|velocidade\s+lenta|rasteje\s+velocidade|fora\s+da\s+toler|fuera\s+de\s+toler|carg\s*a\s*de\s*goma)/i

function normalizeLooseText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function rtfToPlainText(rawText) {
  let text = String(rawText || '')
  if (!text) return ''

  // Decode escaped bytes before dropping RTF control words.
  text = text.replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
    const code = Number.parseInt(m.slice(2), 16)
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

function detectAmlCelSection(line) {
  const norm = normalizeLooseText(line)
  if (!norm) return null
  if (/^aml\b/.test(norm)) return 'AML'
  if (/^cel\b/.test(norm)) return 'CEL'
  return null
}

function cleanAmlCelLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*>>\s*/, '')
    .trim()
}

function cleanAmlCelDescription(text) {
  return String(text || '')
    .replace(/\s*\.{5,}\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCelSetChange(line) {
  const text = String(line || '')
  if (!text) return null

  const setMatchParen = text.match(/\bset\s*:\s*old:\s*\(\s*([^\)]+?)\s*\)\s*new:\s*\(\s*([^\)]+?)\s*\)/i)
  const setMatchLoose = text.match(/\bset\s*:\s*old:\s*([^\s]+)\s*new:\s*([^\s]+)/i)
  const setMatch = setMatchParen || setMatchLoose
  if (!setMatch) return null

  const oldRaw = String(setMatch[1] || '').trim()
  const newRaw = String(setMatch[2] || '').trim()
  const oldNum = parseLooseNumber(oldRaw)
  const newNum = parseLooseNumber(newRaw)

  const setpointMatch = text.match(/\b((?:\d{1,2})?S\d{3,4})\s*:\s*([^<]+)$/i)
  const setpointCode = setpointMatch?.[1] ? String(setpointMatch[1]).toUpperCase() : null
  const setpointDescription = cleanAmlCelDescription(setpointMatch?.[2] || '') || null

  return {
    oldRaw: oldRaw || null,
    newRaw: newRaw || null,
    oldValue: Number.isFinite(oldNum) ? oldNum : null,
    newValue: Number.isFinite(newNum) ? newNum : null,
    deltaValue: Number.isFinite(oldNum) && Number.isFinite(newNum) ? Number((newNum - oldNum).toFixed(6)) : null,
    setpointCode,
    setpointDescription
  }
}

function parseSqlTimestampToDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const normalized = raw.replace('T', ' ')
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null

  const yyyy = Number(m[1])
  const mm = Number(m[2])
  const dd = Number(m[3])
  const hh = Number(m[4])
  const mi = Number(m[5])
  const ss = Number(m[6] || '0')

  const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss)
  if (Number.isNaN(dt.getTime())) return null
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() !== mm - 1 ||
    dt.getDate() !== dd ||
    dt.getHours() !== hh ||
    dt.getMinutes() !== mi ||
    dt.getSeconds() !== ss
  ) {
    return null
  }

  return dt
}

function buildSqlTimestamp(year, month, day, hour, minute, second) {
  const yyyy = Number(year)
  const mm = Number(month)
  const dd = Number(day)
  const hh = Number(hour)
  const mi = Number(minute)
  const ss = Number(second)

  if (![yyyy, mm, dd, hh, mi, ss].every(Number.isFinite)) return null
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  if (hh < 0 || hh > 23 || mi < 0 || mi > 59 || ss < 0 || ss > 59) return null

  const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss)
  if (Number.isNaN(dt.getTime())) return null
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() !== mm - 1 ||
    dt.getDate() !== dd ||
    dt.getHours() !== hh ||
    dt.getMinutes() !== mi ||
    dt.getSeconds() !== ss
  ) {
    return null
  }

  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function normalizeAmlCelYear(value) {
  const year = Number(value)
  if (!Number.isFinite(year)) return null
  if (year >= 100) return year
  return year + 2000
}

function resolveAmlCelDateByAnchor(candidates, anchorTimestamp) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const anchorDate = parseSqlTimestampToDate(anchorTimestamp)
  if (!anchorDate) return candidates[0]

  let best = candidates[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const dt = parseSqlTimestampToDate(candidate)
    if (!dt) continue
    const distanceMs = Math.abs(dt.getTime() - anchorDate.getTime())
    if (distanceMs < bestDistance) {
      bestDistance = distanceMs
      best = candidate
    }
  }

  return best
}

function resolveAmlCelAnchorTimestamp(header) {
  const source = header && typeof header === 'object' ? header : {}
  const candidates = [
    source.comeco,
    source.inicio,
    source.start,
    source.fim,
    source.end,
    source.startTime,
    source.endTime
  ]

  for (const value of candidates) {
    const text = String(value || '').trim()
    if (!text) continue

    const isoLike = text.match(/\b(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\b/)
    if (isoLike) {
      const ts = buildSqlTimestamp(
        Number(isoLike[1]),
        Number(isoLike[2]),
        Number(isoLike[3]),
        Number(isoLike[4]),
        Number(isoLike[5]),
        Number(isoLike[6] || '0')
      )
      if (ts) return ts
    }

    const parsed = parseBenningerDateTime(text)
    if (parsed?.sqlTimestamp) return parsed.sqlTimestamp
  }

  return null
}

function parseAmlCelEventLineFromText(rawLine, sectionHint, lineNo, context = {}) {
  const original = String(rawLine || '')
  const line = cleanAmlCelLine(original)
  if (!line) return null

  const dateTimeRegex = /((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\s+\d{1,2}:\d{2}(?::\d{2})?)/g
  const dtMatches = [...line.matchAll(dateTimeRegex)].map((m) => m[1])
  const startRaw = dtMatches[0] || null
  const endRaw = dtMatches[1] || null
  if (!startRaw) return null

  const parsed = parseAmlCelLine(line, context) || {}
  const meterPos = Number.parseInt(line.match(/\b(\d+)\s*\[m\]/i)?.[1] || '', 10)
  // Formato 1: "NNN[m]-CCCC: SEVERITY:" (con posición métrica)
  // Formato 2: "CCCC: SEVERITY:"         (sin posición métrica, sin guion previo)
  const eventCode = (
    line.match(/(?<!\d)(\d{3,4})\s*:\s*(?:INFO|AVISO|SEGURAN[ÇC]A|ESTADO)\b/i)?.[1] ??
    line.match(/-(\d{3,4})\s*:/)?.[1] ??
    null
  )
  const subsystem = line.match(/\b(?:\d{1,2})?S\d{1,4}(?:-[A-Z]+)?\b/i)?.[0] || null
  const severityToken = line.match(/\b(INFO|AVISO|SEGURAN[ÇC]A|ESTADO)\b/i)?.[1] || null
  const machineTag = line.match(/\bM\d{2}[A-Z]\d{2}B\d{3}X\d+\b/i)?.[0] || null
  const celSet = parseCelSetChange(line)

  let descriptionRaw = null
  const codePrefix = line.match(/-\s*\d{3,4}\s*:\s*/)
  if (codePrefix) {
    let tail = line.slice((codePrefix.index || 0) + codePrefix[0].length)
    tail = tail.replace(/\s*<<\s*(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\s+\d{1,2}:\d{2}(?::\d{2})?\s*/i, ' ')
    tail = tail.replace(/\bM\d{2}[A-Z]\d{2}B\d{3}X\d+\b/i, ' ')
    descriptionRaw = tail
  }
  const descripcionParada = cleanAmlCelDescription(celSet?.setpointDescription || descriptionRaw || parsed.detalle || line)

  const inferredTipo = sectionHint || (/set:\s*old\s*:/i.test(line) ? 'CEL' : 'AML')
  const tipo = String(parsed.tipo || inferredTipo || '').toUpperCase() || null
  const codigo = String(parsed.codigo || celSet?.setpointCode || subsystem || (eventCode ? `E${eventCode}` : '')).toUpperCase() || null
  const detalle = String(descripcionParada || parsed.detalle || line).trim()
  const severidad = String(parsed.severidad || classifyAmlCelSeverity(tipo, codigo, detalle)).toLowerCase()
  const timestamp = normalizeAmlCelTimestamp(startRaw, context)
  const timestampEnd = normalizeAmlCelTimestamp(endRaw, context)
  const eventHash = crypto
    .createHash('sha1')
    .update(`${String(sectionHint || '')}|${String(lineNo || 0)}|${line}`)
    .digest('hex')

  return {
    lineNo: Number.isFinite(Number(lineNo)) ? Number(lineNo) : null,
    section: sectionHint || tipo || null,
    tipo,
    codigo,
    severidad,
    timestamp,
    timestampEnd,
    timestampRaw: startRaw,
    timestampEndRaw: endRaw,
    fechaHoraInicialRaw: startRaw,
    fechaHoraFinalRaw: endRaw,
    meterPos: Number.isFinite(meterPos) ? meterPos : null,
    metros: Number.isFinite(meterPos) ? meterPos : null,
    eventCode,
    codigoParada: eventCode || celSet?.setpointCode || null,
    descripcionParada,
    setOldRaw: celSet?.oldRaw || null,
    setNewRaw: celSet?.newRaw || null,
    setOldValue: Number.isFinite(celSet?.oldValue) ? celSet.oldValue : null,
    setNewValue: Number.isFinite(celSet?.newValue) ? celSet.newValue : null,
    setDeltaValue: Number.isFinite(celSet?.deltaValue) ? celSet.deltaValue : null,
    setpointCode: celSet?.setpointCode || null,
    setpointDescription: celSet?.setpointDescription || null,
    subsystem: subsystem ? String(subsystem).toUpperCase() : null,
    machineTag,
    codigoAlfanumerico: machineTag,
    detalle,
    rawLine: line,
    eventHash
  }
}

function collectAmlCelEventsFromPlainText(plainText, summaryOutput, detailedOutput, context = {}) {
  const plain = String(plainText || '')
  if (!plain) return

  const lines = plain
    .split(/\r?\n/)
    .map((l) => String(l || '').trim())

  let section = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const maybeSection = detectAmlCelSection(line)
    if (maybeSection) {
      section = maybeSection
      continue
    }

    if (!line.includes('>>')) continue

    const event = parseAmlCelEventLineFromText(line, section, i + 1, context)
    if (!event) continue

    detailedOutput.push(event)
    summaryOutput.push({
      tipo: event.tipo,
      codigo: event.codigo,
      timestamp: event.timestamp,
      detalle: event.detalle,
      severidad: event.severidad
    })
  }
}

function normalizeAmlCelTimestamp(raw, context = {}) {
  const value = String(raw || '').trim()
  if (!value) return null

  const isoLike = value.match(/\b(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\b/)
  if (isoLike) {
    const directTs = buildSqlTimestamp(
      Number(isoLike[1]),
      Number(isoLike[2]),
      Number(isoLike[3]),
      Number(isoLike[4]),
      Number(isoLike[5]),
      Number(isoLike[6] || '0')
    )
    if (directTs) return directTs
  }

  const dm = value.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (dm) {
    const a = Number(dm[1])
    const b = Number(dm[2])
    const c = Number(dm[3])
    const hh = Number(dm[4])
    const mi = Number(dm[5])
    const ss = Number(dm[6] || '0')

    const candidates = []

    const dmy = buildSqlTimestamp(normalizeAmlCelYear(c), b, a, hh, mi, ss)
    if (dmy) candidates.push(dmy)

    if (String(dm[1]).length <= 2 && String(dm[3]).length <= 2) {
      const ymd = buildSqlTimestamp(normalizeAmlCelYear(a), b, c, hh, mi, ss)
      if (ymd) candidates.push(ymd)
    }

    const best = resolveAmlCelDateByAnchor(candidates, context?.anchorTimestamp)
    if (best) return best
  }

  const parsed = parseBenningerDateTime(value)
  if (parsed?.sqlTimestamp) return parsed.sqlTimestamp

  const hms = value.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
  return hms ? hms[0] : null
}

function classifyAmlCelSeverity(tipo, codigo, detalle) {
  const t = String(tipo || '').toUpperCase()
  const c = String(codigo || '').toUpperCase()
  const d = String(detalle || '').toLowerCase()

  if (c === 'S800' || c === 'S500') return 'critico'
  if (/critic|fora\s+toler|fuera\s+de\s+toler|desvio\s+alto|desv[ií]o\s+alto/.test(d)) return 'critico'
  if (/grelha\s+aberta|parada|velocidade\s+lenta|rasteje\s+velocidade|carg\s*a\s*de\s*goma/.test(d)) return 'alto'
  if (t === 'CEL') return 'alto'
  return 'medio'
}

function parseAmlCelLine(rawLine, context = {}) {
  const line = String(rawLine || '').replace(/\s+/g, ' ').trim()
  if (!line || !BENNINGER_AML_CEL_RELEVANT.test(line)) return null

  const tipo = line.match(/\b(AML|CEL)\b/i)?.[1]?.toUpperCase() || null
  const sCode = line.match(/\b(?:\d{1,2})?S\d{3,4}\b/i)?.[0]?.toUpperCase() || null
  const genericCode = line.match(/-(\d{3,4})\s*:/)?.[1] || null
  const codigo = sCode || (genericCode ? `E${genericCode}` : null)
  const tsRaw = line.match(/\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\s+\d{1,2}:\d{2}(?::\d{2})?\b/i)?.[0] || null
  const timestamp = normalizeAmlCelTimestamp(tsRaw, context)

  let detalle = line
  if (tsRaw) detalle = detalle.replace(tsRaw, ' ')
  if (tipo) detalle = detalle.replace(new RegExp(`\\b${tipo}\\b`, 'i'), ' ')
  if (sCode) detalle = detalle.replace(new RegExp(`\\b${sCode}\\b`, 'i'), ' ')
  if (genericCode) detalle = detalle.replace(new RegExp(`-${genericCode}\\s*:`, 'i'), ' ')
  detalle = detalle.replace(/^[\s\-:;|]+/, '').replace(/\s+/g, ' ').trim()
  if (!detalle) detalle = line

  return {
    tipo,
    codigo,
    timestamp,
    detalle,
    severidad: classifyAmlCelSeverity(tipo, codigo, detalle)
  }
}

function normalizeAmlCelObject(entry, context = {}) {
  if (!entry || typeof entry !== 'object') return null

  const tipoRaw = entry.tipo ?? entry.type ?? entry.clase ?? entry.category ?? entry.kind ?? null
  const codigoRaw = entry.codigo ?? entry.code ?? entry.alarmCode ?? entry.ponto ?? entry.point ?? entry.tag ?? null
  const detalleRaw = entry.detalle ?? entry.detail ?? entry.message ?? entry.msg ?? entry.descricao ?? entry.description ?? entry.text ?? entry.evento ?? null
  const timestampRaw = entry.timestamp ?? entry.ts ?? entry.datetime ?? entry.dateTime ?? entry.fechaHora ?? entry.hora ?? entry.time ?? null

  const mergedLine = [tipoRaw, codigoRaw, detalleRaw].filter((v) => v !== null && v !== undefined && v !== '').join(' ')
  const parsed = parseAmlCelLine(mergedLine, context)
  if (!parsed) {
    const fallbackText = String(detalleRaw || '').trim()
    if (!BENNINGER_AML_CEL_RELEVANT.test(fallbackText)) return null
    return parseAmlCelLine(fallbackText, context)
  }

  const tsNorm = normalizeAmlCelTimestamp(timestampRaw, context)
  if (tsNorm) parsed.timestamp = tsNorm

  return parsed
}

function collectAmlCelEvents(value, output, depth = 0, context = {}) {
  if (output.length >= 300 || depth > 6 || value === null || value === undefined) return

  if (typeof value === 'string') {
    if (!BENNINGER_AML_CEL_RELEVANT.test(value) && !/(?:ALAR|ALARM|EVENT)/i.test(value)) return
    const lines = value
      .split(/\r?\n|[|;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
    for (const line of lines) {
      const parsed = parseAmlCelLine(line, context)
      if (parsed) output.push(parsed)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAmlCelEvents(item, output, depth + 1, context)
      if (output.length >= 300) break
    }
    return
  }

  if (typeof value !== 'object') return

  const normalizedEvent = normalizeAmlCelObject(value, context)
  if (normalizedEvent) output.push(normalizedEvent)

  for (const [key, item] of Object.entries(value)) {
    const keyLooksRelevant = /aml|cel|alarm|alert|evento|event|log|hist|warning|alarma|estado|grelha|parada|velocidade/i.test(String(key || ''))
    if (typeof item === 'string') {
      if (keyLooksRelevant || BENNINGER_AML_CEL_RELEVANT.test(item) || /(?:ALAR|ALARM|EVENT)/i.test(item)) {
        collectAmlCelEvents(item, output, depth + 1, context)
      }
      continue
    }

    if (typeof item === 'object') {
      if (keyLooksRelevant || depth < 2) {
        collectAmlCelEvents(item, output, depth + 1, context)
      }
    }
  }
}

function isAmlCelPlaceholderDetail(detailNorm, code) {
  const compact = String(detailNorm || '').replace(/\s+/g, ' ').trim()
  if (!compact) return true

  const codeNorm = String(code || '').toLowerCase().trim()
  if (codeNorm && compact === codeNorm) return true

  if (/^(aml|cel)$/.test(compact)) return true
  if (/^(s|e)\d{3,4}$/.test(compact)) return true

  return false
}

function normalizeAmlCelDetailKey(detalle) {
  let text = normalizeLooseText(detalle)
  if (!text) return ''

  text = text.replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, ' ')
  text = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
  text = text.replace(/\b\d+\s*\[m\]\b/g, ' ')
  text = text.replace(/\bM\d{2}[A-Z]\d{2}B\d{3}X\d+\b/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

function extractAmlCelTimeKey(event) {
  const fromTs = String(event?.timestamp || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
  if (fromTs?.[0]) return fromTs[0].slice(0, 5)

  const fromDetail = String(event?.detalle || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
  if (fromDetail?.[0]) return fromDetail[0].slice(0, 5)

  return ''
}

function isAmlCelRelevantEvent(event) {
  const sev = String(event?.severidad || '').toLowerCase()
  const code = String(event?.codigo || '').toUpperCase()
  const detailNorm = normalizeLooseText(event?.detalle)
  if (isAmlCelPlaceholderDetail(detailNorm, code)) return false

  if (sev === 'critico' || sev === 'alto') return true
  if (/^S(800|500)$/.test(code)) return true
  if (/^E(3030|3031|3032|1010|1011|1012)$/.test(code)) return true
  if (/grelha\s+aberta|parada|velocidade\s+lenta|rasteje\s+velocidade|carg\s*a\s*de\s*goma/.test(detailNorm)) return true

  return false
}

function scoreAmlCelEvent(event) {
  let score = 0
  const sev = String(event?.severidad || '').toLowerCase()
  const code = String(event?.codigo || '').toUpperCase()
  const detailNorm = normalizeLooseText(event?.detalle)

  if (isAmlCelPlaceholderDetail(detailNorm, code)) return 0

  if (sev === 'critico') score += 6
  else if (sev === 'alto') score += 4
  else score += 1

  if (/^S(800|500)$/.test(code)) score += 5
  if (/^E(3030|3031|3032|1010|1011|1012)$/.test(code)) score += 3
  if (/grelha\s+aberta/.test(detailNorm)) score += 3
  if (/parada/.test(detailNorm)) score += 3
  if (/velocidade\s+lenta|rasteje\s+velocidade/.test(detailNorm)) score += 2
  if (/carg\s*a\s*de\s*goma/.test(detailNorm)) score += 3

  return score
}

function buildAmlCelIndicadores(rows) {
  const stats = {
    paradas: 0,
    velocidadLenta: 0,
    rasteje: 0,
    grelhaAbierta: 0,
    gomaFueraTolerancia: 0,
    criticos: 0
  }

  for (const row of rows) {
    const detailNorm = normalizeLooseText(row?.detalle)
    const code = String(row?.codigo || '').toUpperCase()
    const sev = String(row?.severidad || '').toLowerCase()

    if (sev === 'critico') stats.criticos += 1
    if (/\bparada\b/.test(detailNorm) || code === 'E3030' || code === 'E1010') stats.paradas += 1
    if (/velocidade\s+lenta/.test(detailNorm) || code === 'E3032' || code === 'E1012') stats.velocidadLenta += 1
    if (/rasteje\s+velocidade/.test(detailNorm) || code === 'E3031' || code === 'E1011') stats.rasteje += 1
    if (/grelha\s+aberta|grelha\s+protet/.test(detailNorm)) stats.grelhaAbierta += 1
    if (/carg\s*a\s*de\s*goma/.test(detailNorm) || code === 'S500' || code === '1485') stats.gomaFueraTolerancia += 1
  }

  return stats
}

function amlCelEventFamily(event) {
  const code = String(event?.codigo || '').toUpperCase()
  const detailNorm = normalizeLooseText(event?.detalle)

  if (/carg\s*a\s*de\s*goma/.test(detailNorm) || code === 'S500' || code === '1485') return 'goma'
  if (/grelha\s+aberta|grelha\s+protet/.test(detailNorm)) return 'grelha'
  if (/\bparada\b/.test(detailNorm) || code === 'E3030' || code === 'E1010') return 'parada'
  if (/velocidade\s+lenta/.test(detailNorm) || code === 'E3032' || code === 'E1012') return 'velocidad_lenta'
  if (/rasteje\s+velocidade/.test(detailNorm) || code === 'E3031' || code === 'E1011') return 'rasteje'
  if (code === 'S800') return 's800'

  return code || 'otros'
}

function buildAmlCelResumenTexto({ riesgo, total, indicadores, recurrentes }) {
  if (!total) return 'Sin eventos AML/CEL relevantes en la corrida auditada.'

  const bloques = []
  if (indicadores.paradas > 0) bloques.push(`${indicadores.paradas} paradas`)
  if (indicadores.velocidadLenta > 0) bloques.push(`${indicadores.velocidadLenta} ciclos de velocidad lenta`)
  if (indicadores.rasteje > 0) bloques.push(`${indicadores.rasteje} eventos de rasteje`) 
  if (indicadores.grelhaAbierta > 0) bloques.push(`${indicadores.grelhaAbierta} aperturas de grelha`) 
  if (indicadores.gomaFueraTolerancia > 0) bloques.push(`${indicadores.gomaFueraTolerancia} alertas de goma`)

  const recurrentesTxt = recurrentes
    .slice(0, 3)
    .map((item) => `${item.codigo}x${item.count}`)
    .join(', ')

  const base = bloques.length
    ? `Secuencia operativa inestable: ${bloques.join(', ')}.`
    : `Se detectaron ${total} eventos AML/CEL en la corrida.`

  const recurrentesPart = recurrentesTxt ? ` Codigos recurrentes: ${recurrentesTxt}.` : ''
  return `${base} Riesgo ${String(riesgo || '').toUpperCase() || 'MEDIO'}.${recurrentesPart}`
}

function summarizeAmlCelEvents(events) {
  const rows = Array.isArray(events) ? events.filter(Boolean) : []
  const total = rows.length
  const aml = rows.filter((e) => String(e.tipo || '').toUpperCase() === 'AML').length
  const cel = rows.filter((e) => String(e.tipo || '').toUpperCase() === 'CEL').length

  const counts = new Map()
  for (const event of rows) {
    const code = String(event.codigo || '').toUpperCase()
    if (!code) continue
    counts.set(code, (counts.get(code) || 0) + 1)
  }

  const recurrentes = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([codigo, count]) => ({ codigo, count }))

  const hasCriticalRecurrence = recurrentes.some((item) => item.codigo === 'S800' || item.codigo === 'S500')
  const riesgo = hasCriticalRecurrence
    ? 'critico'
    : (recurrentes.length > 0 || total >= 6)
      ? 'alto'
      : total > 0
        ? 'medio'
        : 'bajo'

  const indicadores = buildAmlCelIndicadores(rows)

  const relevantMap = new Map()
  for (const event of rows) {
    if (!isAmlCelRelevantEvent(event)) continue

    const key = [
      String(event?.codigo || '').toUpperCase(),
      extractAmlCelTimeKey(event),
      normalizeAmlCelDetailKey(event?.detalle)
    ].join('|')

    const prev = relevantMap.get(key)
    if (!prev || scoreAmlCelEvent(event) > scoreAmlCelEvent(prev)) {
      relevantMap.set(key, event)
    }
  }

  const relevantSorted = [...relevantMap.values()]
    .sort((a, b) => {
      const scoreDiff = scoreAmlCelEvent(b) - scoreAmlCelEvent(a)
      if (scoreDiff !== 0) return scoreDiff
      return String(a?.timestamp || '').localeCompare(String(b?.timestamp || ''))
    })

  const familyCap = new Map()
  const eventosRelevantes = []
  for (const event of relevantSorted) {
    const family = amlCelEventFamily(event)
    const used = Number(familyCap.get(family) || 0)
    if (used >= 3) continue

    familyCap.set(family, used + 1)
    eventosRelevantes.push(event)
    if (eventosRelevantes.length >= 12) break
  }

  const resumen = buildAmlCelResumenTexto({
    riesgo,
    total,
    indicadores,
    recurrentes
  })

  return {
    total,
    aml,
    cel,
    riesgo,
    resumen,
    indicadores,
    codigos: [...counts.keys()],
    recurrentes,
    eventosRelevantes,
    eventos: rows.slice(0, BENNINGER_AML_CEL_MAX_EVENTS)
  }
}

function buildAmlCelBundle({ header, plainText, rawRtfText }) {
  const amlCelContext = {
    anchorTimestamp: resolveAmlCelAnchorTimestamp(header)
  }

  const out = []
  const detailedEvents = []

  collectAmlCelEvents(header, out, 0, amlCelContext)

  const plain = String(plainText || '').trim() || (rawRtfText ? rtfToPlainText(rawRtfText) : '')
  if (plain) {
    collectAmlCelEventsFromPlainText(plain, out, detailedEvents, amlCelContext)
  }

  const unique = new Map()
  for (const event of out) {
    const key = [
      String(event.tipo || '').toUpperCase(),
      String(event.codigo || '').toUpperCase(),
      extractAmlCelTimeKey(event),
      normalizeAmlCelDetailKey(event.detalle)
    ].join('|')
    if (!unique.has(key)) unique.set(key, event)
  }

  return {
    summary: summarizeAmlCelEvents([...unique.values()]),
    detailedEvents,
    plainText: plain
  }
}

function extractLotNumbersFromText(values) {
  const set = new Set()
  for (const value of values) {
    const text = String(value || '').trim()
    if (!text) continue

    const byBracket = text.match(/\[(\d+)\]/)
    if (byBracket?.[1]) set.add(byBracket[1])

    const byPattern = text.match(/[A-Za-z]+[-\s]+(\d+)/)
    if (byPattern?.[1]) set.add(byPattern[1])

    const byAnyDigits = text.match(/(\d{2,})/)
    if (byAnyDigits?.[1]) set.add(byAnyDigits[1])
  }
  return [...set]
}

function buildBenningerProcessFromHeader(rawHeader, options = {}) {
  const header = rawHeader && typeof rawHeader === 'object' ? rawHeader : {}

  const stretchAplicado = pickHeaderNumber(header, ['stretchFinal', 'stretchAplicado', 'stretch1S034', '1S034'])
  const humedadRaw = pickHeaderNumber(header, ['humedadSalida', 'humedad1S068', '1S068'])
  const tensionRaw = pickHeaderNumber(header, ['tensionPlegador', 'tension1S054', '1S054'])
  const gomaReal = pickHeaderNumber(header, ['gomaReal', 'gomaReal1A41', '1A41'])
  const velocidad = pickHeaderNumber(header, ['velocidad', 'velocidad1S102', 'velMMin', '1S102'])
  const presionExprimido = pickHeaderNumber(header, ['presionExprimido', 'presionExprimidoMax', '1S086'])
  const metrosSalida = pickHeaderNumber(header, ['metrosSalida', 'metros', '1X014'])
  const duracionSegundos = parseBenningerDurationSeconds(header?.duracao)
  const amlCelBundle = buildAmlCelBundle({
    header,
    plainText: options?.plainText,
    rawRtfText: options?.rawRtfText
  })
  const amlCel = amlCelBundle.summary
  const velocidadEfectiva = Number.isFinite(metrosSalida) && Number.isFinite(duracionSegundos) && duracionSegundos > 0
    ? (metrosSalida / duracionSegundos) * 60
    : null

  // Benninger stores humidity as centipercent integers (600 = 6.00 %)
  // and tension as hectonewton units (35 = 3500 N). Normalize to physical units.
  const humedadSalida = Number.isFinite(humedadRaw) && humedadRaw > 15
    ? humedadRaw / 100
    : humedadRaw
  const tensionPlegador = Number.isFinite(tensionRaw) && tensionRaw > 0 && tensionRaw < 500
    ? tensionRaw * 100
    : tensionRaw

  return {
    stretchAplicado: Number.isFinite(stretchAplicado) ? Number(stretchAplicado.toFixed(3)) : null,
    humedadSalida: Number.isFinite(humedadSalida) ? Number(humedadSalida.toFixed(3)) : null,
    tensionPlegador: Number.isFinite(tensionPlegador) ? Number(tensionPlegador.toFixed(2)) : null,
    gomaReal: Number.isFinite(gomaReal) ? Number(gomaReal.toFixed(3)) : null,
    velocidad: Number.isFinite(velocidad)
      ? Number(velocidad.toFixed(3))
      : (Number.isFinite(velocidadEfectiva) ? Number(velocidadEfectiva.toFixed(3)) : null),
    metrosSalida: Number.isFinite(metrosSalida) ? Number(metrosSalida.toFixed(3)) : null,
    duracionSegundos: Number.isFinite(duracionSegundos) ? duracionSegundos : null,
    velocidadEfectiva: Number.isFinite(velocidadEfectiva) ? Number(velocidadEfectiva.toFixed(3)) : null,
    presionExprimido: Number.isFinite(presionExprimido) ? Number(presionExprimido.toFixed(3)) : null,
    amlCel,
    tensionTimeline: buildTimelineFromHeader(header, tensionPlegador)
  }
}

function pickBestMatchCandidate(matchPayload) {
  const candidates = Array.isArray(matchPayload?.candidates) ? matchPayload.candidates : []
  if (!candidates.length) return null

  const sorted = [...candidates].sort((a, b) => {
    const scoreA = Number(a?.score)
    const scoreB = Number(b?.score)
    const diffA = Number(a?.startDiffSec)
    const diffB = Number(b?.startDiffSec)

    if (Number.isFinite(scoreA) && Number.isFinite(scoreB) && scoreA !== scoreB) {
      return scoreB - scoreA
    }
    if (Number.isFinite(diffA) && Number.isFinite(diffB) && diffA !== diffB) {
      return diffA - diffB
    }
    return 0
  })

  const best = sorted[0]
  return best && typeof best === 'object' ? best : null
}

async function ensureBenningerRtfSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_benninger_rtf_links (
      source_file TEXT PRIMARY KEY,
      id_rolo TEXT,
      indicativo TEXT,
      receita TEXT,
      comeco_raw TEXT,
      comeco_ts TIMESTAMPTZ,
      fim_raw TEXT,
      fim_ts TIMESTAMPTZ,
      duracao_raw TEXT,
      match_partida TEXT,
      match_rolada TEXT,
      match_dt_inicio TEXT,
      match_hora_inicio TEXT,
      match_dt_final TEXT,
      match_hora_final TEXT,
      match_score NUMERIC(6,2),
      match_confidence TEXT,
      match_mode TEXT,
      match_reason TEXT,
      raw_header JSONB,
      raw_rtf_text TEXT,
      plain_text TEXT,
      rtf_hash TEXT,
      parse_version TEXT,
      match_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query('ALTER TABLE tb_benninger_rtf_links ADD COLUMN IF NOT EXISTS raw_rtf_text TEXT')
  await query('ALTER TABLE tb_benninger_rtf_links ADD COLUMN IF NOT EXISTS plain_text TEXT')
  await query('ALTER TABLE tb_benninger_rtf_links ADD COLUMN IF NOT EXISTS rtf_hash TEXT')
  await query('ALTER TABLE tb_benninger_rtf_links ADD COLUMN IF NOT EXISTS parse_version TEXT')

  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_comeco_ts ON tb_benninger_rtf_links (comeco_ts)')
  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_partida ON tb_benninger_rtf_links (match_partida)')
  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_rolada ON tb_benninger_rtf_links (match_rolada)')

  await query(`
    CREATE TABLE IF NOT EXISTS tb_benninger_rtf_eventos (
      id BIGSERIAL PRIMARY KEY,
      source_file TEXT NOT NULL REFERENCES tb_benninger_rtf_links(source_file) ON DELETE CASCADE,
      line_no INTEGER,
      section TEXT,
      tipo TEXT,
      codigo TEXT,
      severidad TEXT,
      timestamp_raw TEXT,
      timestamp_ts TIMESTAMPTZ,
      timestamp_end_raw TEXT,
      timestamp_end_ts TIMESTAMPTZ,
      meter_pos INTEGER,
      event_code TEXT,
      subsystem TEXT,
      machine_tag TEXT,
      mensaje TEXT,
      raw_line TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      parsed_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_file, event_hash)
    )
  `)

  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_eventos_source ON tb_benninger_rtf_eventos (source_file)')
  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_eventos_ts ON tb_benninger_rtf_eventos (timestamp_ts)')
  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_eventos_codigo ON tb_benninger_rtf_eventos (codigo)')
  await query('CREATE INDEX IF NOT EXISTS idx_benninger_rtf_eventos_section ON tb_benninger_rtf_eventos (section)')
}

async function replaceBenningerRtfEvents(sourceFile, events) {
  const rows = Array.isArray(events) ? events.filter(Boolean) : []
  await query('DELETE FROM tb_benninger_rtf_eventos WHERE source_file = $1', [sourceFile], 'benninger-rtf/clear-events')
  if (!rows.length) return

  for (const row of rows) {
    await query(
      `
        INSERT INTO tb_benninger_rtf_eventos (
          source_file,
          line_no,
          section,
          tipo,
          codigo,
          severidad,
          timestamp_raw,
          timestamp_ts,
          timestamp_end_raw,
          timestamp_end_ts,
          meter_pos,
          event_code,
          subsystem,
          machine_tag,
          mensaje,
          raw_line,
          event_hash,
          parsed_json
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
        )
        ON CONFLICT (source_file, event_hash) DO NOTHING
      `,
      [
        sourceFile,
        Number.isFinite(Number(row.lineNo)) ? Number(row.lineNo) : null,
        row.section || null,
        row.tipo || null,
        row.codigo || null,
        row.severidad || null,
        row.timestampRaw || null,
        row.timestamp || null,
        row.timestampEndRaw || null,
        row.timestampEnd || null,
        Number.isFinite(Number(row.meterPos)) ? Number(row.meterPos) : null,
        row.eventCode || null,
        row.subsystem || null,
        row.machineTag || null,
        row.detalle || null,
        row.rawLine || null,
        row.eventHash || null,
        JSON.stringify(row)
      ],
      'benninger-rtf/insert-event'
    )
  }
}

async function upsertBenningerRtfLink(payload) {
  const {
    sourceFile,
    header,
    rawRtfText,
    plainText,
    parseVersion,
    comecoParsed,
    fimParsed,
    selected,
    confidence,
    mode,
    reason,
    matchPayload
  } = payload

  const safeHeader = header && typeof header === 'object' ? header : {}
  const safeRawRtf = typeof rawRtfText === 'string' && rawRtfText.trim() ? rawRtfText : null
  const normalizedPlain = typeof plainText === 'string' && plainText.trim()
    ? plainText
    : (safeRawRtf ? rtfToPlainText(safeRawRtf) : null)
  const parseVersionFinal = String(parseVersion || BENNINGER_RTF_PARSE_VERSION).trim() || BENNINGER_RTF_PARSE_VERSION
  const amlCelBundle = buildAmlCelBundle({
    header: safeHeader,
    plainText: normalizedPlain,
    rawRtfText: safeRawRtf
  })
  const headerToStore = {
    ...safeHeader,
    amlCel: amlCelBundle.summary
  }
  const rtfHash = safeRawRtf || normalizedPlain
    ? crypto.createHash('sha1').update(String(safeRawRtf || normalizedPlain)).digest('hex')
    : null

  await query(
    `
      INSERT INTO tb_benninger_rtf_links (
        source_file,
        id_rolo,
        indicativo,
        receita,
        comeco_raw,
        comeco_ts,
        fim_raw,
        fim_ts,
        duracao_raw,
        match_partida,
        match_rolada,
        match_dt_inicio,
        match_hora_inicio,
        match_dt_final,
        match_hora_final,
        match_score,
        match_confidence,
        match_mode,
        match_reason,
        raw_header,
        raw_rtf_text,
        plain_text,
        rtf_hash,
        parse_version,
        match_payload,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
        NOW()
      )
      ON CONFLICT (source_file) DO UPDATE SET
        id_rolo = EXCLUDED.id_rolo,
        indicativo = EXCLUDED.indicativo,
        receita = EXCLUDED.receita,
        comeco_raw = EXCLUDED.comeco_raw,
        comeco_ts = EXCLUDED.comeco_ts,
        fim_raw = EXCLUDED.fim_raw,
        fim_ts = EXCLUDED.fim_ts,
        duracao_raw = EXCLUDED.duracao_raw,
        match_partida = EXCLUDED.match_partida,
        match_rolada = EXCLUDED.match_rolada,
        match_dt_inicio = EXCLUDED.match_dt_inicio,
        match_hora_inicio = EXCLUDED.match_hora_inicio,
        match_dt_final = EXCLUDED.match_dt_final,
        match_hora_final = EXCLUDED.match_hora_final,
        match_score = EXCLUDED.match_score,
        match_confidence = EXCLUDED.match_confidence,
        match_mode = EXCLUDED.match_mode,
        match_reason = EXCLUDED.match_reason,
        raw_header = EXCLUDED.raw_header,
        raw_rtf_text = EXCLUDED.raw_rtf_text,
        plain_text = EXCLUDED.plain_text,
        rtf_hash = EXCLUDED.rtf_hash,
        parse_version = EXCLUDED.parse_version,
        match_payload = EXCLUDED.match_payload,
        updated_at = NOW()
    `,
    [
      sourceFile,
      safeHeader?.idRolo || null,
      safeHeader?.indicativo || null,
      safeHeader?.receita || null,
      safeHeader?.comeco || null,
      comecoParsed ? comecoParsed.sqlTimestamp : null,
      safeHeader?.fim || null,
      fimParsed ? fimParsed.sqlTimestamp : null,
      safeHeader?.duracao || null,
      selected?.partida || null,
      selected?.rolada || null,
      selected?.dtInicio || null,
      selected?.horaInicio || null,
      selected?.dtFinal || null,
      selected?.horaFinal || null,
      Number.isFinite(selected?.score) ? selected.score : null,
      confidence || null,
      mode || null,
      reason || null,
      JSON.stringify(headerToStore),
      safeRawRtf,
      normalizedPlain,
      rtfHash,
      parseVersionFinal,
      JSON.stringify(matchPayload || {})
    ],
    'benninger-rtf/upsert-link'
  )

  await replaceBenningerRtfEvents(sourceFile, amlCelBundle.detailedEvents)
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function tableExists(tableName) {
  const res = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`])
  return Boolean(res.rows?.[0]?.reg)
}

async function ensureCostosSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_items (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'KG',
      activo BOOLEAN NOT NULL DEFAULT TRUE
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_item_alias (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      origen TEXT NOT NULL,
      nombre_en_origen TEXT NOT NULL,
      UNIQUE (origen, nombre_en_origen)
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_mensual (
      id SERIAL PRIMARY KEY,
      yyyymm TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      ars_por_unidad NUMERIC NOT NULL,
      observaciones TEXT,
      UNIQUE (yyyymm, item_id)
    )`
  )

  await query('CREATE INDEX IF NOT EXISTS idx_costo_mensual_mes ON tb_costo_mensual(yyyymm)')
  await query('CREATE INDEX IF NOT EXISTS idx_costo_alias_item ON tb_costo_item_alias(item_id)')

  await query(
    `INSERT INTO tb_costo_items (codigo, descripcion, unidad, activo)
     VALUES
       ('ESTOPA_AZUL', 'Estopa Azul', 'KG', TRUE),
       ('URDIDO_TENIDO', 'Urdido Tenido', 'M', TRUE),
       ('TELA_TERMINADA', 'Tela Terminada', 'M', TRUE)
     ON CONFLICT (codigo) DO NOTHING`
  )

  await query("UPDATE tb_costo_items SET unidad = 'M' WHERE codigo IN ('URDIDO_TENIDO', 'TELA_TERMINADA')")

  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'URDIDO TEÑIDO' FROM tb_costo_items WHERE codigo = 'URDIDO_TENIDO'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'TELA TERMINADA' FROM tb_costo_items WHERE codigo = 'TELA_TERMINADA'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL TEJEDURIA' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
}

// =====================================================
// MIDDLEWARE
// =====================================================
const allowedOriginRegexes = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
]

const allowedOriginList = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isOriginAllowed(origin, host) {
  if (!origin) return true
  if (allowedOriginList.includes(origin)) return true
  if (allowedOriginRegexes.some((re) => re.test(origin))) return true

  // Despliegue típico (Podman + reverse proxy): el frontend sirve desde la misma origin,
  // y /api se proxifica al backend. Permitimos Origin == http(s)://<host>.
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) return true

  return false
}

const corsOptionsDelegate = (req, cb) => {
  const origin = req.header('Origin')
  const host = req.headers.host

  const allowed = isOriginAllowed(origin, host)
  cb(null, {
    origin: allowed,
    credentials: true,
  })
}

app.use(cors(corsOptionsDelegate))
app.options('*', cors(corsOptionsDelegate))
app.use(express.json({ limit: '50mb' }))

// =====================================================
// FRONTEND (PRODUCCIÓN): servir SPA desde el mismo servidor
// =====================================================
if (process.env.NODE_ENV === 'production') {
  const frontendDist = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.resolve(__dirname, '..', 'frontend', 'dist')

  app.use(express.static(frontendDist))
  // SPA fallback: cualquier ruta que no sea /api/... vuelve a index.html
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001

// =====================================================
// PRODUCCION: helpers de diferencias / historial
// =====================================================
function readCsvHeaderLine(csvPath) {
  const fd = fs.openSync(csvPath, 'r')
  try {
    const buffer = Buffer.alloc(64 * 1024)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    const chunk = buffer.toString('utf-8', 0, bytesRead)
    const nl = chunk.indexOf('\n')
    const line = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/\r$/u, '')
    return line
  } finally {
    fs.closeSync(fd)
  }
}

async function ensureSyncHistoryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_column_warnings_history (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      csv_path TEXT,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      extra_columns TEXT[] NOT NULL DEFAULT '{}',
      missing_columns TEXT[] NOT NULL DEFAULT '{}'
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_detected_at
      ON tb_column_warnings_history(detected_at DESC)
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_table
      ON tb_column_warnings_history(table_name)
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS tb_schema_changes_log (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      change_type TEXT NOT NULL DEFAULT 'ADD_COLUMNS',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      columns_added TEXT[] NOT NULL DEFAULT '{}',
      reimported BOOLEAN NOT NULL DEFAULT false,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_schema_changes_log_applied_at
      ON tb_schema_changes_log(applied_at DESC)
  `)
}

function arraysEqualCaseSensitive(a, b) {
  const aa = Array.isArray(a) ? a : []
  const bb = Array.isArray(b) ? b : []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false
  }
  return true
}

function dateVariants(dateStr) {
  const s = String(dateStr || '').trim()
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (iso) {
    const [yyyy, mm, dd] = s.split('-')
    return { iso: s, br: `${dd}/${mm}/${yyyy}` }
  }
  const br = /^\d{2}\/\d{2}\/\d{4}$/.test(s)
  if (br) {
    const [dd, mm, yyyy] = s.split('/')
    return { iso: `${yyyy}-${mm}-${dd}`, br: s }
  }
  return { iso: s, br: s }
}

function dateTextCandidates(dateStr) {
  const v = dateVariants(dateStr)
  const out = new Set([v.iso, v.br])

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v.br)) {
    const [dd, mm, yyyy] = v.br.split('/')
    const ddNo = String(parseInt(dd, 10))
    const mmNo = String(parseInt(mm, 10))
    out.add(`${ddNo}/${mmNo}/${yyyy}`)
  }

  return Array.from(out).filter(Boolean)
}

async function ensureCalidadIndexes() {
  // Índices pensados para acelerar filtros por (EMP, fecha text, revisor/partida)
  // Usamos CONCURRENTLY para minimizar locks en tablas grandes.
  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod
        ON tb_calidad ("EMP", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod_revisor
        ON tb_calidad ("EMP", "DAT_PROD", "REVISOR FINAL")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod_revisor:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_partida_revisor_datprod
        ON tb_calidad ("EMP", "PARTIDA", "REVISOR FINAL", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_partida_revisor_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_produccion_partida_tecelagem
        ON tb_produccion ("PARTIDA")
        WHERE "FILIAL" = '05' AND "SELETOR" = 'TECELAGEM'
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_produccion_partida_tecelagem:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_defectos_etiqueta_trim
        ON tb_defectos ((btrim(etiqueta)))
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_defectos_etiqueta_trim:', e.message)
  }

  // Stats: opcional (puede competir con consultas y volver lento el UI)
  if (process.env.PERF_ANALYZE_ON_STARTUP === '1') {
    try {
      await query('ANALYZE tb_calidad')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_calidad:', e.message)
    }
    try {
      await query('ANALYZE tb_produccion')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_produccion:', e.message)
    }
  }
}

async function maybeInsertWarningHistory({ tableName, csvPath, extraColumns, missingColumns }) {
  // Evita spam: solo inserta si cambió respecto al último registro de esa tabla.
  const last = await query(
    `SELECT extra_columns, missing_columns FROM tb_column_warnings_history WHERE table_name = $1 ORDER BY detected_at DESC LIMIT 1`,
    [tableName]
  )

  const prev = last.rows?.[0]
  const sameAsPrev =
    prev &&
    arraysEqualCaseSensitive(prev.extra_columns || [], extraColumns || []) &&
    arraysEqualCaseSensitive(prev.missing_columns || [], missingColumns || [])

  if (sameAsPrev) return

  await query(
    `INSERT INTO tb_column_warnings_history (table_name, csv_path, extra_columns, missing_columns)
     VALUES ($1, $2, $3, $4)`,
    [tableName, csvPath || null, extraColumns || [], missingColumns || []]
  )
}

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// =====================================================
// INVENTARIO
// =====================================================
app.get('/api/inventory/cotton-bales', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tb_est_mp ORDER BY id DESC LIMIT 5000', [], 'Get Cotton Bales')
    res.json(rows)
  } catch (err) {
    console.error(err)
    // Return empty array on error to prevent frontend crash if table missing
    res.json([]) 
  }
})

app.post('/api/inventory/blendomat', async (req, res) => {
  try {
    const { stock, rules, supervisionSettings, blendSize, algorithm } = req.body;

    if (!stock || !rules || !supervisionSettings || !blendSize) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (stock, rules, supervisionSettings, blendSize)' });
    }

    const result = optimizeBlend(stock, rules, supervisionSettings, blendSize, algorithm);
    res.json(result);
  } catch (err) {
    console.error('Error en BlendomatOptimizer:', err);
    res.status(500).json({ error: err.message || 'Error interno al calcular mezclas' });
  }
});

app.get('/api/inventory/lote-fiac-reference-summary', async (req, res) => {
  try {
    const rawLimit = Number.parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 10) : 3;

    const sql = `
      WITH base AS (
        SELECT
          CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS lote_fiac_num,
          CASE
            WHEN "DT_ENTRADA_PROD" ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN TO_DATE("DT_ENTRADA_PROD", 'DD/MM/YYYY')
            WHEN "DT_ENTRADA_PROD" ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN TO_DATE("DT_ENTRADA_PROD", 'YYYY-MM-DD')
            ELSE NULL
          END AS dt_ingreso,
          CASE WHEN "SCI" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SCI", ',', '.')::numeric END AS sci,
          CASE WHEN "MST" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MST", ',', '.')::numeric END AS mst,
          CASE WHEN "MIC" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MIC", ',', '.')::numeric END AS mic,
          CASE WHEN "MAT" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MAT", ',', '.')::numeric END AS mat,
          CASE WHEN "UHML" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UHML", ',', '.')::numeric END AS uhml,
          CASE WHEN "UI" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UI", ',', '.')::numeric END AS ui,
          CASE WHEN "SF" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SF", ',', '.')::numeric END AS sf,
          CASE WHEN "STR" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("STR", ',', '.')::numeric END AS str,
          CASE WHEN "ELG" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("ELG", ',', '.')::numeric END AS elg,
          CASE WHEN "RD" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("RD", ',', '.')::numeric END AS rd,
          CASE WHEN "PLUS_B" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("PLUS_B", ',', '.')::numeric END AS plus_b,
          CASE WHEN "TrCNT" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("TrCNT", ',', '.')::numeric END AS trcnt,
          CASE WHEN "TrAR" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("TrAR", ',', '.')::numeric END AS trar,
          CASE WHEN "TRID" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("TRID", ',', '.')::numeric END AS trid,
          CASE
            WHEN "PESO" ~ '^[0-9][0-9,\\.]*$'
              THEN NULLIF(REPLACE(REPLACE("PESO", '.', ''), ',', '.'), '')::numeric
            ELSE NULL
          END AS peso_kg
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '[0-9]'
      ),
      lotes_consumidos AS (
        SELECT
          lote_fiac_num,
          MIN(dt_ingreso) AS primer_ingreso
        FROM base
        WHERE lote_fiac_num IS NOT NULL
          AND dt_ingreso IS NOT NULL
        GROUP BY lote_fiac_num
      ),
      ultimos AS (
        SELECT lote_fiac_num, primer_ingreso
        FROM lotes_consumidos
        ORDER BY primer_ingreso DESC, lote_fiac_num DESC
        LIMIT $1
      )
      SELECT
        u.lote_fiac_num,
        u.primer_ingreso,
        ROUND(AVG(b.sci), 2) AS sci,
        ROUND(AVG(b.mst), 2) AS mst,
        ROUND(AVG(b.mic), 3) AS mic,
        ROUND(AVG(b.mat), 2) AS mat,
        ROUND(AVG(b.uhml), 2) AS uhml,
        ROUND(AVG(b.ui), 2) AS ui,
        ROUND(AVG(b.sf), 2) AS sf,
        ROUND(AVG(b.str), 2) AS str,
        ROUND(AVG(b.elg), 2) AS elg,
        ROUND(AVG(b.rd), 2) AS rd,
        ROUND(AVG(b.plus_b), 2) AS plus_b,
        ROUND(AVG(b.trcnt), 2) AS trcnt,
        ROUND(AVG(b.trar), 2) AS trar,
        ROUND(AVG(b.trid), 2) AS trid,
        ROUND(COALESCE(SUM(b.peso_kg), 0), 0) AS kg_usados
      FROM ultimos u
      JOIN base b
        ON b.lote_fiac_num = u.lote_fiac_num
       AND b.dt_ingreso IS NOT NULL
      GROUP BY u.lote_fiac_num, u.primer_ingreso
      ORDER BY u.primer_ingreso ASC, u.lote_fiac_num ASC
    `;

    const result = await query(sql, [limit], 'inventory-lote-fiac-reference-summary');

    const referencias = result.rows.map((row) => ({
      loteFiac: String(row.lote_fiac_num),
      primerIngreso: row.primer_ingreso,
      kgUsados: row.kg_usados,
      averages: {
        SCI: row.sci,
        MST: row.mst,
        MIC: row.mic,
        MAT: row.mat,
        UHML: row.uhml,
        UI: row.ui,
        SF: row.sf,
        STR: row.str,
        ELG: row.elg,
        RD: row.rd,
        PLUS_B: row.plus_b,
        TrCNT: row.trcnt,
        TrAR: row.trar,
        TRID: row.trid
      }
    }));

    res.json({ success: true, referencias });
  } catch (err) {
    console.error('Error en /api/inventory/lote-fiac-reference-summary:', err);
    res.status(500).json({ error: err.message || 'Error interno al obtener referencias LOTE_FIAC' });
  }
});

async function costosTablesReady() {
  await ensureCostosSchema()
  return true
}

// =====================================================
// ENDPOINTS COSTOS MENSUALES
// Base URL en frontend: /api/produccion
// =====================================================

app.get('/api/produccion/costos/items', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const sql = `
      SELECT
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        i.activo AS activo,
        a.origen AS origen,
        a.nombre_en_origen AS nombre_en_origen
      FROM tb_costo_items i
      LEFT JOIN tb_costo_item_alias a ON a.item_id = i.id
      ORDER BY i.id ASC, a.id ASC
    `
    const result = await query(sql, [], 'costos-items')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/items:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion/costos/mensual', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const limite = Math.max(1, Number.parseInt(String(req.query.limite || ''), 10) || 24)
    const sql = `
      WITH meses AS (
        SELECT DISTINCT yyyymm
        FROM tb_costo_mensual
        ORDER BY yyyymm DESC
        LIMIT $1
      )
      SELECT
        m.yyyymm AS yyyymm,
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        cm.ars_por_unidad AS ars_por_unidad,
        cm.observaciones AS observaciones
      FROM meses m
      CROSS JOIN tb_costo_items i
      LEFT JOIN tb_costo_mensual cm
        ON cm.yyyymm = m.yyyymm AND cm.item_id = i.id
      ORDER BY m.yyyymm DESC, i.id ASC
    `

    const result = await query(sql, [limite], 'costos-mensual')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/mensual:', err)
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/produccion/costos/mensual', async (req, res) => {
  const { rows } = req.body || {}
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows requerido' })

  const ready = await costosTablesReady()
  if (!ready) return res.status(400).json({ error: 'Tablas de costos no configuradas' })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    for (const row of rows) {
      const yyyymm = String(row?.yyyymm || '').trim()
      const itemId = Number(row?.item_id)
      const obs = row?.observaciones ?? null

      if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
        throw new Error(`yyyymm invalido: ${yyyymm}`)
      }
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error('item_id invalido')
      }

      const rawValue = row?.ars_por_unidad
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        await client.query(
          'DELETE FROM tb_costo_mensual WHERE yyyymm = $1 AND item_id = $2',
          [yyyymm, itemId]
        )
        continue
      }

      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('ars_por_unidad invalido')
      }

      await client.query(
        `
          INSERT INTO tb_costo_mensual (yyyymm, item_id, ars_por_unidad, observaciones)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (yyyymm, item_id) DO UPDATE
          SET ars_por_unidad = EXCLUDED.ars_por_unidad,
              observaciones = EXCLUDED.observaciones
        `,
        [yyyymm, itemId, value, obs]
      )
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error en costos/mensual (PUT):', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// =====================================================
// ENDPOINTS CALIDAD (para UI /revision-cq)
// Base URL en frontend: /api/produccion
// =====================================================

// GET /api/produccion/calidad/revision-cq - Reporte agrupado por Revisor
app.get('/api/produccion/calidad/revision-cq', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${datProdDate} BETWEEN $1::date AND $2::date`
    const params = sameDay ? [dateTextCandidates(startDate)] : [startDate, endDate]

    const sql = `
      WITH CAL AS (
        SELECT
          "DAT_PROD",
          "ARTIGO",
          SUM(${metragemNum}) AS METRAGEM,
          AVG(${pontuacaoNum}) AS PONTUACAO,
          AVG(${larguraNum}) AS LARGURA,
          "REVISOR FINAL" AS REVISOR_FINAL,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
        GROUP BY
          "DAT_PROD",
          "ARTIGO",
          "REVISOR FINAL",
          "PEÇA",
          "QUALIDADE",
          "ETIQUETA"
      ),
      RETALHO_METROS AS (
        SELECT
          SUM(${metragemNum}) AS METRAGEM_RETALHO
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      REVISORES AS (
        SELECT
          REVISOR_FINAL AS "Revisor",
          CAST(SUM(METRAGEM) AS INTEGER) AS "Mts_Total",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) AS "Calidad_Perc",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) AS "Pts_100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) AS "Rollos_1era",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) AS "Rollos_Sin_Pts",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) AS "Perc_Sin_Pts"
        FROM CAL
        GROUP BY REVISOR_FINAL
      )
      SELECT * FROM REVISORES
      UNION ALL
      SELECT
        'RETALHO' AS "Revisor",
        ROUND(METRAGEM_RETALHO)::int AS "Mts_Total",
        0::numeric AS "Calidad_Perc",
        0::numeric AS "Pts_100m2",
        0::int AS "Rollos_1era",
        0::int AS "Rollos_Sin_Pts",
        0::numeric AS "Perc_Sin_Pts"
      FROM RETALHO_METROS
      WHERE METRAGEM_RETALHO > 0
      ORDER BY "Mts_Total" DESC
    `

    const result = await query(sql, params, 'calidad/revision-cq')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revision-cq ${startDate}..${endDate} tramas=${tramas} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revision-cq:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/revision-cq-ia - Datos rollo a rollo (PRIMEIRA)
app.get('/api/produccion/calidad/revision-cq-ia', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${datProdDate} BETWEEN $1::date AND $2::date`
    const params = sameDay ? [dateTextCandidates(startDate)] : [startDate, endDate]

    const sql = `
      WITH RAW AS (
        SELECT
          "REVISOR FINAL" AS REVISOR_FINAL,
          "PARTIDA" AS PARTIDA,
          "PEÇA" AS PECA,
          "ETIQUETA" AS ETIQUETA,
          "HORA" AS HORA,
          ${metragemNum} AS METRAGEM,
          ${pontuacaoNum} AS PONTUACAO,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND btrim("QUALIDADE") ILIKE 'PRIMEIRA%'
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      ROLLOS AS (
        SELECT
          REVISOR_FINAL AS "Revisor",
          PARTIDA AS "Partida",
          PECA AS "Peca",
          ETIQUETA AS "Etiqueta",
          HORA AS "HoraSalida",
          ROUND(SUM(METRAGEM)::numeric, 2) AS "MetrosRollo",
          ROUND(AVG(COALESCE(PONTUACAO, 0))::numeric, 2) AS "PontuacaoRollo"
        FROM RAW
        GROUP BY REVISOR_FINAL, PARTIDA, PECA, ETIQUETA, HORA
      )
      SELECT
        "Revisor",
        "Partida",
        "Peca",
        "Etiqueta",
        "HoraSalida",
        "MetrosRollo",
        "PontuacaoRollo"
      FROM ROLLOS
      ORDER BY
        "Revisor" ASC,
        CASE
          WHEN regexp_replace(COALESCE("HoraSalida"::text, ''), '[^0-9]', '', 'g') ~ '^[0-9]{1,4}$'
            THEN lpad(regexp_replace("HoraSalida"::text, '[^0-9]', '', 'g'), 4, '0')
          ELSE '9999'
        END ASC,
        "Partida" ASC,
        "Peca" ASC,
        "Etiqueta" ASC
    `

    const result = await query(sql, params, 'calidad/revision-cq-ia')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revision-cq-ia ${startDate}..${endDate} tramas=${tramas} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revision-cq-ia:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/revisor-detalle - Detalle por revisor (con partidas)
app.get('/api/produccion/calidad/revisor-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate, revisor } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate || !revisor) {
      return res.status(400).json({ error: 'Se requieren startDate, endDate y revisor' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const calLarguraNum = sqlParseNumber('"LARGURA"')
    const prodPtsLidosNum = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100Num = sqlParseNumber('P."PONTOS_100%"')
    const prodParTraNum = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrdNum = sqlParseNumber('P."PARADA TEC URDUME"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${calDatProdDate} BETWEEN $1::date AND $2::date`
    const revisorParam = sameDay ? '$2' : '$3'
    const params = sameDay ? [dateTextCandidates(startDate), revisor] : [startDate, endDate, revisor]

    const sql = `
      WITH RAW AS (
        SELECT
          "NM MERC" as "NombreArticulo",
          "PARTIDA" as "PARTIDA",
          "DAT_PROD" as "DAT_PROD",
          "ARTIGO" as "ARTIGO",
          "PEÇA" as "PEÇA",
          "ETIQUETA" as "ETIQUETA",
          btrim("QUALIDADE") AS QUALIDADE,
          "HORA" as "HORA",
          ${calMetragemNum} AS METRAGEM,
          ${calPontuacaoNum} AS PONTUACAO,
          ${calLarguraNum} AS LARGURA
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "REVISOR FINAL" = ${revisorParam}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      CAL AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          SUM(METRAGEM) AS METRAGEM,
          AVG(PONTUACAO) AS PONTUACAO,
          AVG(LARGURA) AS LARGURA,
          QUALIDADE
        FROM RAW
        GROUP BY
          "NombreArticulo",
          "PARTIDA",
          "DAT_PROD",
          "ARTIGO",
          "PEÇA",
          QUALIDADE,
          "ETIQUETA"
      ),
      HorasPartida AS (
        SELECT
          "PARTIDA" as PARTIDA,
          MIN("HORA") as "HoraInicio"
        FROM RAW
        GROUP BY "PARTIDA"
      ),
      CalidadPorPartida AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          "PARTIDA" as "Partidas",
          CAST(SUM(METRAGEM) AS INTEGER) as "MetrosRevisados",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) as "CalidadPct",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) as "Pts100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) as "TotalRollos",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) as "SinPuntos",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) as "SinPuntosPct"
        FROM CAL
        GROUP BY "NombreArticulo", "PARTIDA"
      ),
      PartidaVars AS (
        SELECT
          C.*,
          C."PARTIDA" as "Var0",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 0
              THEN (left(C."PARTIDA", 1)::int - 1)::text || substring(C."PARTIDA" from 2)
          END as "Var1",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 1
              THEN (left(C."PARTIDA", 1)::int - 2)::text || substring(C."PARTIDA" from 2)
          END as "Var2",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 2
              THEN (left(C."PARTIDA", 1)::int - 3)::text || substring(C."PARTIDA" from 2)
          END as "Var3",
          CASE
            WHEN length(C."PARTIDA") > 1
              THEN '0' || substring(C."PARTIDA" from 2)
          END as "Var4"
        FROM CalidadPorPartida C
      ),
      TejPorPartida AS (
        SELECT
          PV."PARTIDA" as "CalPartida",
          TEJ.*
        FROM PartidaVars PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA" as "PARTIDA",
            MAX(
              CASE
                WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$' THEN right(P."MAQUINA", 2)::int
                ELSE NULL
              END
            ) as "Telar",
            SUM(COALESCE(${prodPtsLidosNum}, 0)) as "PtsLei",
            SUM(COALESCE(${prodPts100Num}, 0)) as "Pts100",
            SUM(COALESCE(${prodParTraNum}, 0)) as "ParTra",
            SUM(COALESCE(${prodParUrdNum}, 0)) as "ParUrd"
          FROM tb_produccion P
          WHERE
            P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0
            WHEN PV."Var1" THEN 1
            WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3
            WHEN PV."Var4" THEN 4
            ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON true
      )
      SELECT
        HP."HoraInicio" as "HoraInicio",
        PV."NombreArticulo" as "NombreArticulo",
        PV."PARTIDA" as "PARTIDA",
        PV."Partidas" as "Partidas",
        PV."MetrosRevisados" as "MetrosRevisados",
        PV."CalidadPct" as "CalidadPct",
        PV."Pts100m2" as "Pts100m2",
        PV."TotalRollos" as "TotalRollos",
        PV."SinPuntos" as "SinPuntos",
        PV."SinPuntosPct" as "SinPuntosPct",
        COALESCE(TEJ."Telar", 0) as "Telar",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END as "EficienciaPct",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RU105",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RT105"
      FROM PartidaVars PV
      LEFT JOIN HorasPartida HP ON PV."PARTIDA" = HP.PARTIDA
      LEFT JOIN TejPorPartida TEJ ON TEJ."CalPartida" = PV."PARTIDA"
      ORDER BY HP."HoraInicio" ASC
    `

    const result = await query(sql, params, 'calidad/revisor-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revisor-detalle ${startDate}..${endDate} revisor=${revisor} tramas=${tramas} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revisor-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/desempeno-piezas - Piezas individuales de un revisor con datos telar
app.get('/api/produccion/calidad/desempeno-piezas', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha, revisor } = req.query
    if (!fecha || !revisor) {
      return res.status(400).json({ error: 'Se requieren fecha y revisor' })
    }

    const datCandidates = dateTextCandidates(fecha)
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const prodPtsLidosNum = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100Num = sqlParseNumber('P."PONTOS_100%"')
    const prodParTraNum = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrdNum = sqlParseNumber('P."PARADA TEC URDUME"')

    const sql = `
      WITH PIEZAS AS (
        SELECT
          btrim(COALESCE("NM MERC"::text, '')) AS nm_merc,
          "PARTIDA",
          COALESCE("HORA"::text, '') AS hora,
          ${metragemNum} AS metragem,
          ${pontuacaoNum} AS pontuacao,
          ${larguraNum} AS largura,
          btrim("QUALIDADE") AS qualidade,
          "ARTIGO",
          "COR"
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND "DAT_PROD" = ANY($1::text[])
          AND "REVISOR FINAL" = $2
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
      ),
      PART_AGG AS (
        SELECT
          "PARTIDA",
          ROUND(
            (SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN COALESCE(pontuacao, 0) ELSE 0 END) * 100)
            / NULLIF(
              (SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem * COALESCE(largura, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN qualidade ILIKE 'PRIMEIRA%' THEN metragem ELSE 0 END)
            , 0)
          , 1) AS pts100m2
        FROM PIEZAS
        GROUP BY "PARTIDA"
      ),
      PARTIDA_VARS AS (
        SELECT DISTINCT
          "PARTIDA",
          "PARTIDA" AS Var0,
          CASE WHEN length("PARTIDA") > 1 AND left("PARTIDA", 1) ~ '^[0-9]$' AND left("PARTIDA", 1)::int > 0
            THEN (left("PARTIDA", 1)::int - 1)::text || substring("PARTIDA" from 2) END AS Var1,
          CASE WHEN length("PARTIDA") > 1 AND left("PARTIDA", 1) ~ '^[0-9]$' AND left("PARTIDA", 1)::int > 1
            THEN (left("PARTIDA", 1)::int - 2)::text || substring("PARTIDA" from 2) END AS Var2,
          CASE WHEN length("PARTIDA") > 1 AND left("PARTIDA", 1) ~ '^[0-9]$' AND left("PARTIDA", 1)::int > 2
            THEN (left("PARTIDA", 1)::int - 3)::text || substring("PARTIDA" from 2) END AS Var3,
          CASE WHEN length("PARTIDA") > 1
            THEN '0' || substring("PARTIDA" from 2) END AS Var4
        FROM PIEZAS
      ),
      TEJ AS (
        SELECT PV."PARTIDA" AS cal_partida, TEJ_INNER.*
        FROM PARTIDA_VARS PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA",
            MAX(CASE WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$' THEN right(P."MAQUINA", 2)::int ELSE NULL END) AS "Telar",
            SUM(COALESCE(${prodPtsLidosNum}, 0)) AS "PtsLei",
            SUM(COALESCE(${prodPts100Num}, 0)) AS "Pts100",
            SUM(COALESCE(${prodParTraNum}, 0)) AS "ParTra",
            SUM(COALESCE(${prodParUrdNum}, 0)) AS "ParUrd"
          FROM tb_produccion P
          WHERE
            P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV.Var0, PV.Var1, PV.Var2, PV.Var3, PV.Var4)
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV.Var0 THEN 0 WHEN PV.Var1 THEN 1 WHEN PV.Var2 THEN 2
            WHEN PV.Var3 THEN 3 WHEN PV.Var4 THEN 4 ELSE 9
          END ASC
          LIMIT 1
        ) TEJ_INNER ON true
      )
      SELECT
        P.nm_merc AS "NombreArticulo",
        P."PARTIDA" AS "Partida",
        P.hora AS "Hora",
        ROUND(P.metragem::numeric, 2) AS "Metragem",
        P.qualidade AS "Qualidade",
        ROUND(P.pontuacao::numeric, 2) AS "Pontuacao",
        PA.pts100m2 AS "Pts100m2",
        P."ARTIGO" AS "Artigo",
        P."COR" AS "Cor",
        COALESCE(TEJ."Telar", 0) AS "Telar",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END AS "EficienciaPct",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RU105",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END AS "RT105"
      FROM PIEZAS P
      LEFT JOIN PART_AGG PA ON PA."PARTIDA" = P."PARTIDA"
      LEFT JOIN TEJ ON TEJ.cal_partida = P."PARTIDA"
      ORDER BY
        CASE
          WHEN regexp_replace(COALESCE(P.hora, ''), '[^0-9]', '', 'g') ~ '^[0-9]{1,4}$'
            THEN lpad(regexp_replace(P.hora, '[^0-9]', '', 'g'), 4, '0')
          ELSE '9999'
        END ASC
    `

    const result = await query(sql, [datCandidates, revisor], 'calidad/desempeno-piezas')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/desempeno-piezas fecha=${fecha} revisor=${revisor} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/desempeno-piezas:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/partida-detalle - Detalle de defectos por partida
app.get('/api/produccion/calidad/partida-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha, partida, revisor } = req.query
    if (!fecha || !partida || !revisor) {
      return res.status(400).json({ error: 'Se requieren fecha, partida y revisor' })
    }

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumber('"METRAGEM"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')

    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DAT_PROD" as "DAT_PROD",
        "ARTIGO" as "ARTIGO",
        "COR" as "COR",
        "NM MERC" as "NM_MERC",
        "TRAMA" as "TRAMA",
        "GRP_DEF" as "GRP_DEF",
        "COD_DE" as "COD_DE",
        "DEFEITO" as "DEFEITO",
        ${metragemNum} as "METRAGEM",
        "QUALIDADE" as "QUALIDADE",
        "HORA" as "HORA",
        "EMENDAS" as "EMENDAS",
        "PEÇA" as "PEÇA",
        "ETIQUETA" as "ETIQUETA",
        ${larguraNum} as "LARGURA",
        ${pontuacaoNum} as "PONTUACAO"
      FROM tb_calidad
      WHERE
        "EMP" = 'STC'
        AND ("DAT_PROD" = ANY($1::text[]) OR ${datProdDate} = $2::date)
        AND "PARTIDA" = $3
        AND "REVISOR FINAL" = $4
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
      ORDER BY "HORA" ASC, "PEÇA" ASC
    `

    const result = await query(sql, [dateTextCandidates(fecha), variants.iso, partida, revisor], 'calidad/partida-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/partida-detalle fecha=${fecha} partida=${partida} revisor=${revisor} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/partida-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/defectos-detalle - Defectos por etiqueta (tb_defectos)
app.get('/api/produccion/calidad/defectos-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const etiqueta = String(req.query.etiqueta || '').trim()
    if (!etiqueta) return res.status(400).json({ error: 'Se requiere la etiqueta' })

    const sql = `
      SELECT
        partida as "PARTIDA",
        peca as "PECA",
        etiqueta as "ETIQUETA",
        cod_def as "COD_DEF",
        desc_defeito as "DESC_DEFEITO",
        pontos as "PONTOS",
        qualidade as "QUALIDADE",
        data_prod as "DATA_PROD"
      FROM tb_defectos
      WHERE btrim(etiqueta) = $1
      ORDER BY peca ASC, cod_def ASC
    `

    const result = await query(sql, [etiqueta], 'calidad/defectos-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/defectos-detalle etiqueta=${etiqueta} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/defectos-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS - MESA DE TEST (AnalisisMesaTest.vue)
// =====================================================

// GET /api/produccion/calidad/articulos-mesa-test?fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/articulos-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha_inicial, fecha_final } = req.query

    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')

    const testesDtProdDate = sqlParseDate('dt_prod')
    const testesMetragemNum = sqlParseNumberIntl('metragem')

    const sql = `
      WITH MetricasCalidad AS (
        SELECT
          "ARTIGO" AS ARTIGO,
          ROUND(SUM(COALESCE(${calMetragemNum}, 0)), 0)::int AS METROS_REV
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${calDatProdDate} BETWEEN $1::date AND $2::date
          AND "TRAMA" IS NOT NULL
          AND btrim("TRAMA") <> ''
        GROUP BY "ARTIGO"
      ),
      MetricasTestesPartida AS (
        SELECT
          artigo AS ARTIGO,
          btrim(partida) AS PARTIDA,
          AVG(COALESCE(${testesMetragemNum}, 0)) AS METRAGEM_AVG
        FROM tb_testes
        WHERE
          ${testesDtProdDate} BETWEEN $1::date AND $2::date
        GROUP BY artigo, btrim(partida)
      ),
      MetricasTestes AS (
        SELECT
          ARTIGO,
          ROUND(SUM(METRAGEM_AVG), 0)::int AS METROS_TEST
        FROM MetricasTestesPartida
        GROUP BY ARTIGO
      ),
      AllArtigos AS (
        SELECT ARTIGO FROM MetricasCalidad
        UNION
        SELECT ARTIGO FROM MetricasTestes
      )
      SELECT
        AU.ARTIGO AS "ARTIGO_COMPLETO",
        substring(AU.ARTIGO from 1 for 10) AS "Articulo",
        substring(AU.ARTIGO from 7 for 2) AS "Id",
        F."COR" AS "Color",
        F."NOME DE MERCADO" AS "Nombre",
        F."TRAMA REDUZIDO" AS "Trama",
        F."PRODUCAO" AS "Prod",
        COALESCE(MT.METROS_TEST, 0) AS "Metros_TEST",
        COALESCE(MC.METROS_REV, 0) AS "Metros_REV"
      FROM AllArtigos AU
      LEFT JOIN MetricasTestes MT ON AU.ARTIGO = MT.ARTIGO
      LEFT JOIN MetricasCalidad MC ON AU.ARTIGO = MC.ARTIGO
      LEFT JOIN tb_fichas F ON AU.ARTIGO = F."ARTIGO CODIGO"
      WHERE F."TRAMA REDUZIDO" IS NOT NULL
      ORDER BY AU.ARTIGO;
    `

    const result = await query(sql, [startDate, endDate], 'calidad/articulos-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/articulos-mesa-test ${startDate}..${endDate} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/articulos-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/analisis-mesa-test?articulo=XXX&fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/analisis-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { articulo, fecha_inicial, fecha_final } = req.query

    if (!articulo) {
      return res.status(400).json({ error: 'Parámetro "articulo" requerido' })
    }
    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const articleCode = String(articulo)
    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const testesDtProdDate = sqlParseDate('dt_prod')
    const calDatProdDate = sqlParseDate('"DAT_PROD"')

    const tMetragemNum = sqlParseNumberIntl('metragem')
    const tLargAlNum = sqlParseNumberIntl('larg_al')
    const tGramatNum = sqlParseNumberIntl('gramat')
    const tPotenNum = sqlParseNumberIntl('poten')
    const tEncUrdNum = sqlParseNumberIntl('"%_ENC_URD"')
    const tEncTramaNum = sqlParseNumberIntl('"%_ENC_TRAMA"')
    const tSk1Num = sqlParseNumberIntl('"%_SK1"')
    const tSk2Num = sqlParseNumberIntl('"%_SK2"')
    const tSk3Num = sqlParseNumberIntl('"%_SK3"')
    const tSk4Num = sqlParseNumberIntl('"%_SK4"')
    const tSkeNum = sqlParseNumberIntl('"%_SKE"')
    const tSttNum = sqlParseNumberIntl('"%_STT"')
    const tSkmNum = sqlParseNumberIntl('"%_SKM"')

    const cMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const cLarguraNum = sqlParseNumberIntl('"LARGURA"')
    const cGrm2Num = sqlParseNumberIntl('"GR/M2"')

    const fLargMinNum = sqlParseNumberIntl('"LARGURA MIN"')
    const fLargStdNum = sqlParseNumberIntl('"LARGURA"')
    const fLargMaxNum = sqlParseNumberIntl('"LARGURA MAX"')
    const fPesoM2Num = sqlParseNumberIntl('"Peso/m2"')
    const fEncAcabUrdNum = sqlParseNumberIntl('"ENC#ACAB URD"')
    const fSkewMinNum = sqlParseNumberIntl('"SKEW MIN"')
    const fSkewMaxNum = sqlParseNumberIntl('"SKEW MAX"')
    const fUrdMinNum = sqlParseNumberIntl('"URD#MIN"')
    const fUrdMaxNum = sqlParseNumberIntl('"URD#MAX"')
    const fTraMinNum = sqlParseNumberIntl('"TRAMA MIN"')
    const fTraMaxNum = sqlParseNumberIntl('"TRAMA MAX"')
    const fVarTrMinNum = sqlParseNumberIntl('"VAR STR#MIN TRAMA"')
    const fVarTrMaxNum = sqlParseNumberIntl('"VAR STR#MAX TRAMA"')
    const fVarUrMinNum = sqlParseNumberIntl('"VAR STR#MIN URD"')
    const fVarUrMaxNum = sqlParseNumberIntl('"VAR STR#MAX URD"')

    const sql = `
      WITH TESTES AS (
        SELECT
          maquina,
          artigo AS art_test,
          btrim(partida) AS partida,
          artigo AS testes,
          dt_prod,
          aprov,
          obs,
          reprocesso,
          ${tMetragemNum} AS metragem_num,
          ${tLargAlNum} AS larg_al_num,
          ${tGramatNum} AS gramat_num,
          ${tPotenNum} AS poten_num,
          ${tEncUrdNum} AS enc_urd_num,
          ${tEncTramaNum} AS enc_trama_num,
          ${tSk1Num} AS sk1_num,
          ${tSk2Num} AS sk2_num,
          ${tSk3Num} AS sk3_num,
          ${tSk4Num} AS sk4_num,
          ${tSkeNum} AS ske_num,
          ${tSttNum} AS stt_num,
          ${tSkmNum} AS skm_num
        FROM tb_testes
        WHERE
          artigo = $1
          AND ${testesDtProdDate} BETWEEN $2::date AND $3::date
      ),
      CALIDAD AS (
        SELECT
          MIN("DAT_PROD") AS dat_prod,
          "ARTIGO" AS art_cal,
          btrim("PARTIDA") AS partida,
          ROUND(SUM(COALESCE(${cMetragemNum}, 0)), 0) AS metragem,
          ROUND(AVG(COALESCE(${cLarguraNum}, 0)), 1) AS largura,
          ROUND(AVG(COALESCE(${cGrm2Num}, 0)), 1) AS grm2
        FROM tb_calidad
        WHERE
          "ARTIGO" = $1
          AND ${calDatProdDate} BETWEEN $2::date AND $3::date
        GROUP BY "ARTIGO", btrim("PARTIDA")
      ),
      TESTES_CALIDAD AS (
        SELECT
          T.*,
          C.dat_prod AS calidad_dat_prod,
          C.metragem AS calidad_metragem,
          C.largura AS calidad_largura,
          C.grm2 AS calidad_grm2
        FROM TESTES T
        LEFT JOIN CALIDAD C ON T.partida = C.partida
      ),
      ESPECIFICACION AS (
        SELECT
          "ARTIGO CODIGO",
          "TRAMA REDUZIDO" AS trama_reducido,
          ${fLargMinNum} AS largura_min_val,
          ${fLargStdNum} AS ancho,
          ${fLargMaxNum} AS largura_max_val,
          ${fPesoM2Num} AS peso_m2,
          ${fEncAcabUrdNum} AS enc_acab_urd,
          ${fSkewMinNum} AS skew_min,
          (${fSkewMinNum} + ${fSkewMaxNum}) / 2.0 AS skew_std,
          ${fSkewMaxNum} AS skew_max,
          ${fUrdMinNum} AS urd_min,
          (${fUrdMinNum} + ${fUrdMaxNum}) / 2.0 AS urd_std,
          ${fUrdMaxNum} AS urd_max,
          ${fTraMinNum} AS trama_min,
          (${fTraMinNum} + ${fTraMaxNum}) / 2.0 AS trama_std,
          ${fTraMaxNum} AS trama_max,
          ${fVarTrMinNum} AS var_str_min_trama,
          (${fVarTrMinNum} + ${fVarTrMaxNum}) / 2.0 AS var_str_std_trama,
          ${fVarTrMaxNum} AS var_str_max_trama,
          ${fVarUrMinNum} AS var_str_min_urd,
          (${fVarUrMinNum} + ${fVarUrMaxNum}) / 2.0 AS var_str_std_urd,
          ${fVarUrMaxNum} AS var_str_max_urd
        FROM tb_fichas
        WHERE "ARTIGO CODIGO" = $1
      )
      SELECT
        CASE WHEN TC.maquina ~ '^[0-9]+$' THEN TC.maquina::int ELSE NULL END AS "Maquina",
        TC.art_test AS "Articulo",
        E.trama_reducido AS "Trama",
        TC.partida AS "Partida",
        TC.testes AS "C",
        TC.dt_prod AS "Fecha",
        TC.aprov AS "Ap",
        TC.obs AS "Obs",
        TC.reprocesso AS "R",
        ROUND(TC.metragem_num, 0) AS "Metros_TEST",
        ROUND(TC.calidad_metragem, 0) AS "Metros_MESA",

        ROUND(TC.calidad_largura, 1) AS "Ancho_MESA",
        ROUND(
          CASE
            WHEN E.largura_min_val < (E.ancho * 0.5) THEN E.ancho - E.largura_min_val
            ELSE E.largura_min_val
          END
        , 1) AS "Ancho_MIN",
        ROUND(E.ancho, 1) AS "Ancho_STD",
        ROUND(
          CASE
            WHEN E.largura_max_val < (E.ancho * 0.5) THEN E.ancho + E.largura_max_val
            ELSE E.largura_max_val
          END
        , 1) AS "Ancho_MAX",
        ROUND(TC.larg_al_num, 1) AS "Ancho_TEST",

        ROUND(TC.calidad_grm2, 1) AS "Peso_MESA",
        ROUND(E.peso_m2 * 0.95, 1) AS "Peso_MIN",
        ROUND(E.peso_m2, 1) AS "Peso_STD",
        ROUND(E.peso_m2 * 1.05, 1) AS "Peso_MAX",
        ROUND(TC.gramat_num, 1) AS "Peso_TEST",

        ROUND(TC.poten_num, 2) AS "Potencial",
        ROUND(E.enc_acab_urd, 2) AS "Potencial_STD",

        ROUND(TC.enc_urd_num, 2) AS "ENC_URD_%",
        ROUND(E.urd_min, 2) AS "ENC_URD_MIN_%",
        ROUND(E.urd_std, 2) AS "ENC_URD_STD_%",
        ROUND(E.urd_max, 2) AS "ENC_URD_MAX_%",
        -1.5::numeric AS "%_ENC_URD_MIN_Meta",
        -1.0::numeric AS "%_ENC_URD_MAX_Meta",

        ROUND(TC.enc_trama_num, 2) AS "ENC_TRA_%",
        ROUND(E.trama_min, 2) AS "ENC_TRA_MIN_%",
        ROUND(E.trama_std, 2) AS "ENC_TRA_STD_%",
        ROUND(E.trama_max, 2) AS "ENC_TRA_MAX_%",

        ROUND(TC.sk1_num, 2) AS "%_SK1",
        ROUND(TC.sk2_num, 2) AS "%_SK2",
        ROUND(TC.sk3_num, 2) AS "%_SK3",
        ROUND(TC.sk4_num, 2) AS "%_SK4",
        ROUND(TC.ske_num, 2) AS "%_SKE",

        ROUND(E.skew_min, 2) AS "Skew_MIN",
        ROUND(E.skew_std, 2) AS "Skew_STD",
        ROUND(E.skew_max, 2) AS "Skew_MAX",

        ROUND(TC.stt_num, 3) AS "%_STT",
        ROUND(E.var_str_min_trama, 3) AS "%_STT_MIN",
        ROUND(E.var_str_std_trama, 3) AS "%_STT_STD",
        ROUND(E.var_str_max_trama, 3) AS "%_STT_MAX",

        ROUND(TC.skm_num, 2) AS "Pasadas_Terminadas",
        ROUND(E.var_str_min_urd, 2) AS "Pasadas_MIN",
        ROUND(E.var_str_std_urd, 2) AS "Pasadas_STD",
        ROUND(E.var_str_max_urd, 2) AS "Pasadas_MAX",

        ROUND(TC.calidad_grm2 * 0.0295, 1) AS "Peso_MESA_OzYd²",
        ROUND(E.peso_m2 * 0.95 * 0.0295, 1) AS "Peso_MIN_OzYd²",
        ROUND(E.peso_m2 * 0.0295, 1) AS "Peso_STD_OzYd²",
        ROUND(E.peso_m2 * 1.05 * 0.0295, 1) AS "Peso_MAX_OzYd²"
      FROM TESTES_CALIDAD TC
      LEFT JOIN ESPECIFICACION E ON TC.art_test = E."ARTIGO CODIGO"
      ORDER BY ${sqlParseDate('TC.dt_prod')} ASC;
    `

    const result = await query(sql, [articleCode, startDate, endDate], 'calidad/analisis-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/analisis-mesa-test articulo=${articleCode} ${startDate}..${endDate} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/analisis-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS CALIDAD/PRODUCCION (Calidad Sectores)
// =====================================================

// GET /api/calidad/available-dates - Fechas disponibles en tb_calidad
app.get('/api/calidad/available-dates', async (req, res) => {
  try {
    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const sql = `
      SELECT DISTINCT
        to_char(${datProdDate}, 'YYYY-MM-DD') AS fecha,
        to_char(${datProdDate}, 'YYYY') AS year,
        to_char(${datProdDate}, 'MM') AS month,
        to_char(${datProdDate}, 'DD') AS day
      FROM tb_calidad c
      WHERE c."DAT_PROD" IS NOT NULL
        AND c."DAT_PROD" <> ''
        AND ${datProdDate} IS NOT NULL
      ORDER BY fecha DESC
    `

    const result = await query(sql, [], 'calidad/available-dates')
    const rows = result.rows || []

    const dateStructure = { years: {}, minDate: null, maxDate: null }
    if (rows.length > 0) {
      dateStructure.minDate = rows[rows.length - 1].fecha
      dateStructure.maxDate = rows[0].fecha
      for (const row of rows) {
        const { year, month, day, fecha } = row
        if (!dateStructure.years[year]) dateStructure.years[year] = {}
        if (!dateStructure.years[year][month]) dateStructure.years[year][month] = []
        dateStructure.years[year][month].push({ day, fecha })
      }
    }

    res.json(dateStructure)
  } catch (err) {
    console.error('Error en /api/calidad/available-dates:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/partida/:codigo - Detalle de partida
app.get('/api/calidad/partida/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.status(400).json({ error: 'Se requiere código de partida' });
    }

    const sql = `
      SELECT
        "ARTIGO",
        "COR",
        "NM MERC",
        "TRAMA",
        "PEÇA",
        "DAT_PROD",
        "GRP_DEF",
        "COD_DE",
        "DEFEITO",
        "METRAGEM",
        "QUALIDADE",
        "REVISOR FINAL",
        "HORA",
        "PARTIDA",
        "EMENDAS",
        "ETIQUETA"
      FROM tb_calidad
      WHERE "PARTIDA" LIKE '%' || $1
      ORDER BY "PEÇA" ASC
    `;

    const result = await query(sql, [codigo], 'calidad/partida-by-id');
    const rows = result.rows || [];

    if (rows.length === 0) {
      return res.json({ header: null, rows: [] });
    }

    // Tomamos el primer registro para el encabezado (asumiendo homogeneidad en la partida)
    const first = rows[0];
    const header = {
      ARTIGO: first.ARTIGO,
      COR: first.COR,
      NM_MERC: first["NM MERC"],
      TRAMA: first.TRAMA
    };

    res.json({ header, rows });
  } catch (err) {
    console.error('Error en /api/calidad/partida/:codigo:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calidad/sectores-resumen - Metros revisados por sector
app.get('/api/calidad/sectores-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')

    const sql = `
      WITH sectores(sector, nro, meta_pct) AS (
        VALUES
          ('S/ Def.', 1, 95.5),
          ('FIACAO', 2, 0.15),
          ('INDIGO', 3, 1.4),
          ('TECELAGEM', 4, 2.5),
          ('ACABMTO', 5, 0.3),
          ('GERAL', 6, 0.15)
      ),
      calidad_dia AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} = $1::date
        GROUP BY c."GRP_DEF"
      ),
      calidad_mes AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} >= $2::date
          AND ${datProdDate} <= $3::date
        GROUP BY c."GRP_DEF"
      )
      SELECT
        s.sector AS "SECTOR",
        COALESCE(d.metros, 0) AS "metrosDia",
        COALESCE(m.metros, 0) AS "metrosMes",
        s.meta_pct AS "metaPct"
      FROM sectores s
      LEFT JOIN calidad_dia d ON s.sector = d.sector
      LEFT JOIN calidad_mes m ON s.sector = m.sector
      ORDER BY s.nro
    `

    const result = await query(sql, [datePattern, mesInicio, mesFin], 'calidad/sectores-resumen')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/calidad/sectores-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metas/resumen/:fecha - Meta del dia y acumulado del mes
app.get('/api/metas/resumen/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params
    if (!fecha) {
      return res.status(400).json({ error: 'Se requiere parámetro "fecha" (YYYY-MM-DD)' })
    }

    const datePattern = String(fecha).split('T')[0]
    const [year, month] = datePattern.split('-')
    const monthStart = `${year}-${month}-01`

    const metasExists = await tableExists('tb_metas')
    if (!metasExists) {
      return res.json({ day: 0, month: 0, fecha: datePattern })
    }

    const metaDia = await query(
      `SELECT COALESCE("Revision", 0) AS total
       FROM tb_metas WHERE "Dia" = $1`,
      [datePattern],
      'metas/resumen-dia'
    )
    const metaMes = await query(
      `SELECT COALESCE(SUM("Revision"), 0) AS total
       FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
      [monthStart, datePattern],
      'metas/resumen-mes'
    )

    res.json({
      day: Number(metaDia.rows?.[0]?.total || 0),
      month: Number(metaMes.rows?.[0]?.total || 0),
      fecha: datePattern
    })
  } catch (err) {
    console.error('Error en /api/metas/resumen/:fecha:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/pts100m2 - Puntos por 100m2
app.get('/api/calidad/pts100m2', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')
    const pontuacaoNum = sqlParseNumberIntl('c."PONTUACAO"')
    const larguraNum = sqlParseNumberIntl('c."LARGURA"')

    const sqlDia = `
      WITH pts AS (
        SELECT
          dat_prod,
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} = $1::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
        GROUP BY dat_prod
      ),
      ancho AS (
        SELECT
          ${datProdDate} AS fecha,
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} = $1::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
        GROUP BY ${datProdDate}
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho
      LEFT JOIN pts ON ancho.fecha = pts.dat_prod
    `

    const sqlMes = `
      WITH pts AS (
        SELECT
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} >= $1::date
            AND ${datProdDate} <= $2::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
      ),
      ancho AS (
        SELECT
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} >= $1::date
          AND ${datProdDate} <= $2::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho, pts
    `

    const resultDia = await query(sqlDia, [datePattern], 'calidad/pts100m2-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'calidad/pts100m2-mes')

    res.json({
      day: Number(resultDia.rows?.[0]?.pts1002 || 0),
      month: Number(resultMes.rows?.[0]?.pts1002 || 0),
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/calidad/pts100m2:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/indigo-resumen
app.get('/api/produccion/indigo-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasNum = sqlParseNumberIntl('p."RUPTURAS"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'INDIGO'
    `

    const sqlMes = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."SELETOR" = 'INDIGO'
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/indigo-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/indigo-mes')

    let metaDia = 0
    let metaMes = 0
    let indigoMetaRot = 0
    let indigoMetaEstopa = 0
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        'SELECT "Indigo" AS meta_dia, "Meta_Rotura_INDIGO" AS meta_rot_103, "Meta_Estopa_Azul" AS meta_estopa_azul FROM tb_metas WHERE "Dia" = $1',
        [datePattern],
        'metas/indigo-dia'
      )
      const metaMesRes = await query(
        'SELECT SUM("Indigo") AS total, AVG("Meta_Rotura_INDIGO") AS meta_rot_103, AVG("Meta_Estopa_Azul") AS meta_estopa_azul FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2',
        [mesInicio, mesFin],
        'metas/indigo-mes'
      )
      metaDia = Number(metaDiaRes.rows?.[0]?.meta_dia || 0)
      metaMes = Number(metaMesRes.rows?.[0]?.total || 0)
      indigoMetaRot = Number(metaDiaRes.rows?.[0]?.meta_rot_103 || metaMesRes.rows?.[0]?.meta_rot_103 || 0)
      indigoMetaEstopa = Number(metaDiaRes.rows?.[0]?.meta_estopa_azul || metaMesRes.rows?.[0]?.meta_estopa_azul || 0)
    }

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        rot103: Number(resultDia.rows?.[0]?.rot_103 || 0),
        meta: metaDia,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        rot103: Number(resultMes.rows?.[0]?.rot_103 || 0),
        metaAcumulada: metaMes,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/estopa-azul
app.get('/api/produccion/estopa-azul', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const pesoMantaNum = sqlParseNumberIntl('f."CONS#URD/m"')
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')

    const sqlDia = `
      WITH bases AS (
        SELECT DISTINCT
          f."URDUME" AS artigo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE f."URDUME" IS NOT NULL
          AND f."URDUME" <> ''
          AND f."CONS#URD/m" IS NOT NULL
          AND f."CONS#URD/m" <> ''
          AND f."CONS#URD/m" <> '0'
          AND f."CONS#URD/m" <> '0,00'
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_dia AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.artigo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} = $2::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pd.suma_producto,
        CASE WHEN pd.suma_producto > 0 THEN (ea.estopa / pd.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_dia pd, estopa_azul ea
    `

    const sqlMes = `
      WITH bases AS (
        SELECT DISTINCT
          f."URDUME" AS artigo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE f."URDUME" IS NOT NULL
          AND f."URDUME" <> ''
          AND f."CONS#URD/m" IS NOT NULL
          AND f."CONS#URD/m" <> ''
          AND f."CONS#URD/m" <> '0'
          AND f."CONS#URD/m" <> '0,00'
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_mes AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.artigo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} >= $3::date
          AND ${dtMovDate} <= $4::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pm.suma_producto,
        CASE WHEN pm.suma_producto > 0 THEN (ea.estopa / pm.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_mes pm, estopa_azul ea
    `

    const resultDia = await query(sqlDia, [datePattern, datePattern], 'produccion/estopa-azul-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin, mesInicio, mesFin], 'produccion/estopa-azul-mes')

    res.json({
      day: {
        estopaKg: Number(resultDia.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultDia.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultDia.rows?.[0]?.porcentaje || 0)
      },
      month: {
        estopaKg: Number(resultMes.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultMes.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultMes.rows?.[0]?.porcentaje || 0)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/estopa-azul:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/tecelagem-resumen
app.get('/api/produccion/tecelagem-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemEncNum = sqlParseNumberIntl('p."METRAGEM ENCOLH"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('p."PARADA TEC URDUME"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemEncNum}), 0) AS metros,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaTramaNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaUrdNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(${pontos100Num}) > 0 THEN SUM(${pontosLidosNum}) * 100.0 / SUM(${pontos100Num})
          ELSE 0
        END AS eficiencia
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'TECELAGEM'
    `

    const sqlMes = `
      SELECT
        COALESCE(SUM(${metragemEncNum}), 0) AS metros,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaTramaNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaUrdNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(${pontos100Num}) > 0 THEN SUM(${pontosLidosNum}) * 100.0 / SUM(${pontos100Num})
          ELSE 0
        END AS eficiencia
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."SELETOR" = 'TECELAGEM'
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/tecelagem-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/tecelagem-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT
           "Tejeduria" AS meta_dia,
           "EFI_Percent" AS meta_efi,
           "RT105" AS meta_rt105,
           "RU105" AS meta_ru105,
           "Meta_Estopa_Azul_Tejeduria" AS meta_estopa
         FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/tecelagem-dia'
      )
      const metaMesRes = await query(
        `SELECT
           SUM("Tejeduria") AS meta_acumulada,
           AVG("EFI_Percent") AS meta_efi,
           AVG("RT105") AS meta_rt105,
           AVG("RU105") AS meta_ru105,
           AVG("Meta_Estopa_Azul_Tejeduria") AS meta_estopa
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
        [mesInicio, mesFin],
        'metas/tecelagem-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    // Estopa azul tejeduria (residuos por sector)
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const pesoMantaNum = sqlParseNumberIntl('f."CONS#URD/m"')
    const encUrdNum = sqlParseNumberIntl('f."ENC#TEC#URDUME"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')

    const sqlEstopaDiaPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          f."ARTIGO CODIGO" AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE f."ARTIGO CODIGO" IS NOT NULL AND f."ARTIGO CODIGO" <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaDiaResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} = $1::date
        AND r."SUBPRODUTO" = '1785582'
    `

    const sqlEstopaMesPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          f."ARTIGO CODIGO" AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE f."ARTIGO CODIGO" IS NOT NULL AND f."ARTIGO CODIGO" <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaMesResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} >= $1::date
        AND ${dtMovDate} <= $2::date
        AND r."SUBPRODUTO" = '1785582'
    `

    let pesoProductoDia = 0
    let pesoProductoMes = 0
    let estopaDia = 0
    let estopaMes = 0

    try {
      const estopaDiaPeso = await query(sqlEstopaDiaPeso, [datePattern], 'tecelagem/estopa-peso-dia')
      const estopaDiaRes = await query(sqlEstopaDiaResiduo, [datePattern], 'tecelagem/estopa-residuo-dia')
      const estopaMesPeso = await query(sqlEstopaMesPeso, [mesInicio, mesFin], 'tecelagem/estopa-peso-mes')
      const estopaMesRes = await query(sqlEstopaMesResiduo, [mesInicio, mesFin], 'tecelagem/estopa-residuo-mes')

      pesoProductoDia = Number(estopaDiaPeso.rows?.[0]?.peso_urd || 0)
      pesoProductoMes = Number(estopaMesPeso.rows?.[0]?.peso_urd || 0)
      estopaDia = Number(estopaDiaRes.rows?.[0]?.estopa || 0)
      estopaMes = Number(estopaMesRes.rows?.[0]?.estopa || 0)
    } catch (err) {
      console.warn('No se pudo calcular estopa azul tejeduria:', err.message)
    }

    const estopaAzulPctDia = pesoProductoDia > 0 ? (estopaDia / pesoProductoDia) * 100 : 0
    const estopaAzulPctMes = pesoProductoMes > 0 ? (estopaMes / pesoProductoMes) * 100 : 0

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        eficiencia: Number(resultDia.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultDia.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultDia.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctDia,
        meta: Number(metaDia.meta_dia || 0),
        metaEfi: Number(metaDia.meta_efi || 0),
        metaRt105: Number(metaDia.meta_rt105 || 0),
        metaRu105: Number(metaDia.meta_ru105 || 0),
        metaEstopaAzul: Number(metaDia.meta_estopa || 0)
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        eficiencia: Number(resultMes.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultMes.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultMes.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctMes,
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEfi: Number(metaMes.meta_efi || 0),
        metaRt105: Number(metaMes.meta_rt105 || 0),
        metaRu105: Number(metaMes.meta_ru105 || 0),
        metaEstopaAzul: Number(metaMes.meta_estopa || 0)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/tecelagem-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/acabamento-resumen
app.get('/api/produccion/acabamento-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtProdDate = sqlParseDate('t.dt_prod')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const testeMetragemNum = sqlParseNumberIntl('t.metragem')
    const encUrdNum = sqlParseNumberIntl('t."%_ENC_URD"')

    const sqlMetrosDia = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."MAQUINA" = '165001'
    `
    const sqlMetrosMes = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."MAQUINA" = '165001'
    `

    const sqlEncUrdDia = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} = $1::date
        AND t.maquina = '165001'
        AND t.aprov = 'A'
    `
    const sqlEncUrdMes = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} >= $1::date
        AND ${dtProdDate} <= $2::date
        AND t.maquina = '165001'
        AND t.aprov = 'A'
    `

    const resultMetrosDia = await query(sqlMetrosDia, [datePattern], 'acabamento/metros-dia')
    const resultMetrosMes = await query(sqlMetrosMes, [mesInicio, mesFin], 'acabamento/metros-mes')
    const resultEncUrdDia = await query(sqlEncUrdDia, [datePattern], 'acabamento/enc-urd-dia')
    const resultEncUrdMes = await query(sqlEncUrdMes, [mesInicio, mesFin], 'acabamento/enc-urd-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT "Integrada" AS meta_dia, "Meta_ENC_URD_Integrada" AS meta_enc_urd FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/acabamento-dia'
      )
      const metaMesRes = await query(
        `SELECT SUM("Integrada") AS meta_acumulada, AVG("Meta_ENC_URD_Integrada") AS meta_enc_urd
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
        [mesInicio, mesFin],
        'metas/acabamento-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    res.json({
      day: {
        metros: Number(resultMetrosDia.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdDia.rows?.[0]?.enc_urd_pct || 0),
        meta: Number(metaDia.meta_dia || 0),
        metaEncUrd: Number(metaDia.meta_enc_urd || -1.5)
      },
      month: {
        metros: Number(resultMetrosMes.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdMes.rows?.[0]?.enc_urd_pct || 0),
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEncUrd: Number(metaMes.meta_enc_urd || -1.5)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/acabamento-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/eficiencia-roturas
app.get('/api/produccion/eficiencia-roturas', async (req, res) => {
  try {
    const { date, trama, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const startDate = monthStart || `${year}-${month}-01`
    const endDate = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')

    const tramaFilter = trama ? 'AND p."TRAMA REDUZIDA 1" = $3' : ''
    const params = trama ? [startDate, endDate, trama] : [startDate, endDate]

    const sql = `
      SELECT
        to_char(${dtBaseDate}, 'YYYY-MM-DD') AS fecha,
        p."TRAMA REDUZIDA 1" AS trama,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0)) * 100.0) / NULLIF(SUM(COALESCE(${pontos100Num}, 0)), 0), 1) AS eficiencia,
        ROUND((SUM(COALESCE(${paradaTramaNum}, 0)) * 100000.0) / NULLIF((SUM(COALESCE(${pontosLidosNum}, 0)) * 1000), 0), 1) AS rt105
      FROM tb_produccion p
      WHERE p."FILIAL" = '05'
        AND p."SELETOR" = 'TECELAGEM'
        AND ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        ${tramaFilter}
      GROUP BY fecha, p."TRAMA REDUZIDA 1"
      ORDER BY fecha ASC
    `

    const result = await query(sql, params, 'produccion/eficiencia-roturas')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/produccion/eficiencia-roturas:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS BENNINGER RTF (MATCH + VALIDACION)
// =====================================================

app.post('/api/benninger-rtf/status', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const rawList = Array.isArray(req.body?.fileNames) ? req.body.fileNames : []
    const fileNames = [...new Set(rawList.map((v) => String(v || '').trim()).filter(Boolean))]
    if (!fileNames.length) return res.json({ existing: [] })

    const result = await query(
      `SELECT source_file, match_partida, match_confidence, match_mode
       FROM tb_benninger_rtf_links
       WHERE source_file = ANY($1::text[])`,
      [fileNames],
      'benninger-rtf/status'
    )

    // Un registro está "terminado" (saved) si tiene match_partida poblado (vinculado,
    // sin importar el score/confianza) O si fue marcado como no_apta.
    // Solo los que NO tienen partida y NO son no_apta siguen siendo pendientes.
    const existing  = []
    const noMatch   = []
    for (const r of result.rows || []) {
      const isNoApta  = String(r.match_mode || '').includes('no_apta')
      const hasPartida = r.match_partida && String(r.match_partida).trim() !== ''
      if (hasPartida || isNoApta) {
        existing.push(r.source_file)
      } else {
        noMatch.push(r.source_file)
      }
    }

    res.json({ existing, noMatch })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/status:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/benninger-rtf/match', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const files = Array.isArray(req.body?.files) ? req.body.files : []
    const autoConfirmHighConfidence = req.body?.autoConfirmHighConfidence === true

    if (!files.length) {
      return res.status(400).json({ error: 'files must be a non-empty array' })
    }

    const startExpr = sqlBuildTimestamp('p."DT_INICIO"', 'p."HORA_INICIO"')

    const matchResults = []

    for (const item of files) {
      const sourceFile = String(item?.sourceFile || item?.fileName || '').trim()
      const headerIn = item?.header || item || {}
      const rawRtfText = typeof item?.rawRtfText === 'string' ? item.rawRtfText : null
      const plainText = typeof item?.plainText === 'string' ? item.plainText : null
      const parseVersion = String(item?.parseVersion || BENNINGER_RTF_PARSE_VERSION)
      const header = {
        ...(headerIn && typeof headerIn === 'object' ? headerIn : {}),
        idRolo: String(headerIn.idRolo || headerIn.id_rolo || headerIn.ID_ROLO || '').trim(),
        indicativo: String(headerIn.indicativo || headerIn.INDICATIVO || '').trim(),
        receita: String(headerIn.receita || headerIn.RECEITA || '').trim(),
        comeco: String(headerIn.comeco || headerIn['comeco'] || headerIn.COMECO || '').trim(),
        fim: String(headerIn.fim || headerIn.FIM || '').trim(),
        duracao: String(headerIn.duracao || headerIn.DURACAO || '').trim()
      }

      const comecoParsed = parseBenningerDateTime(header.comeco)
      const fimParsed = parseBenningerDateTime(header.fim)

      if (!comecoParsed) {
        matchResults.push({
          sourceFile,
          header,
          candidates: [],
          suggested: null,
          confidence: 'none',
          scoreGap: 0,
          decision: 'review',
          error: 'No se pudo interpretar Comeco del RTF'
        })
        continue
      }

      const fetchCandidates = async (onlyFilial05, windowHours) => {
        const filialClause = onlyFilial05 ? `AND ltrim(COALESCE(p."FILIAL"::text, ''), '0') = '5'` : ''
        const sql = `
          WITH raw AS (
            SELECT
              p."PARTIDA" AS partida,
              p."ROLADA" AS rolada,
              p."FILIAL" AS filial,
              p."SELETOR" AS seletor,
              p."DT_INICIO" AS dt_inicio,
              p."HORA_INICIO" AS hora_inicio,
              p."DT_FINAL" AS dt_final,
              p."HORA_FINAL" AS hora_final,
              ${sqlParseNumberIntl('p."METRAGEM"')} AS metragem_num,
              COALESCE(${sqlParseNumberIntl('p."VELOC"')}, ${sqlParseNumberIntl('p."VELOC CALC"')}) AS velocidade_num,
              ${startExpr} AS start_ts,
              p."BASE URDUME" AS base_urdume
            FROM tb_produccion p
            WHERE upper(btrim(COALESCE(p."SELETOR"::text, ''))) LIKE 'INDIGO%'
              ${filialClause}
          ),
          scored AS (
            SELECT
              r.*,
              SUM(COALESCE(r.metragem_num, 0)) OVER (PARTITION BY r.partida) AS partida_metragem,
              AVG(r.velocidade_num) FILTER (WHERE r.velocidade_num IS NOT NULL) OVER (PARTITION BY r.partida) AS partida_velocidade,
              ABS(EXTRACT(EPOCH FROM (
                date_trunc('minute', r.start_ts) - date_trunc('minute', $1::timestamp)
              ))) AS start_diff_sec
            FROM raw r
            WHERE r.start_ts IS NOT NULL
              AND date_trunc('minute', r.start_ts) BETWEEN
                (date_trunc('minute', $1::timestamp) - (($2::text || ' hours')::interval))
                AND
                (date_trunc('minute', $1::timestamp) + (($2::text || ' hours')::interval))
          ),
          ranked AS (
            SELECT
              s.*,
              row_number() OVER (
                PARTITION BY s.partida
                ORDER BY s.start_diff_sec ASC, s.start_ts ASC
              ) AS rn_partida
            FROM scored s
          )
          SELECT
            r.partida,
            r.rolada,
            r.filial,
            r.seletor,
            r.dt_inicio,
            r.hora_inicio,
            r.dt_final,
            r.hora_final,
            r.start_ts,
            r.partida_metragem,
            r.partida_velocidade,
            r.start_diff_sec,
            r.base_urdume
          FROM ranked r
          WHERE r.rn_partida = 1
          ORDER BY r.start_diff_sec ASC, r.partida DESC NULLS LAST
          LIMIT 30
        `

        const result = await query(
          sql,
          [
            comecoParsed.sqlTimestamp,
            windowHours
          ],
          onlyFilial05 ? 'benninger-rtf/match-candidates-start-minute-filial05' : 'benninger-rtf/match-candidates-start-minute'
        )
        return result.rows || []
      }

      const firstPass = await fetchCandidates(true, 12)
      const secondPass = await fetchCandidates(false, 48)

      const rawByKey = new Map()
      for (const row of [...firstPass, ...secondPass]) {
        const key = String(row.partida ?? '')
        const existing = rawByKey.get(key)
        if (!existing) {
          rawByKey.set(key, row)
          continue
        }

        const existingDiff = Number.isFinite(Number(existing.start_diff_sec)) ? Number(existing.start_diff_sec) : Number.POSITIVE_INFINITY
        const incomingDiff = Number.isFinite(Number(row.start_diff_sec)) ? Number(row.start_diff_sec) : Number.POSITIVE_INFINITY

        if (incomingDiff < existingDiff) {
          rawByKey.set(key, row)
        }
      }

      const candidateRows = [...rawByKey.values()]

      const partidaKeys = [...new Set(candidateRows.map((r) => String(r.partida || '').trim()).filter(Boolean))]
      const lotesByPartida = new Map()
      const fibraByLot = new Map()

      if (partidaKeys.length) {
        const lotesSql = `
          SELECT
            btrim(p."PARTIDA") AS partida,
            array_remove(array_agg(DISTINCT NULLIF(btrim(p."LOTE FIACAO"), '')), NULL) AS lotes
          FROM tb_produccion p
          WHERE btrim(p."PARTIDA") = ANY($1::text[])
            AND upper(btrim(COALESCE(p."SELETOR"::text, ''))) LIKE 'INDIGO%'
          GROUP BY btrim(p."PARTIDA")
        `

        try {
          const lotesResult = await query(lotesSql, [partidaKeys], 'benninger-rtf/match-quality-lotes')
          for (const row of lotesResult.rows || []) {
            const key = String(row.partida || '').trim()
            const lotes = Array.isArray(row.lotes) ? row.lotes.map((l) => String(l || '').trim()).filter(Boolean) : []
            if (!key) continue
            lotesByPartida.set(key, lotes)
          }
        } catch (qualityErr) {
          console.warn('benninger-rtf/match-quality-lotes warning:', qualityErr.message)
        }

        const allLotes = [...new Set([...lotesByPartida.values()].flat().filter(Boolean))]
        if (allLotes.length) {
          const fibraSql = `
            SELECT
              btrim(cf."LOTE_FIAC") AS lote_fiac,
              COUNT(*)::int AS muestras,
              AVG(${sqlParseNumberIntl('cf."MIC"')}) AS mic,
              AVG(${sqlParseNumberIntl('cf."STR"')}) AS str,
              AVG(${sqlParseNumberIntl('cf."UHML"')}) AS uhml,
              AVG(${sqlParseNumberIntl('cf."SCI"')}) AS sci,
              AVG(${sqlParseNumberIntl('cf."ELG"')}) AS elg,
              AVG(${sqlParseNumberIntl('cf."RD"')}) AS rd,
              AVG(${sqlParseNumberIntl('cf."PLUS_B"')}) AS plus_b
            FROM tb_CALIDAD_FIBRA cf
            WHERE btrim(COALESCE(cf."LOTE_FIAC", '')) = ANY($1::text[])
            GROUP BY btrim(cf."LOTE_FIAC")
          `

          try {
            const fibraResult = await query(fibraSql, [allLotes], 'benninger-rtf/match-quality-fibra')
            for (const row of fibraResult.rows || []) {
              const key = String(row.lote_fiac || '').trim()
              if (!key) continue
              fibraByLot.set(key, {
                muestras: Number(row.muestras) || 0,
                mic: roundNullable(row.mic, 3),
                str: roundNullable(row.str, 3),
                uhml: roundNullable(row.uhml, 3),
                sci: roundNullable(row.sci, 3),
                elg: roundNullable(row.elg, 3),
                rd: roundNullable(row.rd, 3),
                plusB: roundNullable(row.plus_b, 3)
              })
            }
          } catch (qualityErr) {
            console.warn('benninger-rtf/match-quality-fibra warning:', qualityErr.message)
          }
        }
      }

      const candidates = candidateRows.map((row) => {
        const startDiffSec = row.start_diff_sec == null ? null : Number(row.start_diff_sec)

        const baseScore = computeBenningerMatchScore({
          startDiffSec,
          endDiffSec: null,
          durationDiffSec: null
        })

        const score = baseScore

        const partidaKey = String(row.partida || '').trim()
        const lotes = lotesByPartida.get(partidaKey) || []
        const fibraQuality = buildFibraSummaryFromLots(lotes, fibraByLot)

        return {
          partida: row.partida,
          rolada: row.rolada,
          filial: row.filial,
          seletor: row.seletor,
          dtInicio: row.dt_inicio,
          horaInicio: row.hora_inicio,
          dtFinal: row.dt_final,
          horaFinal: row.hora_final,
          metragemPartida: row.partida_metragem == null ? null : Number(row.partida_metragem),
          velocidadeMediaPartida: row.partida_velocidade == null ? null : Number(row.partida_velocidade),
          baseUrdume: row.base_urdume || null,
          fibraQuality,
          startDiffSec,
          endDiffSec: null,
          prodDurationSec: null,
          durationDiffSec: null,
          score
        }
      }).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aDiff = Number.isFinite(a.startDiffSec) ? a.startDiffSec : Number.POSITIVE_INFINITY
        const bDiff = Number.isFinite(b.startDiffSec) ? b.startDiffSec : Number.POSITIVE_INFINITY
        return aDiff - bDiff
      })

      const suggested = candidates[0] || null
      const second = candidates[1] || null
      const scoreGap = suggested && second ? Number((suggested.score - second.score).toFixed(2)) : (suggested ? suggested.score : 0)
      const confidence = classifyBenningerConfidence(suggested ? suggested.score : NaN, scoreGap)
      const decision = confidence === 'high' ? 'auto' : 'review'

      let saved = false
      if (autoConfirmHighConfidence && decision === 'auto' && suggested && sourceFile) {
        await upsertBenningerRtfLink({
          sourceFile,
          header,
          rawRtfText,
          plainText,
          parseVersion,
          comecoParsed,
          fimParsed,
          selected: suggested,
          confidence,
          mode: 'auto',
          reason: 'AUTO_HIGH_CONFIDENCE',
          matchPayload: { candidates: candidates.slice(0, 5), scoreGap }
        })
        saved = true
      }

      matchResults.push({
        sourceFile,
        header,
        parsed: {
          comecoSql: comecoParsed.sqlTimestamp,
          fimSql: fimParsed ? fimParsed.sqlTimestamp : null
        },
        candidates: candidates.slice(0, 5),
        suggested,
        confidence,
        scoreGap,
        decision,
        saved
      })
    }

    const summary = {
      total: matchResults.length,
      high: matchResults.filter((r) => r.confidence === 'high').length,
      medium: matchResults.filter((r) => r.confidence === 'medium').length,
      low: matchResults.filter((r) => r.confidence === 'low').length,
      none: matchResults.filter((r) => r.confidence === 'none').length,
      autoSaved: matchResults.filter((r) => r.saved === true).length
    }

    res.json({ success: true, summary, rows: matchResults })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/match:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/benninger-rtf/confirm', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }

    const saved = []
    const errors = []

    for (const item of items) {
      const sourceFile = String(item?.sourceFile || item?.fileName || '').trim()
      const header = item?.header || {}
      const selected = item?.selected || item?.suggested || null

      if (!sourceFile) {
        errors.push({ sourceFile: null, error: 'sourceFile requerido' })
        continue
      }
      if (!selected || (!selected.partida && !selected.rolada)) {
        errors.push({ sourceFile, error: 'Se requiere partida o rolada seleccionada' })
        continue
      }

      const comecoParsed = parseBenningerDateTime(header?.comeco)
      const fimParsed = parseBenningerDateTime(header?.fim)

      await upsertBenningerRtfLink({
        sourceFile,
        header,
        rawRtfText: typeof item?.rawRtfText === 'string' ? item.rawRtfText : null,
        plainText: typeof item?.plainText === 'string' ? item.plainText : null,
        parseVersion: String(item?.parseVersion || BENNINGER_RTF_PARSE_VERSION),
        comecoParsed,
        fimParsed,
        selected,
        confidence: String(item?.confidence || item?.matchConfidence || 'manual').trim() || 'manual',
        mode: String(item?.mode || item?.matchMode || 'manual').trim() || 'manual',
        reason: String(item?.reason || 'USER_VALIDATED').trim() || 'USER_VALIDATED',
        matchPayload: {
          candidates: Array.isArray(item?.candidates) ? item.candidates.slice(0, 5) : [],
          scoreGap: Number(item?.scoreGap || 0),
          noApta: item?.noApta && typeof item.noApta === 'object'
            ? {
                motivo: String(item.noApta.motivo || '').trim() || null,
                observacion: String(item.noApta.observacion || '').trim() || null
              }
            : null
        }
      })

      saved.push({
        sourceFile,
        partida: selected.partida || null,
        rolada: selected.rolada || null,
        mode: item?.mode || item?.matchMode || 'manual'
      })
    }

    res.json({
      success: true,
      savedCount: saved.length,
      errorCount: errors.length,
      saved,
      errors
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/confirm:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/benninger-rtf/sin-match', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  || '500', 10)))
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10))

    const result = await query(`
      SELECT
        source_file,
        id_rolo,
        indicativo,
        receita,
        comeco_raw,
        to_char(comeco_ts, 'DD/MM/YY HH24:MI') AS comeco_fmt,
        fim_raw,
        to_char(fim_ts, 'DD/MM/YY HH24:MI')    AS fim_fmt,
        duracao_raw,
        match_partida,
        match_rolada,
        match_score,
        match_confidence,
        match_mode,
        match_reason,
        updated_at
      FROM tb_benninger_rtf_links
      WHERE (match_partida IS NULL OR TRIM(match_partida) = '')
        AND (match_mode IS NULL OR match_mode NOT LIKE '%no_apta%')
      ORDER BY comeco_ts ASC NULLS LAST, source_file ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset], 'benninger-rtf/sin-match')

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM tb_benninger_rtf_links
       WHERE (match_partida IS NULL OR TRIM(match_partida) = '')
         AND (match_mode IS NULL OR match_mode NOT LIKE '%no_apta%')`,
      [], 'benninger-rtf/sin-match-count'
    )

    res.json({ rows: result.rows, total: countResult.rows[0].total, limit, offset })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/sin-match:', err)
    res.status(500).json({ error: err.message })
  }
})

// Auditoría completa de la secuencia de archivos RTF Benninger.
// Devuelve todos los registros ordenados por el contador (NNN) del nombre de archivo.
// El registro sin sufijo numérico (el original) recibe seq_num = -1 para quedar primero.
app.get('/api/benninger-rtf/audit', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const result = await query(`
      SELECT
        source_file,
        COALESCE(
          (regexp_match(source_file, '\\((\\d+)\\)'))[1]::int,
          -1
        ) AS seq_num,
        receita,
        comeco_raw,
        to_char(comeco_ts, 'DD/MM/YY HH24:MI') AS comeco_fmt,
        comeco_ts,
        match_partida,
        match_rolada,
        match_score,
        match_confidence,
        match_mode,
        match_reason,
        raw_header->>'metros' AS metros_raw
      FROM tb_benninger_rtf_links
      ORDER BY
        COALESCE((regexp_match(source_file, '\\((\\d+)\\)'))[1]::int, -1) ASC,
        source_file ASC
    `, [], 'benninger-rtf/audit')

    res.json({ rows: result.rows, total: result.rows.length })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/audit:', err)
    res.status(500).json({ error: err.message })
  }
})

// Actualiza SOLO los campos de match de un registro ya existente en tb_benninger_rtf_links
// sin tocar raw_rtf_text, plain_text ni otros datos del archivo ya guardado.
app.patch('/api/benninger-rtf/relink', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) return res.status(400).json({ error: 'items requerido' })

    const saved  = []
    const errors = []

    for (const item of items) {
      const sourceFile = String(item?.sourceFile || '').trim()
      const partida    = String(item?.partida    || '').trim() || null
      const rolada     = String(item?.rolada     || '').trim() || null
      const reason     = String(item?.reason     || 'USER_MANUAL_RELINK').trim()
      const mode       = String(item?.mode       || 'manual').trim() || 'manual'
      const esNoApta   = mode.includes('no_apta')

      if (!sourceFile) { errors.push({ sourceFile: null, error: 'sourceFile requerido' }); continue }
      // Para no_apta no se exige partida/rolada (el RTF se descarta)
      if (!esNoApta && !partida && !rolada) { errors.push({ sourceFile, error: 'Se requiere partida o rolada' }); continue }

      // Verificar que el registro existe
      const exists = await query(
        'SELECT 1 FROM tb_benninger_rtf_links WHERE source_file = $1',
        [sourceFile], 'benninger-rtf/relink-check'
      )
      if (!exists.rows.length) { errors.push({ sourceFile, error: 'Registro no encontrado en BD' }); continue }

      await query(`
        UPDATE tb_benninger_rtf_links
        SET
          match_partida    = $2,
          match_rolada     = $3,
          match_score      = $4,
          match_confidence = 'manual',
          match_mode       = $5,
          match_reason     = $6,
          updated_at       = NOW()
        WHERE source_file = $1
      `, [sourceFile, partida, rolada, 100, mode, reason], 'benninger-rtf/relink-update')

      saved.push({ sourceFile, partida, rolada, mode })
    }

    res.json({ success: true, savedCount: saved.length, errorCount: errors.length, saved, errors })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/relink:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/benninger-rtf/logs', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const sourceFile = String(req.query?.sourceFile || '').trim() || null
    const partida = String(req.query?.partida || '').trim() || null
    const rolada = String(req.query?.rolada || '').trim() || null
    const section = String(req.query?.section || '').trim().toUpperCase() || null
    const tipo = String(req.query?.tipo || '').trim().toUpperCase() || null
    const codigo = String(req.query?.codigo || '').trim().toUpperCase() || null
    const severidad = String(req.query?.severidad || '').trim().toLowerCase() || null
    const limitRaw = Number(req.query?.limit)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.trunc(limitRaw))) : 500

    const sql = `
      SELECT
        e.source_file,
        l.match_partida,
        l.match_rolada,
        e.line_no,
        e.section,
        e.tipo,
        e.codigo,
        e.severidad,
        e.timestamp_raw,
        e.timestamp_ts,
        e.timestamp_end_raw,
        e.timestamp_end_ts,
        e.meter_pos,
        e.event_code,
        e.subsystem,
        e.machine_tag,
        e.mensaje,
        e.raw_line,
        e.parsed_json,
        COALESCE(e.parsed_json ->> 'fechaHoraInicialRaw', e.timestamp_raw) AS fecha_hora_inicial,
        COALESCE(e.parsed_json ->> 'fechaHoraFinalRaw', e.timestamp_end_raw) AS fecha_hora_final,
        COALESCE((e.parsed_json ->> 'metros')::int, e.meter_pos) AS metros,
        COALESCE(e.parsed_json ->> 'codigoParada', e.event_code) AS codigo_parada,
        COALESCE(e.parsed_json ->> 'descripcionParada', e.mensaje) AS descripcion_parada,
        COALESCE(e.parsed_json ->> 'codigoAlfanumerico', e.machine_tag) AS codigo_alfanumerico,
        COALESCE(e.parsed_json ->> 'setOldRaw', NULL) AS valor_old,
        COALESCE(e.parsed_json ->> 'setNewRaw', NULL) AS valor_new,
        COALESCE((e.parsed_json ->> 'setOldValue')::numeric, NULL) AS valor_old_num,
        COALESCE((e.parsed_json ->> 'setNewValue')::numeric, NULL) AS valor_new_num,
        COALESCE((e.parsed_json ->> 'setDeltaValue')::numeric, NULL) AS valor_delta,
        COALESCE(e.parsed_json ->> 'setpointCode', NULL) AS codigo_setpoint,
        COALESCE(e.parsed_json ->> 'setpointDescription', NULL) AS descripcion_setpoint
      FROM tb_benninger_rtf_eventos e
      INNER JOIN tb_benninger_rtf_links l ON l.source_file = e.source_file
      WHERE ($1::text IS NULL OR e.source_file = $1)
        AND ($2::text IS NULL OR (
          upper(btrim(COALESCE(l.match_partida, ''))) = upper(btrim($2))
          OR (
            regexp_replace(COALESCE(l.match_partida, ''), '\D', '', 'g') <> ''
            AND regexp_replace($2, '\D', '', 'g') <> ''
            AND COALESCE(NULLIF(ltrim(regexp_replace(COALESCE(l.match_partida, ''), '\D', '', 'g'), '0'), ''), '0')
              = COALESCE(NULLIF(ltrim(regexp_replace($2, '\D', '', 'g'), '0'), ''), '0')
          )
        ))
        AND ($3::text IS NULL OR upper(btrim(COALESCE(l.match_rolada, ''))) = upper(btrim($3)))
        AND ($4::text IS NULL OR upper(COALESCE(e.section, '')) = $4)
        AND ($5::text IS NULL OR upper(COALESCE(e.tipo, '')) = $5)
        AND ($6::text IS NULL OR upper(COALESCE(e.codigo, '')) = $6)
        AND ($7::text IS NULL OR lower(COALESCE(e.severidad, '')) = $7)
      ORDER BY e.timestamp_ts ASC NULLS LAST, e.line_no ASC NULLS LAST, e.id ASC
      LIMIT $8
    `

    const result = await query(
      sql,
      [sourceFile, partida, rolada, section, tipo, codigo, severidad, limit],
      'benninger-rtf/logs'
    )

    const rows = result.rows || []
    const byTipo = rows.reduce((acc, row) => {
      const key = String(row.tipo || 'N/A').toUpperCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const bySeveridad = rows.reduce((acc, row) => {
      const key = String(row.severidad || 'n/a').toLowerCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    res.json({
      success: true,
      total: rows.length,
      filters: { sourceFile, partida, rolada, section, tipo, codigo, severidad, limit },
      summary: { byTipo, bySeveridad },
      rows
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/logs:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/benninger-rtf/file', async (req, res) => {
  const sourceFile = String(req.query?.sourceFile || '').trim()
  if (!sourceFile) return res.status(400).json({ error: 'sourceFile required' })
  try {
    const r = await query(
      'SELECT raw_rtf_text FROM tb_benninger_rtf_links WHERE source_file = $1',
      [sourceFile], 'benninger-rtf/file'
    )
    const rtfText = r.rows?.[0]?.raw_rtf_text
    if (!rtfText) return res.status(404).json({ error: 'RTF not found' })
    res.setHeader('Content-Type', 'application/rtf')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(sourceFile)}"`)
    res.send(rtfText)
  } catch (err) {
    console.error('Error en /api/benninger-rtf/file:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/benninger-rtf/reprocess-logs', async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const sourceFilesIn = Array.isArray(req.body?.sourceFiles)
      ? req.body.sourceFiles.map((v) => String(v || '').trim()).filter(Boolean)
      : []
    const sourceFiles = [...new Set(sourceFilesIn)]
    const applyFilter = sourceFiles.length > 0

    const linksResult = await query(
      `
        SELECT
          source_file,
          raw_header,
          raw_rtf_text,
          plain_text,
          parse_version
        FROM tb_benninger_rtf_links
        WHERE ($1::boolean = FALSE OR source_file = ANY($2::text[]))
        ORDER BY updated_at DESC
      `,
      [applyFilter, sourceFiles],
      'benninger-rtf/reprocess-select-links'
    )

    const links = linksResult.rows || []
    let totalEvents = 0
    let withEvents = 0

    for (const link of links) {
      const sourceFile = String(link.source_file || '').trim()
      if (!sourceFile) continue

      const safeHeader = link.raw_header && typeof link.raw_header === 'object' ? link.raw_header : {}
      const safePlain = typeof link.plain_text === 'string' ? link.plain_text : null
      const safeRawRtf = typeof link.raw_rtf_text === 'string' ? link.raw_rtf_text : null
      const bundle = buildAmlCelBundle({
        header: safeHeader,
        plainText: safePlain,
        rawRtfText: safeRawRtf
      })

      const nextHeader = {
        ...safeHeader,
        amlCel: bundle.summary
      }
      const nextPlain = String(bundle.plainText || '').trim() || null
      const nextHash = safeRawRtf || nextPlain
        ? crypto.createHash('sha1').update(String(safeRawRtf || nextPlain)).digest('hex')
        : null
      const nextParseVersion = String(link.parse_version || BENNINGER_RTF_PARSE_VERSION).trim() || BENNINGER_RTF_PARSE_VERSION

      await query(
        `
          UPDATE tb_benninger_rtf_links
          SET
            raw_header = $2,
            plain_text = $3,
            rtf_hash = $4,
            parse_version = $5,
            updated_at = NOW()
          WHERE source_file = $1
        `,
        [sourceFile, JSON.stringify(nextHeader), nextPlain, nextHash, nextParseVersion],
        'benninger-rtf/reprocess-update-link'
      )

      await replaceBenningerRtfEvents(sourceFile, bundle.detailedEvents)

      totalEvents += bundle.detailedEvents.length
      if (bundle.detailedEvents.length > 0) withEvents += 1
    }

    res.json({
      success: true,
      processed: links.length,
      withEvents,
      totalEvents
    })
  } catch (err) {
    console.error('Error en /api/benninger-rtf/reprocess-logs:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get(['/api/benninger-impacto', '/api/benninger-impacto/:sourceFile'], async (req, res) => {
  try {
    await ensureBenningerRtfSchema()

    const partidaParam = String(req.query?.partida || '').trim()
    const sourceFileParam = String(req.query?.sourceFile || req.params?.sourceFile || '').trim()

    const linkSql = partidaParam
      ? `
          SELECT
            source_file,
            comeco_ts,
            match_partida,
            match_rolada,
            match_dt_inicio,
            match_hora_inicio,
            raw_header,
            raw_rtf_text,
            plain_text,
            parse_version,
            match_payload,
            updated_at
          FROM tb_benninger_rtf_links
          WHERE (
            upper(btrim(COALESCE(match_partida, ''))) = upper(btrim($1::text))
            OR (
              regexp_replace(COALESCE(match_partida, ''), '\\D', '', 'g') <> ''
              AND regexp_replace($1::text, '\\D', '', 'g') <> ''
              AND COALESCE(
                NULLIF(ltrim(regexp_replace(COALESCE(match_partida, ''), '\\D', '', 'g'), '0'), ''),
                '0'
              ) = COALESCE(
                NULLIF(ltrim(regexp_replace($1::text, '\\D', '', 'g'), '0'), ''),
                '0'
              )
            )
          )
          ORDER BY updated_at DESC
          LIMIT 1
        `
      : sourceFileParam
      ? `
          SELECT
            source_file,
            comeco_ts,
            match_partida,
            match_rolada,
            match_dt_inicio,
            match_hora_inicio,
            raw_header,
            raw_rtf_text,
            plain_text,
            parse_version,
            match_payload,
            updated_at
          FROM tb_benninger_rtf_links
          WHERE source_file = $1
          LIMIT 1
        `
      : `
          SELECT
            source_file,
            comeco_ts,
            match_partida,
            match_rolada,
            match_dt_inicio,
            match_hora_inicio,
            raw_header,
            raw_rtf_text,
            plain_text,
            parse_version,
            match_payload,
            updated_at
          FROM tb_benninger_rtf_links
          WHERE match_partida IS NOT NULL OR match_rolada IS NOT NULL
          ORDER BY updated_at DESC
          LIMIT 1
        `

    const linkResult = await query(
      linkSql,
      partidaParam ? [partidaParam] : (sourceFileParam ? [sourceFileParam] : []),
      partidaParam
        ? 'benninger-impacto/link-by-partida'
        : (sourceFileParam ? 'benninger-impacto/link-by-source' : 'benninger-impacto/link-latest')
    )

    const link = linkResult.rows?.[0]
    if (!link) {
      return res.status(404).json({
        success: false,
        error: partidaParam
          ? `No existe enlace Benninger para partida ${partidaParam}`
          : (sourceFileParam
              ? `No existe enlace Benninger para sourceFile ${sourceFileParam}`
              : 'No hay enlaces Benninger confirmados')
      })
    }

    const partida = String(link.match_partida || '').trim() || null
    const rolada = String(link.match_rolada || '').trim() || null
    const header = link.raw_header && typeof link.raw_header === 'object' ? link.raw_header : {}
    const bestCandidate = pickBestMatchCandidate(link.match_payload)

    let backupHeader = null
    if (link.source_file && await tableExists('tb_benninger_rtf_links_sim_backup')) {
      const backupResult = await query(
        `
          SELECT
            old_row->'raw_header' AS raw_header
          FROM tb_benninger_rtf_links_sim_backup
          WHERE source_file = $1
          ORDER BY backup_at DESC
          LIMIT 1
        `,
        [link.source_file],
        'benninger-impacto/backup-raw-header-by-source'
      )
      const raw = backupResult.rows?.[0]?.raw_header
      if (raw && typeof raw === 'object') {
        backupHeader = raw
      }
    }

    const processHeader = {
      ...header,
      ...(backupHeader || {})
    }

    if (!Number.isFinite(parseLooseNumber(processHeader?.velMMin)) && Number.isFinite(Number(bestCandidate?.velocidadeMediaPartida))) {
      processHeader.velMMin = `${Number(bestCandidate.velocidadeMediaPartida)} m/min`
    }
    if (!Number.isFinite(parseLooseNumber(processHeader?.metros)) && Number.isFinite(Number(bestCandidate?.metragemPartida))) {
      processHeader.metros = `${Number(bestCandidate.metragemPartida)} m`
    }
    if (!processHeader?.partidaOrigem && bestCandidate?.partida) {
      processHeader.partidaOrigem = String(bestCandidate.partida)
    }
    if (!processHeader?.roladaOrigem && bestCandidate?.rolada) {
      processHeader.roladaOrigem = String(bestCandidate.rolada)
    }
    const partidaNorm = normalizeDigitsKey(partida)
    const roladaNorm = normalizeDigitsKey(rolada)
    const roladaFromPartida = deriveRoladaFromPartida(partida)

    let lotesFiacion = []
    if (partidaNorm || roladaFromPartida || roladaNorm) {
      const lotesSql = `
        WITH prod AS (
          SELECT
            NULLIF(btrim(p."LOTE FIACAO"), '') AS lote_fiac,
            upper(btrim(COALESCE(p."SELETOR"::text, ''))) AS seletor,
            COALESCE(
              NULLIF(ltrim(regexp_replace(btrim(COALESCE(p."PARTIDA"::text, '')), '\\D', '', 'g'), '0'), ''),
              '0'
            ) AS partida_norm,
            COALESCE(
              NULLIF(ltrim(regexp_replace(btrim(COALESCE(p."ROLADA"::text, '')), '\\D', '', 'g'), '0'), ''),
              '0'
            ) AS rolada_norm
          FROM tb_produccion p
        )
        SELECT array_remove(array_agg(DISTINCT lote_fiac), NULL) AS lotes
        FROM prod
        WHERE lote_fiac IS NOT NULL
          AND seletor IN ('URDIDEIRA', 'URIDEIRA')
          AND (
            ($1::text IS NOT NULL AND $1::text <> '' AND partida_norm = $1::text)
            OR ($2::text IS NOT NULL AND $2::text <> '' AND rolada_norm = $2::text)
            OR ($3::text IS NOT NULL AND $3::text <> '' AND rolada_norm = $3::text)
          )
      `
      const lotesResult = await query(
        lotesSql,
        [partidaNorm, roladaFromPartida, roladaNorm],
        'benninger-impacto/lotes-by-partida-rolada-urdideira'
      )
      lotesFiacion = Array.isArray(lotesResult.rows?.[0]?.lotes)
        ? lotesResult.rows[0].lotes.map((l) => String(l || '').trim()).filter(Boolean)
        : []
    }

    const loteNumbers = extractLotNumbersFromText([
      ...lotesFiacion,
      partida,
      rolada,
      header?.idRolo,
      header?.lote,
      header?.mistura,
      header?.partida
    ])

    let fibra = {
      muestras: 0,
      mic: null,
      sci: null,
      str: null,
      uhml: null,
      elg: null,
      rd: null,
      plusB: null
    }

    if (lotesFiacion.length) {
      const fibraSql = `
        WITH lotes_input AS (
          SELECT unnest($1::text[]) AS lote_raw
        ),
        lotes_norm AS (
          SELECT DISTINCT
            COALESCE(
              NULLIF(ltrim(regexp_replace(btrim(COALESCE(lote_raw, '')), '\\D', '', 'g'), '0'), ''),
              '0'
            ) AS lote_norm
          FROM lotes_input
          WHERE NULLIF(btrim(COALESCE(lote_raw, '')), '') IS NOT NULL
        ),
        fibra_src AS (
          SELECT cf.*
          FROM tb_CALIDAD_FIBRA cf
          WHERE upper(btrim(COALESCE(cf."TIPO_MOV"::text, ''))) = 'MIST'
            AND (
              btrim(COALESCE(cf."LOTE_FIAC", '')) = ANY($1::text[])
              OR (
                regexp_replace(btrim(COALESCE(cf."LOTE_FIAC", '')), '\\D', '', 'g') <> ''
                AND COALESCE(
                  NULLIF(ltrim(regexp_replace(btrim(COALESCE(cf."LOTE_FIAC", '')), '\\D', '', 'g'), '0'), ''),
                  '0'
                ) IN (SELECT lote_norm FROM lotes_norm)
              )
            )
        )
        SELECT
          COUNT(*)::int AS muestras,
          AVG(${sqlParseNumberIntl('cf."MIC"')}) AS mic,
          AVG(${sqlParseNumberIntl('cf."SCI"')}) AS sci,
          AVG(${sqlParseNumberIntl('cf."STR"')}) AS str,
          AVG(${sqlParseNumberIntl('cf."UHML"')}) AS uhml,
          AVG(${sqlParseNumberIntl('cf."ELG"')}) AS elg,
          AVG(${sqlParseNumberIntl('cf."RD"')}) AS rd,
          AVG(${sqlParseNumberIntl('cf."PLUS_B"')}) AS plus_b
        FROM fibra_src cf
      `
      const fibraResult = await query(fibraSql, [lotesFiacion], 'benninger-impacto/fibra-by-lote-fiac-mist')
      if (fibraResult.rows?.[0]) {
        fibra = {
          muestras: Number(fibraResult.rows[0].muestras) || 0,
          mic: roundNullable(fibraResult.rows[0].mic, 3),
          sci: roundNullable(fibraResult.rows[0].sci, 3),
          str: roundNullable(fibraResult.rows[0].str, 3),
          uhml: roundNullable(fibraResult.rows[0].uhml, 3),
          elg: roundNullable(fibraResult.rows[0].elg, 3),
          rd: roundNullable(fibraResult.rows[0].rd, 3),
          plusB: roundNullable(fibraResult.rows[0].plus_b, 3)
        }
      }
    }

    if (fibra.muestras === 0 && loteNumbers.length) {
      const fibraFallbackSql = `
        WITH base AS (
          SELECT
            cf.*,
            COALESCE(
              NULLIF(ltrim(regexp_replace(btrim(COALESCE(cf."LOTE_FIAC", '')), '\\D', '', 'g'), '0'), ''),
              '0'
            ) AS lote_num
          FROM tb_CALIDAD_FIBRA cf
          WHERE upper(btrim(COALESCE(cf."TIPO_MOV"::text, ''))) = 'MIST'
        )
        SELECT
          COUNT(*)::int AS muestras,
          AVG(${sqlParseNumberIntl('b."MIC"')}) AS mic,
          AVG(${sqlParseNumberIntl('b."SCI"')}) AS sci,
          AVG(${sqlParseNumberIntl('b."STR"')}) AS str,
          AVG(${sqlParseNumberIntl('b."UHML"')}) AS uhml,
          AVG(${sqlParseNumberIntl('b."ELG"')}) AS elg,
          AVG(${sqlParseNumberIntl('b."RD"')}) AS rd,
          AVG(${sqlParseNumberIntl('b."PLUS_B"')}) AS plus_b
        FROM base b
        WHERE b.lote_num = ANY($1::text[])
      `
      const fibraFallbackResult = await query(
        fibraFallbackSql,
        [loteNumbers],
        'benninger-impacto/fibra-fallback-by-lote-number'
      )

      if (fibraFallbackResult.rows?.[0] && Number(fibraFallbackResult.rows[0].muestras) > 0) {
        fibra = {
          muestras: Number(fibraFallbackResult.rows[0].muestras) || 0,
          mic: roundNullable(fibraFallbackResult.rows[0].mic, 3),
          sci: roundNullable(fibraFallbackResult.rows[0].sci, 3),
          str: roundNullable(fibraFallbackResult.rows[0].str, 3),
          uhml: roundNullable(fibraFallbackResult.rows[0].uhml, 3),
          elg: roundNullable(fibraFallbackResult.rows[0].elg, 3),
          rd: roundNullable(fibraFallbackResult.rows[0].rd, 3),
          plusB: roundNullable(fibraFallbackResult.rows[0].plus_b, 3)
        }
      }
    }

    let usterPar = null
    let usterAgg = {
      cvm: null,
      neps: null,
      testnr: null,
      lote: null
    }

    if (loteNumbers.length) {
      const usterParSql = `
        WITH base AS (
          SELECT
            u.testnr,
            u.lote,
            u.nomcount,
            u.time_stamp,
            TO_DATE(SPLIT_PART(COALESCE(u.time_stamp, ''), ' ', 1), 'DD/MM/YYYY') AS fecha,
            COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            ) AS lote_num
          FROM tb_uster_par u
          WHERE u.lote IS NOT NULL
        )
        SELECT testnr, lote, nomcount, time_stamp, fecha
        FROM base
        WHERE lote_num = ANY($1::text[])
        ORDER BY
          CASE WHEN $2::date IS NULL OR fecha IS NULL THEN 1 ELSE 0 END ASC,
          CASE WHEN $2::date IS NULL OR fecha IS NULL THEN NULL ELSE ABS(fecha - $2::date) END ASC NULLS LAST,
          testnr DESC
        LIMIT 1
      `

      const usterParResult = await query(
        usterParSql,
        [loteNumbers, link.comeco_ts || null],
        'benninger-impacto/uster-par-by-lote'
      )
      usterPar = usterParResult.rows?.[0] || null

      if (usterPar?.testnr) {
        const usterAggSql = `
          SELECT
            ROUND(AVG(cvm_percent)::numeric, 3) AS cvm,
            ROUND(AVG(neps_200_km)::numeric, 3) AS neps
          FROM tb_uster_tbl
          WHERE testnr = $1
        `
        const usterAggResult = await query(usterAggSql, [usterPar.testnr], 'benninger-impacto/uster-agg-by-testnr')
        const row = usterAggResult.rows?.[0] || {}
        usterAgg = {
          cvm: row.cvm == null ? null : Number(row.cvm),
          neps: row.neps == null ? null : Number(row.neps),
          testnr: String(usterPar.testnr || '').trim() || null,
          lote: String(usterPar.lote || '').trim() || null
        }
      }
    }

    let tensorapidAgg = {
      tenacidad: null,
      elongacion: null,
      testnr: null,
      via: null
    }

    if (usterAgg.testnr) {
      const tensoFromUsterSql = `
        SELECT
          p.testnr,
          ROUND(AVG(t.tenacidad)::numeric, 3) AS tenacidad,
          ROUND(AVG(t.elongacion)::numeric, 3) AS elongacion
        FROM tb_tensorapid_par p
        JOIN tb_tensorapid_tbl t ON t.testnr = p.testnr
        WHERE p.uster_testnr = $1
        GROUP BY p.testnr
        ORDER BY p.testnr DESC
        LIMIT 1
      `
      const tensoFromUsterResult = await query(
        tensoFromUsterSql,
        [usterAgg.testnr],
        'benninger-impacto/tensorapid-by-uster-testnr'
      )

      const best = tensoFromUsterResult.rows?.[0]
      if (best) {
        tensorapidAgg = {
          tenacidad: best.tenacidad == null ? null : Number(best.tenacidad),
          elongacion: best.elongacion == null ? null : Number(best.elongacion),
          testnr: String(best.testnr || '').trim() || null,
          via: 'uster_testnr'
        }
      }
    }

    if (!tensorapidAgg.testnr && loteNumbers.length) {
      const tensoParByLoteSql = `
        WITH base AS (
          SELECT
            p.testnr,
            p.lote,
            p.time_stamp,
            TO_DATE(SPLIT_PART(COALESCE(p.time_stamp, ''), ' ', 1), 'DD/MM/YYYY') AS fecha,
            COALESCE(
              (regexp_match(p.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(p.lote, '(\\d+)'))[1]
            ) AS lote_num
          FROM tb_tensorapid_par p
          WHERE p.lote IS NOT NULL
        )
        SELECT testnr, lote, fecha
        FROM base
        WHERE lote_num = ANY($1::text[])
        ORDER BY
          CASE WHEN $2::date IS NULL OR fecha IS NULL THEN 1 ELSE 0 END ASC,
          CASE WHEN $2::date IS NULL OR fecha IS NULL THEN NULL ELSE ABS(fecha - $2::date) END ASC NULLS LAST,
          testnr DESC
        LIMIT 1
      `

      const tensoParByLoteResult = await query(
        tensoParByLoteSql,
        [loteNumbers, link.comeco_ts || null],
        'benninger-impacto/tensorapid-par-by-lote'
      )
      const tensoParByLote = tensoParByLoteResult.rows?.[0]

      if (tensoParByLote?.testnr) {
        const tensoAggSql = `
          SELECT
            ROUND(AVG(tenacidad)::numeric, 3) AS tenacidad,
            ROUND(AVG(elongacion)::numeric, 3) AS elongacion
          FROM tb_tensorapid_tbl
          WHERE testnr = $1
        `
        const tensoAggResult = await query(
          tensoAggSql,
          [tensoParByLote.testnr],
          'benninger-impacto/tensorapid-agg-by-testnr'
        )
        const row = tensoAggResult.rows?.[0] || {}
        tensorapidAgg = {
          tenacidad: row.tenacidad == null ? null : Number(row.tenacidad),
          elongacion: row.elongacion == null ? null : Number(row.elongacion),
          testnr: String(tensoParByLote.testnr || '').trim() || null,
          via: 'lote'
        }
      }
    }

    const proceso = {
      ...buildBenningerProcessFromHeader(processHeader, {
        plainText: link.plain_text,
        rawRtfText: link.raw_rtf_text
      }),
      origen: backupHeader ? 'source_file+backup_raw_header' : 'source_file_raw_header',
      parseVersion: link.parse_version || BENNINGER_RTF_PARSE_VERSION,
      partidaOrigem: processHeader.partidaOrigem || null,
      roladaOrigem: processHeader.roladaOrigem || null
    }

    res.json({
      success: true,
      sourceFile: link.source_file,
      rawRtfText: link.raw_rtf_text || null,
      match: {
        partida,
        rolada,
        dtInicio: link.match_dt_inicio || null,
        horaInicio: link.match_hora_inicio || null,
        comecoTs: link.comeco_ts || null,
        roladaDerivada: roladaFromPartida,
        lotesFiacion,
        loteNumbers
      },
      laboratorio: {
        elongacionInicial: tensorapidAgg.elongacion,
        cvm: usterAgg.cvm,
        tenacidad: tensorapidAgg.tenacidad,
        neps: usterAgg.neps,
        sci: fibra.sci,
        mic: fibra.mic,
        str: fibra.str,
        uhml: fibra.uhml,
        elg: fibra.elg,
        rd: fibra.rd,
        plusB: fibra.plusB
      },
      proceso,
      referencias: {
        uster: {
          testnr: usterAgg.testnr,
          lote: usterAgg.lote
        },
        tensorapid: {
          testnr: tensorapidAgg.testnr,
          via: tensorapidAgg.via
        },
        fibra: {
          muestras: fibra.muestras,
          lotes: lotesFiacion,
          sci: fibra.sci,
          mic: fibra.mic,
          str: fibra.str,
          uhml: fibra.uhml,
          elg: fibra.elg,
          rd: fibra.rd,
          plusB: fibra.plusB
        }
      }
    })
  } catch (err) {
    console.error('Error en /api/benninger-impacto:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// =====================================================
// ENDPOINTS USTER
// =====================================================

// USTER: Check status
app.post('/api/uster/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || testnrs.length === 0) {
    return res.status(400).json({ error: 'testnrs must be a non-empty array' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_uster_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(row => row.testnr) })
  } catch (err) {
    console.error('❌ Error en /api/uster/status:', err.message)
    // Devolver array vacío en lugar de error para no romper la UI
    res.json({ existing: [] })
  }
})

// USTER: Get PAR
app.get('/api/uster/par', async (req, res) => {
  try {
    const result = await query(`SELECT testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs, created_at, updated_at FROM tb_uster_par ORDER BY testnr`)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get TBL
app.get('/api/uster/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno` 
      : `SELECT * FROM tb_uster_tbl ORDER BY testnr, seqno`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get husos
app.post('/api/uster/husos', async (req, res) => {
  const { testnr } = req.body
  if (!testnr) return res.status(400).json({ error: 'testnr is required' })
  try {
    const result = await query(`SELECT no_ FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno`, [testnr])
    res.json({ husos: result.rows.map(r => r.no_).filter(Boolean) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Husos' })
  }
})

// USTER: Upload
app.post('/api/uster/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing PAR data or TESTNR' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (testnr) DO UPDATE SET 
        nomcount=EXCLUDED.nomcount, 
        maschnr=EXCLUDED.maschnr, 
        lote=EXCLUDED.lote, 
        laborant=EXCLUDED.laborant, 
        time_stamp=EXCLUDED.time_stamp, 
        matclass=EXCLUDED.matclass, 
        estiraje=EXCLUDED.estiraje, 
        pasador=EXCLUDED.pasador, 
        obs=EXCLUDED.obs
    `, [par.TESTNR, par.NOMCOUNT, par.MASCHNR, par.LOTE, par.LABORANT, par.TIME_STAMP, par.MATCLASS, par.ESTIRAJE, par.PASADOR, par.OBS])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_uster_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Helper function to convert values to numbers, preserving zeros
    const toNum = (val) => {
      if (val == null || val === '') return null
      const num = parseFloat(val)
      return isNaN(num) ? null : num
    }
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      // DEBUG: Log first row to see what values are arriving
      if (tbl.length > 0) {
        console.log('[DEBUG USTER TBL Row 1]', JSON.stringify(tbl[0], null, 2))
      }
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        const params = [
          par.TESTNR, i+1, r.NO_, 
          toNum(r.U_PERCENT), toNum(r.CVM_PERCENT), toNum(r.INDICE_PERCENT),
          toNum(r.CVM_1M_PERCENT), toNum(r.CVM_3M_PERCENT), toNum(r.CVM_10M_PERCENT),
          toNum(r.TITULO), toNum(r.TITULO_REL_PERC),
          toNum(r.H), toNum(r.SH), toNum(r.SH_1M), toNum(r.SH_3M), toNum(r.SH_10M),
          toNum(r.DELG_MINUS30_KM), toNum(r.DELG_MINUS40_KM),
          toNum(r.DELG_MINUS50_KM), toNum(r.DELG_MINUS60_KM),
          toNum(r.GRUE_35_KM), toNum(r.GRUE_50_KM), toNum(r.GRUE_70_KM),
          toNum(r.GRUE_100_KM),
          toNum(r.NEPS_140_KM), toNum(r.NEPS_200_KM), toNum(r.NEPS_280_KM), toNum(r.NEPS_400_KM)
        ]
        if (i === 0) {
          console.log('[DEBUG INSERT params row 1]', params.slice(0, 10))
        }
        await client.query(`
          INSERT INTO tb_uster_tbl (
            testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo, titulo_rel_perc,
            h, sh, sh_1m, sh_3m, sh_10m, delg_minus30_km, delg_minus40_km,
            delg_minus50_km, delg_minus60_km, grue_35_km, grue_50_km, grue_70_km,
            grue_100_km, neps_140_km, neps_200_km, neps_280_km, neps_400_km
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
          )`,
          params
        )
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR, tblRows: tbl?.length || 0 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading Uster:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// USTER: Delete
app.delete('/api/uster/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_uster_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS TENSORAPID
// =====================================================

// TENSORAPID: Status
app.post('/api/tensorapid/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || !testnrs.length) {
    return res.status(400).json({ error: 'testnrs required' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_tensorapid_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(r => r.testnr) })
  } catch (err) { 
    res.status(500).json({ error: 'Failed' }) 
  }
})

// TENSORAPID: Get PAR
app.get('/api/tensorapid/par', async (req, res) => {
  try {
    const result = await query(`
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant 
      FROM tb_tensorapid_par 
      ORDER BY testnr
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// TENSORAPID: Get TBL
app.get('/api/tensorapid/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_tensorapid_tbl WHERE testnr = $1 ORDER BY id` 
      : `SELECT * FROM tb_tensorapid_tbl ORDER BY testnr, id`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// CALIDAD FIBRA: Get all
app.get('/api/calidad-fibra', async (req, res) => {
  try {
    const result = await query(`
      SELECT "LOTE_FIAC", "PESO", "MISTURA", "SEQ", "DT_ENTRADA_PROD", "HR_ENTRADA_PROD",
             "SCI", "MST", "MIC", "MAT", "UHML", "UI", "SF", 
             "STR", "ELG", "RD", "PLUS_B", "TIPO", "TrCNT", "TrAR", "TRID"
      FROM tb_CALIDAD_FIBRA
      WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
        AND "TIPO_MOV" = 'MIST'
      ORDER BY "MISTURA", "SEQ"
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Summary
app.get('/api/golden-batch/summary', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Summary...');
  try {
    const result = await query(`
      SELECT 
        CASE 
          WHEN "EFIC_TEJ" >= 90 THEN 'EXITO (>90%)' 
          WHEN "EFIC_TEJ" < 85 THEN 'BAJA (<85%)' 
          ELSE 'NORMAL' 
        END as estado, 
        COUNT(*) as volumen, 
        ROUND(AVG("SCI"), 1) as sci, 
        ROUND(AVG("STR"), 1) as str, 
        ROUND(AVG("MIC"), 2) as mic, 
        ROUND(AVG("RU_105"), 1) as rot_urd 
      FROM view_golden_batch_data 
      GROUP BY 1 
      ORDER BY MIN("EFIC_TEJ") DESC
    `, [], 'GoldenBatchSummary')
    console.log('>>> [GOLDEN BATCH] Summary Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Summary ERROR:', err.message);
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Points
app.get('/api/golden-batch/points', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Points...');
  try {
    const result = await query(`
      SELECT 
        "ROLADA",
        "DATA", 
        "TURNO", 
        "ARTICULO", 
        "TEJIDO_REAL_M", 
        "EFIC_TEJ", 
        "RU_105",
        "RT_105",
        "ROT_URD_URDI",
        "INDIGO_FECHA",
        "INDIGO_BASE",
        "INDIGO_COLOR",
        "INDIGO_R",
        "INDIGO_CAVALOS",
        "INDIGO_VEL_NOM",
        "INDIGO_VEL_REAL",
        "LOTE_FIBRA_TEXT",
        "MISTURA",
        "SCI", 
        "STR", 
        "MIC"
      FROM view_golden_batch_data 
      ORDER BY "DATA" DESC
    `, [], 'GoldenBatchPoints')
    console.log('>>> [GOLDEN BATCH] Points Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Points ERROR:', err.message);
    res.status(500).json({ error: err.message })
  }
})

// TENSORAPID: Upload
app.post('/api/tensorapid/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing data' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) 
      ON CONFLICT (testnr) DO UPDATE SET 
        ne_titulo=EXCLUDED.ne_titulo, 
        titulo=EXCLUDED.titulo, 
        comment_text=EXCLUDED.comment_text, 
        long_prueba=EXCLUDED.long_prueba, 
        time_stamp=EXCLUDED.time_stamp, 
        lote=EXCLUDED.lote, 
        ne_titulo_type=EXCLUDED.ne_titulo_type,
        uster_testnr=EXCLUDED.uster_testnr,
        laborant=EXCLUDED.laborant
    `, [par.TESTNR, par.NE_TITULO, par.TITULO, par.COMMENT_TEXT, par.LONG_PRUEBA, par.TIME_STAMP, par.LOTE, par.NE_TITULO_TYPE, par.USTER_TESTNR, par.LABORANT])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_tensorapid_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tb_tensorapid_tbl (
            testnr, huso_number, tiempo_rotura, fuerza_b, elongacion, tenacidad, trabajo, huso_ensayos
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          par.TESTNR, 
          r.HUSO_NUMBER, 
          parseFloat(r.TIEMPO_ROTURA)||null, 
          parseFloat(r.FUERZA_B)||null, 
          parseFloat(r.ELONGACION)||null, 
          parseFloat(r.TENACIDAD)||null, 
          parseFloat(r.TRABAJO)||null, 
          r.HUSO_ENSAYOS
        ])
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading TensoRapid:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// TENSORAPID: Delete
app.delete('/api/tensorapid/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_tensorapid_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS INDIGO
// =====================================================
app.get('/api/residuos-indigo-tejeduria', async (req, res) => {
  try {
    const requiredTables = [
      'tb_produccion',
      'tb_fichas',
      'tb_residuos_indigo',
      'tb_residuos_por_sector',
      'tb_paradas'
    ]
    const ready = await Promise.all(requiredTables.map(tableExists))
    if (!ready.every(Boolean)) {
      return res.json([])
    }

    const { fecha_inicio, fecha_fin } = req.query
    const fechaInicio = fecha_inicio ? dateVariants(fecha_inicio).iso : null
    const fechaFin = fecha_fin ? dateVariants(fecha_fin).iso : null

    const fichasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_fichas'`,
      [],
      'tb-fichas-columns'
    )
    const fichasCols = new Map(
      (fichasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const consumoKey = ['cons#urd/m', 'consumo'].find((c) => fichasCols.has(c))
    const sizingKey = ['enc#tec#urdume', 'sizing'].find((c) => fichasCols.has(c))
    const consumoCol = consumoKey ? fichasCols.get(consumoKey) : null
    const sizingCol = sizingKey ? fichasCols.get(sizingKey) : null
    const consumoNum = consumoCol ? sqlParseNumber(quoteIdent(consumoCol)) : 'NULL::numeric'
    const sizingNum = sizingCol ? sqlParseNumber(quoteIdent(sizingCol)) : 'NULL::numeric'

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const urdumeKey = ['urdume', 'base urdume'].find((c) => prodCols.has(c))
    const urdumeCol = urdumeKey ? prodCols.get(urdumeKey) : null
    const urdumeExprProd = urdumeCol ? `P.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const urdumeExprTej = urdumeCol ? `T.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const prodDateKey = ['dt_base_producao', 'data_base'].find((c) => prodCols.has(c))
    const prodDateCol = prodDateKey ? prodCols.get(prodDateKey) : null
    const prodDateExpr = prodDateCol ? `P.${quoteIdent(prodDateCol)}` : 'NULL::text'
    const tejDateExpr = prodDateCol ? `T.${quoteIdent(prodDateCol)}` : 'NULL::text'

    const paradasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_paradas'`,
      [],
      'tb-paradas-columns'
    )
    const parCols = new Map(
      (paradasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const parDateKey = ['dt_base_producao', 'data_base'].find((c) => parCols.has(c))
    const parDateCol = parDateKey ? parCols.get(parDateKey) : null
    const parDateExpr = parDateCol ? `"${parDateCol}"` : 'NULL::text'
    const parMotivoKey = ['motivo', 'motivo1'].find((c) => parCols.has(c))
    const parMotivoCol = parMotivoKey ? parCols.get(parMotivoKey) : null
    const parMotivoExpr = parMotivoCol ? quoteIdent(parMotivoCol) : 'NULL::text'
    const metragemNum = sqlParseNumberIntl('P."METRAGEM"')
    const metragemTejNum = sqlParseNumberIntl('T."METRAGEM"')
    const residuosNum = sqlParseNumber('R."PESO LIQUIDO (KG)"')
    const residuosTejNum = sqlParseNumber('RS."PESO LIQUIDO (KG)"')
    const residuosPrensNum = sqlParseNumber('RP."PESO LIQUIDO (KG)"')

    const dateExpr = sqlParseDate('D.fecha')
    const dateFilter = fechaInicio && fechaFin ? `WHERE ${dateExpr} BETWEEN $1::date AND $2::date` : ''
    const params = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : []

    const sql = `
      WITH FICHAS_UNIQUE AS (
        SELECT
          btrim("URDUME") AS URDUME,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME")
      ),
      FICHAS_ARTIGO AS (
        SELECT
          btrim("URDUME") AS URDUME,
          btrim("ARTIGO") AS ARTIGO,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME"), btrim("ARTIGO")
      ),
      PRODUCCION_IND AS (
        SELECT
          ${prodDateExpr} AS DT_BASE_PRODUCAO,
          SUM(${metragemNum}) AS TotalMetros,
          (SUM(${metragemNum} * FU.CONSUMO) / 1000) * 0.98 AS TotalKg
        FROM tb_produccion P
        JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprProd}) = FU.URDUME
        WHERE P."SELETOR" = 'INDIGO' AND P."FILIAL" = '05'
        GROUP BY ${prodDateExpr}
      ),
      TEJEDURIA_RAW AS (
        SELECT
          ${tejDateExpr} AS DT_BASE_PRODUCAO,
          ${metragemTejNum} AS Metros,
          COALESCE(FA.CONSUMO, FU.CONSUMO) AS Consumo,
          COALESCE(FA.SIZING, FU.SIZING, 0) AS Sizing
        FROM tb_produccion T
        LEFT JOIN FICHAS_ARTIGO FA ON btrim(${urdumeExprTej}) = FA.URDUME AND T."ARTIGO" LIKE FA.ARTIGO || '%'
        LEFT JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprTej}) = FU.URDUME
        WHERE T."SELETOR" = 'TECELAGEM' AND T."FILIAL" = '05'
      ),
      PRODUCCION_TEJ AS (
        SELECT
          DT_BASE_PRODUCAO,
          SUM(Metros) AS TejeduriaMetros,
          SUM(Metros * Consumo / NULLIF(1 - (Sizing / 100), 0)) / 1000 AS TejeduriaKg
        FROM TEJEDURIA_RAW
        GROUP BY DT_BASE_PRODUCAO
      ),
      RES_IND AS (
        SELECT R."DT_MOV" AS DT_MOV, SUM(${residuosNum}) AS ResiduosKg
        FROM tb_residuos_indigo R
        WHERE btrim(R."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY R."DT_MOV"
      ),
      RES_TEJ AS (
        SELECT RS."DT_MOV" AS DT_MOV, SUM(${residuosTejNum}) AS ResiduosTejeduriaKg
        FROM tb_residuos_por_sector RS
        WHERE btrim(RS."DESCRICAO") = 'ESTOPA AZUL TEJEDURÍA'
        GROUP BY RS."DT_MOV"
      ),
      RES_PRENSA AS (
        SELECT RP."DT_MOV" AS DT_MOV, SUM(${residuosPrensNum}) AS ResiduosPrensadaKg
        FROM tb_residuos_por_sector RP
        WHERE btrim(RP."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY RP."DT_MOV"
      ),
      ANUDADOS AS (
        SELECT ${parDateExpr} AS DT_BASE_PRODUCAO, COUNT(*)::int AS AnudadosCount
        FROM tb_paradas
        WHERE ${sqlParseNumber(parMotivoExpr)} = 101
        GROUP BY ${parDateExpr}
      ),
      ALL_DATES AS (
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_IND
        UNION
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_IND
        UNION
        SELECT DT_MOV AS fecha FROM RES_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_PRENSA
      )
      SELECT
        D.fecha AS "DT_BASE_PRODUCAO",
        COALESCE(PI.TotalMetros, 0) AS "TotalMetros",
        COALESCE(PI.TotalKg, 0) AS "TotalKg",
        COALESCE(RI.ResiduosKg, 0) AS "ResiduosKg",
        COALESCE(PT.TejeduriaMetros, 0) AS "TejeduriaMetros",
        COALESCE(PT.TejeduriaKg, 0) AS "TejeduriaKg",
        COALESCE(RT.ResiduosTejeduriaKg, 0) AS "ResiduosTejeduriaKg",
        COALESCE(A.AnudadosCount, 0) AS "AnudadosCount",
        COALESCE(RP.ResiduosPrensadaKg, 0) AS "ResiduosPrensadaKg"
      FROM ALL_DATES D
      LEFT JOIN PRODUCCION_IND PI ON PI.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN PRODUCCION_TEJ PT ON PT.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN RES_IND RI ON RI.DT_MOV = D.fecha
      LEFT JOIN RES_TEJ RT ON RT.DT_MOV = D.fecha
      LEFT JOIN RES_PRENSA RP ON RP.DT_MOV = D.fecha
      LEFT JOIN ANUDADOS A ON A.DT_BASE_PRODUCAO = D.fecha
      ${dateFilter}
      ORDER BY ${dateExpr} ASC NULLS LAST
    `

    const result = await query(sql, params, 'residuos-indigo-tejeduria')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-tejeduria:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "PARTIDA" AS "PARTIDA",
        "ROLADA" AS "ROLADA",
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        "URDUME" AS "URDUME",
        "PE DE ROLO" AS "PE DE ROLO",
        "INDIGO" AS "INDIGO",
        "GAIOLA" AS "GAIOLA",
        "OBS" AS "OBS"
      FROM tb_residuos_indigo
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos-sector', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "OBS" AS "OBS"
      FROM tb_residuos_por_sector
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
        AND btrim("DESC_SETOR") = 'TECELAGEM'
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos-sector')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos-sector:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-analisis', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) AS "TotalKg"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "MOTIVO", "DESC_MOTIVO"
      HAVING SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) > 0
      ORDER BY "TotalKg" DESC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-analisis')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-analisis:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-mes', async (req, res) => {
  try {
    const sql = `
      WITH BASE AS (
        SELECT ${sqlParseDate('"DT_MOV"')} AS DT,
               ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS PESO
        FROM tb_residuos_indigo
        WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
      )
      SELECT
        to_char(DT, 'YYYY-MM') AS "Mes",
        COALESCE(ROUND(SUM(PESO)), 0)::int AS "KgResiduo"
      FROM BASE
      WHERE DT IS NOT NULL
        AND DT >= (date_trunc('month', current_date) - interval '11 months')
      GROUP BY 1
      ORDER BY 1
    `
    const result = await query(sql, [], 'residuos-indigo-estopa-por-mes')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-mes:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-dia', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "DT_MOV" AS "Fecha",
        COALESCE(ROUND(SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')})), 0)::int AS "KgResiduo"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "DT_MOV"
      ORDER BY ${sqlParseDate('"DT_MOV"')} ASC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-estopa-por-dia')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-dia:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion-indigo-resumen', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT "S" AS "S", COUNT(*)::int AS "count"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "S"
      ORDER BY "S"
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'produccion-indigo-resumen')
    res.json({ s_valores: result.rows })
  } catch (err) {
    console.error('Error en produccion-indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-indigo', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "ROLADA" AS "ROLADA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        "S" AS "S",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        ${sqlParseNumberIntl('"CAVALOS"')} AS "CAVALOS",
        "OPERADOR" AS "OPERADOR",
        "NM OPERADOR" AS "NM_OPERADOR"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-indigo:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-urdimbre', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "ARTIGO" AS "ARTIGO",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        ${sqlParseNumberIntl('"NUM_FIOS"')} AS "NUM_FIOS",
        ${sqlParseNumberIntl('"RUP FIACAO"')} AS "RUP_FIACAO",
        ${sqlParseNumberIntl('"RUP URD"')} AS "RUP_URD",
        ${sqlParseNumberIntl('"RUP OPER"')} AS "RUP_OPER",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        "NM OPERADOR" AS "NM_OPERADOR",
        "LOTE FIACAO" AS "LOTE_FIACAO",
        "MAQ FIACAO" AS "MAQ_FIACAO",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA') 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-urdimbre')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-urdimbre:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-tecelagem', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const eficienciaNum = sqlParseNumberIntl('"EFICIENCIA"')
    const paradaTramaNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')
    const rpmNum = sqlParseNumberIntl('"RPM NOMINALTEAR"')
    const batidasNum = sqlParseNumberIntl('"BATIDAS"')

    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MIN("DT_INICIO") AS "FECHA_INICIAL",
        MAX("DT_FINAL") AS "FECHA_FINAL",
        SUM(${metragemNum}) AS "METRAGEM",
        MAX("MAQUINA") AS "MAQUINA",
        AVG(${eficienciaNum}) AS "EFICIENCIA",
        ROUND((SUM(${paradaTramaNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((SUM(${paradaUrdNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_URD_105",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERCADO") AS "NM_MERCADO",
        SUM(${batidasNum}) AS "PASADAS",
        AVG(${rpmNum}) AS "RPM"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      GROUP BY "PARTIDA", "MAQUINA", "ARTIGO", "COR", "NM MERCADO"
      ORDER BY substring("PARTIDA" from '.{6}$') ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-tecelagem', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    const cor = String(req.query.cor || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })

    const sortDir = cor.length === 4 ? 'DESC' : 'ASC'
    const sql = `
      SELECT
        "DT_BASE_PRODUCAO" AS "DT_BASE_PRODUCAO",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"PARADA TEC TRAMA"')} AS "PARADA_TRAMA",
        ${sqlParseNumberIntl('"PARADA TEC URDUME"')} AS "PARADA_URDUME",
        ${sqlParseNumberIntl('"EFICIENCIA"')} AS "EFICIENCIA",
        ROUND((${sqlParseNumberIntl('"PARADA TEC TRAMA"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((${sqlParseNumberIntl('"PARADA TEC URDUME"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_URD_105",
        ${sqlParseNumberIntl('"BATIDAS"')} AS "BATIDAS",
        ${sqlParseNumberIntl('"RPM NOMINALTEAR"')} AS "RPM",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        "NM MERCADO" AS "NM_MERCADO",
        "MAQUINA" AS "MAQUINA",
        "GRUPO TEAR" AS "GRUPO_TEAR",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' AND "PARTIDA" = $1
      ORDER BY ${sqlParseDate('"DT_BASE_PRODUCAO"')} ${sortDir}, "TURNO" ${sortDir}
    `

    const result = await query(sql, [partida], 'consulta-partida-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-calidad', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MAX("ST IND") AS "ST_IND",
        MAX("REPROCESSO") AS "REPROCESSO",
        MAX("TEAR") AS "TEAR",
        SUM(${metragemNum}) AS "METRAGEM_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(CASE WHEN "QUALIDADE" NOT ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA",
        SUM(CASE WHEN "GRP_DEF" = 'HIL' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_HIL",
        SUM(CASE WHEN "GRP_DEF" = 'IND' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_IND",
        SUM(CASE WHEN "GRP_DEF" = 'TE' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TE",
        SUM(CASE WHEN "GRP_DEF" = 'TEF' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TEF",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERC") AS "NM_MERCADO",
        MAX("TRAMA") AS "TRAMA"
      FROM tb_calidad
      WHERE (LTRIM("ROLADA", '0') = LTRIM($1, '0') OR LTRIM(substring(right("PARTIDA", 6) from 1 for 4), '0') = LTRIM($1, '0'))
      GROUP BY "PARTIDA", "TEAR", "ARTIGO", "COR", "NM MERC", "TRAMA"
      ORDER BY "PARTIDA" ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-calidad', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })
    const sql = `
      SELECT
        "GRP_DEF" AS "GRP_DEF",
        "COD_DE" AS "COD_DE",
        "DEFEITO" AS "DEFEITO",
        ${sqlParseNumber('"METRAGEM"')} AS "METRAGEM",
        "QUALIDADE" AS "QUALIDADE",
        "HORA" AS "HORA",
        "EMENDAS" AS "EMENDAS",
        "PEÇA" AS "PECA",
        "ETIQUETA" AS "ETIQUETA",
        ${sqlParseNumber('"LARGURA"')} AS "LARGURA",
        ${sqlParseNumber('"PONTUACAO"')} AS "PONTUACAO",
        "REVISOR FINAL" AS "REVISOR_FINAL"
      FROM tb_calidad
      WHERE "PARTIDA" = $1
      ORDER BY "HORA" ASC
    `
    const result = await query(sql, [partida], 'consulta-partida-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

async function getSeguimientoRoladasData(fechaInicio, fechaFin) {
  // Obtener columnas de tb_produccion para detección dinámica de MAQ y LOTE
  const produccionColumns = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
    [],
    'tb-produccion-columns-seguimiento'
  );
  const prodCols = new Map(
    (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
  );
  
  const maqKey = ['maq  fiacao', 'maq fiacao', 'maquina'].find((c) => prodCols.has(c));
  const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c));
  const maqCol = maqKey ? prodCols.get(maqKey) : null;
  const loteCol = loteKey ? prodCols.get(loteKey) : null;
  const maqExpr = maqCol ? quoteIdent(maqCol) : 'NULL::text';
  const loteExpr = loteCol ? quoteIdent(loteCol) : 'NULL::text';

  const metragemNum = sqlParseNumberIntl('"METRAGEM"')
  const rupturasNum = sqlParseNumberIntl('"RUPTURAS"')
  const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
  const velocNum = sqlParseNumberIntl('"VELOC"')
  const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
  const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
  const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
  const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

  const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
  const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
  const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

  const sql = `
    WITH IND AS (
      SELECT
        "ROLADA" AS ROLADA,
        MAX("DT_BASE_PRODUCAO") AS FECHA,
        MAX("ARTIGO") AS BASE,
        string_agg(DISTINCT "COR", ', ') AS COLOR,
        SUM(${metragemNum}) AS MTS_IND,
        SUM(${rupturasNum}) AS RUPTURAS,
        SUM(${cavalosNum}) AS CAV,
        MAX(${velocNum}) AS VEL_NOM,
        SUM(${metragemNum} * COALESCE(${velocNum}, 0)) / NULLIF(SUM(${metragemNum}), 0) AS VEL_PROM
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND "FILIAL" = '05'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "ROLADA"
    ),
    URD AS (
      SELECT
        "ROLADA" AS ROLADA,
        string_agg(
          DISTINCT CAST(
            NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
          )::text,
          ', '
        ) AS MAQ_OE,
        string_agg(
          DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
          ', '
        ) AS LOTE,
        SUM(${metragemNum}) AS URDIDORA_METROS,
        SUM(${rupturasNum}) AS URDIDORA_ROTURAS,
        MAX(${sqlParseNumberIntl('"NUM_FIOS"')}) AS NUM_FIOS
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    TEC AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${metragemNum}) AS MTS_CRUDOS,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0))::numeric / NULLIF(SUM(COALESCE(${puntos100Num}, 0)), 0)) * 100, 2) AS EFI_TEJ,
        SUM(${parTraNum}) AS PARADA_TRAMA,
        SUM(${parUrdNum}) AS PARADA_URD
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM'
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    CAL AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${calMetragemNum}) AS MTS_CAL,
        SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) AS METROS_1ERA,
        SUM(COALESCE(${calPontuacaoNum}, 0)) AS PONTOS,
        AVG(${calLarguraNum}) AS LARGURA
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    )
    SELECT
      IND.ROLADA AS "ROLADA",
      URD.MAQ_OE AS "MAQ_OE",
      URD.LOTE AS "LOTE",
      URD.URDIDORA_METROS AS "URDIDORA_METROS",
      URD.URDIDORA_ROTURAS AS "URDIDORA_ROTURAS",
      URD.NUM_FIOS AS "NUM_FIOS",
      IND.FECHA AS "FECHA",
      IND.BASE AS "BASE",
      IND.COLOR AS "COLOR",
      IND.MTS_IND AS "MTS_IND",
      ROUND(((IND.RUPTURAS * 1000) / NULLIF(IND.MTS_IND, 0))::numeric, 2) AS "R103",
      IND.CAV AS "CAV",
      IND.VEL_NOM AS "VEL_NOM",
      IND.VEL_PROM AS "VEL_PROM",
      TEC.MTS_CRUDOS AS "MTS_CRUDOS",
      TEC.EFI_TEJ AS "EFI_TEJ",
      ROUND(((TEC.PARADA_URD * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RU105",
      ROUND(((TEC.PARADA_TRAMA * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RT105",
      CAL.MTS_CAL AS "MTS_CAL",
      ROUND(((CAL.METROS_1ERA / NULLIF(CAL.MTS_CAL, 0)) * 100)::numeric, 1) AS "CAL_PERCENT",
      ROUND(((CAL.PONTOS * 100) / NULLIF((CAL.MTS_CAL * NULLIF(CAL.LARGURA, 0) / 100), 0))::numeric, 1) AS "PTS_100M2",
      IND.RUPTURAS AS "RUPTURAS"
    FROM IND
    LEFT JOIN URD ON URD.ROLADA = IND.ROLADA
    LEFT JOIN TEC ON TEC.ROLADA = IND.ROLADA
    LEFT JOIN CAL ON CAL.ROLADA = IND.ROLADA
    ORDER BY IND.ROLADA::int ASC
  `

  const result = await query(sql, [fechaInicio, fechaFin], 'seguimiento-roladas')
  const datos = result.rows || []

  const totales = datos.reduce(
    (acc, row) => {
      const mtsInd = Number(row.MTS_IND) || 0
      const mtsUrd = Number(row.URDIDORA_METROS) || 0
      const mtsTej = Number(row.MTS_CRUDOS) || 0
      const mtsCal = Number(row.MTS_CAL) || 0
      const rupturas = Number(row.RUPTURAS) || 0

      acc.TOTAL_ROLADAS += 1
      acc.MTS_IND += mtsInd
      acc.RUPTURAS += rupturas
      acc.CAV += Number(row.CAV) || 0
      acc.URDIDORA_METROS += mtsUrd
      acc.URDIDORA_ROTURAS += Number(row.URDIDORA_ROTURAS) || 0
      acc.NUM_FIOS_SUM += Number(row.NUM_FIOS) || 0
      acc.NUM_FIOS_COUNT += row.NUM_FIOS ? 1 : 0
      acc.MTS_CRUDOS += mtsTej
      acc.MTS_CAL += mtsCal

      acc.VEL_PROM_NUM += (Number(row.VEL_PROM) || 0) * mtsInd
      acc.EFI_TEJ_NUM += (Number(row.EFI_TEJ) || 0) * mtsTej
      acc.RU105_NUM += (Number(row.RU105) || 0) * mtsTej
      acc.RT105_NUM += (Number(row.RT105) || 0) * mtsTej
      acc.CAL_NUM += (Number(row.CAL_PERCENT) || 0) * mtsCal
      acc.PTS_NUM += (Number(row.PTS_100M2) || 0) * mtsCal
      return acc
    },
    {
      TOTAL_ROLADAS: 0,
      MTS_IND: 0,
      RUPTURAS: 0,
      CAV: 0,
      URDIDORA_METROS: 0,
      URDIDORA_ROTURAS: 0,
      NUM_FIOS_SUM: 0,
      NUM_FIOS_COUNT: 0,
      MTS_CRUDOS: 0,
      MTS_CAL: 0,
      VEL_PROM_NUM: 0,
      EFI_TEJ_NUM: 0,
      RU105_NUM: 0,
      RT105_NUM: 0,
      CAL_NUM: 0,
      PTS_NUM: 0
    }
  )

  const totalesMes = {
    TOTAL_ROLADAS: totales.TOTAL_ROLADAS,
    MTS_IND: totales.MTS_IND,
    R103: totales.MTS_IND ? (totales.RUPTURAS * 1000) / totales.MTS_IND : null,
    CAV: totales.CAV,
    VEL_PROM: totales.MTS_IND ? totales.VEL_PROM_NUM / totales.MTS_IND : null,
    URDIDORA_METROS: totales.URDIDORA_METROS,
    URDIDORA_ROTURAS: totales.URDIDORA_ROTURAS,
    NUM_FIOS: totales.NUM_FIOS_COUNT ? totales.NUM_FIOS_SUM / totales.NUM_FIOS_COUNT : null,
    MTS_CRUDOS: totales.MTS_CRUDOS,
    EFI_TEJ: totales.MTS_CRUDOS ? totales.EFI_TEJ_NUM / totales.MTS_CRUDOS : null,
    RU105: totales.MTS_CRUDOS ? totales.RU105_NUM / totales.MTS_CRUDOS : null,
    RT105: totales.MTS_CRUDOS ? totales.RT105_NUM / totales.MTS_CRUDOS : null,
    MTS_CAL: totales.MTS_CAL,
    CAL_PERCENT: totales.MTS_CAL ? totales.CAL_NUM / totales.MTS_CAL : null,
    PTS_100M2: totales.MTS_CAL ? totales.PTS_NUM / totales.MTS_CAL : null
  }

  return { datos, totales: totalesMes }
}

app.get('/api/seguimiento-roladas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const payload = await getSeguimientoRoladasData(fechaInicio, fechaFin)
    res.json(payload)
  } catch (err) {
    console.error('Error en seguimiento-roladas:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/seguimiento-roladas-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const { datos, totales } = await getSeguimientoRoladasData(fechaInicio, fechaFin)

    const lotes = Array.from(
      new Set(
        (datos || [])
          .map((d) => String(d.LOTE || '').split(',')[0].trim())
          .filter(Boolean)
      )
    )

    let hviMap = {}
    if (lotes.length > 0) {
      // Use logical comparison for LOTE_FIAC (strip leading zeros in DB)
      const sql = `
        SELECT
          "LOTE" AS "LOTE",
          "LOTE_FIAC" AS "LOTE_FIAC",
          "MISTURA" AS "MISTURA",
          "COR" AS "COR",
          "DT_ENTRADA_PROD" AS "FECHA_INGRESO",
          ${sqlParseNumber('"SCI"')} AS "SCI",
          ${sqlParseNumber('"MST"')} AS "MST",
          ${sqlParseNumber('"MIC"')} AS "MIC",
          ${sqlParseNumber('"MAT"')} AS "MAT",
          ${sqlParseNumber('"UHML"')} AS "UHML",
          ${sqlParseNumber('"UI"')} AS "UI",
          ${sqlParseNumber('"SF"')} AS "SF",
          ${sqlParseNumber('"STR"')} AS "STR",
          ${sqlParseNumber('"ELG"')} AS "ELG",
          ${sqlParseNumber('"RD"')} AS "RD",
          ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
          ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
          ${sqlParseNumber('"TrAR"')} AS "TrAR",
          ${sqlParseNumber('"TRID"')} AS "TRID",
          CASE 
            WHEN "PESO" IS NULL OR "PESO" = '' THEN 0
            ELSE CAST(REPLACE(REPLACE("PESO", '.', ''), ',', '.') AS NUMERIC)
          END AS "PESO"
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "MISTURA" IS NOT NULL
          AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)::TEXT = ANY($1::text[])
      `
      
      const hviRows = await query(sql, [lotes], 'seguimiento-roladas-fibra-hvi')
      
      // Use numeric/short string key for map
      hviMap = hviRows.rows.reduce((acc, row) => {
        // Normalize keys to short string (e.g. "104")
        // ONLY use LOTE_FIAC as key, matching legacy system
        const k2 = String(row.LOTE_FIAC || '').replace(/^0+/, '').trim()
        
        // Prefer LOTE_FIAC (normalized) as canonical key
        const primaryKey = k2
        
        if (!primaryKey) return acc


        if (!acc[primaryKey]) {
          acc[primaryKey] = { 
             ...row, 
             MISTURA: [],
             FECHA_INGRESO: [],
             _peso: 0, 
             _sum: {},
             _dist: {},
             _colors: {}
          }
        }
        
        const target = acc[primaryKey]
        
        // Collect Metadata (Set-like behavior) WITH normalization
        if (row.MISTURA) {
          const m = String(row.MISTURA).replace(/^0+/, '')
          if (m && !target.MISTURA.includes(m)) target.MISTURA.push(m)
        }
        if (row.FECHA_INGRESO) {
          const d = row.FECHA_INGRESO instanceof Date
            ? row.FECHA_INGRESO.toISOString().split('T')[0]
            : String(row.FECHA_INGRESO).split('T')[0]
          if (d && !target.FECHA_INGRESO.includes(d)) target.FECHA_INGRESO.push(d)
        }

        const peso = Number(row.PESO) || 0
        target._peso += peso

        // Color weights
        const cor = String(row.COR || '').toUpperCase().trim()
        if (cor) {
             target._colors[cor] = (target._colors[cor] || 0) + peso
        }

        for (const k of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
          const val = Number(row[k])
          if (!isNaN(val)) {
            target._sum[k] = (target._sum[k] || 0) + val * peso
            // Collect distribution for stats
            if (!target._dist[k]) target._dist[k] = []
            target._dist[k].push(val)
          }
        }
        
        // Ensure strictly padded or unpadded lookups work
        // if (k1) acc[k1] = target // Removed to ensure we STRICTLY use LOTE_FIAC
        if (k2) acc[k2] = target
        
        return acc
      }, {})

      // Finalize weighted averages in the map items
      // Note: multiple keys point to the same object, so calculate once per object
      const processedObjects = new Set()
      for (const key of Object.keys(hviMap)) {
        const item = hviMap[key]
        if (processedObjects.has(item)) continue
        processedObjects.add(item)

        const peso = item._peso || 0
        for (const k of Object.keys(item._sum)) {
          item[k] = peso ? item._sum[k] / peso : null

          // Calculate MIN, MAX, SIGMA
          const vals = item._dist ? (item._dist[k] || []) : []
          if (vals.length > 0) {
              item[`${k}_MIN`] = Math.min(...vals)
              item[`${k}_MAX`] = Math.max(...vals)
              const n = vals.length
              const simpleMean = vals.reduce((a,b)=>a+b,0)/n
              const variance = vals.reduce((a,b) => a + Math.pow(b - simpleMean, 2), 0) / (n > 1 ? n - 1 : 1)
              item[`${k}_SIGMA`] = Math.sqrt(variance)
          } else {
              item[`${k}_MIN`] = null
              item[`${k}_MAX`] = null
              item[`${k}_SIGMA`] = null
          }
        }
        
        // Calculate Colors
        if (peso > 0 && item._colors) {
            item.COLOR_BCO_PCT = (item._colors['BCO'] || 0) / peso * 100
            item.COLOR_GRI_PCT = (item._colors['GRI'] || 0) / peso * 100
            item.COLOR_LG_PCT = (item._colors['LG'] || 0) / peso * 100
            item.COLOR_AMA_PCT = (item._colors['AMA'] || 0) / peso * 100
            item.COLOR_LA_PCT = (item._colors['LA'] || 0) / peso * 100
        }
      }
    }

    const datosConFibra = (datos || []).map((row) => {
      // Find all HVI data for comma-separated lotes
      const loteKeys = String(row.LOTE || '').split(',').map(s => s.trim().replace(/^0+/, '')).filter(Boolean)
      
      // Collect valid hvi objects
      const found = loteKeys.map(k => hviMap[k]).filter(item => item && item.SCI !== undefined)
      
      const resultHvi = {
        MISTURA: null, FECHA_INGRESO: null,
        SCI: null, MST: null, MIC: null, MAT: null, UHML: null, UI: null, 
        SF: null, STR: null, ELG: null, RD: null, PLUS_B: null, 
        TrCNT: null, TrAR: null, TRID: null
      }

      if (found.length > 0) {
        // Aggregate metadata from all matched lote items
        const allMisturas = new Set()
        const allFechas = new Set()
        
        found.forEach(item => {
             if (Array.isArray(item.MISTURA)) item.MISTURA.forEach(m => allMisturas.add(m))
             else if (item.MISTURA) allMisturas.add(item.MISTURA)

             if (Array.isArray(item.FECHA_INGRESO)) item.FECHA_INGRESO.forEach(f => allFechas.add(f))
             else if (item.FECHA_INGRESO) allFechas.add(item.FECHA_INGRESO)
        })
        
        resultHvi.MISTURA = Array.from(allMisturas).join(',')
        
        // Sort dates to pick the earliest? Or just join them?
        // Reference uses MIN(FECHA_INGRESO)
        const sortedFechas = Array.from(allFechas).sort((a,b) => {
             const ma = a.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             const mb = b.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             if (ma && mb) {
                 const ka = `${ma[3]}${ma[2]}${ma[1]}`
                 const kb = `${mb[3]}${mb[2]}${mb[1]}`
                 return ka.localeCompare(kb)
             }
             return a.localeCompare(b)
        })
        resultHvi.FECHA_INGRESO = sortedFechas[0] || null

        // Average the numeric fields
        const keys = ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']
        keys.forEach(k => {
          const validValues = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
          if (validValues.length > 0) {
             const sum = validValues.reduce((a,b) => a+b, 0)
             resultHvi[k] = sum / validValues.length
          }

          // Min of Mins
          const mins = found.map(f => f[`${k}_MIN`]).filter(v => v !== null && v !== undefined)
          if (mins.length > 0) resultHvi[`${k}_MIN`] = Math.min(...mins)

          // Max of Maxs
          const maxs = found.map(f => f[`${k}_MAX`]).filter(v => v !== null && v !== undefined)
          if (maxs.length > 0) resultHvi[`${k}_MAX`] = Math.max(...maxs)

          // Avg of Sigmas (Simple approximation)
          const sigmas = found.map(f => f[`${k}_SIGMA`]).filter(v => v !== null && v !== undefined)
          if (sigmas.length > 0) resultHvi[`${k}_SIGMA`] = sigmas.reduce((a,b)=>a+b,0) / sigmas.length
        })

        // Colors
        const colors = ['COLOR_BCO_PCT', 'COLOR_GRI_PCT', 'COLOR_LG_PCT', 'COLOR_AMA_PCT', 'COLOR_LA_PCT']
        colors.forEach(k => {
            const vals = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
            if (vals.length > 0) resultHvi[k] = vals.reduce((a,b) => a+b, 0) / vals.length
        })
      }

      return {
        ...row,
        ...resultHvi
      }
    })

    res.json({ datos: datosConFibra, totales })
  } catch (err) {
    console.error('Error en seguimiento-roladas-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/hvi-estadisticas-mezcla', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'hvi-estadisticas-mezcla')).rows
    const stats = {}

    for (const row of rows) {
      const mistura = String(row.MISTURA || '').trim()
      if (!mistura) continue
      if (!stats[mistura]) stats[mistura] = { N: 0 }
      const target = stats[mistura]
      target.N += 1

      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        const k = key === 'PLUS_B' ? 'PLUS_B' : key
        if (!target[k]) target[k] = { values: [] }
        target[k].values.push(val)
      }
    }

    for (const mistura of Object.keys(stats)) {
      const target = stats[mistura]
      for (const key of Object.keys(target)) {
        if (key === 'N') continue
        const vals = target[key].values || []
        if (!vals.length) {
          target[key] = { MIN: null, MAX: null, DESV: null }
          continue
        }
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        const desv = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length)
        target[key] = { MIN: min, MAX: max, DESV: desv }
      }
    }

    res.json({ stats })
  } catch (err) {
    console.error('Error en hvi-estadisticas-mezcla:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/calidad-fibra-mistura', async (req, res) => {
  try {
    const misturaRaw = String(req.query.mistura || '').trim()
    if (!misturaRaw) return res.status(400).json({ error: 'mistura requerida' })

    const mistura = misturaRaw.padStart(10, '0')
    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        "SEQ" AS SEQ,
        "DT_ENTRADA_PROD" AS "DT_ENTRADA_PROD",
        "HR_ENTRADA_PROD" AS "HR_ENTRADA_PROD",
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST' AND ("MISTURA" = $1 OR "MISTURA" = $2)
    `

    const rows = (await query(sql, [misturaRaw, mistura], 'calidad-fibra-mistura')).rows
    if (!rows.length) return res.json({ mistura: misturaRaw, seqs: [], totales: {} })

    const seqs = {}
    const totales = { sumPeso: 0, sum: {} }

    for (const row of rows) {
      const seq = String(row.SEQ || '').trim()
      if (!seqs[seq]) {
        seqs[seq] = { SEQ: seq, DT_ENTRADA_PROD: row.DT_ENTRADA_PROD, HR_ENTRADA_PROD: row.HR_ENTRADA_PROD, sumPeso: 0, sum: {} }
      }
      const peso = Number(row.PESO) || 0
      seqs[seq].sumPeso += peso
      totales.sumPeso += peso
      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        seqs[seq].sum[key] = (seqs[seq].sum[key] || 0) + val * peso
        totales.sum[key] = (totales.sum[key] || 0) + val * peso
      }
    }

    const seqsOut = Object.values(seqs).map((s) => {
      const out = { SEQ: s.SEQ, DT_ENTRADA_PROD: s.DT_ENTRADA_PROD, HR_ENTRADA_PROD: s.HR_ENTRADA_PROD }
      for (const key of Object.keys(s.sum)) {
        out[key === 'PLUS_B' ? '+b' : key] = s.sumPeso ? s.sum[key] / s.sumPeso : null
      }
      return out
    })

    const totalesOut = {}
    for (const key of Object.keys(totales.sum)) {
      totalesOut[key === 'PLUS_B' ? '+b' : key] = totales.sumPeso ? totales.sum[key] / totales.sumPeso : null
    }

    res.json({ mistura: misturaRaw, seqs: seqsOut, totales: totalesOut })
  } catch (err) {
    console.error('Error en calidad-fibra-mistura:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-calidad', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const sql = `
      SELECT
        ${sqlParseDate('"DAT_PROD"')} AS "FECHA_DB",
        "DAT_PROD" AS "FECHA",
        SUM(${metragemNum}) AS "METROS_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(COALESCE(${pontuacaoNum}, 0)) AS "PONTOS",
        AVG(${larguraNum}) AS "LARGURA"
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND ${sqlParseDate('"DAT_PROD"')} BETWEEN $1::date AND $2::date
      GROUP BY "FECHA_DB", "FECHA"
      ORDER BY "FECHA_DB" ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-calidad')).rows
    const datos = rows.map((r) => {
      const calPct = r.METROS_TOTAL ? (Number(r.METROS_1ERA) / Number(r.METROS_TOTAL)) * 100 : null
      const pts100 = r.METROS_TOTAL && r.LARGURA
        ? (Number(r.PONTOS) * 100) / (Number(r.METROS_TOTAL) * Number(r.LARGURA) / 100)
        : null
      return {
        FECHA_DB: r.FECHA_DB,
        FECHA: r.FECHA,
        CALIDAD_PERCENT: calPct,
        PTS_100M2: pts100,
        METROS_1ERA: r.METROS_1ERA,
        METROS_TOTAL: r.METROS_TOTAL,
        ROLLOS: null
      }
    })

    const rangos = {}
    for (const key of ['CALIDAD_PERCENT', 'PTS_100M2', 'METROS_1ERA', 'METROS_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-produccion', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const rupturasNum = sqlParseNumber('"RUPTURAS"')
    const numFiosNum = sqlParseNumber('"NUM_FIOS"')
    const velocNum = sqlParseNumber('"VELOC"')
    const eficienciaClean = `regexp_replace("EFICIENCIA", '[^0-9,.-]', '', 'g')`
    const eficienciaNum = sqlParseNumberIntl(eficienciaClean)
    const puntosLidosNum = sqlParseNumber('"PONTOS_LIDOS"')
    const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumber('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumber('"PARADA TEC URDUME"')

    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_BASE_PRODUCAO"')} AS FECHA_DB,
          "DT_BASE_PRODUCAO" AS FECHA,
          "SELETOR" AS SELETOR,
          ${metragemNum} AS METRAGEM,
          ${rupturasNum} AS RUPTURAS,
          ${numFiosNum} AS NUM_FIOS,
          ${velocNum} AS VELOC,
          CASE
            WHEN ${eficienciaNum} IS NULL OR ${eficienciaNum} = 0 THEN
              (${puntosLidosNum} * 100) / NULLIF(${puntos100Num}, 0)
            ELSE ${eficienciaNum}
          END AS EFICIENCIA,
          ${parTraNum} AS PARADA_TRAMA,
          ${parUrdNum} AS PARADA_URD
        FROM tb_produccion
        WHERE "FILIAL" = '05'
          AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (RUPTURAS * 1000000) ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (METRAGEM * NUM_FIOS) ELSE 0 END), 0) AS "RU106_URDIDORA",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END) AS "METROS_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN RUPTURAS ELSE 0 END) * 1000
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "R103_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM * VELOC ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "VELOCIDAD_INDIGO",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM * EFICIENCIA ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END), 0) AS "EFICIENCIA_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_URD ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RU105_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_TRAMA ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RT105_TELAR"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-produccion')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      RU106_URDIDORA: r.RU106_URDIDORA,
      METROS_INDIGO: r.METROS_INDIGO,
      R103_INDIGO: r.R103_INDIGO,
      VELOCIDAD_INDIGO: r.VELOCIDAD_INDIGO,
      EFICIENCIA_TELAR: r.EFICIENCIA_TELAR,
      RU105_TELAR: r.RU105_TELAR,
      RT105_TELAR: r.RT105_TELAR
    }))

    const rangos = {}
    for (const key of ['RU106_URDIDORA','METROS_INDIGO','R103_INDIGO','VELOCIDAD_INDIGO','EFICIENCIA_TELAR','RU105_TELAR','RT105_TELAR']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-produccion:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const pesoNum = sqlParseNumber('"PESO"')
    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_ENTRADA_PROD"')} AS FECHA_DB,
          "DT_ENTRADA_PROD" AS FECHA,
          ${pesoNum} AS PESO,
          ${sqlParseNumber('"SCI"')} AS SCI,
          ${sqlParseNumber('"MIC"')} AS MIC,
          ${sqlParseNumber('"MAT"')} AS MAT,
          ${sqlParseNumber('"UHML"')} AS UHML,
          ${sqlParseNumber('"UI"')} AS UI,
          ${sqlParseNumber('"SF"')} AS SF,
          ${sqlParseNumber('"STR"')} AS STR,
          ${sqlParseNumber('"ELG"')} AS ELG,
          ${sqlParseNumber('"RD"')} AS RD,
          ${sqlParseNumber('"PLUS_B"')} AS PLUS_B
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(PESO) AS "PESO_TOTAL",
        SUM(SCI * PESO) / NULLIF(SUM(PESO), 0) AS "SCI",
        SUM(MIC * PESO) / NULLIF(SUM(PESO), 0) AS "MIC",
        SUM(MAT * PESO) / NULLIF(SUM(PESO), 0) AS "MAT",
        SUM(UHML * PESO) / NULLIF(SUM(PESO), 0) AS "UHML",
        SUM(UI * PESO) / NULLIF(SUM(PESO), 0) AS "UI",
        SUM(SF * PESO) / NULLIF(SUM(PESO), 0) AS "SF",
        SUM(STR * PESO) / NULLIF(SUM(PESO), 0) AS "STR",
        SUM(ELG * PESO) / NULLIF(SUM(PESO), 0) AS "ELG",
        SUM(RD * PESO) / NULLIF(SUM(PESO), 0) AS "RD",
        SUM(PLUS_B * PESO) / NULLIF(SUM(PESO), 0) AS "PLUS_B"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-fibra')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      SCI: r.SCI,
      MIC: r.MIC,
      MAT: r.MAT,
      UHML: r.UHML,
      UI: r.UI,
      SF: r.SF,
      STR: r.STR,
      ELG: r.ELG,
      RD: r.RD,
      PLUS_B: r.PLUS_B,
      PESO_TOTAL: r.PESO_TOTAL
    }))

    const rangos = {}
    for (const key of ['SCI','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','PESO_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/informe-produccion-indigo', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns-informe'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const maqKey = ['maq  fiacao', 'maq fiacao'].find((c) => prodCols.has(c))
    const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c))
    const maqCol = maqKey ? prodCols.get(maqKey) : null
    const loteCol = loteKey ? prodCols.get(loteKey) : null
    const maqExpr = maqCol ? `p.${quoteIdent(maqCol)}` : 'NULL::text'
    const loteExpr = loteCol ? `p.${quoteIdent(loteCol)}` : 'NULL::text'
    const maqFilter = maqCol ? `${maqExpr} IS NOT NULL` : '1=1'
    const loteFilter = loteCol ? `${loteExpr} IS NOT NULL` : '1=1'

    const metragemIndNum = sqlParseNumberIntl('"METRAGEM"')
    const metragemUrdNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasIndNum = sqlParseNumberIntl('"RUPTURAS"')
    const rupturasUrdNum = sqlParseNumberIntl('p."RUPTURAS"')
    const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
    const velocNum = sqlParseNumberIntl('"VELOC"')
    const numFiosNum = sqlParseNumberIntl('"NUM_FIOS"')
    const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
    const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

    const makeTimestampExpr = (dateCol, timeCol) => {
      const dateExpr = sqlParseDate(dateCol)
      return `(
        CASE
          WHEN ${dateExpr} IS NULL THEN NULL
          ELSE to_timestamp(
            to_char(${dateExpr}, 'YYYY-MM-DD') || ' ' || COALESCE(
              CASE
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]$' THEN ${timeCol} || ':00'
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$' THEN ${timeCol}
                ELSE NULL
              END,
              '00:00:00'
            ),
            'YYYY-MM-DD HH24:MI:SS'
          )
        END
      )`
    }

    const urdStartTs = makeTimestampExpr('p."DT_INICIO"', 'p."HORA_INICIO"')
    const urdEndTs = makeTimestampExpr('p."DT_FINAL"', 'p."HORA_FINAL"')
    const indStartTs = makeTimestampExpr('"DT_INICIO"', '"HORA_INICIO"')
    const indEndTs = makeTimestampExpr('"DT_FINAL"', '"HORA_FINAL"')

    const sql = `
      WITH RoladaBase AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          MIN(${sqlParseDate('"DT_INICIO"')}) AS FECHA_INICIO,
          "ARTIGO" AS ARTIGO
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR", "ARTIGO"
      ),
      NumFiosPorRolada AS (
        SELECT
          ROLADA,
          SUM(NUM_FIOS_MAX) AS NUM_FIOS_SUM
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            "PARTIDA" AS PARTIDA,
            MAX(${numFiosNum}) AS NUM_FIOS_MAX
          FROM tb_produccion
          WHERE "SELETOR" = 'URDIDEIRA'
            AND "ROLADA" IS NOT NULL
            AND "PARTIDA" IS NOT NULL
            AND "NUM_FIOS" IS NOT NULL
          GROUP BY "ROLADA", "PARTIDA"
        ) AS nf
        GROUP BY ROLADA
      ),
      UrdideiraMetrics AS (
        SELECT
          p."ROLADA" AS ROLADA,
          MIN(${sqlParseDate('p."DT_INICIO"')}) AS FECHA_URDIDORA,
          string_agg(
            DISTINCT CAST(
              NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
            )::text,
            ', '
          ) AS MAQ_OE,
          string_agg(
            DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
            ', '
          ) AS LOTE,
          SUM(${metragemUrdNum}) / NULLIF(COUNT(DISTINCT p."PARTIDA"), 0) AS METRAGEM_AVG,
          SUM(${rupturasUrdNum}) AS RUPTURAS_TOTAL,
          MIN(${urdStartTs}) AS INICIO_MIN,
          MAX(${urdEndTs}) AS FIN_MAX
        FROM tb_produccion p
        WHERE p."SELETOR" = 'URDIDEIRA'
          AND p."ROLADA" IS NOT NULL
          AND p."ROLADA" <> ''
          AND ${maqFilter}
          AND ${loteFilter}
        GROUP BY p."ROLADA"
      ),
      RoladaMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${rupturasIndNum}) AS RUPTURAS_TOTAL,
          SUM(${cavalosNum}) AS CAVALOS_TOTAL,
          SUM(${metragemIndNum} * COALESCE(${velocNum}, 0)) AS VELOC_POND_NUM,
          MIN(${indStartTs}) AS INICIO_MIN,
          MAX(${indEndTs}) AS FIN_MAX
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR"
      ),
      RoladaCalidad AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          COUNT(DISTINCT CASE WHEN "S" = 'N' THEN "PARTIDA" || '_' || "S" END) AS N_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'P' THEN "PARTIDA" || '_' || "S" END) AS P_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'Q' THEN "PARTIDA" || '_' || "S" END) AS Q_COUNT,
          COUNT(DISTINCT "PARTIDA" || '_' || "S") AS TOTAL_COUNT
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
          AND "PARTIDA" IS NOT NULL
          AND "S" IS NOT NULL
        GROUP BY "ROLADA", "COR"
      ),
      TecelagemMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${pontosLidosNum}) AS PONTOS_LIDOS_TOTAL,
          SUM(${pontos100Num}) AS PONTOS_100_TOTAL,
          SUM(${parTraNum}) AS PARADA_TRAMA_TOTAL,
          SUM(${parUrdNum}) AS PARADA_URDUME_TOTAL
        FROM tb_produccion
        WHERE "SELETOR" = 'TECELAGEM'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA"
      ),
      CalidadMetrics AS (
        SELECT
          CAL_M.ROLADA,
          CAL_M.MTS_CAL,
          CAL_M.CAL_PERCENT,
          ROUND(
            ((PTS.PUNTOS * 100.0) / NULLIF((PTS.MTS_1ERA * PTS.ANC_POND), 0))::numeric,
            1
          ) AS PTS_100M2
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_CAL,
            ROUND(
              (SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) * 100.0) /
              NULLIF(SUM(${calMetragemNum}), 0),
              1
            ) AS CAL_PERCENT
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS CAL_M
        LEFT JOIN (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_1ERA,
            SUM(${calPontuacaoNum}) AS PUNTOS,
            SUM(${calMetragemNum} * ${calLarguraNum}) / NULLIF(SUM(${calMetragemNum}), 0) / 100.0 AS ANC_POND
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND btrim("QUALIDADE") = 'PRIMEIRA'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS PTS ON CAL_M.ROLADA = PTS.ROLADA
      )
      SELECT
        rb.ROLADA AS "ROLADA",
        to_char(um.FECHA_URDIDORA, 'DD/MM/YYYY') AS "FECHA_URDIDORA",
        um.MAQ_OE AS "MAQ_OE",
        um.LOTE AS "LOTE",
        ROUND(um.METRAGEM_AVG, 3) AS "URDIDORA_M",
        um.RUPTURAS_TOTAL AS "URDIDORA_ROT_TOT",
        ROUND(
          ((CAST(um.RUPTURAS_TOTAL AS REAL) * 1000000.0) /
          NULLIF((um.METRAGEM_AVG * nf.NUM_FIOS_SUM), 0))::numeric,
          6
        ) AS "URDIDORA_ROT_106",
        CAST(EXTRACT(EPOCH FROM (um.FIN_MAX - um.INICIO_MIN)) / 60 AS INTEGER) AS "URDIDORA_TIEMPO_MIN",
        to_char(rb.FECHA_INICIO, 'DD/MM/YYYY') AS "FECHA_INDIGO",
        rb.COR AS "COR",
        rb.ARTIGO AS "ARTIGO",
        ROUND(rm.METRAGEM_TOTAL, 3) AS "METRAGEM",
        rm.RUPTURAS_TOTAL AS "RUPTURAS",
        ROUND(((CAST(rm.RUPTURAS_TOTAL AS REAL) * 1000.0) / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "ROT_103",
        ROUND(rm.CAVALOS_TOTAL, 1) AS "CAVALOS",
        ROUND((rm.VELOC_POND_NUM / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "VELOC_PROMEDIO",
        CAST(EXTRACT(EPOCH FROM (rm.FIN_MAX - rm.INICIO_MIN)) / 60 AS INTEGER) AS "TIEMPO_MINUTOS",
        COALESCE(rc.N_COUNT, 0) AS "N_COUNT",
        ROUND(((CAST(COALESCE(rc.N_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "N_PERCENT",
        COALESCE(rc.P_COUNT, 0) AS "P_COUNT",
        ROUND(((CAST(COALESCE(rc.P_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "P_PERCENT",
        COALESCE(rc.Q_COUNT, 0) AS "Q_COUNT",
        ROUND(((CAST(COALESCE(rc.Q_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "Q_PERCENT",
        ROUND(tm.METRAGEM_TOTAL, 0) AS "TECELAGEM_METROS",
        ROUND(((tm.PONTOS_LIDOS_TOTAL * 100.0) / NULLIF(tm.PONTOS_100_TOTAL, 0))::numeric, 1) AS "TECELAGEM_EFICIENCIA",
        ROUND(((tm.PARADA_TRAMA_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RT105",
        ROUND(((tm.PARADA_URDUME_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RU105",
        ROUND(cm.MTS_CAL, 0) AS "METROS_CAL",
        cm.CAL_PERCENT AS "CAL_PERCENT",
        cm.PTS_100M2 AS "PTS_100M2"
      FROM RoladaBase rb
      INNER JOIN UrdideiraMetrics um ON rb.ROLADA = um.ROLADA
      INNER JOIN NumFiosPorRolada nf ON rb.ROLADA = nf.ROLADA
      INNER JOIN RoladaMetrics rm ON rb.ROLADA = rm.ROLADA AND rb.COR = rm.COR
      LEFT JOIN RoladaCalidad rc ON rb.ROLADA = rc.ROLADA AND rb.COR = rc.COR
      LEFT JOIN TecelagemMetrics tm ON rb.ROLADA = tm.ROLADA
      LEFT JOIN CalidadMetrics cm ON rb.ROLADA = cm.ROLADA
      WHERE rb.FECHA_INICIO BETWEEN $1::date AND $2::date
      ORDER BY rb.FECHA_INICIO DESC, rb.ROLADA DESC, rb.COR
    `

    const result = await query(sql, [fechaInicio, fechaFin], 'informe-produccion-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en informe-produccion-indigo:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS PRODUCCION (Sistema de importación CSV)
// =====================================================

// PRODUCCION: Import status (estado de todos los CSVs)
app.get('/api/produccion/import-status', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)
    const status = await getImportStatus(pool, csvFolder)
    res.json(status)
  } catch (err) {
    console.error('Error en import-status:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: DB status (información básica de la base de datos)
app.get('/api/produccion/status', async (req, res) => {
  try {
    // Obtener tamaño de la base de datos
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) / (1024 * 1024) as size_mb
    `)
    
    res.json({
      database: process.env.PG_DATABASE || 'stc_produccion',
      sizeMB: Math.round(sizeResult.rows[0].size_mb),
      sizeFormatted: sizeResult.rows[0].size,
      connected: true
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar tablas específicas desactualizadas (llamado por botón "Actualizar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/update-outdated', async (req, res) => {
  try {
    const { tables, csvFolder } = req.body
    
    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: 'Se requiere un array de nombres de tablas' })
    }
    
    const csvPath = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Importando tablas específicas: ${tables.join(', ')}`)
    
    const results = await importSpecificTables(pool, tables, csvPath)
    
    res.json({ 
      success: true,
      results 
    })
  } catch (err) {
    console.error('Error en update-outdated:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de una tabla específica (ignora estado)
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-table', async (req, res) => {
  try {
    const { table, csvPath: csvPathRaw, csvFolder } = req.body
    
    if (!table) {
      return res.status(400).json({ error: 'Se requiere el nombre de la tabla' })
    }
    
    let csvPath = csvPathRaw
    if (!csvPath) {
      // Compatibilidad con la UI: envía { table, csvFolder }
      const folder = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
      const status = await getImportStatus(pool, folder)
      const match = status.find(s => s.table === table)
      csvPath = match?.csvPath
    }

    if (!csvPath) {
      return res.status(400).json({ error: 'No se pudo resolver csvPath para la tabla solicitada' })
    }

    console.log(`[IMPORT] Forzando importación de ${table} desde ${csvPath}`)

    const result = await importCSV(pool, table, csvPath)
    
    res.json(result)
  } catch (err) {
    console.error(`Error forzando importación:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar todos los CSVs desactualizados
app.post('/api/produccion/import-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    const results = await importAll(pool, csvFolder)
    res.json({ results })
  } catch (err) {
    console.error('Error en import-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de TODAS las tablas (botón "Forzar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Forzando importación de todas las tablas desde ${csvFolder}`)

    const results = await importForceAll(pool, csvFolder)
    const errors = results.filter((r) => r && r.success === false)

    res.json({
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: results.length,
        successful: results.length - errors.length,
        failed: errors.length
      }
    })
  } catch (err) {
    console.error('Error en force-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Column warnings (devuelve lista vacía - funcionalidad opcional)
app.get('/api/produccion/import/column-warnings', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)

    await ensureSyncHistoryTables()

    const status = await getImportStatus(pool, csvFolder)
    const client = await pool.connect()

    try {
      const warnings = []
      const nowIso = new Date().toISOString()

      for (const item of status) {
        if (!item?.csvPath) continue
        if (item.status === 'MISSING_FILE' || item.status === 'ERROR') continue
        if (!fs.existsSync(item.csvPath)) continue

        let rawLine
        try {
          rawLine = readCsvHeaderLine(item.csvPath)
        } catch (e) {
          console.warn(`[WARNINGS] No se pudo leer header de ${item.csvPath}: ${e.message}`)
          continue
        }

        const rawHeaders = rawLine.split(',')
        const csvHeaders = renameduplicateHeaders(rawHeaders)

        const pgColumns = await getTableColumns(client, item.table)
        const diff = compareColumns(csvHeaders, pgColumns)

        if (!diff.hasDifferences) continue

        const warning = {
          id: `${item.table}-${Date.now()}`,
          table: item.table,
          csvPath: item.csvPath,
          timestamp: nowIso,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV,
          hasDifferences: true
        }
        warnings.push(warning)

        await maybeInsertWarningHistory({
          tableName: item.table,
          csvPath: item.csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }

      res.json({ warnings })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de diferencias detectadas
app.get('/api/produccion/import/warnings-history', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, csv_path, detected_at, extra_columns, missing_columns
       FROM tb_column_warnings_history
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ history: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar una tabla específica
// IMPORTANTE: Esta ruta con parámetro :table debe estar DESPUÉS de TODAS las rutas específicas
app.post('/api/produccion/import/:table', async (req, res) => {
  try {
    const { table } = req.params
    const { csvPath } = req.body
    
    if (!csvPath) {
      return res.status(400).json({ error: 'csvPath requerido' })
    }
    
    const result = await importCSV(pool, table, csvPath)
    res.json(result)
  } catch (err) {
    console.error(`Error importando ${req.params.table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Pick folder (no implementado - funcionalidad opcional)
app.post('/api/produccion/system/pick-folder', async (req, res) => {
  res.status(501).json({ error: 'Funcionalidad no implementada' })
})

// PRODUCCION: Sync columns (no implementado - funcionalidad opcional)
app.post('/api/produccion/schema/sync-columns', async (req, res) => {
  const { table, csvPath, reimport } = req.body || {}

  if (!table) return res.status(400).json({ error: 'table requerido' })
  if (!csvPath) return res.status(400).json({ error: 'csvPath requerido' })

  try {
    await ensureSyncHistoryTables()

    const client = await pool.connect()
    let addedColumns = []

    try {
      const rawLine = readCsvHeaderLine(csvPath)
      const rawHeaders = rawLine.split(',')
      const csvHeaders = renameduplicateHeaders(rawHeaders)
      const pgColumns = await getTableColumns(client, table)
      const diff = compareColumns(csvHeaders, pgColumns)

      const toAdd = diff.extraInCSV || []
      const addRes = await addColumnsToTable(client, table, toAdd)
      addedColumns = addRes.columns || []

      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [table, 'ADD_COLUMNS', addedColumns, Boolean(reimport), true]
      )

      // Registrar también como diferencia detectada (para historial) si aún había diferencias
      if (diff.hasDifferences) {
        await maybeInsertWarningHistory({
          tableName: table,
          csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }
    } finally {
      client.release()
    }

    let reimportResult = null
    if (reimport) {
      reimportResult = await importCSV(pool, table, csvPath)
    }

    res.json({
      success: true,
      columnsAdded: addedColumns.length,
      addedColumns,
      reimportResult
    })
  } catch (err) {
    try {
      await ensureSyncHistoryTables()
      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [table, 'ADD_COLUMNS', [], Boolean(reimport), false, err.message]
      )
    } catch (e2) {
      console.error('Error registrando tb_schema_changes_log:', e2.message)
    }
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de sincronizaciones aplicadas
app.get('/api/produccion/schema/changes-log', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, change_type, applied_at, columns_added, reimported, success, error_message
       FROM tb_schema_changes_log
       ORDER BY applied_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ changes: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS PARAMETROS HVI (Gestión de rangos de calidad)
// =====================================================

// GET /api/parametros-hvi - Listar todos los parámetros HVI
app.get('/api/parametros-hvi', async (req, res) => {
  try {
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    
    let sql = 'SELECT * FROM tb_parametros_hvi'
    const params = []
    
    if (activo !== undefined) {
      sql += ' WHERE activo = $1'
      params.push(activo)
    }
    
    sql += ' ORDER BY codigo ASC'
    
    const result = await query(sql, params, 'parametros-hvi-list')
    res.json({ 
      success: true,
      parametros: result.rows 
    })
  } catch (err) {
    console.error('Error obteniendo parámetros HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// GET /api/parametros-hvi/:codigo - Obtener un parámetro por código
app.get('/api/parametros-hvi/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params
    
    const result = await query(
      'SELECT * FROM tb_parametros_hvi WHERE codigo = $1',
      [codigo.toUpperCase()],
      'parametros-hvi-get-one'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0] 
    })
  } catch (err) {
    console.error('Error obteniendo parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// POST /api/parametros-hvi - Crear un nuevo parámetro HVI
app.post('/api/parametros-hvi', async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!codigo || !nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: codigo, nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `INSERT INTO tb_parametros_hvi (
        codigo, nombre, descripcion, grupo, unidad, tipo_dato, decimales,
        optimo_min, optimo_max, aceptable_min, aceptable_max,
        critico_min, critico_max, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        codigo.toUpperCase(),
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true
      ],
      'parametros-hvi-create'
    )
    
    res.status(201).json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI creado exitosamente'
    })
  } catch (err) {
    console.error('Error creando parámetro HVI:', err)
    
    // Manejar error de código duplicado
    if (err.code === '23505') {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe un parámetro con ese código' 
      })
    }
    
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// PUT /api/parametros-hvi/:id - Actualizar un parámetro HVI existente
app.put('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `UPDATE tb_parametros_hvi SET
        nombre = $1,
        descripcion = $2,
        grupo = $3,
        unidad = $4,
        tipo_dato = $5,
        decimales = $6,
        optimo_min = $7,
        optimo_max = $8,
        aceptable_min = $9,
        aceptable_max = $10,
        critico_min = $11,
        critico_max = $12,
        activo = $13
      WHERE id = $14
      RETURNING *`,
      [
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true,
        id
      ],
      'parametros-hvi-update'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI actualizado exitosamente'
    })
  } catch (err) {
    console.error('Error actualizando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// DELETE /api/parametros-hvi/:id - Eliminar un parámetro HVI
app.delete('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM tb_parametros_hvi WHERE id = $1 RETURNING codigo, nombre',
      [id],
      'parametros-hvi-delete'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      deleted: result.rows[0],
      message: 'Parámetro HVI eliminado exitosamente'
    })
  } catch (err) {
    console.error('Error eliminando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// =====================================================
// DETALLE MISTURA POR LOTE DE HILANDERÍA
// =====================================================

// GET /api/detalle-mistura/:loteFiac - Obtener detalle de mistura por LOTE_FIAC
app.get('/api/detalle-mistura/:loteFiac', async (req, res) => {
  try {
    const { loteFiac } = req.params
    
    if (!loteFiac) {
      return res.status(400).json({ 
        success: false,
        error: 'LOTE_FIAC es requerido' 
      })
    }

    // Formatear LOTE_FIAC con ceros adelante (10 dígitos)
    const loteFiacFormateado = String(loteFiac).padStart(10, '0')
    
    console.log(`[DetalleMistura] Buscando LOTE_FIAC: ${loteFiac} → Formateado: ${loteFiacFormateado}`)
    
    // Helper para parsear números desde texto
    const sqlParseNumber = (col) => `
      CASE 
        WHEN ${col} IS NULL OR ${col} = '' THEN NULL
        ELSE CAST(REPLACE(REPLACE(${col}, '.', ''), ',', '.') AS NUMERIC)
      END
    `
    
    const sql = `
      SELECT 
        "LOTE_FIAC",
        "MISTURA",
        "PRODUTOR",
        "LOTE",
        ${sqlParseNumber('"QTDE"')} AS "QTDE",
        ${sqlParseNumber('"PESO"')} AS "PESO",
        "TP",
        "CLASSIFIC",
        ${sqlParseNumber('"SCI"')} AS "SCI",
        ${sqlParseNumber('"MST"')} AS "MST",
        ${sqlParseNumber('"MIC"')} AS "MIC",
        ${sqlParseNumber('"MAT"')} AS "MAT",
        ${sqlParseNumber('"UHML"')} AS "UHML",
        ${sqlParseNumber('"UI"')} AS "UI",
        ${sqlParseNumber('"SF"')} AS "SF",
        ${sqlParseNumber('"STR"')} AS "STR",
        ${sqlParseNumber('"ELG"')} AS "ELG",
        ${sqlParseNumber('"RD"')} AS "RD",
        ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID"
      FROM tb_calidad_fibra
      WHERE "LOTE_FIAC" = $1
        AND "TIPO_MOV" = 'MIST'
        AND "PRODUTOR" IS NOT NULL
        AND "PRODUTOR" != ''
      ORDER BY "PRODUTOR", "LOTE"
    `
    
    const result = await query(sql, [loteFiacFormateado], 'detalle-mistura')
    
    console.log(`[DetalleMistura] Filas encontradas: ${result.rows.length}`)
    
    res.json({
      success: true,
      loteFiac: loteFiac,
      loteFiacFormateado: loteFiacFormateado,
      filas: result.rows,
      total: result.rows.length
    })
  } catch (err) {
    console.error('Error obteniendo detalle de mistura:', err)
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

// =====================================================
// HVI: Guardar datos de ensayos en tablas específicas
// =====================================================
app.post('/api/hvi/save', async (req, res) => {
  const { files } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ success: false, error: 'No se enviaron datos de archivos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Asegurar que las tablas existan y tengan las columnas necesarias
    await client.query(`
      CREATE TABLE IF NOT EXISTS tb_hvi_ensayos (
          id SERIAL PRIMARY KEY,
          lote TEXT NOT NULL,
          proveedor TEXT,
          grado TEXT,
          fecha TEXT,
          muestra TEXT,
          archivo_fuente TEXT,
          creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Asegurar columna 'tipo' si no existe
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='tipo') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN tipo TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cantidad') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cantidad INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='color') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN color TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cort') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cort INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='obs') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN obs TEXT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS tb_hvi_detalles (
          id SERIAL PRIMARY KEY,
          ensayo_id INTEGER REFERENCES tb_hvi_ensayos(id) ON DELETE CASCADE,
          fardo TEXT,
          sci NUMERIC, mst NUMERIC, mic NUMERIC, mat NUMERIC, uhml NUMERIC, 
          ui NUMERIC, sf NUMERIC, str NUMERIC, elg NUMERIC, rd NUMERIC, 
          plus_b NUMERIC, tipo TEXT, tr_cnt NUMERIC, tr_ar NUMERIC, trid NUMERIC,
          estado_fardo TEXT DEFAULT 'OK'
      );
    `);

    for (const file of files) {
      const { metadata, details } = file;
      
      // 1. Verificar si ya existe un ensayo para este lote/proveedor/fecha/archivo para evitar duplicados
      const existing = await client.query(
        `SELECT id FROM tb_hvi_ensayos 
         WHERE lote = $1 AND proveedor = $2 AND fecha = $3 AND archivo_fuente = $4`,
        [metadata.loteEntrada, metadata.proveedor, metadata.fecha, metadata.fileName]
      );

      if (existing.rows.length > 0) {
        // Si existe, lo eliminamos (y por CASCADE se borran sus detalles) para re-insertar
        await client.query('DELETE FROM tb_hvi_ensayos WHERE id = $1', [existing.rows[0].id]);
      }

      // 2. Insertar Cabecera
      const headerRes = await client.query(
        `INSERT INTO tb_hvi_ensayos (tipo, lote, proveedor, grado, fecha, muestra, cantidad, color, cort, obs, archivo_fuente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [metadata.tipo, metadata.loteEntrada, metadata.proveedor, metadata.grado, metadata.fecha, metadata.muestra, metadata.cantidad || null, metadata.color || null, metadata.cort || null, metadata.obs || null, metadata.fileName]
      );

      const ensayoId = headerRes.rows[0].id;

      // 3. Insertar Detalles
      for (const row of details) {
        const toNum = (v) => {
          if (v === null || v === undefined || v === '-' || v === '') return null;
          const n = parseFloat(String(v).replace(',', '.'));
          return isNaN(n) ? null : n;
        };

        const sqlDetalle = `
          INSERT INTO tb_hvi_detalles (
            ensayo_id, fardo, sci, mst, mic, mat, uhml, ui, sf, 
            str, elg, rd, plus_b, tipo, tr_cnt, tr_ar, trid
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `;

        const values = [
          ensayoId, row.fardo, 
          toNum(row.sci), toNum(row.mst), toNum(row.mic), toNum(row.mat), 
          toNum(row.uhml), toNum(row.ui), toNum(row.sf), toNum(row.str), 
          toNum(row.elg), toNum(row.rd), toNum(row.plusB), 
          row.tipo, 
          toNum(row.trCnt), toNum(row.trAr), toNum(row.trid)
        ];

        await client.query(sqlDetalle, values);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Se han guardado los datos correctamente.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error guardando datos HVI:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Endpoint para verificar archivos existentes
app.post('/api/hvi/check-files', async (req, res) => {
  const { fileNames } = req.body;
  if (!fileNames || !Array.isArray(fileNames)) {
    return res.status(400).json({ success: false, error: 'Lista de archivos inválida' });
  }

  try {
    // Verificar si la tabla existe antes de consultar
    const tableCheck = await query(`SELECT to_regclass('public.tb_hvi_ensayos') as exists`);
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, existingNames: [] });
    }

    const result = await query(
      `SELECT archivo_fuente FROM tb_hvi_ensayos WHERE archivo_fuente = ANY($1)`,
      [fileNames]
    );
    const existingNames = result.rows.map(r => r.archivo_fuente);
    res.json({ success: true, existingNames });
  } catch (err) {
    console.error('Error checking HVI files:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener metadatos guardados de archivos HVI
app.post('/api/hvi/get-metadata', async (req, res) => {
  const { fileNames } = req.body;
  if (!fileNames || !Array.isArray(fileNames)) {
    return res.status(400).json({ success: false, error: 'Lista de archivos inválida' });
  }

  try {
    // Asegurar que las columnas adicionales existan antes de consultar
    await query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cantidad') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cantidad INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='color') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN color TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='cort') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN cort INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tb_hvi_ensayos' AND column_name='obs') THEN
          ALTER TABLE tb_hvi_ensayos ADD COLUMN obs TEXT;
        END IF;
      END $$;
    `);

    const result = await query(
      `SELECT archivo_fuente, tipo, lote, proveedor, grado, fecha, muestra, cantidad, color, cort, obs
       FROM tb_hvi_ensayos WHERE archivo_fuente = ANY($1)`,
      [fileNames]
    );

    // Devolver un mapa por nombre de archivo
    const map = {};
    result.rows.forEach(r => {
      map[r.archivo_fuente] = {
        tipo: r.tipo,
        loteEntrada: r.lote,
        proveedor: r.proveedor,
        grado: r.grado,
        fecha: r.fecha,
        muestra: r.muestra,
        cantidad: r.cantidad,
        color: r.color,
        cort: r.cort,
        obs: r.obs
      };
    });

    res.json({ success: true, metadata: map });
  } catch (err) {
    console.error('Error getting HVI metadata:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Comparación Calidad (Muestra vs Entrega)
app.get('/api/hvi/comparacion-muestra', async (req, res) => {
  try {
    const sql = `
      WITH promedios_lote AS (
          SELECT 
              e.id AS ensayo_id,
              e.lote,
              e.tipo,
              e.muestra,
              AVG(d.sci) as sci_avg,
              AVG(d.str) as str_avg,
              AVG(d.sf) as sf_avg,
              COUNT(d.id) as fardos
          FROM tb_hvi_ensayos e
          JOIN tb_hvi_detalles d ON e.id = d.ensayo_id
          GROUP BY e.id, e.lote, e.tipo, e.muestra
      )
      SELECT 
          ent.lote as lote_ent,
          mue.lote as lote_mue,
          
          ent.sci_avg as sci_ent,
          mue.sci_avg as sci_mue,
          ((ent.sci_avg / NULLIF(mue.sci_avg, 0)) - 1) * 100 as var_sci,
          
          ent.str_avg as str_ent,
          mue.str_avg as str_mue,
          ((ent.str_avg / NULLIF(mue.str_avg, 0)) - 1) * 100 as var_str,
          
          ent.sf_avg as sf_ent,
          mue.sf_avg as sf_mue,
          ((ent.sf_avg / NULLIF(mue.sf_avg, 0)) - 1) * 100 as var_sf
      FROM promedios_lote ent
      LEFT JOIN promedios_lote mue ON ent.muestra = mue.lote
      WHERE ent.tipo = 'Ent' AND (mue.tipo = 'Mue' OR mue.tipo IS NULL)
      ORDER BY ent.lote ASC
    `;

    const result = await query(sql, [], 'hvi-comparacion-muestra');
    
    const formatted = result.rows.map(r => {
      const sci_mue = r.sci_mue || 0;
      const sci_ent = r.sci_ent || 0;
      const str_mue = r.str_mue || 0;
      const str_ent = r.str_ent || 0;
      const sf_mue = r.sf_mue || 0;
      const sf_ent = r.sf_ent || 0;

      const var_sci = sci_mue > 0 ? ((sci_ent / sci_mue) - 1) * 100 : 0;
      const var_str = str_mue > 0 ? ((str_ent / str_mue) - 1) * 100 : 0;
      const var_sf = sf_mue > 0 ? ((sf_ent / sf_mue) - 1) * 100 : 0;

      let alerta = '';
      let critico = false;

      if (sci_mue > 0) {
        if (var_str < -5 || var_sci < -5 || var_sf > 5) {
          alerta = '⚠️ ALERTA DE RECLAMO: Calidad inferior a la muestra aprobada';
          critico = true;
        }
      }

      return {
          lote: r.lote_ent,
          muestra: r.lote_mue || 'No vinculada',
          sci_mue: sci_mue > 0 ? parseFloat(sci_mue).toFixed(1) : '---',
          sci_ent: parseFloat(sci_ent).toFixed(1),
          var_sci: sci_mue > 0 ? var_sci.toFixed(1) + '%' : '---',
          str_mue: str_mue > 0 ? parseFloat(str_mue).toFixed(1) : '---',
          str_ent: parseFloat(str_ent).toFixed(1),
          var_str: str_mue > 0 ? var_str.toFixed(1) + '%' : '---',
          sf_mue: sf_mue > 0 ? parseFloat(sf_mue).toFixed(1) : '---',
          sf_ent: parseFloat(sf_ent).toFixed(1),
          var_sf: sf_mue > 0 ? var_sf.toFixed(1) + '%' : '---',
          alerta,
          critico,
          estado: sci_mue === 0 ? 'SIN MUESTRA' : (critico ? 'RECHAZADO' : 'ACEPTADO')
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error en comparación HVI:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hvi/predecir-hilatura', async (req, res) => {
  try {
    const { lote, pacas, metadata, contexto } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_API_KEY no configurada' });
    }

    // Permitir selección de modelo desde el frontend (req.body.model) o usar el default
    // Default actualizamos a Gemini 3 Pro (Preview) a petición del usuario para desarrollo
    const modelName = req.body.model || "gemini-3-pro-preview";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Procesamiento de datos para la estructura requerida por el Prompt
    // Separar Muestras (Mue) y Entradas (Ent)
    const muestras = pacas.filter(p => p.tipo === 'Mue' || p.Tipo === 'Mue');
    const entradas = pacas.filter(p => p.tipo === 'Ent' || p.Tipo === 'Ent');

    // Si no hay distinción clara en el array enviado, asumimos que todo es 'Ent' y buscamos si hay referencia en metadatos
    // O si es un análisis simple de un solo lote.
    
    // Cálculo de promedios auxiliares
    const calcularPromedios = (items) => {
        if (!items.length) return {};
        const sum = items.reduce((acc, curr) => ({
            sci: acc.sci + (parseFloat(curr.sci || curr.SCI) || 0),
            str: acc.str + (parseFloat(curr.str || curr.STR) || 0),
            sf: acc.sf + (parseFloat(curr.sf || curr.SF) || 0),
            rd: acc.rd + (parseFloat(curr.rd || curr.RD) || 0),
            plus_b: acc.plus_b + (parseFloat(curr.plusb || curr['+b']) || 0),
            mic: acc.mic + (parseFloat(curr.mic || curr.MIC) || 0),
            trash: acc.trash + (parseFloat(curr.trash || curr.Trash) || 0)
        }), { sci: 0, str: 0, sf: 0, rd: 0, plus_b: 0, mic: 0, trash: 0 });
        
        return {
            sci: parseFloat((sum.sci / items.length).toFixed(1)),
            str: parseFloat((sum.str / items.length).toFixed(1)),
            sf: parseFloat((sum.sf / items.length).toFixed(1)),
            rd: parseFloat((sum.rd / items.length).toFixed(1)),
            plus_b: parseFloat((sum.plus_b / items.length).toFixed(1)),
            mic: parseFloat((sum.mic / items.length).toFixed(2)),
            trash: parseFloat((sum.trash / items.length).toFixed(2))
        };
    };

    const datosPromedioMue = calcularPromedios(muestras);
    const datosPromedioEnt = calcularPromedios(entradas);

    // Construcción del JSON estructurado para el Prompt
    const datosParaPrompt = {
        referencia_muestra: muestras.length > 0 ? {
            lote: muestras[0].lote || muestras[0].Lote || "Desconocido",
            tot: muestras.length,
            prom: datosPromedioMue
        } : null,
        lote_recibido: entradas.length > 0 ? {
            lote: entradas[0].lote || entradas[0].Lote || lote, 
            tot: entradas.length,
            prom: datosPromedioEnt
        } : {
            lote: lote,
            tot: pacas.length,
            prom: calcularPromedios(pacas)
        },
        // INCORPORAMOS LOS 30 PEORES FARDOS (Reducido drásticamente para evitar quota limits)
        // Minificamos la data antes de enviarla
        fardos_criticos: (entradas.length > 0 ? entradas : pacas)
           .sort((a,b) => (parseFloat(a.sci) || 0) - (parseFloat(b.sci) || 0))
           .slice(0, 30)
           .map(f => ({
               id: f.fardo, 
               sci: Math.round(f.sci||f.SCI), 
               str: parseFloat(f.str||f.STR).toFixed(1), 
               mic: parseFloat(f.mic||f.MIC).toFixed(2)
           }))
    };

    // Si tenemos ambos, es un cruce. Si solo tenemos uno, es análisis individual.
    // El usuario pidió explícitamente lógica de cruce, pero debemos ser robustos.

    const prompt = `Actúa como un Ingeniero Senior de Planta de Denim. Tu misión principal es la Auditoría de Cumplimiento de Compra.
    IMPORTANTE: Responde de manera EJECUTIVA y RÁPIDA.

    LÓGICA DE RELACIÓN (CRUCE DE DATOS):
    Te estoy enviando dos conjuntos de datos o uno según disponibilidad: la Muestra (Tipo: 'Mue') y la Entrada (Tipo: 'Ent').
    
    Debes usar el valor de la columna lote de la Muestra para compararlo con el valor de la columna muestra de la Entrada (si existen).
    
    Es obligatorio calcular la variación porcentual entre ambos: ((Promedio_Ent / Promedio_Mue) - 1) * 100. (Solo si hay datos de referencia).

    REGLAS DE EVALUACIÓN TÉCNICA:
    1. Foco en Denim: Analiza aptitud para 7/1 a 10/1 (Trama), 10/1 Flame y 12.5/1 a 16/1 (Urdimbre).
    2. Penalización por Desviación: Si el STR o el SCI caen más de un 5% respecto a la muestra, califica el lote como 'No Conforme/Reclamo Directo'.
    3. Análisis de Color (Rd y +b): Compara el brillo y la amarillez. Si la entrada es más amarilla (+b mayor) que la muestra, advierte sobre 'Variación de Tono en el Lote Final'.

    ESTRUCTURA DEL REPORTE:
    1. Tabla Comparativa de Desviación: (Mue vs Ent) para SCI, STR, MIC, SF y Trash. Incluye columnas: Muestra, Entrada, Var %, Estado.
    2. Diagnóstico de Procesabilidad: Impacto en paros de rotor y cortes en telar basado en la caída de calidad.
    3. Conclusión de Compra: Dictamen final para el sector adquisiciones (Aceptar, Aceptar con descuento, o Rechazar).

    DATOS DE ENTRADA (JSON):
    ${JSON.stringify(datosParaPrompt, null, 2)}

    NOTA ADICIONAL DE CONTEXTO:
    Si solo recibes 'lote_recibido' sin 'referencia_muestra', realiza la evaluación técnica absoluta basada en estándares de Denim (SCI > 130, STR > 28, etc.) pero indica que falta la muestra para la comparativa contractual.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ success: true, insight: text });
  } catch (error) {
    console.error("Error Gemini:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// CORRELACIÓN MEZCLA (HVI) → HILO (USTER + TENSORAPID)
// =====================================================

// Helpers de estadística
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  );
  return den === 0 ? 0 : parseFloat((num / den).toFixed(4));
}

function linearRegression(x, y) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const ssxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const ssxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const slope = ssxx === 0 ? 0 : ssxy / ssxx;
  const intercept = my - slope * mx;
  const r = pearsonCorrelation(x, y) || 0;
  return {
    slope: parseFloat(slope.toFixed(4)),
    intercept: parseFloat(intercept.toFixed(4)),
    r2: parseFloat((r * r).toFixed(4))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/produccion/partida-tejeduria
// Trazabilidad completa de una partida – sector TEJEDURÍA
// Query params: partida (requerido), filial (opcional, default '05')
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/produccion/partida-tejeduria', async (req, res) => {
  try {
    const { partida, filial = '05' } = req.query;
    if (!partida) return res.status(400).json({ error: 'Se requiere parámetro "partida"' });

    // Construir candidatos: el valor exacto + con 1 ó 2 ceros al frente
    // Ej: '535201' → ['535201', '0535201', '00535201']
    const partidaCandidates = [...new Set([
      partida,
      '0'  + partida,
      '00' + partida
    ])];

    const pNum  = col => sqlParseNumber(col);
    const pNumI = col => sqlParseNumberIntl(col);  // para columnas con separador de miles (3.000,00)
    const pDate = col => sqlParseDate(col);

    // Detectar nombre exacto de columnas variables en tb_produccion
    const colsRes = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_produccion'`,
      [], 'partida-tej/cols'
    );
    const prodCols = new Map((colsRes.rows || []).map(r => [String(r.column_name).toLowerCase(), r.column_name]));
    const maqKey  = ['maq  fiacao', 'maq fiacao'].find(c => prodCols.has(c));
    const loteKey = ['lote fiacao', 'lote  fiacao'].find(c => prodCols.has(c));
    const maqExpr  = maqKey  ? `p.${quoteIdent(prodCols.get(maqKey))}` : 'NULL::text';
    const loteExpr = loteKey ? `p.${quoteIdent(prodCols.get(loteKey))}` : 'NULL::text';

    // ── Q1: registros diario/turno (TECELAGEM) ──────────────────────────────
    const sqlRegistros = `
      SELECT
        ${pDate('p."DT_BASE_PRODUCAO"')}              AS fecha,
        p."TURNO"                                       AS turno,
        p."PARTIDA"                                     AS partida,
        ${pNum('p."METRAGEM"')}                        AS metros_crudos,
        ${pNum('p."PARADA TEC TRAMA"')}                AS paradas_trama,
        ${pNum('p."PARADA TEC URDUME"')}               AS paradas_urdimbre,
        ${pNum('p."PONTOS_LIDOS"')}                    AS pontos_lidos,
        ${pNum('p."PONTOS_100%"')}                     AS pontos_100,
        ${pNum('p."RPM LEITURA"')}                     AS rpm,
        p."ARTIGO"                                      AS artigo,
        p."COR"                                         AS cor,
        p."NM MERCADO"                                  AS nm_mercado,
        p."MAQUINA"                                     AS maquina,
        p."TRAMA REDUZIDA 1"                            AS trama,
        ${pNum('p."BATIDAS"')}                         AS batidas,
        p."GRUPO TEAR"                                  AS grupo_tear,
        p."BASE URDUME"                                 AS base_urdume,
        p."ROLADA"                                      AS rolada
      FROM tb_produccion p
      WHERE p."FILIAL" = $2
        AND p."PARTIDA" = ANY($1::text[])
        AND p."SELETOR" = 'TECELAGEM'
      ORDER BY ${pDate('p."DT_BASE_PRODUCAO"')} ASC NULLS LAST, p."TURNO" ASC
    `;

    // ── Q2: totales/promedios consolidados (TECELAGEM) ──────────────────────
    const sqlTotales = `
      SELECT
        SUM(${pNum('p."METRAGEM"')})                   AS metros_crudos,
        SUM(${pNum('p."PARADA TEC TRAMA"')})           AS paradas_trama,
        SUM(${pNum('p."PARADA TEC URDUME"')})          AS paradas_urdimbre,
        SUM(${pNum('p."PONTOS_LIDOS"')})               AS pontos_lidos,
        SUM(${pNum('p."PONTOS_100%"')})                AS pontos_100,
        AVG(${pNum('p."RPM LEITURA"')})                AS rpm
      FROM tb_produccion p
      WHERE p."FILIAL" = $2
        AND p."PARTIDA" = ANY($1::text[])
        AND p."SELETOR" = 'TECELAGEM'
    `;

    const [resRegistros, resTotales] = await Promise.all([
      query(sqlRegistros, [partidaCandidates, filial], 'partida-tej/registros'),
      query(sqlTotales,   [partidaCandidates, filial], 'partida-tej/totales')
    ]);

    const rows = resRegistros.rows;
    if (rows.length === 0) {
      return res.json({
        success: true,
        encontrada: false,
        encabezado: {},
        registros: [],
        totales: {}
      });
    }

    // ── Encabezado (valores del primer registro no nulo) ──────────────────
    const hdr  = rows[0];
    const art  = (hdr.artigo  || '').substring(0, 10);
    const cor  = hdr.cor  || '';
    const base = hdr.base_urdume || '';
    // Maquina: últimos 2 dígitos como número
    const telar = hdr.maquina ? parseInt(hdr.maquina.replace(/\D+$/, '').slice(-2) || '0', 10) || hdr.maquina : '';

    // ── Cómputos por fila ─────────────────────────────────────────────────
    let acum = 0;
    const registros = rows.map(r => {
      const mc   = parseFloat(r.metros_crudos) || 0;
      const mt   = Math.round(mc * 0.85 * 10) / 10;
      const pt   = parseFloat(r.paradas_trama) || 0;
      const pu   = parseFloat(r.paradas_urdimbre) || 0;
      const pl   = parseFloat(r.pontos_lidos) || 0;
      const p100 = parseFloat(r.pontos_100) || 0;
      const efi  = p100 > 0 ? Math.round((pl / p100 * 100) * 10) / 10 : null;
      const rt   = pl > 0   ? Math.round((pt * 100000 / (pl * 1000)) * 100) / 100 : null;
      const ru   = pl > 0   ? Math.round((pu * 100000 / (pl * 1000)) * 100) / 100 : null;
      acum += mt;
      return {
        fecha:            r.fecha,
        turno:            r.turno,
        partida:          r.partida,
        metros_crudos:    parseFloat(mc.toFixed(1)),
        metros_term:      mt,
        metros_term_acum: Math.round(acum * 10) / 10,
        paradas_trama:    pt,
        paradas_urdimbre: pu,
        total_paradas:    pt + pu,
        eficiencia:       efi,
        rt_105:           rt,
        ru_105:           ru,
        rpm:              r.rpm !== null ? Math.round(parseFloat(r.rpm)) : null
      };
    });

    // ── Totales ────────────────────────────────────────────────────────────
    const tot = resTotales.rows[0] || {};
    const tmc  = parseFloat(tot.metros_crudos) || 0;
    const tpt  = parseFloat(tot.paradas_trama) || 0;
    const tpu  = parseFloat(tot.paradas_urdimbre) || 0;
    const tpl  = parseFloat(tot.pontos_lidos) || 0;
    const tp100 = parseFloat(tot.pontos_100) || 0;
    const totales = {
      metros_crudos:    Math.round(tmc),
      metros_term:      Math.round(tmc * 0.85),
      paradas_trama:    tpt,
      paradas_urdimbre: tpu,
      total_paradas:    tpt + tpu,
      eficiencia:       tp100 > 0 ? Math.round((tpl / tp100 * 100) * 10) / 10 : null,
      rt_105:           tpl > 0   ? Math.round((tpt * 100000 / (tpl * 1000)) * 100) / 100 : null,
      ru_105:           tpl > 0   ? Math.round((tpu * 100000 / (tpl * 1000)) * 100) / 100 : null,
      rpm:              tot.rpm !== null ? Math.round(parseFloat(tot.rpm)) : null
    };

    // ── ROLADAs: del conjunto TECELAGEM (para header) + derivada del string de partida ──
    const roladas = [...new Set(rows.map(r => r.rolada).filter(Boolean))];

    // Usar la partida real de la BD (puede tener ceros al frente que el usuario no ingresó)
    // Derivar ROLADA: Left(Right(partida, 6), 4) → '0535201' → '535201' → '5352'
    const partidaReal    = String(rows[0].partida || partida);
    const roladaDerivada = partidaReal.length >= 6 ? partidaReal.slice(-6, -2) : partidaReal;

    // ── Q3: Roturas URDIDORA (RU106) ──────────────────────────────────────
    // Fórmula per-fila: SUM(RUPTURAS * 1_000_000) / NULLIF(SUM(METRAGEM * NUM_FIOS), 0)
    // SELETOR incluye tanto 'URDIDEIRA' como 'URDIDORA'
    // METRAGEM/NUM_FIOS usan formato europeo (3.000,00) → pNumI
    const sqlRU106 = `
      SELECT
        SUM(${pNum('p."RUPTURAS"')} * 1000000.0)                                          AS numerador,
        NULLIF(SUM(${pNumI('p."METRAGEM"')} * ${pNumI('p."NUM_FIOS"')}), 0)             AS denominador
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
    `;

    // ── Q4: Roturas INDIGO (RI103) ────────────────────────────────────────
    // METRAGEM usa formato europeo → pNumI
    const sqlRI103 = `
      SELECT
        SUM(${pNum('p."RUPTURAS"')}) * 1000.0 / NULLIF(SUM(${pNumI('p."METRAGEM"')}), 0) AS ri103
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" = 'INDIGO'
    `;

    // ── Q5: Lotes de hilo URDIDORA ────────────────────────────────────────
    const sqlLotes = `
      SELECT DISTINCT ${pNum(loteExpr)} AS lote
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND ${loteExpr} IS NOT NULL AND ${loteExpr} <> ''
      ORDER BY ${pNum(loteExpr)} ASC NULLS LAST
    `;

    // ── Q6: Máquinas OE URDIDORA ─────────────────────────────────────────
    const sqlOEs = `
      SELECT DISTINCT RIGHT(${maqExpr}, 2) AS oe_raw
      FROM tb_produccion p
      WHERE p."FILIAL" = $1
        AND p."ROLADA" = $2
        AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND ${maqExpr} IS NOT NULL AND ${maqExpr} <> ''
      ORDER BY RIGHT(${maqExpr}, 2) ASC NULLS LAST
    `;

    const [resRU106, resRI103, resLotes, resOEs] = await Promise.all([
      query(sqlRU106, [filial, roladaDerivada], 'partida-tej/ru106'),
      query(sqlRI103, [filial, roladaDerivada], 'partida-tej/ri103'),
      query(sqlLotes, [filial, roladaDerivada], 'partida-tej/lotes'),
      query(sqlOEs,   [filial, roladaDerivada], 'partida-tej/oes')
    ]);

    // ── Calcular RU106 ─────────────────────────────────────────────────────
    let rot_urd_106 = null;
    if (resRU106.rows[0]) {
      const ru = resRU106.rows[0];
      const num = parseFloat(ru.numerador) || 0;
      const den = parseFloat(ru.denominador);
      if (den && den > 0) {
        rot_urd_106 = Math.round((num / den) * 100) / 100;
      }
    }

    // ── Calcular RI103 ─────────────────────────────────────────────────────
    let rot_ind_103 = null;
    if (resRI103.rows[0]) {
      const ri = resRI103.rows[0];
      const val = parseFloat(ri.ri103);
      if (!isNaN(val)) {
        rot_ind_103 = Math.round(val * 100) / 100;
      }
    }

    // ── Lotes y OEs ────────────────────────────────────────────────────────
    const lotesArr = resLotes.rows.map(r => r.lote).filter(Boolean);
    // Extraer número de OE del raw (ej. '06' → 6, ' 8' → 8)
    const oesArr   = [...new Set(
      resOEs.rows.map(r => {
        const raw = String(r.oe_raw || '').trim();
        const n = parseInt(raw, 10);
        return isNaN(n) ? raw : n;
      }).filter(v => v !== '' && v !== null)
    )].sort((a, b) => a - b);

    const encabezado = {
      articulo:    `${art} ${cor}`.trim(),
      nombre:      hdr.nm_mercado || '',
      telar,
      trama:       hdr.trama || '',
      pasadas:     hdr.batidas !== null ? parseFloat(hdr.batidas) : null,
      grupo:       hdr.grupo_tear || '',
      base,
      rot_urd_106,
      rot_ind_103,
      oes:         oesArr.join(', '),
      lote:        lotesArr.join(', '),
      roladas
    };

    // ── Q7: Historial de máquinas por las que pasó la partida ─────────────
    // Agrupa por MAQUINA (todos los SELETOR), mostrando primer inicio / último fin / suma metros
    let historial = [];
    try {
      const sqlHistorial = `
        WITH base AS (
          SELECT
            p."MAQUINA",
            p."SELETOR",
            p."PARTIDA"                          AS partida_rec,
            ${pDate('p."DT_INICIO"')}       AS dt_ini_parsed,
            p."HORA_INICIO",
            ${pDate('p."DT_FINAL"')}        AS dt_fin_parsed,
            p."HORA_FINAL",
            ${pNumI('p."METRAGEM"')}                AS metros_val,
            ${pNum('p."RUPTURAS"')}                 AS rupturas_val,
            ${pNumI('p."NUM_FIOS"')}                AS num_fios_val,
            ${pNumI('p."CAVALOS"')}                 AS cavalos_val,
            ${pNumI('p."VELOC"')}                   AS veloc_val,
            ${pNum('p."PONTOS_LIDOS"')}             AS pontos_lidos_val,
            ${pNum('p."PONTOS_100%"')}              AS pontos_100_val,
            ${pNum('p."PARADA TEC TRAMA"')}         AS par_trama_val,
            ${pNum('p."PARADA TEC URDUME"')}        AS par_urd_val,
            p."ARTIGO",
            p."COR",
            p."NM MERCADO"                          AS nm_mercado
          FROM tb_produccion p
          WHERE p."FILIAL" = $2
            AND (
              -- TECELAGEM, INDIGO, ACABAMENTO: ligados por nro de partida
              p."PARTIDA" = ANY($1::text[])
              OR
              -- URDIDEIRA / URDIDORA: sus registros usan como PARTIDA el nro de haz
              -- (ej. 544401..544416) y se vinculan a la partida de tejeria via ROLADA
              ( p."ROLADA" = $3
                AND p."SELETOR" IN ('URDIDEIRA', 'URDIDORA') )
            )
            AND p."MAQUINA" IS NOT NULL
            AND TRIM(p."MAQUINA"::text) <> ''
        ),
        por_maquina AS (
          SELECT
            "MAQUINA",
            MAX("SELETOR")                      AS seletor,
            MIN(dt_ini_parsed)                   AS dt_inicio,
            MAX(dt_fin_parsed)                   AS dt_final,
            ROUND(COALESCE(SUM(metros_val), 0)::numeric, 0) AS metros_raw,
            -- Partida a mostrar: URDIDEIRA usa LEFT(RIGHT(partida,6),4) = nro de orden de urdido
            -- Resto: la partida tal cual
            CASE
              WHEN MAX("SELETOR") IN ('URDIDEIRA', 'URDIDORA')
              THEN LEFT(RIGHT(MIN(partida_rec)::text, 6), 4)
              ELSE MAX(partida_rec)::text
            END                                  AS partida_display,
            MAX("ARTIGO")                        AS artigo,
            MAX("COR")                           AS cor,
            MAX(nm_mercado)                      AS nm_mercado
          FROM base
          GROUP BY "MAQUINA"
        ),
        -- URDIDEIRA: sumar METRAGEM por haz (PARTIDA) individualmente,
        -- luego tomar MAX. Esto da la longitud del haz completo (ej. 60.000m)
        -- independientemente de cuantos haces haya en la ROLADA o si alguno es parcial.
        beam_max AS (
          SELECT
            sub."MAQUINA",
            MAX(sub.haz_total) AS metros_beam
          FROM (
            SELECT "MAQUINA", partida_rec,
                   SUM(metros_val) AS haz_total
            FROM base
            WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
            GROUP BY "MAQUINA", partida_rec
          ) sub
          GROUP BY sub."MAQUINA"
        ),
        -- ROT 106 por maquina (URDIDEIRA/URDIDORA)
        rot106_maq AS (
          SELECT
            "MAQUINA",
            ROUND(
              (SUM(rupturas_val * 1000000.0)
               / NULLIF(SUM(metros_val * num_fios_val), 0))::numeric
            , 2) AS rot_106
          FROM base
          WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
            AND num_fios_val > 0
          GROUP BY "MAQUINA"
        ),
        -- INDIGO: R10³, Cav 10⁵, Vel.Nom
        indigo_vals AS (
          SELECT
            "MAQUINA",
            ROUND(SUM(rupturas_val) * 1000.0   / NULLIF(SUM(metros_val), 0), 2) AS r103,
            ROUND(SUM(cavalos_val) * 100000.0  / NULLIF(SUM(metros_val), 0), 1) AS cav105,
            MAX(veloc_val) AS vel_nom
          FROM base
          WHERE "SELETOR" = 'INDIGO'
          GROUP BY "MAQUINA"
        ),
        -- TECELAGEM: Efic%, RU10⁵, RT10⁵
        tecelagem_vals AS (
          SELECT
            "MAQUINA",
            ROUND(SUM(pontos_lidos_val) * 100.0  / NULLIF(SUM(pontos_100_val), 0), 1) AS efic_pct,
            ROUND(SUM(par_urd_val) * 100000.0    / NULLIF(SUM(pontos_lidos_val) * 1000, 0), 1) AS ru105,
            ROUND(SUM(par_trama_val) * 100000.0  / NULLIF(SUM(pontos_lidos_val) * 1000, 0), 1) AS rt105
          FROM base
          WHERE "SELETOR" = 'TECELAGEM'
          GROUP BY "MAQUINA"
        ),
        -- ACABAMENTO: Velocidad
        acabamento_vals AS (
          SELECT
            "MAQUINA",
            MAX(veloc_val) AS veloc
          FROM base
          WHERE "SELETOR" ILIKE 'ACABAMENTO%'
          GROUP BY "MAQUINA"
        ),
        primera_hora AS (
          SELECT DISTINCT ON ("MAQUINA")
            "MAQUINA",
            "HORA_INICIO"
          FROM base
          ORDER BY "MAQUINA", dt_ini_parsed ASC NULLS LAST
        ),
        ultima_hora AS (
          SELECT DISTINCT ON ("MAQUINA")
            "MAQUINA",
            "HORA_FINAL"
          FROM base
          ORDER BY "MAQUINA", dt_fin_parsed DESC NULLS LAST
        )
        SELECT
          pm."MAQUINA"      AS maquina,
          pm.seletor,
          pm.dt_inicio,
          ph."HORA_INICIO"  AS hora_inicio,
          pm.dt_final,
          uh."HORA_FINAL"   AS hora_final,
          CASE
            WHEN pm.seletor IN ('URDIDEIRA', 'URDIDORA')
            THEN COALESCE(bm.metros_beam, pm.metros_raw)
            ELSE pm.metros_raw
          END               AS metros,
          pm.partida_display,
          rm.rot_106,
          iv.r103,     iv.cav105,  iv.vel_nom,
          tv.efic_pct, tv.ru105,   tv.rt105,
          av.veloc,
          pm.artigo,
          pm.cor,
          pm.nm_mercado
        FROM por_maquina pm
        LEFT JOIN primera_hora   ph ON ph."MAQUINA" = pm."MAQUINA"
        LEFT JOIN ultima_hora    uh ON uh."MAQUINA" = pm."MAQUINA"
        LEFT JOIN beam_max       bm ON bm."MAQUINA" = pm."MAQUINA"
        LEFT JOIN rot106_maq     rm ON rm."MAQUINA" = pm."MAQUINA"
        LEFT JOIN indigo_vals    iv ON iv."MAQUINA" = pm."MAQUINA"
        LEFT JOIN tecelagem_vals tv ON tv."MAQUINA" = pm."MAQUINA"
        LEFT JOIN acabamento_vals av ON av."MAQUINA" = pm."MAQUINA"
        ORDER BY pm.dt_inicio ASC NULLS LAST, pm."MAQUINA" ASC
      `;
      const resHistorial = await query(sqlHistorial, [partidaCandidates, filial, roladaDerivada], 'partida-tej/historial');
      const pf = v => (v !== null && v !== undefined) ? parseFloat(v) : null;
      historial = (resHistorial.rows || []).map(r => ({
        maquina:         r.maquina,
        seletor:         r.seletor,
        dt_inicio:       r.dt_inicio,
        hora_inicio:     r.hora_inicio,
        dt_final:        r.dt_final,
        hora_final:      r.hora_final,
        metros:          pf(r.metros),
        rot_106:         pf(r.rot_106),
        // INDIGO
        r103:            pf(r.r103),
        cav105:          pf(r.cav105),
        vel_nom:         pf(r.vel_nom),
        // TECELAGEM
        efic_pct:        pf(r.efic_pct),
        ru105:           pf(r.ru105),
        rt105:           pf(r.rt105),
        // ACABAMENTO
        veloc:           pf(r.veloc),
        partida_display: r.partida_display || '',
        artigo:          r.artigo,
        cor:             r.cor,
        nm_mercado:      r.nm_mercado
      }));
    } catch (histErr) {
      console.warn('partida-tej/historial: columnas no disponibles -', histErr.message);
      historial = [];
    }

    // ── Q8: tb_calidad agrupada por partida ────────────────────────────
    // REVISOR FINAL = Maquina; MIN/MAX de DAT_PROD+HORA como inicio/fin
    let calidad = [];
    try {
      const sqlCalidad = `
        WITH base_cal AS (
          SELECT
            c."PARTIDA",
            TRIM(c."REVISOR FINAL"::text)              AS revisor,
            ${pDate('c."DAT_PROD"')}                  AS dat_prod_parsed,
            LPAD(TRIM(COALESCE(c."HORA"::text, '0')), 4, '0') AS hora_fmt,
            ${pNum('c."METRAGEM"')}                   AS metros_val,
            ${pNum('c."PONTUACAO"')}                 AS pontuacao_val,
            ${pNum('c."LARGURA"')}                   AS largura_val,
            UPPER(TRIM(COALESCE(c."QUALIDADE"::text, ''))) AS qualidade_val,
            c."ARTIGO",
            c."COR",
            c."NM MERC"                               AS nm_mercado
          FROM tb_calidad c
          WHERE c."PARTIDA" = ANY($1::text[])
            AND TRIM(COALESCE(c."REVISOR FINAL"::text, '')) <> ''
        ),
        min_row AS (
          SELECT DISTINCT ON ("PARTIDA")
            "PARTIDA",
            dat_prod_parsed AS dat_inicio,
            LEFT(hora_fmt, 2) || ':' || RIGHT(hora_fmt, 2) AS hora_inicio
          FROM base_cal
          ORDER BY "PARTIDA", dat_prod_parsed ASC NULLS LAST, hora_fmt ASC NULLS LAST
        ),
        max_row AS (
          SELECT DISTINCT ON ("PARTIDA")
            "PARTIDA",
            dat_prod_parsed AS dat_final,
            LEFT(hora_fmt, 2) || ':' || RIGHT(hora_fmt, 2) AS hora_final
          FROM base_cal
          ORDER BY "PARTIDA", dat_prod_parsed DESC NULLS LAST, hora_fmt DESC NULLS LAST
        )
        SELECT
          STRING_AGG(
            DISTINCT b.revisor, ' / '
            ORDER BY b.revisor
          )                                     AS revisores,
          b."PARTIDA"                           AS partida,
          mn.dat_inicio,
          mn.hora_inicio,
          mx.dat_final,
          mx.hora_final,
          ROUND(SUM(b.metros_val)::numeric, 0)  AS metros,
          ROUND(
            SUM(CASE WHEN b.qualidade_val LIKE 'PRIMEIRA%' THEN b.metros_val ELSE 0 END)
            * 100.0 / NULLIF(SUM(b.metros_val), 0)
          , 1)                                  AS cal_pct,
          ROUND(
            SUM(b.pontuacao_val) * 100.0
            / NULLIF(SUM(b.metros_val * COALESCE(b.largura_val, 0) / 100.0), 0)
          , 1)                                  AS pts_100m2,
          MAX(b."ARTIGO")                       AS artigo,
          MAX(b."COR")                          AS cor,
          MAX(b.nm_mercado)                     AS nm_mercado
        FROM base_cal b
        JOIN min_row mn ON mn."PARTIDA" = b."PARTIDA"
        JOIN max_row mx ON mx."PARTIDA" = b."PARTIDA"
        GROUP BY b."PARTIDA", mn.dat_inicio, mn.hora_inicio, mx.dat_final, mx.hora_final
        ORDER BY mn.dat_inicio ASC NULLS LAST, b."PARTIDA" ASC
      `;
      const resCalidad = await query(sqlCalidad, [partidaCandidates], 'partida-tej/calidad');
      calidad = (resCalidad.rows || []).map(r => ({
        revisores:   r.revisores  || '',
        partida:     r.partida    || '',
        dat_inicio:  r.dat_inicio,
        hora_inicio: r.hora_inicio || '',
        dat_final:   r.dat_final,
        hora_final:  r.hora_final  || '',
        metros:      r.metros !== null ? parseFloat(r.metros) : null,
        cal_pct:     r.cal_pct  !== null && r.cal_pct  !== undefined ? parseFloat(r.cal_pct)  : null,
        pts_100m2:   r.pts_100m2 !== null && r.pts_100m2 !== undefined ? parseFloat(r.pts_100m2) : null,
        artigo:      r.artigo,
        cor:         r.cor,
        nm_mercado:  r.nm_mercado
      }));
    } catch (calErr) {
      console.warn('partida-tej/calidad:', calErr.message);
      calidad = [];
    }

    res.json({
      success: true,
      encontrada: true,
      encabezado,
      registros,
      totales,
      historial,
      calidad
    });

  } catch (err) {
    console.error('Error /api/produccion/partida-tejeduria:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/correlacion/mezcla-hilo
// Query params: fecha_inicio, fecha_fin, ne_titulo (opt)
app.get('/api/correlacion/mezcla-hilo', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, ne_titulo } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ success: false, error: 'Se requieren fecha_inicio y fecha_fin' });
    }

    // Extrae el numero de mistura del campo lote: "HD-91-25", "HD 91-25", etc. → "91"
    const sql = `
      WITH uster_lotes AS (
        SELECT
          u.testnr,
          u.lote AS lote_raw,
          u.nomcount,
          u.time_stamp,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) AS mistura_num
        FROM tb_uster_par u
        WHERE u.time_stamp IS NOT NULL
          AND TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY') BETWEEN $1::date AND $2::date
          AND ($3::text IS NULL OR u.nomcount = SPLIT_PART($3, '/', 1) OR u.nomcount::text ILIKE $3)
      ),
      uster_avg AS (
        SELECT
          testnr,
          ROUND(AVG(cvm_percent)::numeric, 2)       AS cvm,
          ROUND(AVG(h)::numeric, 2)                 AS vellosidad,
          ROUND(AVG(neps_200_km)::numeric, 1)        AS neps_200,
          ROUND(AVG(delg_minus50_km)::numeric, 1)    AS thin_50,
          ROUND(AVG(grue_50_km)::numeric, 1)         AS thick_50
        FROM tb_uster_tbl
        GROUP BY testnr
      ),
      tenso_avg AS (
        SELECT
          p.uster_testnr,
          ROUND(AVG(t.tenacidad)::numeric, 2)   AS tenacidad,
          ROUND(AVG(t.elongacion)::numeric, 2)  AS elongacion
        FROM tb_tensorapid_par p
        JOIN tb_tensorapid_tbl t ON t.testnr = p.testnr
        WHERE p.uster_testnr IS NOT NULL
        GROUP BY p.uster_testnr
      ),
      hvi_avg AS (
        SELECT
          "LOTE_FIAC"::integer                                       AS lote_fiac_num,
          ROUND(AVG(REPLACE("STR",  ',', '.')::numeric), 2)          AS str_avg,
          ROUND(AVG(REPLACE("SCI",  ',', '.')::numeric), 2)          AS sci_avg,
          ROUND(AVG(REPLACE("MIC",  ',', '.')::numeric), 3)          AS mic_avg,
          ROUND(AVG(REPLACE("UHML", ',', '.')::numeric), 2)          AS uhml_avg,
          COUNT(*)                                                   AS fardos
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '^\\d+$'
          AND "STR"  ~ '^[0-9][0-9,\\.]*$'
          AND "SCI"  ~ '^[0-9][0-9,\\.]*$'
          AND "MIC"  ~ '^[0-9][0-9,\\.]*$'
          AND "UHML" ~ '^[0-9][0-9,\\.]*$'
        GROUP BY "LOTE_FIAC"::integer
      )
      SELECT
        ul.lote_raw,
        ul.mistura_num,
        ul.nomcount        AS ne_titulo,
        TO_DATE(SPLIT_PART(ul.time_stamp, ' ', 1), 'DD/MM/YYYY') AS fecha,
        ua.cvm,
        ua.vellosidad,
        ua.neps_200,
        ua.thin_50,
        ua.thick_50,
        ta.tenacidad,
        ta.elongacion,
        ha.str_avg   AS str,
        ha.sci_avg   AS sci,
        ha.mic_avg   AS mic,
        ha.uhml_avg  AS uhml,
        ha.fardos    AS fardos_hvi
      FROM uster_lotes ul
      JOIN uster_avg  ua ON ua.testnr       = ul.testnr
      LEFT JOIN tenso_avg ta ON ta.uster_testnr = ul.testnr
      JOIN hvi_avg    ha ON ha.lote_fiac_num = ul.mistura_num::integer
      ORDER BY ul.time_stamp ASC
    `;

    const result = await query(sql, [fecha_inicio, fecha_fin, ne_titulo || null], 'correlacion-mezcla-hilo');
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({ success: true, datos: [], correlaciones: [], n: 0 });
    }

    // Variables HVI disponibles como causas
    const hviVars   = ['str', 'sci', 'mic', 'uhml'];
    // Variables hilo disponibles como efectos
    const hiloVars  = ['cvm', 'vellosidad', 'neps_200', 'thin_50', 'thick_50', 'tenacidad', 'elongacion'];

    // Filtra pares validos (ambos valores numéricos != null) para cada combinación
    const correlaciones = [];
    for (const hv of hviVars) {
      for (const yv of hiloVars) {
        const pares = rows.filter(r =>
          r[hv] != null && r[yv] != null &&
          !isNaN(parseFloat(r[hv])) && !isNaN(parseFloat(r[yv]))
        );
        if (pares.length < 3) continue;
        const x = pares.map(r => parseFloat(r[hv]));
        const y = pares.map(r => parseFloat(r[yv]));
        const r  = pearsonCorrelation(x, y);
        const lr = linearRegression(x, y);
        correlaciones.push({
          hvi_var:   hv,
          hilo_var:  yv,
          r,
          r2:        lr.r2,
          slope:     lr.slope,
          intercept: lr.intercept,
          n:         pares.length,
          // Para el scatter plot
          puntos: pares.map((row, i) => ({
            x:       x[i],
            y:       y[i],
            lote:    row.lote_raw,
            titulo:  row.ne_titulo,
            fecha:   row.fecha
          }))
        });
      }
    }

    res.json({ success: true, datos: rows, correlaciones, n: rows.length });
  } catch (err) {
    console.error('Error en correlacion mezcla-hilo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/correlacion/narrativa
// Body: { correlaciones, n, fecha_inicio, fecha_fin, ne_titulo, model }
app.post('/api/correlacion/narrativa', async (req, res) => {
  try {
    const { correlaciones, n, fecha_inicio, fecha_fin, ne_titulo, model: modelReq } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_API_KEY no configurada' });
    }

    const modelName = modelReq || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const etiquetas = {
      str: 'STR (Tenacidad Fibra, g/tex)',
      sci: 'SCI (Spinning Consistency Index)',
      mic: 'MIC (Micronaire)',
      uhml: 'UHML (Longitud media fibra, mm)',
      cvm: 'CVm% (Irregularidad de masa)',
      vellosidad: 'H (Vellosidad Uster)',
      neps_200:  'Neps 200%/km',
      thin_50:   'Puntos delgados -50%/km',
      thick_50:  'Puntos gruesos +50%/km',
      tenacidad: 'Tenacidad hilo (cN/tex)',
      elongacion:'Elongación hilo (%)'
    };

    const resumen = correlaciones
      .filter(c => Math.abs(c.r) >= 0.3)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 12)
      .map(c => {
        const dir = c.slope >= 0 ? 'aumenta' : 'disminuye';
        const unidadHvi = c.hvi_var === 'str' ? 'g/tex' : c.hvi_var === 'mic' ? 'unidades' : c.hvi_var === 'uhml' ? 'mm' : 'puntos';
        const unidadHilo = ['cvm','vellosidad','neps_200','thin_50','thick_50'].includes(c.hvi_var) ? 'unidades' : 'cN/tex';
        return `- ${etiquetas[c.hvi_var]} → ${etiquetas[c.hilo_var]}: r=${c.r} (${c.n} muestras). Por cada 1 ${unidadHvi} de aumento en ${c.hvi_var.toUpperCase()}, el ${c.hilo_var.toUpperCase()} ${dir} ${Math.abs(c.slope).toFixed(3)} ${unidadHilo}.`;
      }).join('\n');

    const prompt = `Actúa como un Analista Senior de Control de Calidad Textil especializado en hilatura de Denim.

Recibirás un análisis de correlación estadística entre variables de FIBRA (HVI) y variables de HILO (Uster + Tensorapid) calculado sobre ${n} ensayos históricos de la planta, periodo ${fecha_inicio} a ${fecha_fin}${ne_titulo ? `, título Ne ${ne_titulo}` : ', todos los títulos'}.

CORRELACIONES DETECTADAS (r = coeficiente de Pearson, slope = pendiente de regresión lineal):
${resumen || 'No se detectaron correlaciones significativas (r >= 0.3) con los datos disponibles.'}

TAREA:
Redactá en español un análisis técnico dividido en exactamente 3 secciones usando Markdown:

## 1. Relaciones Causa-Efecto Confirmadas
Explicá en lenguaje claro (para un jefe de planta, no un estadístico) qué variables de la mezcla impactan más en la calidad del hilo y en qué dirección. Cuantificá el impacto ("por cada unidad que sube X, Y cambia en Z").

## 2. Oportunidades de Optimización
Basado en las correlaciones encontradas, indicá qué ajustes en la mezcla podrían mejorar la calidad del hilo o reducir costos sin sacrificar estándares. Sé específico y accionable.

## 3. Veredicto y Recomendación
Un párrafo ejecutivo de 3-4 oraciones que un gerente pueda leer en 20 segundos. Indicá si los datos son suficientes para tomar decisiones o si se necesitan más muestras.

REGLAS:
- No inventes relaciones que no estén en los datos.
- Si el n es bajo (< 10), advierte sobre la limitación estadística.
- Usá terminología textil correcta.
- Formato Markdown.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return res.json({ success: true, narrativa: text, fuente: 'gemini' });
    } catch (geminiErr) {
      console.warn('Gemini no disponible en correlacion/narrativa, generando local:', geminiErr.message?.slice(0, 120));
      // Fallback local: redactar análisis determinista desde las correlaciones
      const top = correlaciones
        .filter(c => Math.abs(c.r) >= 0.3)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
        .slice(0, 8);
      const etiquetasLocal = {
        str: 'STR', sci: 'SCI', mic: 'MIC', uhml: 'UHML',
        cvm: 'CVm%', vellosidad: 'Vellosidad H', neps_200: 'Neps +200%',
        thin_50: 'Delgados -50%', thick_50: 'Gruesos +50%',
        tenacidad: 'Tenacidad', elongacion: 'Elongación'
      };
      const periodoStr = `${fecha_inicio} – ${fecha_fin}${ne_titulo ? ` | Ne ${ne_titulo}` : ''}`;
      const lineas = [
        `## 1. Relaciones Causa-Efecto Confirmadas`,
        `Período analizado: ${periodoStr} (${n} ensayos).`,
        '',
        ...top.map(c => {
          const dir = c.slope >= 0 ? '↑ sube' : '↓ baja';
          const fuerza = Math.abs(c.r) >= 0.7 ? 'Correlación fuerte' : Math.abs(c.r) >= 0.5 ? 'Correlación moderada' : 'Correlación débil';
          return `- **${etiquetasLocal[c.hvi_var] || c.hvi_var} → ${etiquetasLocal[c.hilo_var] || c.hilo_var}**: r=${c.r} (${fuerza}). Por cada unidad que sube ${c.hvi_var.toUpperCase()}, ${c.hilo_var.toUpperCase()} ${dir} ${Math.abs(c.slope).toFixed(3)} unidades.`;
        }),
        top.length === 0 ? '_No se detectaron correlaciones significativas (r ≥ 0.3) con los datos disponibles._' : '',
        '',
        `## 2. Oportunidades de Optimización`,
        top.length > 0
          ? `Las ${top.length} correlaciones detectadas sugieren que las variables de fibra con mayor impacto son: **${[...new Set(top.map(c => etiquetasLocal[c.hvi_var] || c.hvi_var))].join(', ')}**. Controlar estas variables en la mezcla de fardos permitirá anticipar el comportamiento del hilo antes de hilar.`
          : 'Ampliar el período de análisis o incluir más títulos para detectar relaciones accionables.',
        '',
        `## 3. Veredicto y Recomendación`,
        n < 10
          ? `⚠️ **Muestra insuficiente (n=${n}).** Las correlaciones calculadas tienen baja confiabilidad estadística. Se recomienda ampliar el rango de fechas antes de tomar decisiones de proceso basadas en estos datos.`
          : `Análisis generado localmente sobre ${n} ensayos. ${
              top.length >= 3
                ? `Se identificaron ${top.length} pares con correlación significativa. Los datos son suficientes para orientar ajustes de mezcla.`
                : 'Se detectaron pocas correlaciones significativas; considerar ampliar el período o revisar la homogeneidad de los datos.'
            } Para análisis narrativo enriquecido, configurar cuota de Gemini en Google AI Studio (gemini-1.5-flash, capa gratuita).`,
      ];
      const narrativaLocal = lineas.join('\n');
      return res.json({ success: true, narrativa: narrativaLocal, fuente: 'local', aviso: 'Gemini no disponible – análisis generado localmente.' });
    }
  } catch (error) {
    console.error('Error narrativa correlacion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/mezcla-lotes
// Comparativa HVI + Uster + Tensorapid por lotes de mezcla
// Query: lotes (ej: "107,108,109"), ne (opcional, ej: "10/1"), fecha (opcional, YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/dashboard/mezcla-lotes', async (req, res) => {
  try {
    const { lotes, ne, fecha } = req.query;
    if (!lotes) return res.status(400).json({ error: 'Se requiere parámetro lotes (ej: 107,108,109)' });

    const fechaCardas = typeof fecha === 'string' ? fecha.trim() : '';
    if (fechaCardas && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCardas)) {
      return res.status(400).json({ error: 'Parámetro fecha inválido. Formato esperado: YYYY-MM-DD' });
    }

    const loteList = [...new Set(
      lotes.split(',').map(l => parseInt(l.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    )];
    if (loteList.length === 0) return res.status(400).json({ error: 'Sin lotes válidos' });

    const sql = `
      WITH hvi_agg AS (
        -- Filtra por LOTE_FIAC (el número que ingresa el usuario), no por MISTURA.
        -- n_fardos = fardos efectivamente consumidos (DT_ENTRADA_PROD no nulo).
        -- n_secuencias = secuencias (SEQ) ingresadas a blendomat con fecha.
        SELECT
          CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS mistura,
          MAX(CAST(NULLIF(regexp_replace("MISTURA", '[^0-9]', '', 'g'), '') AS INTEGER))::text AS mistura_real,
          ROUND(AVG(CASE WHEN "STR"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("STR",  ',', '.')::numeric END), 2) AS str,
          ROUND(AVG(CASE WHEN "SCI"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SCI",  ',', '.')::numeric END), 1) AS sci,
          ROUND(AVG(CASE WHEN "MIC"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MIC",  ',', '.')::numeric END), 3) AS mic,
          ROUND(AVG(CASE WHEN "UHML" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UHML", ',', '.')::numeric END), 2) AS uhml,
          ROUND(AVG(CASE WHEN "UI"   ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UI",   ',', '.')::numeric END), 2) AS ui,
          ROUND(AVG(CASE WHEN "ELG"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("ELG",  ',', '.')::numeric END), 2) AS elg_fibra,
          -- Solo fardos con fecha de entrada a producción (consumidos en blendomat)
          SUM(CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> ''
                   THEN ROUND(REPLACE("QTDE"::text, ',', '.')::numeric)::integer
                   ELSE 0 END) AS n_fardos,
          -- Secuencias distintas que ya ingresaron (DT_ENTRADA_PROD no nulo)
          COUNT(DISTINCT CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> '' THEN "SEQ" END) AS n_secuencias
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '[0-9]'
          AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = ANY($1::integer[])
        GROUP BY CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)
      ),
      uster_base AS (
        SELECT
          u.testnr,
          u.nomcount AS ne,
          CASE
            WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true
            ELSE false
          END AS is_flame,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) AS mistura_str
        FROM tb_uster_par u
        WHERE COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) IS NOT NULL
          AND ($2::text IS NULL OR u.nomcount = SPLIT_PART($2, '/', 1) OR u.nomcount::text ILIKE $2)
      ),
      uster_lotes AS (
        SELECT testnr, ne, is_flame, mistura_str::integer AS mistura
        FROM uster_base
        WHERE mistura_str ~ '^\\d+$'
          AND mistura_str::integer = ANY($1::integer[])
      ),
      uster_agg AS (
        SELECT
          ul.mistura,
          ul.ne,
          ul.is_flame,
          ROUND(AVG(t.cvm_percent)::numeric,    2) AS cvm,
          ROUND(AVG(t.h)::numeric,              2) AS vellosidad,
          ROUND(AVG(t.neps_200_km)::numeric,    1) AS neps_200,
          ROUND(AVG(t.delg_minus30_km)::numeric,1) AS thin_30,
          ROUND(AVG(t.delg_minus40_km)::numeric,1) AS thin_40,
          ROUND(AVG(t.delg_minus50_km)::numeric,1) AS thin_50,
          ROUND(AVG(t.grue_35_km)::numeric,     1) AS thick_35,
          ROUND(AVG(t.grue_50_km)::numeric,     1) AS thick_50,
          ROUND(AVG(t.neps_140_km)::numeric,    1) AS neps_140,
          ROUND(AVG(t.neps_280_km)::numeric,    1) AS neps_280,
          COUNT(DISTINCT ul.testnr)               AS n_uster
        FROM uster_lotes ul
        JOIN tb_uster_tbl t ON t.testnr = ul.testnr
        GROUP BY ul.mistura, ul.ne, ul.is_flame
      ),
      tenso_agg AS (
        SELECT
          ul.mistura,
          ul.ne,
          ul.is_flame,
          ROUND(AVG(tt.tenacidad)::numeric,  2) AS tenacidad,
          ROUND(AVG(tt.elongacion)::numeric, 2) AS elongacion,
          ROUND(AVG(tt.fuerza_b)::numeric,   2) AS fuerza_b,
          ROUND(AVG(tt.trabajo)::numeric,    2) AS trabajo_b
        FROM uster_lotes ul
        JOIN tb_tensorapid_par tp ON tp.uster_testnr = ul.testnr
        JOIN tb_tensorapid_tbl tt ON tt.testnr = tp.testnr
        GROUP BY ul.mistura, ul.ne, ul.is_flame
      )
      SELECT
        h.mistura,
        h.mistura_real,
        h.str,
        h.sci,
        h.mic,
        h.uhml,
        h.ui,
        h.elg_fibra,
        h.n_fardos,
        h.n_secuencias,
        ua.ne,
        ua.is_flame,
        ua.cvm,
        ua.vellosidad,
        ua.neps_200,
        ua.thin_30,
        ua.thin_40,
        ua.thin_50,
        ua.thick_35,
        ua.thick_50,
        ua.neps_140,
        ua.neps_280,
        ua.n_uster,
        ta.tenacidad,
        ta.elongacion,
        ta.fuerza_b,
        ta.trabajo_b
      FROM hvi_agg h
      LEFT JOIN uster_agg  ua ON ua.mistura = h.mistura
      LEFT JOIN tenso_agg  ta ON ta.mistura = h.mistura AND ta.ne = ua.ne AND ta.is_flame = ua.is_flame
      ORDER BY h.mistura ASC, ua.ne::numeric ASC NULLS LAST, ua.is_flame ASC NULLS FIRST
    `;

    const result = await query(sql, [loteList, ne || null], 'dashboard/mezcla-lotes');

    // ── Análisis por proveedor (PRODUTOR) ────────────────────────────────────
    const sqlProv = `
      SELECT
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) AS mistura,
        "PRODUTOR" AS produtor,
        ROUND(AVG(CASE WHEN "STR"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("STR",  ',', '.')::numeric END), 2) AS str,
        ROUND(AVG(CASE WHEN "SCI"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("SCI",  ',', '.')::numeric END), 1) AS sci,
        ROUND(AVG(CASE WHEN "MIC"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("MIC",  ',', '.')::numeric END), 3) AS mic,
        ROUND(AVG(CASE WHEN "UHML" ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("UHML", ',', '.')::numeric END), 2) AS uhml,
        ROUND(AVG(CASE WHEN "ELG"  ~ '^[0-9][0-9,\\.]*$' THEN REPLACE("ELG",  ',', '.')::numeric END), 2) AS elg,
        SUM(CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> ''
                 THEN ROUND(REPLACE("QTDE"::text, ',', '.')::numeric)::integer
                 ELSE 0 END) AS fardos_consumidos,
        COUNT(DISTINCT CASE WHEN "DT_ENTRADA_PROD" IS NOT NULL AND "DT_ENTRADA_PROD" <> '' THEN "SEQ" END) AS secuencias
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND "LOTE_FIAC" ~ '[0-9]'
        AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER) = ANY($1::integer[])
      GROUP BY
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER),
        "PRODUTOR"
      ORDER BY mistura, fardos_consumidos DESC
    `;
    const provResult = await query(sqlProv, [loteList], 'dashboard/mezcla-lotes/proveedores');

    let sideDaily = [];
    try {
      const sqlSideDaily = `
        WITH side_daily AS (
          SELECT
            DATE(COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            )) AS fecha,
            COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            )::integer AS mistura,
            u.nomcount AS ne,
            CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END AS is_flame,
            CASE
              WHEN upper(trim(COALESCE(u.maschnr, ''))) ~ '(^|[[:space:]])LP($|[[:space:]])' THEN 'LP'
              WHEN upper(trim(COALESCE(u.maschnr, ''))) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])' THEN 'LI'
              ELSE NULL
            END AS side,
            ROUND(AVG(t.delg_minus30_km)::numeric, 1) AS thin_30,
            ROUND(AVG(t.neps_140_km)::numeric, 1) AS neps_140,
            ROUND(AVG(tt.tenacidad)::numeric, 2) AS tenacidad,
            ROUND(AVG(tt.elongacion)::numeric, 2) AS elongacion,
            ROUND(AVG(tt.trabajo)::numeric, 2) AS trabajo_b,
            COUNT(DISTINCT u.testnr) AS n_tests,
            string_agg(DISTINCT trim(u.maschnr), ', ' ORDER BY trim(u.maschnr))
              FILTER (WHERE u.maschnr IS NOT NULL AND trim(u.maschnr) <> '') AS maquinas
          FROM tb_uster_par u
          JOIN tb_uster_tbl t ON t.testnr = u.testnr
          LEFT JOIN tb_tensorapid_par tp ON tp.uster_testnr = u.testnr
          LEFT JOIN tb_tensorapid_tbl tt ON tt.testnr = tp.testnr
          WHERE COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            ) IS NOT NULL
            AND COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            ) ~ '^\\d+$'
            AND COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            )::integer = ANY($1::integer[])
            AND ($2::text IS NULL OR u.nomcount = SPLIT_PART($2, '/', 1) OR u.nomcount::text ILIKE $2)
          GROUP BY
            DATE(COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            )),
            COALESCE((regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1], (regexp_match(u.lote, '(\\d+)'))[1])::integer,
            u.nomcount,
            CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END,
            CASE
              WHEN upper(trim(COALESCE(u.maschnr, ''))) ~ '(^|[[:space:]])LP($|[[:space:]])' THEN 'LP'
              WHEN upper(trim(COALESCE(u.maschnr, ''))) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])' THEN 'LI'
              ELSE NULL
            END
        )
        SELECT
          fecha,
          to_char(fecha, 'DD/MM/YYYY') AS fecha_txt,
          mistura,
          ne,
          is_flame,
          side,
          thin_30,
          neps_140,
          tenacidad,
          elongacion,
          trabajo_b,
          n_tests,
          maquinas
        FROM side_daily
        WHERE side IS NOT NULL
        ORDER BY mistura ASC, fecha ASC, ne::numeric ASC NULLS LAST, side ASC`;
      const sideResult = await query(sqlSideDaily, [loteList, ne || null], 'dashboard/mezcla-lotes/side-daily');
      sideDaily = sideResult.rows || [];
    } catch (sideErr) {
      console.warn('dashboard/mezcla-lotes: sideDaily no disponible:', sideErr.message?.slice(0, 120) || sideErr.message);
      sideDaily = [];
    }

    // ── Contexto operativo Cardas (última fecha disponible) ──────────────────
    let cardas = {
      disponible: false,
      motivo: 'Sin datos de cardas disponibles',
      resumen: null,
      turnos: [],
      maquinasCriticas: [],
      calidadDato: null
    };

    try {
      const parseDateCarda = (col) => `
        CASE
          WHEN ${col} ~ '^[0-3]?[0-9]/[0-1]?[0-9]/[0-9]{4}(\\s|$)' THEN to_date(split_part(${col}, ' ', 1), 'DD/MM/YYYY')
          WHEN ${col} ~ '^[0-3]?[0-9]/[0-1]?[0-9]/[0-9]{2}(\\s|$)' THEN to_date(split_part(${col}, ' ', 1), 'DD/MM/YY')
          ELSE NULL
        END`;
      const parseNumCarda = (col) => `
        CASE
          WHEN ${col} ~ '^[0-9][0-9\\.,]*$' THEN REPLACE(REPLACE(${col}, '.', ''), ',', '.')::numeric
          ELSE NULL
        END`;

      const cteCarda = `
        WITH carda_raw AS (
          SELECT
            ${parseDateCarda('"DATA"')} AS data_date,
            NULLIF(trim("T"), '') AS turno,
            NULLIF(trim("MAQUINA"), '') AS maquina,
            NULLIF(trim("ITEM"), '') AS item,
            ${parseNumCarda('"EFIC CALC"')} AS efic_calc,
            ${parseNumCarda('"EFIC INFOR"')} AS efic_infor,
            ${parseNumCarda('"PROD CALC"')} AS prod_calc,
            ${parseNumCarda('"PROD INFORM"')} AS prod_inform,
            ${parseNumCarda('"RPM"')} AS rpm
          FROM tb_PRODUCCION_CARDA
        ),
        dmax AS (
          SELECT
            CASE
              WHEN $1::date IS NULL THEN MAX(data_date)
              ELSE MAX(data_date) FILTER (WHERE data_date <= $1::date)
            END AS data_ref
          FROM carda_raw
        ),
        base AS (
          SELECT cr.*
          FROM carda_raw cr
          JOIN dmax d ON cr.data_date = d.data_ref
        )`;

      const rResumen = await query(`${cteCarda}
        SELECT
          to_char(d.data_ref, 'DD/MM/YYYY') AS data_ref,
          COUNT(*)::int AS filas,
          COUNT(DISTINCT b.maquina)::int AS maquinas,
          COUNT(*) FILTER (WHERE COALESCE(b.prod_inform, 0) > 0)::int AS filas_activas,
          ROUND((COUNT(*) FILTER (WHERE COALESCE(b.prod_inform, 0) > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS cobertura_prod_pct,
          ROUND(AVG(b.efic_calc)::numeric, 2) AS efic_calc_avg,
          ROUND(AVG(b.efic_infor)::numeric, 2) AS efic_infor_avg,
          ROUND(SUM(b.prod_calc)::numeric, 2) AS prod_calc_total,
          ROUND(SUM(b.prod_inform)::numeric, 2) AS prod_inform_total,
          ROUND(AVG(b.rpm)::numeric, 2) AS rpm_avg
        FROM dmax d
        LEFT JOIN base b ON true`, [fechaCardas || null], 'dashboard/mezcla-lotes/carda-resumen');

      const rTurnos = await query(`${cteCarda}
        SELECT
          COALESCE(turno, 'S/D') AS turno,
          COUNT(*)::int AS filas,
          COUNT(DISTINCT maquina)::int AS maquinas,
          ROUND(AVG(efic_calc)::numeric, 2) AS efic_calc_avg,
          ROUND(AVG(efic_infor)::numeric, 2) AS efic_infor_avg,
          ROUND(SUM(prod_inform)::numeric, 2) AS prod_inform_total
        FROM base
        GROUP BY COALESCE(turno, 'S/D')
        ORDER BY CASE COALESCE(turno, 'S/D') WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 9 END`, [fechaCardas || null], 'dashboard/mezcla-lotes/carda-turnos');

      const rMaq = await query(`${cteCarda}
        SELECT
          COALESCE(maquina, 'S/D') AS maquina,
          ROUND(AVG(efic_calc)::numeric, 2) AS efic_calc_avg,
          ROUND(AVG(efic_infor)::numeric, 2) AS efic_infor_avg,
          ROUND(SUM(prod_inform)::numeric, 2) AS prod_inform_total,
          ROUND(SUM(prod_calc)::numeric, 2) AS prod_calc_total
        FROM base
        GROUP BY COALESCE(maquina, 'S/D')
        ORDER BY AVG(efic_calc) ASC NULLS LAST
        LIMIT 8`, [fechaCardas || null], 'dashboard/mezcla-lotes/carda-maquinas-criticas');

      const rCalidadDato = await query(`${cteCarda}
        SELECT
          COUNT(*)::int AS filas,
          COUNT(*) FILTER (WHERE COALESCE(prod_inform, 0) = 0)::int AS prod_inform_cero,
          COUNT(*) FILTER (WHERE COALESCE(efic_calc, 0) = 0)::int AS efic_calc_cero,
          COUNT(*) FILTER (WHERE COALESCE(rpm, 0) = 0)::int AS rpm_cero,
          COUNT(*) FILTER (WHERE maquina IS NULL OR maquina = '')::int AS maquina_sin_dato
        FROM base`, [fechaCardas || null], 'dashboard/mezcla-lotes/carda-calidad-dato');

      const resumen = rResumen.rows?.[0] || null;
      if (resumen?.data_ref) {
        cardas = {
          disponible: true,
          motivo: '',
          resumen,
          turnos: rTurnos.rows || [],
          maquinasCriticas: rMaq.rows || [],
          calidadDato: rCalidadDato.rows?.[0] || null
        };
      }
    } catch (cardaErr) {
      cardas = {
        disponible: false,
        motivo: `Cardas no disponible: ${cardaErr.message?.slice(0, 120) || 'error no identificado'}`,
        resumen: null,
        turnos: [],
        maquinasCriticas: [],
        calidadDato: null
      };
    }

    res.json({ success: true, rows: result.rows, proveedores: provResult.rows, lotes: loteList, cardas, sideDaily });
  } catch (err) {
    console.error('Error /api/dashboard/mezcla-lotes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Genera el informe de forma local (sin IA externa) — siempre disponible
// ─────────────────────────────────────────────────────────────────────────────
function generarNarrativaLocal(rows, loteActual, proveedores = [], rowsPorFecha = [], rowsMaquinas = [], rowsProduccionOe = [], fechaCorte = null, sideDaily = []) {
  const lotesSorted = [...new Set(rows.map(r => Number(r.mistura)))].sort((a, b) => a - b);
  const actual = loteActual ? Number(loteActual) : Math.max(...lotesSorted);
  const refs   = lotesSorted.filter(l => l !== actual);

  const f = (v, d = 2) => (v == null || isNaN(parseFloat(v))) ? '–' : parseFloat(v).toFixed(d);
  const isFlame = (r) => {
    if (r?.is_flame === true || r?.is_flame === false) return r.is_flame;
    const t = String(r?.is_flame ?? '').trim().toLowerCase();
    return t === 'true' || t === '1' || t === 't' || t === 'yes';
  };
  const neLabel = (r) => `${r?.ne}${isFlame(r) ? ' FLAME' : ''}`;
  const getMatriz = (neValue, flame) => getMatrizRequisitos(neValue, flame);
  const pct = (a, b) => {
    if (a == null || b == null) return '';
    const d = parseFloat(b) - parseFloat(a);
    const p = (d / Math.abs(parseFloat(a))) * 100;
    return ` (${d >= 0 ? '+' : ''}${p.toFixed(1)}%)`;
  };
  const formatPuntosClaveAgrupados = (alertasList, puntosList) => {
    const grouped = new Map();
    const pushItem = (neTitleRaw, icon, detalle) => {
      const neTitle = `Ne${String(neTitleRaw).trim()}`;
      if (!grouped.has(neTitle)) grouped.set(neTitle, []);
      grouped.get(neTitle).push(`${icon} ${String(detalle).trim()}`);
    };

    for (const a of alertasList || []) {
      const m = String(a).match(/^Ne([^:]+):\s*(.+)$/);
      if (!m) continue;
      pushItem(m[1], '⚠️', m[2]);
    }

    for (const p of puntosList || []) {
      const m = String(p).match(/^[🔸⚠️]\s*Ne([^:]+):\s*(.+)$/);
      if (!m) continue;
      pushItem(m[1], '🔸', m[2]);
    }

    const neTitles = [...grouped.keys()];
    const maxNeLen = neTitles.reduce((max, t) => Math.max(max, t.length), 0);

    return neTitles.map((title) => {
      const detalles = grouped.get(title).join(' | ');
      return `  • ${title.padEnd(maxNeLen)} | ${detalles}`;
    });
  };

  // Agrupa por lote y obtiene primer registro HVI + todos los Ne
  const getLote = (m) => ({ hvi: rows.find(r => Number(r.mistura) === m) || {}, hilos: rows.filter(r => Number(r.mistura) === m && r.ne != null) });
  const dataActual = getLote(actual);
  const dataRefs   = refs.map(getLote);
  const toNeKey = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : null;
  };
  const toDateKey = (v) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.toISOString().slice(0, 10);
    }
    const raw = String(v || '').trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];

    const br = raw.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{2}|\d{4})/);
    if (br) {
      const dd = br[1].padStart(2, '0');
      const mm = br[2].padStart(2, '0');
      const yy = br[3].length === 2
        ? String((Number(br[3]) >= 70 ? 1900 : 2000) + Number(br[3]))
        : br[3];
      return `${yy}-${mm}-${dd}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  };
  const toLocalDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtFechaCorta = (v) => {
    const k = toDateKey(v);
    if (!k) return 'S/D';
    return `${k.slice(8, 10)}/${k.slice(5, 7)}`;
  };
  const fmtMaq = (m) => {
    return formatOeMachineCode(m);
  };

  const oeActual = (rowsProduccionOe || []).filter(r => Number(r.mistura) === actual);
  const oeByNe = new Map();
  const oeByNeDate = new Map();
  for (const r of oeActual) {
    const neKey = toNeKey(r.ne);
    if (!neKey) continue;
    if (!oeByNe.has(neKey)) oeByNe.set(neKey, []);
    oeByNe.get(neKey).push(r);
    const dateKey = toDateKey(r.fecha);
    if (dateKey) oeByNeDate.set(`${neKey}|${dateKey}`, r);
  }
  const getOeRowsByNe = (neValue) => {
    const neKey = toNeKey(neValue);
    if (!neKey) return [];
    return oeByNe.get(neKey) || [];
  };
  const getOeRowByNeDate = (neValue, fechaValue) => {
    const neKey = toNeKey(neValue);
    const dateKey = toDateKey(fechaValue);
    if (!neKey || !dateKey) return null;
    return oeByNeDate.get(`${neKey}|${dateKey}`) || null;
  };

  // Nivel de semáforo global del lote actual
  let nivelGlobal = 'VERDE';
  const alertas = [];
  for (const h of dataActual.hilos) {
    const flame = isFlame(h);
    const ten = parseFloat(h.tenacidad);
    const elo = parseFloat(h.elongacion);
    const nps = parseFloat(h.neps_200);
    const cvm = parseFloat(h.cvm);
    const trabajoB = parseFloat(h.trabajo_b);
    const neTxt = neLabel(h);
    const refEtas = dataRefs
      .map((ref) => {
        const sameNe = ref.hilos.find((candidate) => String(candidate.ne) === String(h.ne) && isFlame(candidate) === flame);
        return sameNe ? computeEta(ref.hvi?.str, sameNe.tenacidad) : null;
      })
      .filter((value) => Number.isFinite(value));
    const benningerEval = evaluateBenningerAptitude({
      neValue: parseFloat(h.ne),
      isFlame: flame,
      tenacidad: ten,
      trabajoB,
      strFibra: dataActual.hvi?.str,
      referenceEtas: refEtas,
    });
    if (!isNaN(ten) && ten < 14.5) { nivelGlobal = 'ROJO'; alertas.push(`Ne${neTxt}: Tenacidad crítica (${f(ten)} cN/tex < 14.5)`); }
    else if (!isNaN(ten) && ten < 16.0) { if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO'; alertas.push(`Ne${neTxt}: Tenacidad en zona de precaución (${f(ten)} cN/tex)`); }
    if (!isNaN(elo) && elo < 7.5) { if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO'; alertas.push(`Ne${neTxt}: Elongación ${f(elo)}% – riesgo rotura en Urdidora`); }
    if (!isNaN(nps) && nps > (flame ? 850 : 700)) {
      nivelGlobal = 'ROJO';
      alertas.push(`Ne${neTxt}: Neps ${f(nps,1)}/km – riesgo en Índigo`);
    } else if (!isNaN(nps) && flame && nps > 700) {
      if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO';
      alertas.push(`Ne${neTxt}: Neps ${f(nps,1)}/km – vigilar estabilidad del efecto flame`);
    }
    if (!isNaN(cvm)) {
      const cvmWarn = flame ? 18.0 : 13.0;
      const cvmCrit = flame ? 20.0 : 14.5;
      if (cvm > cvmCrit) {
        nivelGlobal = 'ROJO';
        alertas.push(`Ne${neTxt}: CVm% ${f(cvm)} – variación fuera de banda`);
      } else if (cvm > cvmWarn) {
        if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO';
        alertas.push(`Ne${neTxt}: CVm% ${f(cvm)} – ${flame ? 'controlar efecto flame' : 'masa irregular'}`);
      }
    }
    if (benningerEval.state === 'crit') {
      nivelGlobal = 'ROJO';
      if (benningerEval.blocked) {
        alertas.push(`Ne${neTxt}: Bloqueo Benninger por Tenacidad + Trabajo B fuera de banda`);
      } else if (benningerEval.reasons.includes('trabajo_b')) {
        alertas.push(`Ne${neTxt}: Trabajo B crítico para urdimbre/Benninger (${f(trabajoB)})`);
      } else if (benningerEval.reasons.includes('eta')) {
        alertas.push(`Ne${neTxt}: eta por debajo de la ventana comparable (${f(benningerEval.eta, 1)}%)`);
      }
    } else if (benningerEval.state === 'warn') {
      if (nivelGlobal === 'VERDE') nivelGlobal = 'AMARILLO';
      alertas.push(`Ne${neTxt}: Aptitud Benninger en observación (${benningerEval.reasons.join(', ')})`);
    }
  }

  const estadoLabel = { VERDE: '✅ APROBADO PARA CONTINUIDAD', AMARILLO: '⚠️ PRECAUCIÓN – REVISAR', ROJO: '🔴 CRÍTICO – DETENER' }[nivelGlobal];
  const conclusionBase = {
    VERDE: `El Lote FIAC ${actual} cumple todos los umbrales críticos de aptitud para tejeduría.${refs.length ? ` Supera o iguala el desempeño de referencia (${refs.join('/')}).` : ''}`,
    AMARILLO: `El Lote FIAC ${actual} presenta valores fuera de rango en algunas variables; se recomienda monitoreo intensivo en los procesos afectados.`,
    ROJO: `El Lote FIAC ${actual} registra valores críticos que requieren acción inmediata antes de continuar la producción.`
  }[nivelGlobal];

  // Genera comparativas por variable
  let numVar = 0;
  const bloques = [];

  const varDefs = [
    { key: 'str',       label: 'STR — Tenacidad Fibra', unit: 'g/tex', src: 'hvi', buenos: 27, bad: 25, inv: false },
    { key: 'sci',       label: 'SCI — Índice Hilabilidad', unit: '',   src: 'hvi', buenos: 145, bad: 130, inv: false },
    { key: 'tenacidad', label: 'Tenacidad Hilo', unit: 'cN/tex',       src: 'hilo', buenos: 16, bad: 14.5, inv: false },
    { key: 'elongacion',label: 'Elongación Hilo', unit: '%',           src: 'hilo', buenos: 8,  bad: 7.5,  inv: false },
    { key: 'cvm',       label: 'CVm% — Irregularidad de Masa', unit: '%', src: 'hilo', buenos: 12, bad: 13, inv: true },
    { key: 'neps_200',  label: 'Neps +200%', unit: '/km',              src: 'hilo', buenos: 500, bad: 700, inv: true },
  ];

  const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

  for (const vd of varDefs) {
    const getVal = (loteData) => {
      if (vd.src === 'hvi') return parseFloat(loteData.hvi[vd.key]);
      // Para hilo: promedio de todos los Ne
      const vals = loteData.hilos.map(h => parseFloat(h[vd.key])).filter(v => !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b) / vals.length : NaN;
    };

    const valActual = getVal(dataActual);
    if (isNaN(valActual)) continue;

    const descriptor = (val, inv) => {
      if (isNaN(val)) return '–';
      const good = vd.buenos, bad2 = vd.bad;
      if (inv) return val <= good ? '✅ Óptimo' : val <= bad2 ? '⚠️ Precaución' : '🔴 Crítico';
      return val >= good ? '✅ Óptimo' : val >= bad2 ? '⚠️ Precaución' : '🔴 Crítico';
    };

    numVar++;
    let bloque = `${emojis[numVar-1] || `${numVar}.`} ${vd.label.toUpperCase()}:\n`;
    for (const rd of dataRefs) {
      const v = getVal(rd);
      bloque += `  • Lote ${refs[dataRefs.indexOf(rd)]}: ${isNaN(v) ? '(sin datos)' : `${f(v)} ${vd.unit} ${descriptor(v, vd.inv)}`}\n`;
    }
    bloque += `  • Lote ${actual}: ${f(valActual)} ${vd.unit} ${descriptor(valActual, vd.inv)}\n`;

    // Trend vs primer ref
    if (dataRefs.length > 0) {
      const vRef = getVal(dataRefs[0]);
      if (!isNaN(vRef)) {
        const diff = valActual - vRef;
        const arrow = diff > 0.001 ? '↑' : diff < -0.001 ? '↓' : '=';
        const mejor = vd.inv ? diff < 0 : diff > 0;
        const cambio = `${arrow} ${Math.abs(diff).toFixed(2)} ${vd.unit}${pct(vRef, valActual)}`;
        const impactoDesc = {
          tenacidad: vd.inv ? `Hilo más débil, mayor riesgo de paradas en Telar.` : diff > 0.5 ? `Hilo significativamente más resistente, menor riesgo de rotura en Telar.` : diff > 0 ? `Leve mejora en resistencia.` : `Leve reducción; monitorear en alta velocidad.`,
          elongacion: diff < 0 ? `Menor absorción de impacto, mayor riesgo de rotura en Urdidora.` : `Mejor elasticidad, más tolerancia a la tensión.`,
          cvm: diff < 0 ? `Masa más uniforme; menos irregularidad visual en la tela.` : `Mayor irregularidad de masa; posible barreado.`,
          neps_200: diff < 0 ? `Hilo más limpio; menos enredos y arrastre de colorante desigual en Índigo.` : `Más impurezas; evaluar ajuste de cardas.`,
          str: diff > 0 ? `Fibra más resistente, impacto positivo directo en tenacidad del hilo.` : `Reducción en tenacidad de fibra.`,
          sci: diff > 0 ? `Mayor consistencia de hilatura, menos paradas de rotura esperadas.` : `Menor índice composite; revisar mezcla.`,
        }[vd.key] || '';
        bloque += `  👉 Variación: ${cambio} (${mejor ? 'mejora' : 'empeora'}). ${impactoDesc}`;
      }
    }
    bloques.push(bloque);
  }

  // Puntos clave adicionales por Ne
  const puntosNe = [];
  const HilosActual = dataActual.hilos;
  for (const h of HilosActual) {
    const ten = parseFloat(h.tenacidad);
    const elo = parseFloat(h.elongacion);
    const nps = parseFloat(h.neps_200);
    const neTxt = neLabel(h);
    if (!isNaN(ten) && ten >= 16.0) puntosNe.push(`🔸 Ne${neTxt}: Tenacidad ${f(ten)} cN/tex — APTO telar alta velocidad.`);
    if (!isNaN(elo) && elo >= 8.0)  puntosNe.push(`🔸 Ne${neTxt}: Elongación ${f(elo)}% — buena absorción de impacto en Urdidora.`);
    if (!isNaN(nps) && nps < 200)   puntosNe.push(`🔸 Ne${neTxt}: Neps ${f(nps,1)}/km — hilo muy limpio para Índigo.`);
  }
  const puntosClaveAgrupados = formatPuntosClaveAgrupados(alertas, puntosNe);

  // ── Análisis por proveedor del lote actual ──────────────────────────────
  const provActual = (proveedores || []).filter(p => Number(p.mistura) === actual);
  let bloqueProveedores = [];
  if (provActual.length > 0) {
    const totalFardos = provActual.reduce((s, p) => s + (Number(p.fardos_consumidos) || 0), 0);

    // Listas con valor numérico válido por variable
    const withStr  = provActual.filter(p => p.str  != null && !isNaN(parseFloat(p.str)));
    const withSci  = provActual.filter(p => p.sci  != null && !isNaN(parseFloat(p.sci)));
    const withMic  = provActual.filter(p => p.mic  != null && !isNaN(parseFloat(p.mic)));
    const withUhml = provActual.filter(p => p.uhml != null && !isNaN(parseFloat(p.uhml)));

    // STR / UHML / SCI: mayor = mejor
    const best  = (arr, key) => arr.length ? arr.reduce((a, b) => parseFloat(a[key]) >= parseFloat(b[key]) ? a : b) : null;
    const worst = (arr, key) => arr.length ? arr.reduce((a, b) => parseFloat(a[key]) <= parseFloat(b[key]) ? a : b) : null;
    // MIC: rango óptimo 3.5–4.9; más alejado del centro (4.2) = peor
    const micDist = p => Math.abs(parseFloat(p.mic) - 4.2);
    const bestMic  = withMic.length ? withMic.reduce((a, b) => micDist(a) <= micDist(b) ? a : b) : null;
    const worstMic = withMic.length ? withMic.reduce((a, b) => micDist(a) >= micDist(b) ? a : b) : null;
    const micOutOfRange = withMic.filter(p => { const v = parseFloat(p.mic); return v < 3.5 || v > 4.9; });

    const obs = [];
    if (best(withStr, 'str') && worst(withStr, 'str') && best(withStr, 'str').produtor !== worst(withStr, 'str').produtor) {
      const b = best(withStr, 'str'), w = worst(withStr, 'str');
      obs.push(`  🏆 STR más alto: ${b.produtor} (${f(b.str)} g/tex) — fibra más resistente para hilatura.`);
      obs.push(`  ⚠️  STR más bajo: ${w.produtor} (${f(w.str)} g/tex)${parseFloat(w.str) < 25 ? ' — por debajo del límite crítico (25 g/tex).' : ' — monitorear impacto en tenacidad del hilo.'}`);
    }
    if (best(withSci, 'sci') && worst(withSci, 'sci') && best(withSci, 'sci').produtor !== worst(withSci, 'sci').produtor) {
      const b = best(withSci, 'sci'), w = worst(withSci, 'sci');
      obs.push(`  🏆 SCI más alto: ${b.produtor} (${f(b.sci, 1)}) — mayor índice de hilabilidad, menos paradas esperadas.`);
      obs.push(`  ⚠️  SCI más bajo: ${w.produtor} (${f(w.sci, 1)})${parseFloat(w.sci) < 130 ? ' — riesgo de inestabilidad en hilatura.' : '.'}`);
    }
    if (bestMic && worstMic && bestMic.produtor !== worstMic.produtor) {
      obs.push(`  🏆 MIC óptimo:   ${bestMic.produtor} (${f(bestMic.mic, 3)}) — finura más cercana al rango ideal (3.5–4.9).`);
      if (micOutOfRange.length) {
        obs.push(`  ⚠️  MIC fuera de rango (3.5–4.9): ${micOutOfRange.map(p => `${p.produtor} ${f(p.mic, 3)}`).join(', ')}.`);
      } else {
        obs.push(`  ⚠️  MIC más alejado del centro: ${worstMic.produtor} (${f(worstMic.mic, 3)}).`);
      }
    }
    if (best(withUhml, 'uhml') && worst(withUhml, 'uhml') && best(withUhml, 'uhml').produtor !== worst(withUhml, 'uhml').produtor) {
      const b = best(withUhml, 'uhml'), w = worst(withUhml, 'uhml');
      obs.push(`  🏆 UHML más largo: ${b.produtor} (${f(b.uhml)} mm) — fibra más larga, menor neps y mejor resistencia.`);
      obs.push(`  ⚠️  UHML más corto: ${w.produtor} (${f(w.uhml)} mm)${parseFloat(w.uhml) < 25 ? ' — longitud crítica.' : '.'}`);
    }

    bloqueProveedores = [
      `📦 ANÁLISIS POR PROVEEDOR — Lote FIAC ${actual}:`,
      ...provActual.map(p => {
        const fardos = Number(p.fardos_consumidos) || 0;
        const pct    = totalFardos > 0 ? ((fardos / totalFardos) * 100).toFixed(1) : '–';
        const strNum  = p.str  != null ? f(p.str) : '–';
        const sciNum  = p.sci  != null ? f(p.sci, 1) : '–';
        const micNum  = p.mic  != null ? f(p.mic, 3) : '–';
        const uhmlNum = p.uhml != null ? f(p.uhml) : '–';
        const strVal  = `STR ${strNum.padStart(5)} g/tex`;
        const sciVal  = `SCI ${sciNum.padStart(5)}`;
        const micVal  = `MIC ${micNum.padStart(5)}`;
        const uhmlVal = `UHML ${uhmlNum.padStart(5)} mm`;
        const hvi = [strVal, sciVal, micVal, uhmlVal].join(' | ');
        return `  • ${String(p.produtor).padEnd(16)} ${String(fardos).padStart(4)} fardos (${String(pct).padStart(5)}%)  ${hvi}`;
      }),
      ...(obs.length ? [``, `  📌 Observaciones:`, ...obs] : []),
      ``,
    ];
  }

  const refStr = refs.length > 0 ? refs.join('/') : 'sin referencia';

  const fechasActualAll = (rowsPorFecha || []).filter(r => Number(r.mistura) === actual);
  const fechaCorteSolicitadaKey = toDateKey(fechaCorte);
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerKey = toLocalDateKey(ayer);
  const fechasDisponibles = fechasActualAll
    .map(r => toDateKey(r.fecha))
    .filter(Boolean)
    .sort();
  const fechaCorteAplicadaKey = fechaCorteSolicitadaKey
    || [...fechasDisponibles].filter(k => k <= ayerKey).pop()
    || fechasDisponibles[fechasDisponibles.length - 1]
    || ayerKey;
  const fechasActual = fechasActualAll.filter(r => {
    const k = toDateKey(r.fecha);
    return k && k <= fechaCorteAplicadaKey;
  });
  const fechasPosteriores = fechasActualAll.filter(r => {
    const k = toDateKey(r.fecha);
    return k && k > fechaCorteAplicadaKey;
  });

  const sideRowsActual = (sideDaily || []).filter(r => Number(r.mistura) === actual);
  const sideGroupsByNe = new Map();
  for (const r of sideRowsActual) {
    const side = String(r.side || '').trim().toUpperCase();
    if (side !== 'LI' && side !== 'LP') continue;
    const dateKey = toDateKey(r.fecha) || toDateKey(r.fecha_txt);
    if (!dateKey) continue;
    const flame = isFlame(r);
    const neKey = `${r.ne}|${flame}`;
    const mapKey = `${neKey}|${dateKey}`;
    if (!sideGroupsByNe.has(neKey)) sideGroupsByNe.set(neKey, new Map());
    if (!sideGroupsByNe.get(neKey).has(mapKey)) {
      sideGroupsByNe.get(neKey).set(mapKey, {
        ne: r.ne,
        flame,
        dateKey,
        LI: null,
        LP: null,
      });
    }
    sideGroupsByNe.get(neKey).get(mapKey)[side] = r;
  }

  const sideSnapshotByNe = new Map();
  for (const [neKey, entriesMap] of sideGroupsByNe.entries()) {
    const entries = [...entriesMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (!entries.length) continue;
    const prevOrEqual = entries.filter(e => e.dateKey <= fechaCorteAplicadaKey);
    const selected = prevOrEqual.length ? prevOrEqual[prevOrEqual.length - 1] : entries[entries.length - 1];
    const evaluation = evaluateSideImbalance({ left: selected.LI, right: selected.LP });
    sideSnapshotByNe.set(neKey, {
      ne: selected.ne,
      flame: selected.flame,
      dateKey: selected.dateKey,
      evaluation,
      left: selected.LI,
      right: selected.LP,
    });
  }

  // ── Evolución diaria por título (rowsPorFecha) ─────────────────────────
  const bloqueEvolucion = [];
  if (fechasActual.length > 0) {
    const neMap = new Map();
    for (const r of fechasActual) {
      const key = `${r.ne}|${r.is_flame}`;
      if (!neMap.has(key)) neMap.set(key, { ne: r.ne, is_flame: r.is_flame, dias: [] });
      neMap.get(key).dias.push(r);
    }
    bloqueEvolucion.push(`🧵 EVOLUCIÓN Y ESTADO DE TÍTULOS — Lote FIAC ${actual}:`);
    bloqueEvolucion.push(``);
    // Ordenar Ne de mayor a menor (los críticos primero: urdimbre antes de trama)
    const neEntries = [...neMap.values()].sort((a, b) => parseFloat(b.ne) - parseFloat(a.ne));
    for (const { ne, is_flame, dias } of neEntries) {
      const flame = is_flame === true || String(is_flame).trim() === 'true' || String(is_flame).trim() === '1';
      const neTxt = `${ne}${flame ? ' FLAME' : '/1'}`;
      const mNe = getMatriz(parseFloat(ne), flame);
      const appNe = mNe?.app || (parseFloat(ne) <= 9 ? 'Trama' : (flame ? 'Urdimbre Flame' : 'Urdimbre'));
      bloqueEvolucion.push(`Ne ${neTxt} (${appNe}):`);
      const diasOrd = [...dias].sort((a, b) => {
        const ka = toDateKey(a.fecha) || '';
        const kb = toDateKey(b.fecha) || '';
        return ka.localeCompare(kb);
      });
      for (let i = 0; i < diasOrd.length; i++) {
        const d = diasOrd[i];
        const fecha = toDateKey(d.fecha);
        const dd = fecha ? fecha.slice(8, 10) : '??';
        const mm = fecha ? fecha.slice(5, 7) : '??';
        const oeDia = getOeRowByNeDate(ne, d.fecha);
        const parts = [];
        if (d.cvm        != null) parts.push(`CVm ${f(d.cvm)}`);
        if (d.tenacidad  != null) parts.push(`Tenac ${f(d.tenacidad)}`);
        if (d.neps_200   != null) parts.push(`Neps ${f(d.neps_200, 0)}/km`);
        if (d.elongacion != null) parts.push(`Elong ${f(d.elongacion)}%`);
        if (oeDia?.cvm_oe != null) parts.push(`OE-CVm ${f(oeDia.cvm_oe)}`);
        if (oeDia?.efic_oe != null) parts.push(`OE-Efic ${f(oeDia.efic_oe, 1)}%`);
        // Delta inline respecto al día anterior
        let deltaStr = '';
        if (i > 0) {
          const prev = diasOrd[i - 1];
          const oePrev = getOeRowByNeDate(ne, prev.fecha);
          const cvmD = (d.cvm != null && prev.cvm != null) ? parseFloat(d.cvm) - parseFloat(prev.cvm) : null;
          const npsD = (d.neps_200 != null && prev.neps_200 != null) ? parseFloat(d.neps_200) - parseFloat(prev.neps_200) : null;
          const oeCvmD = (oeDia?.cvm_oe != null && oePrev?.cvm_oe != null)
            ? parseFloat(oeDia.cvm_oe) - parseFloat(oePrev.cvm_oe)
            : null;
          const alertas = [];
          if (cvmD != null && Math.abs(cvmD) >= 0.1) alertas.push(`CVm ${cvmD > 0 ? '↑' : '↓'}${Math.abs(cvmD).toFixed(2)}`);
          if (npsD != null && Math.abs(npsD) > 20) alertas.push(`Neps ${npsD > 0 ? '↑' : '↓'}${Math.abs(npsD).toFixed(0)}`);
          if (oeCvmD != null && Math.abs(oeCvmD) >= 0.1) alertas.push(`OE-CVm ${oeCvmD > 0 ? '↑' : '↓'}${Math.abs(oeCvmD).toFixed(2)}`);
          if (alertas.length) deltaStr = `  (${alertas.join(' | ')})`;
        }
        const alertIcon = (() => {
          if (i === 0) return '';
          const prev = diasOrd[i - 1];
          const cvmD = (d.cvm != null && prev.cvm != null) ? parseFloat(d.cvm) - parseFloat(prev.cvm) : null;
          const npsD = (d.neps_200 != null && prev.neps_200 != null) ? parseFloat(d.neps_200) - parseFloat(prev.neps_200) : null;
          if ((cvmD != null && cvmD > 0.5) || (npsD != null && npsD > 150)) return '⚠️ ';
          return '';
        })();
        bloqueEvolucion.push(`  • ${alertIcon}${dd}/${mm}: ${parts.join(' | ')}${deltaStr}`);
      }
      // 👉 ESTADO por Ne basado en último vs penúltimo día
      if (diasOrd.length >= 2) {
        const last = diasOrd[diasOrd.length - 1];
        const prev = diasOrd[diasOrd.length - 2];
        const cvmD = (last.cvm != null && prev.cvm != null) ? parseFloat(last.cvm) - parseFloat(prev.cvm) : null;
        const npsD = (last.neps_200 != null && prev.neps_200 != null) ? parseFloat(last.neps_200) - parseFloat(prev.neps_200) : null;
        let estadoNe, iconNe, descripcion;
        if ((cvmD != null && cvmD > 0.5) || (npsD != null && npsD > 150)) {
          iconNe = '🔴'; estadoNe = 'EMPEORÓ CRÍTICAMENTE';
          const causas = [];
          if (cvmD != null && cvmD > 0.5) causas.push(`CVm subió ${cvmD > 0 ? '+' : ''}${cvmD.toFixed(2)} pts`);
          if (npsD != null && npsD > 150) causas.push(`Neps +${npsD.toFixed(0)}/km (${f(last.neps_200, 0)} total)`);
          descripcion = `${causas.join(', ')}. Falla mecánica probable — no es la fibra.`;
        } else if (cvmD != null && cvmD < -0.2 && (npsD == null || npsD <= 50)) {
          iconNe = '🟢'; estadoNe = 'MEJORÓ';
          descripcion = `CVm bajó ${cvmD.toFixed(2)} pts. Los ajustes están surtiendo efecto.`;
          if (npsD != null && npsD < 0) descripcion += ` Neps también bajaron ${Math.abs(npsD).toFixed(0)}/km.`;
        } else if (cvmD != null && cvmD > 0.1) {
          iconNe = '⚠️'; estadoNe = 'PRECAUCIÓN';
          descripcion = `CVm subió ${cvmD > 0 ? '+' : ''}${cvmD.toFixed(2)} pts. Monitorear en próximo turno.`;
        } else {
          iconNe = '✅'; estadoNe = 'ESTABLE';
          descripcion = 'Sin variaciones significativas respecto al día anterior.';
        }
        bloqueEvolucion.push(`👉 ESTADO: ${iconNe} ${estadoNe}. ${descripcion}`);
      }
      bloqueEvolucion.push(``);
    }
  }

  // ── Balance de Mejoras y Deterioros ────────────────────────────────────
  const bloqueBalance = [];
  if (fechasActual.length > 0) {
    const neMap2 = new Map();
    for (const r of fechasActual) {
      const key = `${r.ne}|${r.is_flame}`;
      if (!neMap2.has(key)) neMap2.set(key, { ne: r.ne, is_flame: r.is_flame, dias: [] });
      neMap2.get(key).dias.push(r);
    }
    const mejoras    = [];
    const deterioros  = [];
    // Acciones por etapa
    const acOe       = [];
    const acPasador  = [];
    const acCardas   = [];

    const neEntries2 = [...neMap2.values()].sort((a, b) => parseFloat(b.ne) - parseFloat(a.ne));
    for (const { ne, is_flame, dias } of neEntries2) {
      const flame  = is_flame === true || String(is_flame).trim() === 'true' || String(is_flame).trim() === '1';
      const neTxt  = `Ne ${ne}${flame ? ' FLAME' : '/1'}`;
      const mNe2   = getMatriz(parseFloat(ne), flame);
      const appNe2 = mNe2?.app || (parseFloat(ne) <= 9 ? 'Trama' : (flame ? 'Urdimbre Flame' : 'Urdimbre'));
      const diasOrd = [...dias].sort((a, b) => {
        const ka = toDateKey(a.fecha) || '';
        const kb = toDateKey(b.fecha) || '';
        return ka.localeCompare(kb);
      });
      if (diasOrd.length < 2) continue;

      const last  = diasOrd[diasOrd.length - 1];
      const prev  = diasOrd[diasOrd.length - 2];
      const first = diasOrd[0];

      const cvmLast  = last.cvm        != null ? parseFloat(last.cvm)        : null;
      const cvmPrev  = prev.cvm        != null ? parseFloat(prev.cvm)        : null;
      const npsLast  = last.neps_200   != null ? parseFloat(last.neps_200)   : null;
      const npsPrev  = prev.neps_200   != null ? parseFloat(prev.neps_200)   : null;
      const tenLast  = last.tenacidad  != null ? parseFloat(last.tenacidad)  : null;
      const tenFirst = first.tenacidad != null ? parseFloat(first.tenacidad) : null;

      const cvmDelta = (cvmLast != null && cvmPrev != null) ? cvmLast - cvmPrev : null;
      const npsDelta = (npsLast != null && npsPrev != null) ? npsLast - npsPrev : null;
      const tenDelta = (tenLast != null && tenFirst != null) ? tenLast - tenFirst : null;

      const esCritico = (cvmDelta != null && cvmDelta > 0.5) || (npsDelta != null && npsDelta > 150);
      const esMejora  = (cvmDelta != null && cvmDelta < -0.2) && (npsDelta == null || npsDelta <= 50);

      if (esMejora) {
        let desc = `${neTxt}: Recuperó regularidad — CVm bajó ${Math.abs(cvmDelta).toFixed(2)} pts`;
        if (npsLast != null && npsDelta != null && npsDelta < 0) desc += `, Neps bajaron ${Math.abs(npsDelta).toFixed(0)}/km`;
        if (tenDelta != null && tenDelta > 0.2) desc += `. Tenacidad mejoró +${tenDelta.toFixed(2)} cN/tex vs inicio de lote`;
        desc += `. Los ajustes están surtiendo efecto.`;
        mejoras.push(`  ${neTxt}: ${desc}`);
      } else if (esCritico) {
        const causas = [];
        if (cvmDelta != null && cvmDelta > 0.5) causas.push(`CVm subió +${cvmDelta.toFixed(2)} pts`);
        if (npsDelta != null && npsDelta > 150) causas.push(`Neps +${npsDelta.toFixed(0)}/km (${npsLast?.toFixed(0)}/km total)`);
        const desc = `${neTxt} [${appNe2}]: ${causas.join(', ')}. La fibra no es el problema; buscar la falla en el proceso.`;
        deterioros.push(`  ${desc}`);
        // acciones por etapa
        if (parseFloat(ne) >= 10) {
          acOe.push(`  ${neTxt}: Limpieza de rotores y revisión del canal de transporte — CVm ${cvmLast?.toFixed(2)}% con Neps ${npsLast?.toFixed(0)}/km. Verificar que la purga de aire sea constante.`);
          if (npsLast != null && npsLast > 700) {
            acCardas.push(`  ${neTxt}: Verificar ajuste de chapones — neps altos sostenidos sugieren revisar cardado antes del OE.`);
          }
        } else {
          acPasador.push(`  ${neTxt}: CVm subió +${cvmDelta?.toFixed(2)} pts — revisar presión de rodillos de estiraje y estado de cots para frenar la flotación de fibra.`);
        }
      } else if (cvmDelta != null && Math.abs(cvmDelta) > 0.1) {
        if (cvmDelta > 0) {
          deterioros.push(`  ${neTxt}: Leve aumento de irregularidad (CVm +${cvmDelta.toFixed(2)} pts). Monitorear turno siguiente.`);
          if (parseFloat(ne) < 10) {
            acPasador.push(`  ${neTxt}: Verificar alfa de torsión y tensión de salida — CVm mostró tendencia alcista.`);
          }
        } else {
          mejoras.push(`  ${neTxt}: Pequeña mejora de masa (CVm ${cvmDelta.toFixed(2)} pts). Mantener ajuste actual.`);
        }
      }
    }

    if (mejoras.length > 0 || deterioros.length > 0) {
      bloqueBalance.push(`⚖️ BALANCE DE TENDENCIAS`);
      bloqueBalance.push(``);
      if (mejoras.length > 0) {
        bloqueBalance.push(`📈 MEJORAS:`);
        bloqueBalance.push(...mejoras);
        bloqueBalance.push(``);
      }
      if (deterioros.length > 0) {
        bloqueBalance.push(`📉 DETERIOROS:`);
        bloqueBalance.push(...deterioros);
        bloqueBalance.push(``);
      }
    }
    // Acciones por etapa (solo si hay)
    const hayAcciones = acOe.length || acPasador.length || acCardas.length;
    if (hayAcciones) {
      let prioNum = 1;
      bloqueBalance.push(`🛠 ACCIONES RECOMENDADAS (URGENTE):`);
      if (acOe.length) {
        bloqueBalance.push(``);
        bloqueBalance.push(`${prioNum++}️⃣ OPEN END (OE):`);
        bloqueBalance.push(...acOe);
      }
      if (acPasador.length) {
        bloqueBalance.push(``);
        bloqueBalance.push(`${prioNum++}️⃣ PASADOR (MANUAR):`);
        bloqueBalance.push(...acPasador);
      }
      if (acCardas.length) {
        bloqueBalance.push(``);
        bloqueBalance.push(`${prioNum++}️⃣ CARDAS:`);
        bloqueBalance.push(...acCardas);
      }
      bloqueBalance.push(``);
    }
  }

  // ── Correlación explícita con tb_PRODUCCION_OE ─────────────────────────
  const bloqueCorrelacionOe = [];
  if (dataActual.hilos.length > 0) {
    bloqueCorrelacionOe.push(`🔗 CORRELACIÓN CON PRODUCCIÓN OE (tb_PRODUCCION_OE):`);
    const hilosCorrOrd = [...dataActual.hilos].sort((a, b) => parseFloat(b.ne) - parseFloat(a.ne));
    const totalDef = (r) => {
      if (!r) return null;
      const vals = [
        r.n_total, r.s_total, r.l_total, r.t_total, r.mo_total,
        r.cp_v_sl_total, r.cm_v_sl_total, r.ccp_c_total, r.ccm_c_total,
        r.jp_p_total, r.jm_p_total, r.cort_nat_total,
      ].map(v => Number(v)).filter(v => Number.isFinite(v));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0);
    };
    for (const h of hilosCorrOrd) {
      const flame = isFlame(h);
      const neTxt = `${h.ne}${flame ? ' FLAME' : '/1'}`;
      const diasNe = fechasActual
        .filter(r => Number(r.ne) === Number(h.ne) && isFlame(r) === flame)
        .sort((a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || ''));
      const oeRowsNe = getOeRowsByNe(h.ne)
        .slice()
        .sort((a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || ''));

      if (!oeRowsNe.length) {
        bloqueCorrelacionOe.push(`  • Ne ${neTxt}: sin registros en tb_PRODUCCION_OE para este lote/título.`);
        continue;
      }

      const oeLast = oeRowsNe[oeRowsNe.length - 1];
      const resumenOe = `OE ${oeLast.fecha_txt || fmtFechaCorta(oeLast.fecha)} · CVm ${f(oeLast.cvm_oe)} · CVP ${f(oeLast.cvp_oe)} · Efic ${f(oeLast.efic_oe, 1)}% · Prod ${f(oeLast.prod_oe, 0)} kg · Máq activas ${oeLast.maquinas_activas ?? '–'}/${oeLast.maquinas_total ?? '–'}`;

      if (diasNe.length < 2) {
        bloqueCorrelacionOe.push(`  • Ne ${neTxt}: ${resumenOe}. Sin solape diario suficiente con ensayos para confirmar tendencia.`);
        continue;
      }

      const lastEns = diasNe[diasNe.length - 1];
      const prevEns = diasNe[diasNe.length - 2];
      const oeLastMatch = getOeRowByNeDate(h.ne, lastEns.fecha);
      const oePrevMatch = getOeRowByNeDate(h.ne, prevEns.fecha);
      if (!oeLastMatch || !oePrevMatch || lastEns.cvm == null || prevEns.cvm == null) {
        const fechasOe = oeRowsNe.map(r => r.fecha_txt || fmtFechaCorta(r.fecha)).join(', ');
        bloqueCorrelacionOe.push(`  • Ne ${neTxt}: ${resumenOe}. Hay datos OE (${fechasOe}), pero sin solape fecha-a-fecha con USTER para correlación robusta.`);
        continue;
      }

      const dUster = parseFloat(lastEns.cvm) - parseFloat(prevEns.cvm);
      const dOe = (oeLastMatch.cvm_oe != null && oePrevMatch.cvm_oe != null)
        ? parseFloat(oeLastMatch.cvm_oe) - parseFloat(oePrevMatch.cvm_oe)
        : null;
      const dEfic = (oeLastMatch.efic_oe != null && oePrevMatch.efic_oe != null)
        ? parseFloat(oeLastMatch.efic_oe) - parseFloat(oePrevMatch.efic_oe)
        : null;
      const dProd = (oeLastMatch.prod_oe != null && oePrevMatch.prod_oe != null)
        ? parseFloat(oeLastMatch.prod_oe) - parseFloat(oePrevMatch.prod_oe)
        : null;
      const dDef = (() => {
        const a = totalDef(oeLastMatch);
        const b = totalDef(oePrevMatch);
        if (a == null || b == null) return null;
        return a - b;
      })();
      const dActivas = (oeLastMatch.maquinas_activas != null && oePrevMatch.maquinas_activas != null)
        ? Number(oeLastMatch.maquinas_activas) - Number(oePrevMatch.maquinas_activas)
        : null;

      const cvmOeNoConfiable = (oeLastMatch.cvm_oe == null || oePrevMatch.cvm_oe == null)
        || (Number(oeLastMatch.cvm_oe) === 0 && Number(oePrevMatch.cvm_oe) === 0);
      let juicio = 'sin correlación fuerte';
      if (!cvmOeNoConfiable && dOe != null) {
        if (dUster > 0.30 && dOe > 0.20) juicio = 'correlación positiva (ambos empeoran)';
        else if (dUster < -0.20 && dOe < -0.15) juicio = 'correlación positiva (ambos mejoran)';
        else if ((dUster > 0.30 && dOe <= 0.05) || (dUster < -0.20 && dOe >= -0.05)) juicio = 'desacople USTER vs OE';
      } else {
        if ((dUster > 0.30 && dEfic != null && dEfic < -8) || (dUster > 0.30 && dDef != null && dDef > 20)) {
          juicio = 'correlación operativa parcial (eficiencia/defectología)';
        } else {
          juicio = 'sin evidencia de correlación por CVm_OE (CVM OE en 0.00/no confiable)';
        }
      }

      const evidencia = [
        dOe != null ? `OE CVm ${dOe >= 0 ? '+' : ''}${dOe.toFixed(2)} pts` : null,
        dEfic != null ? `OE Efic ${dEfic >= 0 ? '+' : ''}${dEfic.toFixed(1)} pts` : null,
        dProd != null ? `OE Prod ${dProd >= 0 ? '+' : ''}${dProd.toFixed(0)} kg` : null,
        dActivas != null ? `Máq activas ${dActivas >= 0 ? '+' : ''}${dActivas}` : null,
        dDef != null ? `Defectología ${dDef >= 0 ? '+' : ''}${dDef.toFixed(0)}` : null,
      ].filter(Boolean).join(' | ');

      bloqueCorrelacionOe.push(
        `  • Ne ${neTxt}: USTER CVm ${fmtFechaCorta(prevEns.fecha)}→${fmtFechaCorta(lastEns.fecha)} ${dUster >= 0 ? '+' : ''}${dUster.toFixed(2)} pts | ${evidencia || 'sin evidencia operativa comparable'} → ${juicio}.`
      );
    }
    bloqueCorrelacionOe.push('');
  }

  // ── Auditoría de Aptitud por Proceso (texto) ───────────────────────────
  const bloqueAuditoria = [];
  if (dataActual.hilos.length > 0) {
    bloqueAuditoria.push(`🔍 AUDITORÍA DE APTITUD POR PROCESO — Lote FIAC ${actual}:`);
    for (const h of dataActual.hilos) {
      const ne = String(h.ne);
      const neTxt = neLabel(h);
      const nN = parseFloat(ne);
      const flame = isFlame(h);
      const m = getMatriz(nN, flame);
      const app = m?.app || (nN <= 9 ? 'Trama' : (flame ? 'Urdimbre Flame' : 'Urdimbre'));
      const dest = m?.dest || (nN <= 9 ? ['TELAR'] : ['URDIDORA','INDIGO','TELAR']);
      const desviosCrit = [];
      const desviosWarn = [];
      if (m?.umb) {
        for (const [k, u] of Object.entries(m.umb)) {
          const v = h[k] != null ? parseFloat(h[k]) : null;
          if (v == null) continue;
          const estadoVar = evalUmbral(v, u);
          const label = `${k === 'cvm' ? 'CVm%' : k === 'neps_200' ? 'Neps' : k === 'tenacidad' ? 'Tenac.' : k === 'elongacion' ? 'Elong.' : k} ${f(v)} (${estadoVar === 'warn' ? 'zona de vigilancia' : estadoVar === 'crit' ? 'fuera de banda' : 'ok'})`;
          if (estadoVar === 'crit') desviosCrit.push(label);
          else if (estadoVar === 'warn') desviosWarn.push(label);
        }
      }
      const str = dataActual.hvi.str != null ? parseFloat(dataActual.hvi.str) : null;
      const sci = dataActual.hvi.sci != null ? parseFloat(dataActual.hvi.sci) : null;
      const hviAlerts = [];
      if (m?.strMin && str != null && str < m.strMin) hviAlerts.push(`STR ${f(str, 1)} < ${m.strMin}`);
      if (m?.sciMin && sci != null && sci < m.sciMin) hviAlerts.push(`SCI ${f(sci, 0)} < ${m.sciMin}`);

      const estado = desviosCrit.length
        ? '🔴 Rechazado'
        : (desviosWarn.length || hviAlerts.length)
          ? '⚠️ Condicional'
          : '✅ Aprobado';

      const procIcon = desviosCrit.length ? '🔴' : (desviosWarn.length || hviAlerts.length ? '⚠️' : '✅');
      const procs = dest.map(p => `${p} ${procIcon}`).join(' → ');
      const detalles = [];
      if (desviosCrit.length) detalles.push(`Crítico: ${desviosCrit.join(', ')}`);
      if (desviosWarn.length) detalles.push(`Vigilancia: ${desviosWarn.join(', ')}`);
      if (hviAlerts.length) detalles.push(`Fibra: ${hviAlerts.join(' / ')}`);

      bloqueAuditoria.push(`  Ne ${neTxt} [${app}] → ${procs} — ${estado}${detalles.length ? ' — ' + detalles.join(' | ') : ''}`);

      if (!desviosCrit.length && desviosWarn.length && Math.abs(nN - 12.5) < 0.2) {
        bloqueAuditoria.push(`    💬 "Ne 12.5 en vigilancia condicional: desvío leve en promedio. Corroborar en Informe Auditoría si hubo mínimos aislados por fecha/operador antes de escalar a rechazo."`);
      }
      // Comentario de planta
      const ten = h.tenacidad != null ? parseFloat(h.tenacidad) : null;
      const cvm = h.cvm != null ? parseFloat(h.cvm) : null;
      const elo = h.elongacion != null ? parseFloat(h.elongacion) : null;
      if (ten != null) {
        if (ten >= 18) bloqueAuditoria.push(`    💬 "Va sobrado de fuerza (${f(ten)} cN/tex). Sin drama en ningún proceso."`);
        else if (ten < 14.5) bloqueAuditoria.push(`    💬 "Tenacidad crítica. Alta probabilidad de rotura."`);
      }
      if (app === 'Trama' && cvm != null && cvm > 13) bloqueAuditoria.push(`    💬 "La masa viene bailando (CVm ${f(cvm)}%). Riesgo de barras en tela."`);
      if (app.startsWith('Urdimbre') && flame && cvm != null && cvm <= 18) bloqueAuditoria.push(`    💬 "CVm ${f(cvm)}% coherente con fantasía FLAME. No penaliza aptitud estructural."`);
      if (app.startsWith('Urdimbre') && flame && cvm != null && cvm > 18) bloqueAuditoria.push(`    💬 "CVm ${f(cvm)}% alto incluso para FLAME. Revisar receta/estiraje de efecto."`);
      if (app.startsWith('Urdimbre') && elo != null && elo < 7.5) bloqueAuditoria.push(`    💬 "Elongación baja. El hilo no perdona en la Urdidora."`);
    }
    bloqueAuditoria.push('');
  }

  // ── bloqueDictamen: cabecera ejecutiva + semáforo por Ne ─────────────────
  const bloqueDictamen = [];
  {
    const strHVI  = dataActual.hvi.str != null ? parseFloat(dataActual.hvi.str) : null;
    const encabezado = {
      VERDE:    `📢 INFORME DE CALIDAD — LOTE FIAC ${actual}`,
      AMARILLO: `📢 INFORME LOTE FIAC ${actual} — ⚠️ CONDICIONAL`,
      ROJO:     `📢 REPORTE CRÍTICO: LOTE FIAC ${actual}`,
    }[nivelGlobal];
    const prioLabel = {
      VERDE:    ``,
      AMARILLO: `Prioridad: Media — Monitoreo Activo`,
      ROJO:     `Prioridad: Alta — Revisión Mecánica Urgente`,
    }[nivelGlobal];
    const iconDict = nivelGlobal === 'VERDE' ? '✅' : nivelGlobal === 'AMARILLO' ? '⚠️' : '🔴';
    const fibDesc = strHVI != null
      ? ` Fibra STR ${f(strHVI, 2)} g/tex${strHVI >= 27 ? ' (premium)' : strHVI >= 25 ? ' (apta)' : ' (débil)'}.`
      : '';

    bloqueDictamen.push(encabezado);
    if (prioLabel) bloqueDictamen.push(prioLabel);
    bloqueDictamen.push(``);
    bloqueDictamen.push(`${iconDict} DICTAMEN FINAL:`);
    bloqueDictamen.push(conclusionBase + fibDesc);
    bloqueDictamen.push(``);
    bloqueDictamen.push(`🧵 ESTADO DE TÍTULOS (Semáforo de Calidad):`);
    bloqueDictamen.push(``);

    // Calcular nivel de cada Ne para ordenar de peor a mejor
    const nivelNe = (h) => {
      const m = getMatriz(parseFloat(h.ne), isFlame(h));
      if (!m) return 0;
      let n = 0;
      for (const [campo, umb] of Object.entries(m.umb)) {
        const v = parseFloat(h[campo]);
        if (isNaN(v)) continue;
        const e = evalUmbral(v, umb);
        if (e === 'crit') n = Math.max(n, 2);
        else if (e === 'warn') n = Math.max(n, 1);
      }
      return n;
    };
    const hilosOrd = [...HilosActual].sort((a, b) => nivelNe(b) - nivelNe(a));

    // Índice de máquinas por Ne (del lote actual)
    const maqPorNe = new Map();
    for (const mr of rowsMaquinas) {
      if (Number(mr.mistura) !== actual) continue;
      const flame = mr.is_flame === true || String(mr.is_flame).trim() === 'true' || String(mr.is_flame).trim() === '1';
      const key = `${mr.ne}|${flame}`;
      maqPorNe.set(key, mr);
    }

    const campoLabel = { tenacidad: 'Tenac', elongacion: 'Elong', cvm: 'CVm', neps_200: 'Neps' };
    const campoUnidad = { tenacidad: 'cN/tex', elongacion: '%', cvm: '%', neps_200: '/km' };
    const campoDec    = { tenacidad: 2, elongacion: 2, cvm: 2, neps_200: 0 };

    for (const h of hilosOrd) {
      const flame  = isFlame(h);
      const ne     = parseFloat(h.ne);
      const neTxt  = `${h.ne}${flame ? ' FLAME' : '/1'}`;
      const m      = getMatriz(ne, flame);
      if (!m) continue;

      let nv = 'ok';
      const fuera = [], enRango = [];
      for (const [campo, umb] of Object.entries(m.umb)) {
        const v = parseFloat(h[campo]);
        const lbl = campoLabel[campo] || campo;
        const und = campoUnidad[campo] || '';
        const dec = campoDec[campo] ?? 2;
        if (isNaN(v)) continue;
        const e = evalUmbral(v, umb);
        if (e === 'crit') { nv = 'crit'; fuera.push(`${lbl} ${f(v, dec)}${und} 🔴`); }
        else if (e === 'warn') { if (nv !== 'crit') nv = 'warn'; fuera.push(`${lbl} ${f(v, dec)}${und} ⚠️`); }
        else { enRango.push(`${lbl} ${f(v, dec)}${und}`); }
      }

      const icon   = nv === 'crit' ? '🔴' : nv === 'warn' ? '🟡' : '🟢';
      const estado = nv === 'crit' ? 'ALERTA CRÍTICA' : nv === 'warn' ? 'CONDICIONAL' : 'APROBADO';
      bloqueDictamen.push(`${icon} Ne ${neTxt} (${m.app}): ${estado}`);

      // Datos de proceso: máquina OE, pasador, estiraje
      const maqInfo = maqPorNe.get(`${h.ne}|${flame}`);
      if (maqInfo) {
        const maqStr = maqInfo.maquinas
          ? `Hechos en OE ${maqInfo.maquinas.split(',').map(fmtMaq).join(' y ')}`
          : null;
        const pasStr = maqInfo.pasador === 'SI' ? 'Con pasador'
                     : maqInfo.pasador === 'NO' ? 'Sin pasador'
                     : 'sin información de pasador';
        const estStr = maqInfo.estiraje_avg != null
          ? `Estiraje aplicado: ${formatEstirajeBySide(maqInfo)}`
          : null;
        const infoParts = [maqStr, pasStr, estStr].filter(Boolean);
        bloqueDictamen.push(`   ${infoParts.length ? infoParts.join(' | ') : '⚠️ Sin datos de máquina registrados'}`);
      } else {
        bloqueDictamen.push(`   ⚠️ Sin datos de máquina registrados`);
      }

      const oeRowsNe = getOeRowsByNe(h.ne)
        .slice()
        .sort((a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || ''));
      const oeLast = oeRowsNe.length ? oeRowsNe[oeRowsNe.length - 1] : null;
      if (oeLast) {
        const oeFecha = oeLast.fecha_txt || fmtFechaCorta(oeLast.fecha);
        const oeMaq = oeLast.maquinas_oe
          ? oeLast.maquinas_oe.split(',').map(fmtMaq).filter(Boolean).join(' y ')
          : '';
        const oeLine = [
          `tb_PRODUCCION_OE ${oeFecha}`,
          oeLast.filiales ? `Filial ${oeLast.filiales}` : null,
          oeLast.loc_fisicos ? `Loc ${oeLast.loc_fisicos}` : null,
          oeMaq ? `OEs ${oeMaq}` : null,
          oeLast.maquinas_activas != null && oeLast.filas != null
            ? `Máq activas ${oeLast.maquinas_activas}/${oeLast.maquinas_total ?? oeLast.filas}`
            : null,
          oeLast.turnos ? `Turnos ${oeLast.turnos}` : null,
          oeLast.lados ? `Lados ${oeLast.lados}` : null,
          (oeLast.hora_inicial_min || oeLast.hora_final_max)
            ? `Horario ${oeLast.hora_inicial_min || 'S/D'}-${oeLast.hora_final_max || 'S/D'}`
            : null,
          oeLast.operadores ? `Operador(es) ${oeLast.operadores}` : null,
        ].filter(Boolean).join(' | ');
        const oePerf = [
          `OE-RESUMEN: RPM ${f(oeLast.rpm_avg, 0)}`,
          oeLast.num_fusos_avg != null ? `Fusos ${f(oeLast.num_fusos_avg, 0)}` : null,
          oeLast.alfa_avg != null ? `Alfa ${f(oeLast.alfa_avg, 2)}` : null,
          oeLast.torcao_p_poleg_avg != null ? `Tors/pol ${f(oeLast.torcao_p_poleg_avg, 2)}` : null,
          oeLast.torcao_p_metro_avg != null ? `Tors/m ${f(oeLast.torcao_p_metro_avg, 2)}` : null,
          oeLast.prod_mt_min_avg != null ? `Prod ${f(oeLast.prod_mt_min_avg, 1)} mt/min` : null,
          oeLast.prod_kg_hr_avg != null ? `Prod ${f(oeLast.prod_kg_hr_avg, 1)} kg/h` : null,
          oeLast.prod_oe != null ? `Prod inf ${f(oeLast.prod_oe, 0)} kg` : null,
          oeLast.prod_calc_total != null ? `Prod calc ${f(oeLast.prod_calc_total, 0)} kg` : null,
          oeLast.efic_calc_oe != null ? `Efic calc ${f(oeLast.efic_calc_oe, 1)}%` : null,
          oeLast.efic_oe != null ? `Efic inf ${f(oeLast.efic_oe, 1)}%` : null,
          oeLast.t_bob_avg != null ? `T.BOB ${f(oeLast.t_bob_avg, 3)}` : null,
          oeLast.rpm_card_avg != null ? `RPM Card ${f(oeLast.rpm_card_avg, 0)}` : null,
          oeLast.cvp_oe != null ? `CVP ${f(oeLast.cvp_oe, 2)}` : null,
          oeLast.cvm_oe != null ? `CVM ${f(oeLast.cvm_oe, 2)}` : null,
          (oeLast.rob_01_avg != null || oeLast.rob_02_avg != null || oeLast.rob_03_avg != null)
            ? `%ROB ${f(oeLast.rob_01_avg, 1)}/${f(oeLast.rob_02_avg, 1)}/${f(oeLast.rob_03_avg, 1)}`
            : null,
        ].filter(Boolean).join(' | ');
        const oeCal = [
          `OE-DEFECTOLOGÍA:`,
          `N ${f(oeLast.n_total, 0)}`,
          `S ${f(oeLast.s_total, 0)}`,
          `L ${f(oeLast.l_total, 0)}`,
          `T ${f(oeLast.t_total, 0)}`,
          `MO ${f(oeLast.mo_total, 0)}`,
          `CP ${f(oeLast.cp_v_sl_total, 0)}`,
          `CM ${f(oeLast.cm_v_sl_total, 0)}`,
          `CCp ${f(oeLast.ccp_c_total, 0)}`,
          `CCm ${f(oeLast.ccm_c_total, 0)}`,
          `JP ${f(oeLast.jp_p_total, 0)}`,
          `JM ${f(oeLast.jm_p_total, 0)}`,
          `CORT NAT ${f(oeLast.cort_nat_total, 0)}`,
        ].join(' | ');
        bloqueDictamen.push(`   ${oeLine}`);
        bloqueDictamen.push(`   ${oePerf}`);
        // En estado OK mostrar defectología solo si hay señal; en WARN/CRIT mostrar siempre.
        const haySenialDef = [
          oeLast.n_total, oeLast.s_total, oeLast.l_total, oeLast.t_total, oeLast.mo_total,
          oeLast.cp_v_sl_total, oeLast.cm_v_sl_total, oeLast.ccp_c_total, oeLast.ccm_c_total,
          oeLast.jp_p_total, oeLast.jm_p_total, oeLast.cort_nat_total,
        ].some(v => Number(v) > 0);
        if (nv !== 'ok' || haySenialDef) bloqueDictamen.push(`   ${oeCal}`);
      }

      if (fuera.length > 0) {
        bloqueDictamen.push(`   Fuera de umbral: ${fuera.join(' | ')}`);
        const cvm = parseFloat(h.cvm);
        const nps = parseFloat(h.neps_200);
        const ten = parseFloat(h.tenacidad);
        // Diagnóstico de causa
        if (!isNaN(cvm) && m.umb.cvm && cvm > m.umb.cvm.ok && strHVI != null && strHVI >= 26) {
          bloqueDictamen.push(`   Diagnóstico: Fibra buena (STR ${f(strHVI, 2)} g/tex) — irregularidad es de proceso, no de la bala.`);
        } else if (!isNaN(ten) && m.umb.tenacidad && ten < m.umb.tenacidad.w) {
          bloqueDictamen.push(`   Diagnóstico: Tenacidad comprometida — revisar STR de fibra y torsión del hilo.`);
        }
        // Riesgos operacionales
        if (!isNaN(nps) && nps > (flame ? 700 : 600)) {
          bloqueDictamen.push(`   Riesgo: Manchas de tinte desiguales en Índigo y paradas en urdido.`);
        }
        if (!isNaN(ten) && ten < (ne >= 10 ? 15.5 : 14.0)) {
          bloqueDictamen.push(`   Riesgo: Cortes de hilo en Telar/Urdidora con carga normal de producción.`);
        }
        if (!isNaN(cvm) && cvm > (flame ? 19 : 13.5) && ne < 10) {
          bloqueDictamen.push(`   Riesgo: Barras de trama visibles en tela — revisar CVm antes de continuar.`);
        }
      } else {
        bloqueDictamen.push(`   Valores en rango: ${enRango.join(' | ')}`);
      }
      bloqueDictamen.push(``);
    }
  }

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const avgField = (arr, field) => {
    const vals = arr.map(x => toNum(x[field])).filter(v => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const neToNum = (h) => Number(h?.ne);
  const dateSortAsc = (a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || '');
  const prioridadLabel = nivelGlobal === 'ROJO'
    ? 'Alta — Revisión Mecánica Urgente'
    : nivelGlobal === 'AMARILLO'
      ? 'Media — Monitoreo Activo'
      : null;
  const estadoOperativo = nivelGlobal === 'ROJO'
    ? 'CRÍTICO - DETENER'
    : nivelGlobal === 'AMARILLO'
      ? 'PRECAUCIÓN - REVISAR'
      : 'APROBADO PARA CONTINUIDAD';

  const severityForHilo = (h) => {
    const m = getMatriz(neToNum(h), isFlame(h));
    if (!m?.umb) return 0;
    let maxS = 0;
    for (const [campo, umb] of Object.entries(m.umb)) {
      const ev = evalUmbral(toNum(h[campo]), umb);
      if (ev === 'crit') return 2;
      if (ev === 'warn') maxS = Math.max(maxS, 1);
    }
    return maxS;
  };

  const hiloSeverity = HilosActual
    .map(h => ({ h, s: severityForHilo(h) }))
    .sort((a, b) => b.s - a.s || neToNum(b.h) - neToNum(a.h));
  const foco = hiloSeverity.filter(x => x.s > 0);
  const focoList = foco.length ? foco.map(x => x.h) : (hiloSeverity[0] ? [hiloSeverity[0].h] : []);

  const getMaqInfo = (h) => {
    const flame = isFlame(h);
    return (rowsMaquinas || []).find(r => Number(r.mistura) === actual && String(r.ne) === String(h.ne) && (isFlame(r) === flame));
  };
  const formatOeList = (raw) => {
    const unique = [...new Set(String(raw || '')
      .split(',')
      .map(x => formatOeMachineCode(x))
      .filter(Boolean))];
    return unique.map(x => `OE ${x}`).join(' y ');
  };
  const getOeProcesoForHilo = (h) => {
    const maq = getMaqInfo(h);
    const fromMaq = maq?.maquinas ? formatOeList(maq.maquinas) : '';
    const oeRows = getOeRowsByNe(h.ne)
      .slice()
      .sort((a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || ''));
    const oeLast = oeRows.length ? oeRows[oeRows.length - 1] : null;
    const fromOe = oeLast?.maquinas_oe ? formatOeList(oeLast.maquinas_oe) : '';
    const base = fromMaq || fromOe || 'OE S/D';
    if (/\bLP\b|\bLI\b/.test(base)) return base;
    if (oeLast?.lados) {
      const lados = String(oeLast.lados)
        .split(',')
        .map(x => String(x).trim().toUpperCase())
        .filter(Boolean)
        .join('/');
      return lados ? `${base} (${lados})` : base;
    }
    return base;
  };

  const hviStr = toNum(dataActual.hvi.str);
  const hviSci = toNum(dataActual.hvi.sci);
  const hviUi = toNum(dataActual.hvi.ui);
  const hviMic = toNum(dataActual.hvi.mic);
  const hilosNeps140 = avgField(HilosActual, 'neps_140');
  const hilosCvm = avgField(HilosActual, 'cvm');
  const hilosTen = avgField(HilosActual, 'tenacidad');
  const hilosElo = avgField(HilosActual, 'elongacion');
  const focoProcesosTxt = focoList
    .slice(0, 3)
    .map(h => `${getOeProcesoForHilo(h)} (Ne ${neLabel(h)})`)
    .join(' y ');

  const resumenBullets = [];
  if (focoList.length >= 2) {
    const topNames = focoList.slice(0, 2).map(h => `Ne ${neLabel(h)}`).join(' y ');
    resumenBullets.push(`${topNames} comparten un posible origen común de proceso (variación de regularidad/neps).`);
  } else if (focoList.length === 1) {
    resumenBullets.push(`Ne ${neLabel(focoList[0])} concentra el principal desvío del lote actual.`);
  } else {
    resumenBullets.push('No se detectan desvíos críticos; mantener control de rutina por título.');
  }
  resumenBullets.push(`${conclusionBase} ${hviStr != null ? `STR fibra ${f(hviStr, 2)} g/tex.` : ''}`.trim());
  resumenBullets.push(`**Impacto inmediato en producción:** ${nivelGlobal === 'ROJO' ? 'alto riesgo de roturas y variabilidad en urdido/índigo.' : nivelGlobal === 'AMARILLO' ? 'riesgo moderado; puede aumentar ajustes y paradas en urdido/telar.' : 'sin impacto crítico esperado en continuidad.'}`);
  resumenBullets.push(`**Decisión recomendada:** ${nivelGlobal === 'ROJO' ? `intervenir de inmediato ${focoProcesosTxt || 'en las OE foco'} antes de sostener ritmo normal.` : nivelGlobal === 'AMARILLO' ? `continuar con condición, aplicando ajustes en ${focoProcesosTxt || 'las OE foco'} y control en el siguiente turno.` : 'continuar y validar estabilidad con muestreo de rutina.'}`);

  const comparativaRows = [
    { p: 'STR fibra (g/tex)', a: hviStr != null ? f(hviStr, 2) : 'N/D', r: '>=27.0', t: hviStr == null ? 'N/D' : (hviStr >= 27 ? 'OK' : 'Desvio') },
    { p: 'SCI fibra', a: hviSci != null ? f(hviSci, 1) : 'N/D', r: '>=110', t: hviSci == null ? 'N/D' : (hviSci >= 110 ? 'OK' : 'Leve baja') },
    { p: 'MIC fibra', a: hviMic != null ? f(hviMic, 3) : 'N/D', r: '3.8-4.7', t: hviMic == null ? 'N/D' : (hviMic >= 3.8 && hviMic <= 4.7 ? 'OK' : 'Alto') },
    { p: 'CVm% promedio', a: hilosCvm != null ? f(hilosCvm, 2) : 'N/D', r: '<=11.0', t: hilosCvm == null ? 'N/D' : (hilosCvm <= 11 ? 'OK' : 'Desvio') },
    { p: 'Neps+140 prom.', a: hilosNeps140 != null ? f(hilosNeps140, 1) : 'N/D', r: '<=300', t: hilosNeps140 == null ? 'N/D' : (hilosNeps140 <= 300 ? 'OK' : 'Desvio') },
    { p: 'Tenacidad prom.', a: hilosTen != null ? f(hilosTen, 2) : 'N/D', r: '>=16.5', t: hilosTen == null ? 'N/D' : (hilosTen >= 16.5 ? 'OK' : 'Desvio') },
    { p: 'Elongación prom.', a: hilosElo != null ? f(hilosElo, 2) : 'N/D', r: '>=8.5', t: hilosElo == null ? 'N/D' : (hilosElo >= 8.5 ? 'OK' : 'Estable') },
  ];
  if (hviUi != null) {
    comparativaRows.splice(3, 0, {
      p: 'UI fibra (%)',
      a: f(hviUi, 2),
      r: '>=80',
      t: hviUi >= 80 ? 'OK' : 'Desvio',
    });
  }
  const cmpW = {
    p: Math.max(22, ...comparativaRows.map(r => String(r.p).length)),
    a: Math.max(8, ...comparativaRows.map(r => String(r.a).length)),
    r: Math.max(9, ...comparativaRows.map(r => String(r.r).length)),
    t: Math.max(10, ...comparativaRows.map(r => String(r.t).length)),
  };
  const formatCmpRow = (r) => `${String(r.p).padEnd(cmpW.p)}  ${String(r.a).padStart(cmpW.a)}  ${String(r.r).padStart(cmpW.r)}  ${String(r.t).padStart(cmpW.t)}`;

  const novedades = [];
  const byNe = new Map();
  for (const r of fechasActual) {
    const key = `${r.ne}|${isFlame(r)}`;
    if (!byNe.has(key)) byNe.set(key, []);
    byNe.get(key).push(r);
  }
  const corteDateKey = fechaCorteAplicadaKey || null;
  const fechaAnteriorKey = fechasActual
    .map(r => toDateKey(r.fecha))
    .filter(Boolean)
    .filter(k => !corteDateKey || k < corteDateKey)
    .sort()
    .pop() || null;
  const corteTxt = corteDateKey ? `${corteDateKey.slice(8, 10)}/${corteDateKey.slice(5, 7)}` : 'S/D';
  const fmtSigned = (v, d = 2) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(d)}`;
  const sideNovedadForHilo = (h) => {
    const key = `${h.ne}|${isFlame(h)}`;
    const side = sideSnapshotByNe.get(key);
    if (!side || side.evaluation?.state === 'sin-dato') return null;
    const evalState = side.evaluation;
    const dominant = evalState.dominantSide === 'EQ'
      ? 'equilibrado'
      : `${evalState.dominantSide || 'S/D'} dominante`;
    const estadoTxt = evalState.state === 'crit'
      ? 'crítico'
      : evalState.state === 'warn'
        ? 'en vigilancia'
        : 'controlado';
    return `    - LI/LP ${fmtFechaCorta(side.dateKey)}: Δ thin-30 ${evalState.deltaPct != null ? evalState.deltaPct.toFixed(1) + '%' : 'S/D'} (${dominant}, ${estadoTxt}).`;
  };

  for (const h of focoList.slice(0, 4)) {
    const key = `${h.ne}|${isFlame(h)}`;
    const dias = (byNe.get(key) || []).slice().sort(dateSortAsc);
    novedades.push(`Título analizado: Ne ${neLabel(h)}`);
    if (!dias.length) {
      novedades.push(`    - Sin dato para la fecha analizada ${corteTxt}.`);
      const sideNovedad = sideNovedadForHilo(h);
      if (sideNovedad) novedades.push(sideNovedad);
      novedades.push('');
      continue;
    }
    const diaCorte = corteDateKey
      ? dias.find(d => toDateKey(d.fecha) === corteDateKey)
      : dias[dias.length - 1];
    if (!diaCorte) {
      const ultimo = dias[dias.length - 1];
      novedades.push(`    - Sin dato en fecha analizada ${corteTxt}; último disponible ${fmtFechaCorta(ultimo.fecha)}.`);
      const sideNovedad = sideNovedadForHilo(h);
      if (sideNovedad) novedades.push(sideNovedad);
      novedades.push('');
      continue;
    }
    const prev = fechaAnteriorKey
      ? dias.filter(d => toDateKey(d.fecha) && toDateKey(d.fecha) <= fechaAnteriorKey).sort(dateSortAsc).pop()
      : null;
    const cvmD = (diaCorte?.cvm != null && prev?.cvm != null) ? toNum(diaCorte.cvm) - toNum(prev.cvm) : null;
    const n140D = (diaCorte?.neps_140 != null && prev?.neps_140 != null) ? toNum(diaCorte.neps_140) - toNum(prev.neps_140) : null;
    const tenD = (diaCorte?.tenacidad != null && prev?.tenacidad != null) ? toNum(diaCorte.tenacidad) - toNum(prev.tenacidad) : null;
    const eloD = (diaCorte?.elongacion != null && prev?.elongacion != null) ? toNum(diaCorte.elongacion) - toNum(prev.elongacion) : null;
    const cambios = [];
    if (cvmD != null && Math.abs(cvmD) >= 0.30) {
      cambios.push(`${cvmD > 0 ? 'Aumento' : 'Disminución'} de CVm (${fmtSigned(cvmD, 2)} pts a ${f(diaCorte.cvm, 2)})`);
    }
    if (n140D != null && Math.abs(n140D) >= 100) {
      cambios.push(`${n140D > 0 ? 'Aumento' : 'Disminución'} de Neps+140 (${fmtSigned(n140D, 1)}/km a ${f(diaCorte.neps_140, 1)}/km)`);
    }
    if (tenD != null && Math.abs(tenD) >= 0.30) {
      cambios.push(`${tenD > 0 ? 'Aumento' : 'Disminución'} de Tenacidad (${fmtSigned(tenD, 2)} cN/tex a ${f(diaCorte.tenacidad, 2)})`);
    }
    if (eloD != null && Math.abs(eloD) >= 0.30) {
      cambios.push(`${eloD > 0 ? 'Aumento' : 'Disminución'} de Elongación (${fmtSigned(eloD, 2)} pts a ${f(diaCorte.elongacion, 2)}%)`);
    }
    const fechaTxt = fmtFechaCorta(diaCorte.fecha);
    novedades.push(`    - Fecha analizada: ${fechaTxt}${prev ? ` (vs ${fmtFechaCorta(prev.fecha)})` : ''}.`);
    if (!prev) {
      novedades.push(`    - Sin base de comparación diaria.`);
      const sideNovedad = sideNovedadForHilo(h);
      if (sideNovedad) novedades.push(sideNovedad);
      novedades.push('');
      continue;
    }
    if (!cambios.length) {
      novedades.push(`    - Sin variaciones relevantes en fecha analizada.`);
      const sideNovedad = sideNovedadForHilo(h);
      if (sideNovedad) novedades.push(sideNovedad);
      novedades.push('');
      continue;
    }
    for (const c of cambios) novedades.push(`    - ${c}.`);
    const sideNovedad = sideNovedadForHilo(h);
    if (sideNovedad) novedades.push(sideNovedad);
    novedades.push('');
  }
  if (!novedades.length) novedades.push('Sin variaciones diarias relevantes para los títulos foco.');

  const novedadesActuales = [];
  if (fechasPosteriores.length > 0) {
    const posterioresByNe = new Map();
    for (const r of fechasPosteriores) {
      const key = `${r.ne}|${isFlame(r)}`;
      if (!posterioresByNe.has(key)) posterioresByNe.set(key, []);
      posterioresByNe.get(key).push(r);
    }
    for (const [key, dias] of posterioresByNe.entries()) {
      const ord = dias.slice().sort(dateSortAsc);
      const last = ord[ord.length - 1];
      const tag = last ? `${fmtFechaCorta(last.fecha)}` : 'S/D';
      const basePrev = (ord.length >= 2)
        ? ord[ord.length - 2]
        : ((byNe.get(key) || []).slice().sort(dateSortAsc).pop() || null);
      const partes = [];
      if (last?.cvm != null) partes.push(`CVm ${f(last.cvm)}`);
      if (last?.neps_140 != null) partes.push(`Neps+140 ${f(last.neps_140, 0)}`);
      if (last?.neps_200 != null) partes.push(`Neps+200 ${f(last.neps_200, 1)}`);
      if (last?.tenacidad != null) partes.push(`Tenac ${f(last.tenacidad, 2)}`);
      if (last?.elongacion != null) partes.push(`Elong ${f(last.elongacion, 2)}%`);

      const cvmD = (last?.cvm != null && basePrev?.cvm != null) ? toNum(last.cvm) - toNum(basePrev.cvm) : null;
      const n140D = (last?.neps_140 != null && basePrev?.neps_140 != null) ? toNum(last.neps_140) - toNum(basePrev.neps_140) : null;
      const n200D = (last?.neps_200 != null && basePrev?.neps_200 != null) ? toNum(last.neps_200) - toNum(basePrev.neps_200) : null;
      const tenD = (last?.tenacidad != null && basePrev?.tenacidad != null) ? toNum(last.tenacidad) - toNum(basePrev.tenacidad) : null;
      const eloD = (last?.elongacion != null && basePrev?.elongacion != null) ? toNum(last.elongacion) - toNum(basePrev.elongacion) : null;
      let trendScore = 0;
      if (cvmD != null) trendScore += (cvmD <= -0.10 ? 1 : (cvmD >= 0.10 ? -1 : 0));
      if (n140D != null) trendScore += (n140D <= -30 ? 1 : (n140D >= 30 ? -1 : 0));
      if (n200D != null) trendScore += (n200D <= -20 ? 1 : (n200D >= 20 ? -1 : 0));
      if (tenD != null) trendScore += (tenD >= 0.10 ? 1 : (tenD <= -0.10 ? -1 : 0));
      if (eloD != null) trendScore += (eloD >= 0.10 ? 1 : (eloD <= -0.10 ? -1 : 0));
      const tendencia = trendScore > 0 ? 'mejora' : trendScore < 0 ? 'empeora' : 'mantiene tendencia estable';

      const [neRaw, flameRaw] = key.split('|');
      const neTxt = `${neRaw}${flameRaw === 'true' ? ' FLAME' : '/1'}`;
      novedadesActuales.push(`- Ne ${neTxt}: dato nuevo del día ${tag} (${partes.join(' | ') || 'sin variables comparables'}). Tendencia: ${tendencia}.`);
    }
  }

  const planAccion = [];
  for (const h of focoList.slice(0, 3)) {
    const maq = getMaqInfo(h);
    const oeTxt = maq?.maquinas ? formatOeList(maq.maquinas) : 'OE S/D';
    const sev = severityForHilo(h);
    const sideInfo = sideSnapshotByNe.get(`${h.ne}|${isFlame(h)}`);
    const sideEval = sideInfo?.evaluation;
    const objetivoBase = sev >= 2
      ? 'bajar irregularidad y recuperar estabilidad del título crítico'
      : 'estabilizar variación y evitar escalamiento en el siguiente turno';
    const objetivo = sideEval?.state === 'crit'
      ? `${objetivoBase}; corregir desbalance LI/LP (thin-30) con foco en ${sideEval.dominantSide || 'lado crítico'}`
      : sideEval?.state === 'warn'
        ? `${objetivoBase}; contener deriva LI/LP antes de que escale`
        : objetivoBase;
    const sideTxt = sideEval && sideEval.state !== 'sin-dato'
      ? ` | LI/LP Δ ${sideEval.deltaPct != null ? sideEval.deltaPct.toFixed(1) + '%' : 'S/D'} (${sideEval.dominantSide === 'EQ' ? 'equilibrado' : (sideEval.dominantSide || 'S/D')})`
      : '';
    planAccion.push(`- ${oeTxt} (Ne ${neLabel(h)}${sideTxt}): ajustar limpieza/estiraje y verificar alimentación; objetivo: ${objetivo}.`);
  }
  if (!planAccion.length) {
    planAccion.push('- OE foco del lote actual: mantener parámetros y verificar consistencia por turno.');
  }

  const detalleNe = [];
  for (const h of focoList.length ? focoList : HilosActual.slice(0, 1)) {
    const m = getMatriz(neToNum(h), isFlame(h));
    const estado = severityForHilo(h) >= 2 ? 'Rechazado' : severityForHilo(h) === 1 ? 'Condicional' : 'Aprobado';
    const problemas = [];
    if (m?.umb?.tenacidad) {
      const e = evalUmbral(toNum(h.tenacidad), m.umb.tenacidad);
      if (e !== 'ok' && toNum(h.tenacidad) != null) problemas.push(`Tenacidad ${f(h.tenacidad, 2)} cN/tex`);
    }
    if (m?.umb?.cvm) {
      const e = evalUmbral(toNum(h.cvm), m.umb.cvm);
      if (e !== 'ok' && toNum(h.cvm) != null) problemas.push(`CVm ${f(h.cvm, 2)}%`);
    }
    if (toNum(h.neps_140) != null && toNum(h.neps_140) > 600) problemas.push(`Neps+140 ${f(h.neps_140, 1)}/km`);
    const maq = getMaqInfo(h);
    const sideInfo = sideSnapshotByNe.get(`${h.ne}|${isFlame(h)}`);
    const sideEval = sideInfo?.evaluation;
    const proceso = maq
      ? `${formatOeList(maq.maquinas)} | ${maq.pasador === 'SI' ? 'Con pasador' : maq.pasador === 'NO' ? 'Sin pasador' : 'Pasador S/D'} | Estiraje ${formatEstirajeBySide(maq)}`
      : 'Sin datos de máquina';
    const sideTxt = sideEval && sideEval.state !== 'sin-dato'
      ? `Fecha ${fmtFechaCorta(sideInfo.dateKey)} | LI ${sideEval.liThin30 != null ? sideEval.liThin30.toFixed(1) : 'S/D'} | LP ${sideEval.lpThin30 != null ? sideEval.lpThin30.toFixed(1) : 'S/D'} | Δ ${sideEval.deltaPct != null ? sideEval.deltaPct.toFixed(1) + '%' : 'S/D'} | ${sideEval.dominantSide === 'EQ' ? 'equilibrado' : `${sideEval.dominantSide || 'S/D'} dominante`}`
      : 'Sin datos LI/LP comparables';
    detalleNe.push(`Ne ${neLabel(h)} (${m?.app || 'Proceso'}):`);
    detalleNe.push(`    Estado: ${estado}`);
    detalleNe.push(`    Problemas: ${problemas.length ? problemas.join(' | ') : 'sin desvíos críticos en corte actual'}`);
    detalleNe.push(`    Proceso: ${proceso}`);
    detalleNe.push(`    LI/LP día: ${sideTxt}`);
    detalleNe.push(`    Riesgo: ${severityForHilo(h) >= 2 ? 'alto impacto en continuidad de urdido/telar' : severityForHilo(h) === 1 ? 'riesgo moderado; vigilar siguiente turno' : 'bajo'}`);
  }

  const correlacion = [];
  for (const h of focoList.slice(0, 3)) {
    const dias = (byNe.get(`${h.ne}|${isFlame(h)}`) || []).slice().sort(dateSortAsc);
    const ens = dias[dias.length - 1] || null;
    const oeRows = getOeRowsByNe(h.ne).slice().sort((a, b) => (toDateKey(a.fecha) || '').localeCompare(toDateKey(b.fecha) || ''));
    const oe = ens ? (getOeRowByNeDate(h.ne, ens.fecha) || oeRows[oeRows.length - 1] || null) : (oeRows[oeRows.length - 1] || null);
    const fechaTxt = ens ? fmtFechaCorta(ens.fecha) : (oe ? (oe.fecha_txt || fmtFechaCorta(oe.fecha)) : 'S/D');
    const oeTag = oe?.maquinas_oe ? formatOeList(oe.maquinas_oe) : 'OE S/D';
    correlacion.push(`Ne ${neLabel(h)} (${fechaTxt}, ${oeTag}):`);
    if (!oe) {
      correlacion.push(`    Hecho: sin registros OE comparables para este título.`);
      correlacion.push(`    Hipótesis probable: sin evidencia suficiente para vincular causa mecánica puntual.`);
      correlacion.push(`    Qué verificar en el siguiente turno: disponibilidad de OE por fecha y evolución de CVm/Neps del hilo.`);
      continue;
    }
    const lVal = toNum(oe.l_total);
    const tVal = toNum(oe.t_total);
    const cortVal = toNum(oe.cort_nat_total);
    const hecho = [
      lVal != null ? `L=${f(lVal, 0)}` : null,
      tVal != null ? `T=${f(tVal, 0)}` : null,
      cortVal != null ? `CortNat=${f(cortVal, 0)}` : null,
      oe.efic_oe != null ? `Efic=${f(oe.efic_oe, 1)}%` : null,
    ].filter(Boolean).join(' | ');
    correlacion.push(`    Hecho: ${hecho || 'sin señal operativa consolidada'}${(lVal != null || tVal != null) ? ' (L=lugares gruesos, T=lugares delgados; ambos aumentan irregularidad y ajustes en telar).' : ''}`);
    correlacion.push(`    Hipótesis probable: la variación en OE está contribuyendo al desvío de calidad observado en USTER, sin evidencia de error operativo humano.`);
    correlacion.push(`    Qué verificar en el siguiente turno: descenso de L/T y CortNat junto con mejora de CVm y Neps+140 del hilo.`);
  }

  const totalFardosProv = provActual.reduce((s, p) => s + (Number(p.fardos_consumidos) || 0), 0);
  const provRiesgo = provActual.filter(p => {
    const mic = toNum(p.mic);
    const str = toNum(p.str);
    return (mic != null && mic > 4.7) || (str != null && str < 27);
  });
  const provTop = [...provActual].sort((a, b) => (Number(b.fardos_consumidos) || 0) - (Number(a.fardos_consumidos) || 0)).slice(0, 3);
  const provShowMap = new Map();
  for (const p of [...provTop, ...provRiesgo]) provShowMap.set(`${p.produtor}`, p);
  const provShow = [...provShowMap.values()];
  const lecturaProveedor = (p) => {
    const str = toNum(p.str);
    const mic = toNum(p.mic);
    const uhml = toNum(p.uhml);
    const elg = toNum(p.elg);
    const alertas = [];
    const fortalezas = [];

    if (str != null) {
      if (str < 27) alertas.push('STR bajo');
      else fortalezas.push('STR fuerte');
    }
    if (mic != null) {
      if (mic < 3.8 || mic > 4.7) alertas.push('MIC fuera');
      else fortalezas.push('MIC ok');
    }
    if (uhml != null) {
      if (uhml < 26) alertas.push('UHML corto');
      else fortalezas.push('UHML ok');
    }
    if (elg != null) {
      if (elg < 6.5) alertas.push('ELG baja');
      else fortalezas.push('ELG ok');
    }

    if (alertas.length) return `Riesgo: ${alertas.join(', ')}`;
    if (fortalezas.length) return `Favorable: ${fortalezas.slice(0, 2).join(', ')}`;
    return 'Sin señal relevante';
  };

  const bloqueProv = [];
  if (provShow.length) {
    bloqueProv.push('Proveedor      %     STR    MIC    ELG    UHML   Lectura');
    for (const p of provShow) {
      const fardos = Number(p.fardos_consumidos) || 0;
      const prc = totalFardosProv > 0 ? ((fardos / totalFardosProv) * 100).toFixed(1) : '0.0';
      bloqueProv.push(
        `${String(p.produtor || 'S/D').padEnd(12)} ${prc.padStart(5)} ${f(p.str, 2).padStart(6)} ${f(p.mic, 3).padStart(6)} ${f(p.elg, 2).padStart(6)} ${f(p.uhml, 2).padStart(7)}   ${lecturaProveedor(p)}`
      );
    }
  } else {
    bloqueProv.push('Sin datos de proveedores para el lote actual.');
  }

  const diagnostico = (() => {
    const noFibra = (hviStr != null && hviStr >= 27) && focoList.some(h => severityForHilo(h) > 0);
    if (noFibra) {
      return `STR fibra ${f(hviStr, 2)} g/tex con desvíos en hilo sugiere causa de proceso. **No es la fibra**. Hipótesis probable: variación mecánica en preparación/OE; validar en el siguiente turno la estabilización de CVm y Neps+140.`;
    }
    return `La evidencia no descarta impacto de materia prima. **Sí es la fibra** como hipótesis probable; validar mezcla por proveedor y evolución de tenacidad/cvm en el siguiente turno.`;
  })();

  const lines = [
    `📢 REPORTE — LOTE FIAC ${actual}${refs.length ? ` vs ${refs.join('/')}` : ''}`,
    `📅 Fecha analizada: ${corteTxt}`,
    ...(prioridadLabel ? [`Prioridad: ${prioridadLabel}`] : []),
    ``,
    `🚦 RESUMEN EJECUTIVO:`,
    ...resumenBullets.map(x => `- ${x}`),
    ``,
    `📊 COMPARATIVA CONSOLIDADA:`,
    formatCmpRow({ p: 'Parametro', a: 'Actual', r: 'Ref/Obj', t: 'Tendencia' }),
    ...comparativaRows.map(formatCmpRow),
    ``,
    `📅 NOVEDADES DEL DÍA:`,
    `Fecha analizada: ${corteTxt}`,
    `Base de análisis: fecha analizada ${corteTxt}${fechaAnteriorKey ? ` (comparada contra ${fechaAnteriorKey.slice(8, 10)}/${fechaAnteriorKey.slice(5, 7)})` : ' (sin base de comparación diaria)'}`,
    ...novedades,
    ...(novedadesActuales.length ? [`Datos actuales posteriores a la fecha analizada:`, ...novedadesActuales] : []),
    ``,
    `🛠 PLAN DE ACCIÓN PRIORIZADO (24h):`,
    ...planAccion,
    ``,
    `🧵 DETALLE TÉCNICO POR NE:`,
    ...detalleNe,
    ``,
    `🔗 CORRELACIÓN CON PRODUCCIÓN OE:`,
    ...correlacion,
    ``,
    `📦 PROVEEDORES CLAVE — Lote FIAC ${actual}:`,
    ...bloqueProv,
    ``,
    `🔬 DIAGNÓSTICO MECÁNICO — Paradoja de la Fibra:`,
    diagnostico,
    ``,
    `🚀 ESTADO OPERATIVO: ${estadoOperativo}`,
    `    Plan inmediato: intervenir hoy las OE/manuar indicadas, confirmar setpoints y registrar resultado al cierre del turno.`,
    `    Validación: tomar nuevas muestras tras el ajuste para confirmar corrección.`,
    ``,
    `_Informe generado localmente · ${formatTimestampEsAr24()}_`,
  ];

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dashboard/narrativa-lotes
// Genera informe comparativo. Intenta Gemini; si falla por quota → local.
// Body: { rows, loteActual, modelo? ('gemini'|'local') }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/dashboard/narrativa-lotes', async (req, res) => {
  try {
    const { rows, loteActual, model: modelReq, modo, proveedores, fechaCorte, sideDaily } = req.body;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Sin datos para analizar' });

    const dateKey = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }
      const raw = String(value || '').trim();
      if (!raw) return null;
      const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (iso) return iso[1];
      const br = raw.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{2}|\d{4})/);
      if (br) {
        const dd = br[1].padStart(2, '0');
        const mm = br[2].padStart(2, '0');
        const yy = br[3].length === 2
          ? String((Number(br[3]) >= 70 ? 1900 : 2000) + Number(br[3]))
          : br[3];
        return `${yy}-${mm}-${dd}`;
      }
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      return null;
    };

    const fmtDateDdMm = (value) => {
      const k = dateKey(value);
      return k ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : 'S/D';
    };

    const toLocalDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const cargarContextoOe = async (loteNums, traceTag) => {
      if (!Array.isArray(loteNums) || loteNums.length === 0) return [];
      const colsRes = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tb_produccion_oe'`,
        [],
        `${traceTag}/oe-cols`
      );
      const norm = (s) => String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const colMap = new Map((colsRes.rows || []).map(r => [norm(r.column_name), r.column_name]));
      const pickCol = (...candidates) => {
        for (const c of candidates) {
          const found = colMap.get(norm(c));
          if (found) return found;
        }
        return null;
      };

      const cData = pickCol('DATA_PRODUCAO', 'DATA PRODUCAO', 'DATA');
      const cTitulo = pickCol('TÍTULO', 'TITULO', 'TITULO_NE');
      const cCvm = pickCol('CVM');
      const cCvp = pickCol('CVP');
      const cEfic = pickCol('EFIC INFORMADA', 'EFIC_INFORMADA');
      const cEficCalc = pickCol('EFIC CALCULADA', 'EFIC_CALCULADA');
      const cProd = pickCol('PROD INFORMADA', 'PROD_INFORMADA');
      const cProdCalc = pickCol('PROD CALCULADA', 'PROD_CALCULADA');
      const cProdKgHr = pickCol('PROD KG/HR', 'PROD_KG_HR');
      const cProdMtMin = pickCol('PROD MT/MIN', 'PROD_MT_MIN');
      const cMaq = pickCol('MAQUINA');
      const cNomeMaq = pickCol('NOME_MAQUINA', 'NOME MAQUINA');
      const cFilial = pickCol('FILIAL');
      const cLoc = pickCol('LOC. FISICO', 'LOC FISICO', 'LOC_FISICO');
      const cTurno = pickCol('TURNO');
      const cLado = pickCol('LADO');
      const cItem = pickCol('ITEM');
      const cDescItem = pickCol('DESC ITEM', 'DESC_ITEM');
      const cOperador = pickCol('OPERADOR');
      const cHoraIni = pickCol('HORA INICIAL', 'HORA_INICIAL');
      const cHoraFim = pickCol('HORA FINAL', 'HORA_FINAL');
      const cRpm = pickCol('RPM');
      const cNumFusos = pickCol('NUM FUSOS', 'NUM_FUSOS');
      const cAlfa = pickCol('ALFA');
      const cTempo = pickCol('TEMPO');
      const cTorcPoleg = pickCol('TORCAO P POLEG', 'TORCAO_P_POLEG');
      const cTorcMetro = pickCol('TORCAO P METRO', 'TORCAO_P_METRO');
      const cTBob = pickCol('T.BOB.', 'T_BOB');
      const cRpmCard = pickCol('RPM CARD', 'RPM_CARD');
      const cN = pickCol('N');
      const cS = pickCol('S');
      const cL = pickCol('L');
      const cT = pickCol('T');
      const cMo = pickCol('MO');
      const cCp = pickCol('CP V+ SL+', 'CP_V_SL');
      const cCm = pickCol('CM V- SL-', 'CM_V_SL');
      const cCcp = pickCol('CCp C+', 'CCP_C');
      const cCcm = pickCol('CCm C-', 'CCM_C');
      const cJp = pickCol('JP (P+)', 'JP_P');
      const cJm = pickCol('JM (P-)', 'JM_P');
      const cCort = pickCol('CORT NAT', 'CORT_NAT');
      const cRob1 = pickCol('% ROB 01', 'ROB_01');
      const cRob2 = pickCol('% ROB 02', 'ROB_02');
      const cRob3 = pickCol('% ROB 03', 'ROB_03');
      const cLote = pickCol('LOTE PRODUC', 'LOTE_PRODUC', 'LOTE PRODUCAO', 'LOTE_PRODUCAO');

      if (!cData || !cTitulo || !cLote) {
        console.warn(`narrativa-lotes: columnas OE insuficientes para correlación (data=${cData}, titulo=${cTitulo}, lote=${cLote})`);
        return [];
      }

      const qData = quoteIdent(cData);
      const qTitulo = quoteIdent(cTitulo);
      const qCvm = cCvm ? quoteIdent(cCvm) : 'NULL::text';
      const qCvp = cCvp ? quoteIdent(cCvp) : 'NULL::text';
      const qEfic = cEfic ? quoteIdent(cEfic) : 'NULL::text';
      const qEficCalc = cEficCalc ? quoteIdent(cEficCalc) : 'NULL::text';
      const qProd = cProd ? quoteIdent(cProd) : 'NULL::text';
      const qProdCalc = cProdCalc ? quoteIdent(cProdCalc) : 'NULL::text';
      const qProdKgHr = cProdKgHr ? quoteIdent(cProdKgHr) : 'NULL::text';
      const qProdMtMin = cProdMtMin ? quoteIdent(cProdMtMin) : 'NULL::text';
      const qMaq = cMaq ? quoteIdent(cMaq) : 'NULL::text';
      const qNomeMaq = cNomeMaq ? quoteIdent(cNomeMaq) : 'NULL::text';
      const qFilial = cFilial ? quoteIdent(cFilial) : 'NULL::text';
      const qLoc = cLoc ? quoteIdent(cLoc) : 'NULL::text';
      const qTurno = cTurno ? quoteIdent(cTurno) : 'NULL::text';
      const qLado = cLado ? quoteIdent(cLado) : 'NULL::text';
      const qItem = cItem ? quoteIdent(cItem) : 'NULL::text';
      const qDescItem = cDescItem ? quoteIdent(cDescItem) : 'NULL::text';
      const qOperador = cOperador ? quoteIdent(cOperador) : 'NULL::text';
      const qHoraIni = cHoraIni ? quoteIdent(cHoraIni) : 'NULL::text';
      const qHoraFim = cHoraFim ? quoteIdent(cHoraFim) : 'NULL::text';
      const qRpm = cRpm ? quoteIdent(cRpm) : 'NULL::text';
      const qNumFusos = cNumFusos ? quoteIdent(cNumFusos) : 'NULL::text';
      const qAlfa = cAlfa ? quoteIdent(cAlfa) : 'NULL::text';
      const qTempo = cTempo ? quoteIdent(cTempo) : 'NULL::text';
      const qTorcPoleg = cTorcPoleg ? quoteIdent(cTorcPoleg) : 'NULL::text';
      const qTorcMetro = cTorcMetro ? quoteIdent(cTorcMetro) : 'NULL::text';
      const qTBob = cTBob ? quoteIdent(cTBob) : 'NULL::text';
      const qRpmCard = cRpmCard ? quoteIdent(cRpmCard) : 'NULL::text';
      const qN = cN ? quoteIdent(cN) : 'NULL::text';
      const qS = cS ? quoteIdent(cS) : 'NULL::text';
      const qL = cL ? quoteIdent(cL) : 'NULL::text';
      const qT = cT ? quoteIdent(cT) : 'NULL::text';
      const qMo = cMo ? quoteIdent(cMo) : 'NULL::text';
      const qCp = cCp ? quoteIdent(cCp) : 'NULL::text';
      const qCm = cCm ? quoteIdent(cCm) : 'NULL::text';
      const qCcp = cCcp ? quoteIdent(cCcp) : 'NULL::text';
      const qCcm = cCcm ? quoteIdent(cCcm) : 'NULL::text';
      const qJp = cJp ? quoteIdent(cJp) : 'NULL::text';
      const qJm = cJm ? quoteIdent(cJm) : 'NULL::text';
      const qCort = cCort ? quoteIdent(cCort) : 'NULL::text';
      const qRob1 = cRob1 ? quoteIdent(cRob1) : 'NULL::text';
      const qRob2 = cRob2 ? quoteIdent(cRob2) : 'NULL::text';
      const qRob3 = cRob3 ? quoteIdent(cRob3) : 'NULL::text';
      const qLote = quoteIdent(cLote);

      const oeFechaExpr = sqlParseDate(`btrim(COALESCE(${qData}::text, ''))`);
      const oeNeExpr = sqlParseNumberIntl(`btrim(COALESCE(${qTitulo}::text, ''))`);
      const oeCvmExpr = sqlParseNumberIntl(`btrim(COALESCE(${qCvm}::text, ''))`);
      const oeCvpExpr = sqlParseNumberIntl(`btrim(COALESCE(${qCvp}::text, ''))`);
      const oeEficCalcExpr = sqlParseNumberIntl(`btrim(COALESCE(${qEficCalc}::text, ''))`);
      const oeEficExpr = sqlParseNumberIntl(`btrim(COALESCE(${qEfic}::text, ''))`);
      const oeProdExpr = sqlParseNumberIntl(`btrim(COALESCE(${qProd}::text, ''))`);
      const sqlOe = `
        WITH oe_raw AS (
          SELECT
            NULLIF(regexp_replace(COALESCE(${qLote}::text, ''), '\\D', '', 'g'), '')::integer AS mistura,
            ${oeFechaExpr} AS fecha,
            ROUND(${oeNeExpr}::numeric, 2) AS ne,
            NULLIF(btrim(COALESCE(${qFilial}::text, '')), '') AS filial,
            NULLIF(btrim(COALESCE(${qLoc}::text, '')), '') AS loc_fisico,
            NULLIF(btrim(COALESCE(${qMaq}::text, '')), '') AS maquina,
            NULLIF(btrim(COALESCE(${qNomeMaq}::text, '')), '') AS nome_maquina,
            NULLIF(btrim(COALESCE(${qTurno}::text, '')), '') AS turno,
            NULLIF(btrim(COALESCE(${qLado}::text, '')), '') AS lado,
            NULLIF(btrim(COALESCE(${qItem}::text, '')), '') AS item,
            NULLIF(btrim(COALESCE(${qDescItem}::text, '')), '') AS desc_item,
            NULLIF(btrim(COALESCE(${qOperador}::text, '')), '') AS operador,
            NULLIF(btrim(COALESCE(${qHoraIni}::text, '')), '') AS hora_inicial,
            NULLIF(btrim(COALESCE(${qHoraFim}::text, '')), '') AS hora_final,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qRpm}::text, ''))`)} AS rpm,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qNumFusos}::text, ''))`)} AS num_fusos,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qAlfa}::text, ''))`)} AS alfa,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qTempo}::text, ''))`)} AS tempo,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qTorcPoleg}::text, ''))`)} AS torcao_p_poleg,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qTorcMetro}::text, ''))`)} AS torcao_p_metro,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qProdMtMin}::text, ''))`)} AS prod_mt_min,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qProdKgHr}::text, ''))`)} AS prod_kg_hr,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qProdCalc}::text, ''))`)} AS prod_calc,
            ${oeCvmExpr} AS cvm_oe,
            ${oeCvpExpr} AS cvp_oe,
            ${oeEficCalcExpr} AS efic_calc_oe,
            ${oeEficExpr} AS efic_oe,
            ${oeProdExpr} AS prod_oe,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qTBob}::text, ''))`)} AS t_bob,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qRpmCard}::text, ''))`)} AS rpm_card,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qN}::text, ''))`)} AS n,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qS}::text, ''))`)} AS s,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qL}::text, ''))`)} AS l,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qT}::text, ''))`)} AS t,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qMo}::text, ''))`)} AS mo,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qCp}::text, ''))`)} AS cp_v_sl,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qCm}::text, ''))`)} AS cm_v_sl,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qCcp}::text, ''))`)} AS ccp_c,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qCcm}::text, ''))`)} AS ccm_c,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qJp}::text, ''))`)} AS jp_p,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qJm}::text, ''))`)} AS jm_p,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qCort}::text, ''))`)} AS cort_nat,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qRob1}::text, ''))`)} AS rob_01,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qRob2}::text, ''))`)} AS rob_02,
            ${sqlParseNumberIntl(`btrim(COALESCE(${qRob3}::text, ''))`)} AS rob_03
          FROM tb_PRODUCCION_OE
        )
        SELECT
          mistura,
          fecha,
          to_char(fecha, 'DD/MM/YYYY') AS fecha_txt,
          ne,
          string_agg(DISTINCT filial, ', ' ORDER BY filial)
            FILTER (WHERE filial IS NOT NULL AND filial <> '') AS filiales,
          string_agg(DISTINCT loc_fisico, ', ' ORDER BY loc_fisico)
            FILTER (WHERE loc_fisico IS NOT NULL AND loc_fisico <> '') AS loc_fisicos,
          string_agg(DISTINCT maquina, ', ' ORDER BY maquina)
            FILTER (WHERE maquina IS NOT NULL AND maquina <> '') AS maquinas_oe,
          string_agg(DISTINCT nome_maquina, ' | ' ORDER BY nome_maquina)
            FILTER (WHERE nome_maquina IS NOT NULL AND nome_maquina <> '') AS nomes_maquina,
          string_agg(DISTINCT turno, ', ' ORDER BY turno)
            FILTER (WHERE turno IS NOT NULL AND turno <> '') AS turnos,
          string_agg(DISTINCT lado, ', ' ORDER BY lado)
            FILTER (WHERE lado IS NOT NULL AND lado <> '') AS lados,
          string_agg(DISTINCT item, ', ' ORDER BY item)
            FILTER (WHERE item IS NOT NULL AND item <> '') AS itens,
          string_agg(DISTINCT desc_item, ' | ' ORDER BY desc_item)
            FILTER (WHERE desc_item IS NOT NULL AND desc_item <> '') AS desc_itens,
          string_agg(DISTINCT operador, ', ' ORDER BY operador)
            FILTER (WHERE operador IS NOT NULL AND operador <> '') AS operadores,
          MIN(hora_inicial) AS hora_inicial_min,
          MAX(hora_final) AS hora_final_max,
          ROUND(AVG(rpm)::numeric, 2) AS rpm_avg,
          ROUND(AVG(num_fusos)::numeric, 2) AS num_fusos_avg,
          ROUND(AVG(alfa)::numeric, 2) AS alfa_avg,
          ROUND(AVG(tempo)::numeric, 2) AS tempo_avg,
          ROUND(AVG(torcao_p_poleg)::numeric, 2) AS torcao_p_poleg_avg,
          ROUND(AVG(torcao_p_metro)::numeric, 2) AS torcao_p_metro_avg,
          ROUND(AVG(prod_mt_min)::numeric, 2) AS prod_mt_min_avg,
          ROUND(AVG(prod_kg_hr)::numeric, 2) AS prod_kg_hr_avg,
          ROUND(SUM(prod_calc)::numeric, 2) AS prod_calc_total,
          ROUND(AVG(cvm_oe)::numeric, 2) AS cvm_oe,
          ROUND(AVG(cvp_oe)::numeric, 2) AS cvp_oe,
          ROUND(AVG(efic_calc_oe)::numeric, 2) AS efic_calc_oe,
          ROUND(AVG(efic_oe)::numeric, 2) AS efic_oe,
          ROUND(SUM(prod_oe)::numeric, 2) AS prod_oe,
          ROUND(AVG(t_bob)::numeric, 3) AS t_bob_avg,
          ROUND(AVG(rpm_card)::numeric, 2) AS rpm_card_avg,
          ROUND(SUM(n)::numeric, 2) AS n_total,
          ROUND(SUM(s)::numeric, 2) AS s_total,
          ROUND(SUM(l)::numeric, 2) AS l_total,
          ROUND(SUM(t)::numeric, 2) AS t_total,
          ROUND(SUM(mo)::numeric, 2) AS mo_total,
          ROUND(SUM(cp_v_sl)::numeric, 2) AS cp_v_sl_total,
          ROUND(SUM(cm_v_sl)::numeric, 2) AS cm_v_sl_total,
          ROUND(SUM(ccp_c)::numeric, 2) AS ccp_c_total,
          ROUND(SUM(ccm_c)::numeric, 2) AS ccm_c_total,
          ROUND(SUM(jp_p)::numeric, 2) AS jp_p_total,
          ROUND(SUM(jm_p)::numeric, 2) AS jm_p_total,
          ROUND(SUM(cort_nat)::numeric, 2) AS cort_nat_total,
          ROUND(AVG(rob_01)::numeric, 2) AS rob_01_avg,
          ROUND(AVG(rob_02)::numeric, 2) AS rob_02_avg,
          ROUND(AVG(rob_03)::numeric, 2) AS rob_03_avg,
          COUNT(*)::int AS filas,
          COUNT(DISTINCT maquina)::int AS maquinas_total,
          COUNT(DISTINCT CASE WHEN COALESCE(prod_oe, 0) > 0 THEN maquina END)::int AS maquinas_activas,
          COUNT(*) FILTER (WHERE COALESCE(prod_oe, 0) > 0)::int AS filas_activas
        FROM oe_raw
        WHERE mistura = ANY($1::integer[])
          AND fecha IS NOT NULL
          AND ne IS NOT NULL
        GROUP BY mistura, fecha, ne
        ORDER BY mistura, ne, fecha`;
      const r = await query(sqlOe, [loteNums], `${traceTag}/oe-contexto`);
      return r.rows || [];
    };

    // Si piden explícitamente local, o no hay API key → generación local directa
    if (modo === 'local' || !process.env.GOOGLE_API_KEY) {
      const loteNums = [...new Set(rows.map(r => Number(r.mistura)).filter(n => n > 0))];
      let rowsPorFecha = [];
      try {
        const sqlDiario = `
          SELECT
            DATE(COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            )) AS fecha,
            COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            )::integer AS mistura,
            u.nomcount AS ne,
            CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END AS is_flame,
            ROUND(AVG(t.cvm_percent)::numeric, 2) AS cvm,
            ROUND(AVG(t.neps_200_km)::numeric, 1) AS neps_200,
            ROUND(AVG(t.neps_140_km)::numeric, 1) AS neps_140,
            ROUND(AVG(tp2.tenacidad)::numeric, 2) AS tenacidad,
            ROUND(AVG(tp2.elongacion)::numeric, 2) AS elongacion,
            COUNT(DISTINCT u.testnr) AS n_tests
          FROM tb_uster_par u
          JOIN tb_uster_tbl t ON t.testnr = u.testnr
          LEFT JOIN tb_tensorapid_par tp ON tp.uster_testnr = u.testnr
          LEFT JOIN tb_tensorapid_tbl tp2 ON tp2.testnr = tp.testnr
          WHERE COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            ) IS NOT NULL
            AND COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            ) ~ '^\\d+$'
            AND COALESCE(
              (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
              (regexp_match(u.lote, '(\\d+)'))[1]
            )::integer = ANY($1::integer[])
          GROUP BY
            DATE(COALESCE(
              CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
              u.created_at
            )),
            COALESCE((regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1], (regexp_match(u.lote, '(\\d+)'))[1])::integer,
            u.nomcount,
            CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END
          ORDER BY fecha ASC, mistura ASC, u.nomcount::numeric ASC NULLS LAST`;
        const rDiario = await query(sqlDiario, [loteNums], 'narrativa-lotes/diario');
        rowsPorFecha = rDiario.rows || [];
        console.log(`[narrativa-lotes/local] diario: ${rowsPorFecha.length} filas para lotes [${loteNums.join(',')}]`);
        if (rowsPorFecha.length) console.log('[narrativa-lotes/local] muestra:', JSON.stringify(rowsPorFecha.slice(0, 3)));
        else console.warn('[narrativa-lotes/local] sin datos diarios — verificar campo lote en tb_uster_par para lotes:', loteNums);
      } catch (e) {
        console.warn('narrativa-lotes: no se pudo obtener datos diarios:', e.message?.slice(0, 80));
      }
      // ── Máquinas OE + pasador + estiraje por Ne ──────────────────────────
      let rowsMaquinas = [];
      const sqlMaquinas = `
        SELECT
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          )::integer AS mistura,
          u.nomcount AS ne,
          CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END AS is_flame,
          string_agg(DISTINCT trim(u.maschnr), ', ' ORDER BY trim(u.maschnr))
            FILTER (WHERE u.maschnr IS NOT NULL AND trim(u.maschnr) <> '') AS maquinas,
          CASE
            WHEN COUNT(CASE WHEN upper(trim(u.pasador)) = 'SI' THEN 1 END) >
                 COUNT(CASE WHEN upper(trim(u.pasador)) = 'NO' THEN 1 END) THEN 'SI'
            WHEN COUNT(CASE WHEN upper(trim(u.pasador)) = 'NO' THEN 1 END) > 0 THEN 'NO'
            ELSE NULL
          END AS pasador,
          ROUND(AVG(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_avg,
          ROUND(MIN(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_min,
          ROUND(MAX(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_max,
          ROUND(AVG(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_avg,
          ROUND(MIN(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_min,
          ROUND(MAX(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_max,
          ROUND(AVG(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_avg,
          ROUND(MIN(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_min,
          ROUND(MAX(CASE
            WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
            THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_max
        FROM tb_uster_par u
        WHERE COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) ~ '^\\d+$'
          AND COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          )::integer = ANY($1::integer[])
        GROUP BY
          COALESCE((regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1], (regexp_match(u.lote, '(\\d+)'))[1])::integer,
          u.nomcount,
          CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END
        ORDER BY mistura, u.nomcount::numeric ASC NULLS LAST`;
      try {
        const rMaq = await query(sqlMaquinas, [loteNums], 'narrativa-lotes/maquinas');
        rowsMaquinas = rMaq.rows || [];
      } catch (e) {
        console.warn('narrativa-lotes: datos de máquinas no disponibles:', e.message?.slice(0, 80));
      }
      let rowsProduccionOe = [];
      try {
        rowsProduccionOe = await cargarContextoOe(loteNums, 'narrativa-lotes/local');
      } catch (e) {
        console.warn('narrativa-lotes: contexto OE no disponible:', e.message?.slice(0, 80));
      }
      const narrativa = generarNarrativaLocal(rows, loteActual, proveedores || [], rowsPorFecha, rowsMaquinas, rowsProduccionOe, fechaCorte, sideDaily || []);
      const narrativaLocal = normalizeNarrativaGemini(narrativa);
      const fuenteLocal = `⚡ Fuente: Generador local (sin IA externa) · ${formatTimestampEsAr24()}\n\n`;
      return res.json({ success: true, narrativa: fuenteLocal + narrativaLocal, fuente: 'local' });
    }

    const lotesSorted = [...new Set(rows.map(r => Number(r.mistura)))].sort((a, b) => a - b);
    const actual = loteActual ? Number(loteActual) : Math.max(...lotesSorted);
    const refs   = lotesSorted.filter(l => l !== actual);

    // ── Datos diarios para evolución temporal ──────────────────────────────
    const loteNums = lotesSorted;
    let rowsPorFechaGemini = [];
    try {
      const sqlDiario = `
        SELECT
          DATE(COALESCE(
            CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
            u.created_at
          )) AS fecha,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          )::integer AS mistura,
          u.nomcount AS ne,
          CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END AS is_flame,
          ROUND(AVG(t.cvm_percent)::numeric, 2) AS cvm,
          ROUND(AVG(t.neps_200_km)::numeric, 1) AS neps_200,
          ROUND(AVG(t.neps_140_km)::numeric, 1) AS neps_140,
          ROUND(AVG(tp2.tenacidad)::numeric, 2) AS tenacidad,
          ROUND(AVG(tp2.elongacion)::numeric, 2) AS elongacion
        FROM tb_uster_par u
        JOIN tb_uster_tbl t ON t.testnr = u.testnr
        LEFT JOIN tb_tensorapid_par tp ON tp.uster_testnr = u.testnr
        LEFT JOIN tb_tensorapid_tbl tp2 ON tp2.testnr = tp.testnr
        WHERE COALESCE(
            CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
            u.created_at
          ) IS NOT NULL
          AND COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) ~ '^\\d+$'
          AND COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          )::integer = ANY($1::integer[])
        GROUP BY
          DATE(COALESCE(
            CASE WHEN trim(u.time_stamp) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN TO_TIMESTAMP(trim(u.time_stamp), 'DD/MM/YYYY HH24:MI') ELSE NULL END,
            u.created_at
          )),
          COALESCE((regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1], (regexp_match(u.lote, '(\\d+)'))[1])::integer,
          u.nomcount,
          CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END
        ORDER BY fecha ASC, mistura ASC, u.nomcount::numeric ASC NULLS LAST`;
      const rDiario = await query(sqlDiario, [loteNums], 'narrativa-lotes-gemini/diario');
      rowsPorFechaGemini = rDiario.rows || [];
      console.log(`[narrativa-lotes/gemini] diario: ${rowsPorFechaGemini.length} filas para lotes [${loteNums.join(',')}]`);
      if (rowsPorFechaGemini.length) console.log('[narrativa-lotes/gemini] muestra:', JSON.stringify(rowsPorFechaGemini.slice(0, 3)));
      else console.warn('[narrativa-lotes/gemini] sin datos diarios — verificar campo lote en tb_uster_par para lotes:', loteNums);
    } catch (e) {
      console.warn('narrativa-lotes Gemini: datos diarios no disponibles:', e.message?.slice(0, 80));
    }

    const ayerGemini = new Date();
    ayerGemini.setDate(ayerGemini.getDate() - 1);
    const ayerGeminiKey = toLocalDateKey(ayerGemini);
    const fechaCorteReqKey = dateKey(fechaCorte);
    const fechasActualGeminiDisponibles = rowsPorFechaGemini
      .filter(r => Number(r.mistura) === actual)
      .map(r => dateKey(r.fecha))
      .filter(Boolean)
      .sort();
    const fechaCorteGeminiKey = fechaCorteReqKey
      || [...fechasActualGeminiDisponibles].filter(k => k <= ayerGeminiKey).pop()
      || fechasActualGeminiDisponibles[fechasActualGeminiDisponibles.length - 1]
      || ayerGeminiKey;

    const rowsPorFechaGeminiBase = rowsPorFechaGemini.filter(r => {
      const k = dateKey(r.fecha);
      return k && k <= fechaCorteGeminiKey;
    });
    const rowsPorFechaGeminiPosteriorActual = rowsPorFechaGemini.filter(r => {
      const k = dateKey(r.fecha);
      return Number(r.mistura) === actual && k && k > fechaCorteGeminiKey;
    });
    rowsPorFechaGemini = rowsPorFechaGeminiBase;

    // ── Máquinas OE + pasador + estiraje (Gemini path) ─────────────────────
    let rowsMaquinasGemini = [];
    const sqlMaquinasG = `
      SELECT
        COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer AS mistura,
        u.nomcount AS ne,
        CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END AS is_flame,
        string_agg(DISTINCT trim(u.maschnr), ', ' ORDER BY trim(u.maschnr))
          FILTER (WHERE u.maschnr IS NOT NULL AND trim(u.maschnr) <> '') AS maquinas,
        CASE
          WHEN COUNT(CASE WHEN upper(trim(u.pasador)) = 'SI' THEN 1 END) >
               COUNT(CASE WHEN upper(trim(u.pasador)) = 'NO' THEN 1 END) THEN 'SI'
          WHEN COUNT(CASE WHEN upper(trim(u.pasador)) = 'NO' THEN 1 END) > 0 THEN 'NO'
          ELSE NULL
        END AS pasador,
        ROUND(AVG(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_avg,
        ROUND(MIN(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_min,
        ROUND(MAX(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_max,
        ROUND(AVG(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_avg,
        ROUND(MIN(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_min,
        ROUND(MAX(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])LP($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_lp_max,
        ROUND(AVG(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_avg,
        ROUND(MIN(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_min,
        ROUND(MAX(CASE
          WHEN u.estiraje IS NOT NULL AND trim(u.estiraje::text) ~ '^[0-9\\.]+$' AND upper(trim(u.maschnr)) ~ '(^|[[:space:]])(LI|LIM)($|[[:space:]])'
          THEN u.estiraje::numeric END)::numeric, 2) AS estiraje_li_max
      FROM tb_uster_par u
      WHERE COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        ) ~ '^\\d+$'
        AND COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer = ANY($1::integer[])
      GROUP BY
        COALESCE((regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1], (regexp_match(u.lote, '(\\d+)'))[1])::integer,
        u.nomcount,
        CASE WHEN lower(trim(COALESCE(u.matclass, ''))) = 'hilo de fantasia' THEN true ELSE false END
      ORDER BY mistura, u.nomcount::numeric ASC NULLS LAST`;
    try {
      const rMaqG = await query(sqlMaquinasG, [loteNums], 'narrativa-lotes-gemini/maquinas');
      rowsMaquinasGemini = rMaqG.rows || [];
    } catch (e) {
      console.warn('narrativa-lotes Gemini: datos de máquinas no disponibles:', e.message?.slice(0, 80));
    }
    let rowsProduccionOeGemini = [];
    try {
      rowsProduccionOeGemini = await cargarContextoOe(loteNums, 'narrativa-lotes/gemini');
    } catch (e) {
      console.warn('narrativa-lotes Gemini: contexto OE no disponible:', e.message?.slice(0, 80));
    }
    // Formatea bloque de evolución diaria para incluir en el prompt
    const evolucionDiariaStr = (() => {
      if (!rowsPorFechaGemini.length) return '';
      const neMap = new Map();
      for (const r of rowsPorFechaGemini) {
        const key = `${r.mistura}|${r.ne}|${r.is_flame}`;
        if (!neMap.has(key)) neMap.set(key, { mistura: Number(r.mistura), ne: r.ne, is_flame: r.is_flame, dias: [] });
        neMap.get(key).dias.push(r);
      }
      const lines = [];
      for (const { mistura, ne, is_flame, dias } of neMap.values()) {
        const flame = is_flame === true || String(is_flame).trim() === 'true' || String(is_flame).trim() === '1';
        const neTxt = `${ne}${flame ? ' FLAME' : '/1'}`;
        const loteTag = mistura === actual ? '[ACTUAL]' : '[REF]';
        lines.push(`Ne ${neTxt} — Lote ${mistura} ${loteTag}:`);
        const diasOrd = [...dias].sort((a, b) => String(a.fecha) < String(b.fecha) ? -1 : 1);
        for (const d of diasOrd) {
          const fecha = String(d.fecha).slice(0, 10);
          const parts = [`Fecha=${fecha}`];
          if (d.cvm       != null) parts.push(`CVm=${d.cvm}`);
          if (d.tenacidad != null) parts.push(`Tenac=${d.tenacidad}`);
          if (d.neps_200  != null) parts.push(`Neps+200=${d.neps_200}/km`);
          if (d.neps_140  != null) parts.push(`Neps+140=${d.neps_140}/km`);
          if (d.elongacion!= null) parts.push(`Elong=${d.elongacion}%`);
          lines.push(`  ${parts.join(' | ')}`);
        }
      }
      return `\nDATA DIARIA (por fecha de ensayo):\n` + lines.join('\n');
    })();

    const datosActualesPosterioresStr = (() => {
      if (!rowsPorFechaGeminiPosteriorActual.length) return '';
      const map = new Map();
      for (const r of rowsPorFechaGeminiPosteriorActual) {
        const key = `${r.ne}|${r.is_flame}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
      }
      const lines = [];
      for (const [key, dias] of map.entries()) {
        const ord = dias.slice().sort((a, b) => {
          const ka = dateKey(a.fecha) || '';
          const kb = dateKey(b.fecha) || '';
          return ka.localeCompare(kb);
        });
        const last = ord[ord.length - 1];
        const [neRaw, flameRaw] = key.split('|');
        const neTxt = `${neRaw}${String(flameRaw).trim() === 'true' || String(flameRaw).trim() === '1' ? ' FLAME' : '/1'}`;
        const parts = [];
        if (last?.cvm != null) parts.push(`CVm=${last.cvm}`);
        if (last?.neps_140 != null) parts.push(`Neps+140=${last.neps_140}/km`);
        if (last?.neps_200 != null) parts.push(`Neps+200=${last.neps_200}/km`);
        if (last?.tenacidad != null) parts.push(`Tenac=${last.tenacidad}`);
        if (last?.elongacion != null) parts.push(`Elong=${last.elongacion}%`);
        lines.push(`  Ne ${neTxt} | Fecha=${dateKey(last.fecha) || 'S/D'} | ${parts.join(' | ') || 'sin variables comparables'}`);
      }
      return `\nDATOS ACTUALES POSTERIORES AL CORTE (mostrar en NOVEDADES si existen):\n` + lines.join('\n');
    })();

    // ── Datos de proceso por Ne para el prompt de Gemini ───────────────────
    const maquinasStr = (() => {
      const actMaq = rowsMaquinasGemini.filter(r => Number(r.mistura) === actual);
      if (!actMaq.length) return '';
      const lines = actMaq.map(r => {
        const flame = r.is_flame === true || String(r.is_flame).trim() === 'true' || String(r.is_flame).trim() === '1';
        const neTxt = `${r.ne}${flame ? ' FLAME' : '/1'}`;
        const parts = [`Ne ${neTxt}`];
        if (r.maquinas) {
          parts.push(`Hechos en OE ${r.maquinas.split(',').map(formatOeMachineCode).join(' y ')}`);
        }
        parts.push(r.pasador === 'SI' ? 'Con pasador' : r.pasador === 'NO' ? 'Sin pasador' : 'sin información de pasador');
        if (r.estiraje_avg != null) parts.push(`Estiraje aplicado: ${formatEstirajeBySide(r)}`);
        return `  ${parts.join(' | ')}`;
      });
      return `\nDATOS DE PROCESO (máquinas OE, pasador, estiraje — Lote ${actual}):\n` + lines.join('\n');
    })();

    const sideDailyStr = (() => {
      const sideRows = (sideDaily || [])
        .filter(r => Number(r.mistura) === actual)
        .filter(r => {
          const side = String(r.side || '').trim().toUpperCase();
          return side === 'LI' || side === 'LP';
        });
      if (!sideRows.length) return '';

      const grouped = new Map();
      for (const row of sideRows) {
        const side = String(row.side || '').trim().toUpperCase();
        const dateK = dateKey(row.fecha) || dateKey(row.fecha_txt);
        if (!dateK) continue;
        const flame = row.is_flame === true || String(row.is_flame).trim() === 'true' || String(row.is_flame).trim() === '1';
        const neKey = `${row.ne}|${flame}`;
        const mapKey = `${neKey}|${dateK}`;
        if (!grouped.has(mapKey)) {
          grouped.set(mapKey, {
            ne: row.ne,
            flame,
            dateK,
            LI: null,
            LP: null,
          });
        }
        grouped.get(mapKey)[side] = row;
      }

      const byNe = new Map();
      for (const entry of grouped.values()) {
        const neKey = `${entry.ne}|${entry.flame}`;
        if (!byNe.has(neKey)) byNe.set(neKey, []);
        byNe.get(neKey).push(entry);
      }

      const lines = [];
      for (const entries of byNe.values()) {
        entries.sort((a, b) => a.dateK.localeCompare(b.dateK));
        const prevOrEqual = entries.filter(e => e.dateK <= fechaCorteGeminiKey);
        const selected = prevOrEqual.length ? prevOrEqual[prevOrEqual.length - 1] : entries[entries.length - 1];
        const evalSide = evaluateSideImbalance({ left: selected.LI, right: selected.LP });
        const neTxt = `${selected.ne}${selected.flame ? ' FLAME' : '/1'}`;
        const estado = evalSide.state === 'crit' ? 'CRITICO' : evalSide.state === 'warn' ? 'WARN' : evalSide.state === 'ok' ? 'OK' : 'SIN_DATO';
        lines.push(
          `  Ne ${neTxt} | Fecha=${selected.dateK} | LP_thin30=${evalSide.lpThin30 ?? 'S/D'} | LI_thin30=${evalSide.liThin30 ?? 'S/D'} | Delta%=${evalSide.deltaPct != null ? evalSide.deltaPct.toFixed(1) : 'S/D'} | Dominante=${evalSide.dominantSide || 'S/D'} | Estado=${estado}`
        );
      }

      if (!lines.length) return '';
      return `\nDATA LI/LP DIARIA (thin-30 por lado, usar para detectar lado crítico):\n` + lines.join('\n');
    })();

    const oeProduccionStr = (() => {
      const oeActualBase = rowsProduccionOeGemini
        .filter(r => Number(r.mistura) === actual)
        .filter(r => {
          const k = dateKey(r.fecha);
          return k && k <= fechaCorteGeminiKey;
        })
        .sort((a, b) => {
          const neA = Number(a.ne) || 0;
          const neB = Number(b.ne) || 0;
          if (neA !== neB) return neB - neA;
          const ka = (a.fecha instanceof Date && !Number.isNaN(a.fecha.getTime())) ? a.fecha.toISOString().slice(0, 10) : String(a.fecha || '').slice(0, 10);
          const kb = (b.fecha instanceof Date && !Number.isNaN(b.fecha.getTime())) ? b.fecha.toISOString().slice(0, 10) : String(b.fecha || '').slice(0, 10);
          return ka.localeCompare(kb);
        });
      const oeActualPosterior = rowsProduccionOeGemini
        .filter(r => Number(r.mistura) === actual)
        .filter(r => {
          const k = dateKey(r.fecha);
          return k && k > fechaCorteGeminiKey;
        })
        .sort((a, b) => {
          const ka = dateKey(a.fecha) || '';
          const kb = dateKey(b.fecha) || '';
          return ka.localeCompare(kb);
        });

      if (!oeActualBase.length) {
        const postTxt = oeActualPosterior.length
          ? `\nDATA OE ACTUAL (posterior a la fecha analizada ${fmtDateDdMm(fechaCorteGeminiKey)}):\n  ${oeActualPosterior.length} registro(s) OE detectados para lote actual.`
          : '';
        return `\nDATA OE (tb_PRODUCCION_OE, base <= fecha analizada ${fmtDateDdMm(fechaCorteGeminiKey)}):\n  Sin datos de producción OE para Lote ${actual}.` + postTxt;
      }

      const lines = oeActualBase.map(r => {
        const neTxt = Number.isFinite(Number(r.ne)) ? Number(r.ne).toFixed(2) : String(r.ne || 'S/D');
        const fechaTxt = r.fecha_txt || ((r.fecha instanceof Date && !Number.isNaN(r.fecha.getTime())) ? r.fecha.toISOString().slice(0, 10) : String(r.fecha || '').slice(0, 10)) || 'S/D';
        const oeMaqTxt = (r.maquinas_oe || '')
          .split(',')
          .map(x => formatOeMachineCode(x))
          .filter(Boolean)
          .join(', ');
        return [
          `  Ne ${neTxt} | Fecha ${fechaTxt}`,
          `Filial=${r.filiales || '-'} | Loc=${r.loc_fisicos || '-'} | OEs=${oeMaqTxt || 'S/D'} | NombreMaq=${r.nomes_maquina || '-'}`,
          `Turno=${r.turnos || '-'} | Lado=${r.lados || '-'} | Horario=${r.hora_inicial_min || '-'}-${r.hora_final_max || '-'} | Operador=${r.operadores || '-'}`,
          `Item=${r.itens || '-'} | DescItem=${r.desc_itens || '-'}`,
          `RPM=${r.rpm_avg ?? '-'} | NumFusos=${r.num_fusos_avg ?? '-'} | Alfa=${r.alfa_avg ?? '-'} | Tempo=${r.tempo_avg ?? '-'} | TorcaoPol=${r.torcao_p_poleg_avg ?? '-'} | TorcaoM=${r.torcao_p_metro_avg ?? '-'}`,
          `ProdMtMin=${r.prod_mt_min_avg ?? '-'} | ProdKgHr=${r.prod_kg_hr_avg ?? '-'} | ProdCalc=${r.prod_calc_total ?? '-'} | ProdInf=${r.prod_oe ?? '-'} | EficCalc=${r.efic_calc_oe ?? '-'} | EficInf=${r.efic_oe ?? '-'}`,
          `T.BOB=${r.t_bob_avg ?? '-'} | RPMCard=${r.rpm_card_avg ?? '-'} | CVP=${r.cvp_oe ?? '-'} | CVM=${r.cvm_oe ?? '-'} | CortNat=${r.cort_nat_total ?? '-'}`,
          `N=${r.n_total ?? '-'} | S=${r.s_total ?? '-'} | L=${r.l_total ?? '-'} | T=${r.t_total ?? '-'} | MO=${r.mo_total ?? '-'} | CP=${r.cp_v_sl_total ?? '-'} | CM=${r.cm_v_sl_total ?? '-'} | CCp=${r.ccp_c_total ?? '-'} | CCm=${r.ccm_c_total ?? '-'} | JP=${r.jp_p_total ?? '-'} | JM=${r.jm_p_total ?? '-'}`,
          `%ROB01=${r.rob_01_avg ?? '-'} | %ROB02=${r.rob_02_avg ?? '-'} | %ROB03=${r.rob_03_avg ?? '-'}`,
        ].join(' \n    ');
      });
      const posterioresTxt = oeActualPosterior.length
        ? `\nDATA OE ACTUAL (posterior a la fecha analizada ${fmtDateDdMm(fechaCorteGeminiKey)}):\n` + oeActualPosterior.map(r => {
            const fechaTxt = r.fecha_txt || fmtDateDdMm(r.fecha);
            const neTxt = Number.isFinite(Number(r.ne)) ? Number(r.ne).toFixed(2) : String(r.ne || 'S/D');
            const cvmTxt = r.cvm_oe != null ? Number(r.cvm_oe).toFixed(2) : 'S/D';
            const eficTxt = r.efic_oe != null ? Number(r.efic_oe).toFixed(1) : 'S/D';
            return `  Ne ${neTxt} | Fecha ${fechaTxt} | CVm_OE=${cvmTxt} | Efic_OE=${eficTxt}%`;
          }).join('\n')
        : '';
      return `\nDATA OE (tb_PRODUCCION_OE, base <= fecha analizada ${fmtDateDdMm(fechaCorteGeminiKey)}):\n` + lines.join('\n') + posterioresTxt;
    })();

    const resumenLotes = lotesSorted.map(mistura => {
      const filas = rows.filter(r => Number(r.mistura) === mistura);
      const hvi = filas[0] || {};
      const hilos = filas
        .filter(r => r.ne != null)
        .map(r => {
          const flame = r.is_flame === true || String(r.is_flame ?? '').trim().toLowerCase() === 'true' || String(r.is_flame ?? '').trim() === '1';
          const neTxt = `${r.ne}${flame ? ' FLAME' : '/1'}`;
          return `   • Ne ${neTxt}: Tenacidad=${r.tenacidad ?? '-'} cN/tex | Elongación=${r.elongacion ?? '-'}% | CVm%=${r.cvm ?? '-'} | Neps+200%=${r.neps_200 ?? '-'}/km | Neps+140%=${r.neps_140 ?? '-'}/km`;
        })
        .join('\n');
      const misturaLabel = hvi.mistura_real ? `${mistura} (Mistura ${hvi.mistura_real})` : `${mistura}`;
      // Proveedores del lote
      const provLote = (proveedores || []).filter(p => Number(p.mistura) === mistura);
      const totalFardosProv = provLote.reduce((s, p) => s + (Number(p.fardos_consumidos) || 0), 0);
      const provStr = provLote.length
        ? '\n  Proveedores:\n' + provLote.map(p => {
            const pct = totalFardosProv > 0 ? ((Number(p.fardos_consumidos) / totalFardosProv) * 100).toFixed(1) : '–';
            return `   • ${p.produtor}: ${p.fardos_consumidos} fardos (${pct}%) STR=${p.str ?? '-'} SCI=${p.sci ?? '-'} MIC=${p.mic ?? '-'} ELG=${p.elg ?? '-'} UHML=${p.uhml ?? '-'}`;
          }).join('\n')
        : '';
      return `LOTE_FIAC ${misturaLabel}${mistura === actual ? ' [ACTUAL]' : ' [REFERENCIA]'}:
  HVI: STR=${hvi.str ?? '-'} g/tex | SCI=${hvi.sci ?? '-'} | MIC=${hvi.mic ?? '-'} | UHML=${hvi.uhml ?? '-'} mm | UI=${hvi.ui ?? '-'} % | ELG=${hvi.elg_fibra ?? '-'} % | ${hvi.n_fardos ?? '-'} fardos consumidos | ${hvi.n_secuencias ?? '-'} secuencias blendomat
  Hilo:\n${hilos || '   (sin datos)'}${provStr}`;
    }).join('\n\n');

    const modelName = modelReq || 'gemini-2.5-flash';
    const genAI  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model  = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Actúa como Auditor de Calidad Textil y Experto en Tejeduría e Hilandería de denim de alta velocidad.

OBJETIVO PRINCIPAL:
- Entregar claridad accionable para responsables de planta, evitando sobrecarga de datos.
- Priorizar qué hacer primero (24h), luego explicar por qué.
- Separar salida en dos capas: VISTA EJECUTIVA (decisión) y VISTA TÉCNICA (evidencia).

DATOS COMPARATIVOS:
${resumenLotes}
FECHA_ANALIZADA_SOLICITADA: ${fechaCorteReqKey ? fmtDateDdMm(fechaCorteReqKey) : 'No informada (usa corte por defecto)'}. FECHA_ANALIZADA_EFECTIVA: ${fmtDateDdMm(fechaCorteGeminiKey)}.
Regla de cálculo obligatoria: todo análisis principal debe usar SOLO datos con fecha <= FECHA_ANALIZADA_EFECTIVA.
${evolucionDiariaStr}${datosActualesPosterioresStr}${maquinasStr}${sideDailyStr}${oeProduccionStr}

NOTA SOBRE NEPS: Neps+200% = impurezas grandes que afectan absorción del colorante en Índigo. Neps+140% = conteo total de neps incluyendo pequeños, indicador de agresividad del proceso de apertura y cardado. Los umbrales de decisión aplican a Neps+200%; usar Neps+140% como indicador complementario de proceso.

UMBRALES GENERALES: Tenacidad hilo >16.0=APTO, 14.5-16.0=PRECAUCIÓN, <14.5=CRÍTICO | Elongación <7.5%=RIESGO URDIDORA | Neps+200% >700=RIESGO ÍNDIGO (liso) / >850 (FLAME)=CRÍTICO | CVm% >13=IRREGULAR (liso) / >18 (FLAME)=ALERTA | STR fibra >27=ÓPTIMO

MATRIZ DE REQUISITOS MÍNIMOS POR TÍTULO:
${buildNarrativaMatrixPromptBlock()}

REGLAS BENNINGER / URDIMBRE:
${buildBenningerPromptBlock()}

REGLAS DE AUDITORÍA (OBLIGATORIAS):
- Si es Urdimbre (Ne>=10): priorizar Elongación y CVm%.
- Si es FLAME: no usar criterio de hilo liso; tratarlo como serie independiente.
- Si es Trama (Ne<=9): priorizar estabilidad de masa (CVm%).
- Estado por Ne: Aprobado (todo OK), Condicional (solo WARN), Rechazado (algún CRIT).
- Si MIC > 4.7: advertir "cargado al grueso".
- Si falta un dato crítico: escribir "dato insuficiente para conclusión técnica".

REGLAS DE PRIORIDAD OPERATIVA:
- Usar FECHA_ANALIZADA_EFECTIVA provista arriba (no recalcular otra fecha analizada).
- Detectar FECHA_ANTERIOR = fecha inmediatamente previa para comparación.
- Si no hay DATA DIARIA para FECHA_ANALIZADA: declarar explícitamente "sin datos diarios recientes".
- Si FECHA_ANALIZADA existe, comparar FECHA_ANALIZADA vs FECHA_ANTERIOR y destacar solo cambios relevantes: CVm (>=0.30 pts), Neps+140 (>=100/km), Tenacidad (>=0.30), Elongación (>=0.30).
- Si existen "DATOS ACTUALES POSTERIORES A LA FECHA ANALIZADA", mostrarlos al final de NOVEDADES con etiqueta "dato nuevo del día DD/MM".
- Si hay señal en USTER y no hay solape fecha-a-fecha con OE, indicar "sin evidencia de correlación con tb_PRODUCCION_OE".

DIAGNÓSTICO MECÁNICO (PARADOJA DE LA FIBRA):
- Si STR >= 27 g/tex y CVm% elevado en hilo liso: concluir causa mecánica (no materia prima).
- Si UI >= 80% y Neps altos en hilo liso: señalar causa de proceso (apertura/cardas/OE).
- Si STR < 25 g/tex y tenacidad hilo < 15: causa de materia prima.

INSTRUCCIÓN SOBRE DATOS DE PROCESO:
- Si hay datos de máquina para un Ne, incluir explícitamente OE/pasador/estiraje.
- Si Pasador=SI y hay desvío, aclarar que pasó por manuar y buscar falla de ajuste.
- Si Pasador=NO y hay desvío, aclarar "sin doblez previo" como riesgo de irregularidad.
- Si DATA LI/LP reporta Estado=CRITICO en un Ne, elevar prioridad operativa de ese título y describir el lado dominante (LP o LI).

INSTRUCCIÓN SOBRE DATA OE:
- Sintetizar por Ne en máximo 2 líneas: operación (turno/lado/horario, rpm/alfa/fusos, producción/eficiencia) y calidad (CVP/CVM, defectología, CORT NAT, %ROB).
- No volcar tabla cruda extensa.

REGLAS DE CUMPLIMIENTO ESTRICTO (OBLIGATORIAS):
- La respuesta DEBE seguir exactamente los encabezados solicitados abajo, en el mismo orden.
- PROHIBIDO usar estos encabezados del formato antiguo: "DICTAMEN FINAL", "ESTADO DE TÍTULOS (Semáforo de Calidad)", "BALANCE DE TENDENCIAS", "ACCIONES RECOMENDADAS (URGENTE)", "EVOLUCIÓN Y ESTADO DE TÍTULOS", "PUNTOS CLAVE PARA PRODUCCIÓN".
- PROHIBIDO usar estas frases sin evidencia directa: "alta defectología", "cambio operativo", "error de carga".
- PROHIBIDO mencionar "CVm en OE 0.00" o equivalentes mientras el dato no sea confiable en fuente operativa.
- Si por error generás un encabezado prohibido, reescribí la respuesta completa antes de enviarla.
- No superar 650 palabras.

Generá exactamente este formato en español (máximo 650 palabras), priorizando simplicidad y claridad:

📢 REPORTE — LOTE FIAC ${actual}${refs.length ? ` vs ${refs.join('/')}` : ''}
[Si hay algún Ne en CRÍTICO: "Prioridad: Alta — Revisión Mecánica Urgente". Si solo CONDICIONAL: "Prioridad: Media — Monitoreo Activo". Si todo OK, omitir prioridad.]

🚦 RESUMEN EJECUTIVO (máx 4 bullets, lenguaje de planta):
[Si dos o más Ne comparten el mismo problema, mencionar primero los hilos juntos y después el problema común. Ejemplo correcto: "Ne 12.5/1 y Ne 10/1 comparten un aumento de neps de proceso...".]
[Si la evidencia no alcanza para afirmar causalidad única, usar "posible origen común".]
[El bullet 3 debe empezar exactamente con **Impacto inmediato en producción:**]
[El bullet 4 debe empezar exactamente con **Decisión recomendada:**]
[No usar bullets con asterisco (*). Usar guion (-) en los 4 bullets.]

📊 COMPARATIVA CONSOLIDADA (obligatorio, inmediatamente después):
[NO usar tabla markdown ni separadores con |---|.]
[Usar bloque textual alineado, estilo monoespaciado, con 4 columnas: Parámetro, Actual, Ref/Obj, Tendencia.]
[Usar una sola línea de encabezado corta: "Parametro            Actual    Ref/Obj    Tendencia".]
[Usar valores breves y uniformes. Si falta dato, usar "N/D" en lugar de "Dato insuficiente".]
[No ensanchar la columna Tendencia: usar términos cortos como "OK", "Leve baja", "Alto", "Mejora", "Desvio".]
[Incluir UI cuando exista en DATOS COMPARATIVOS. Si viene en HVI, no escribir N/D.]
[Nunca escribir la fila exacta "HVI UI (%) N/D N/D N/D". Si UI no existe en dataset, omitir esa fila.]
[Añadir debajo solo 2 hallazgos clave, en 2 líneas breves.]

📅 NOVEDADES DEL DÍA (obligatorio):
[Encabezado: "Fecha analizada: DD/MM" usando FECHA_ANALIZADA. Nunca usar nombres de mes en inglés o español abreviado (ej: no usar "Mar 13").]
[Cruzar USTER + Tensorapid + OE de FECHA_ANALIZADA vs FECHA_ANTERIOR. Mostrar solo desvíos relevantes por Ne.]
[Si no hay FECHA_ANTERIOR: indicar "sin base de comparación diaria"].
[Si hay datos del día analizado, listarlos explícitamente como "dato nuevo del día" usando siempre DD/MM.]

🛠 PLAN DE ACCIÓN PRIORIZADO (24h):
[Máximo 3 acciones, ordenadas por impacto: 1 urgente, 1 importante, 1 monitoreo].
[Cada acción debe incluir: proceso (MANUAR/OE/CARDAS), Ne afectado, máquina si existe, y objetivo técnico de ajuste].
[No usar acciones genéricas ni más de 1 línea por acción].
[Formatear máquinas siempre como "OE N" usando últimos 2 dígitos y sin ceros a izquierda (ej: 050409 -> OE 9, 050410 -> OE 10).]

🧵 DETALLE TÉCNICO POR NE (solo focos, no volcado masivo):
[Listar solo Ne en Rechazado o Condicional; si todo está OK, listar solo 1 Ne representativo].
[No escribir todo en una sola línea. Formato obligatorio: primero una línea corta con el título. Debajo, 3 a 5 líneas con sangría de 4 espacios para Problemas, Proceso, OE-resumen y Riesgo.]
[Ejemplo de estructura: "Ne 10/1 (Urdimbre):" y debajo "    Estado: ...", "    Problemas: ...", "    Proceso: ...", "    Riesgo: ...".]

🔗 CORRELACIÓN CON PRODUCCIÓN OE:
[Por Ne del lote actual, confirmar o descartar correlación solo si hay coincidencia por Ne+fecha].
[Usar siempre fecha DD/MM, nunca "Mar 12" o similares.]
[No escribir todo en una sola línea. Formato obligatorio: una línea con "Ne X/1 (DD/MM, OE Y):" y debajo 2 a 4 líneas con sangría para Evidencia, Mejora/Problema y Conclusión.]
[En cada Ne usar mini-estructura obligatoria: "Hecho:", "Hipótesis probable:", "Qué verificar en el siguiente turno:".]
[Cuando se mencionen códigos L y T, explicar en lenguaje de planta: L=lugares gruesos y T=lugares delgados; ambos elevan irregularidad y riesgo de paro/ajuste.]
[Mantener redacción neutral: no atribuir culpa operativa sin evidencia directa.]

📦 PROVEEDORES CLAVE — Lote FIAC ${actual}:
[Mostrar top 3 por participación + cualquier proveedor con señal de riesgo (MIC alto o STR bajo).]
[Usar bloque textual alineado, no bullets largos, con columnas: Proveedor, %, STR, MIC, ELG, UHML, Lectura.]
[En Lectura, sintetizar en 1 frase corta si el perfil es favorable o de riesgo, indicando variable(s) clave.]
[Si ELG por proveedor no existe en los datos, usar "N/D". Si existe, mostrarlo.]

🔬 DIAGNÓSTICO MECÁNICO — Paradoja de la Fibra:
[1 párrafo corto: ¿problema de fibra o de proceso? con evidencia numérica.]
[Resaltar en negrita la conclusión central: **Sí es la fibra** o **No es la fibra**.]
[Si hay causalidad no probada, etiquetar explícitamente como "hipótesis probable" y agregar qué variable/turno/máquina observar para confirmar.] 

🚀 ESTADO OPERATIVO: [APROBADO PARA CONTINUIDAD / PRECAUCIÓN - REVISAR / CRÍTICO - DETENER]
[Debajo, agregar 2 líneas obligatorias con sangría: "    Plan inmediato: ..." y "    Validación: tomar nuevas muestras tras el ajuste para confirmar corrección".]`;

    try {
      const result = await model.generateContent(prompt);
      const narrativaGemini = normalizeNarrativaGemini(result.response.text());
      const fuenteGemini = `✨ Fuente: Gemini Flash 2.5 · ${formatTimestampEsAr24()}\n\n`;
      return res.json({ success: true, narrativa: fuenteGemini + narrativaGemini, fuente: 'gemini' });
    } catch (geminiErr) {
      // Fallback local ante cualquier error de Gemini (quota, red, etc.)
      console.warn('Gemini no disponible, usando generación local:', geminiErr.message?.slice(0, 120));
      const narrativa = generarNarrativaLocal(rows, loteActual, proveedores || [], rowsPorFechaGemini, rowsMaquinasGemini, rowsProduccionOeGemini, fechaCorteGeminiKey, sideDaily || []);
      const narrativaLocal = normalizeNarrativaGemini(narrativa);
      const fuenteFallback = `⚡ Fuente: Generador local (Gemini no disponible) · ${formatTimestampEsAr24()}\n\n`;
      const geminiErrText = String(geminiErr?.message || '');
      const cuotaDiariaAgotada = /generate_content_free_tier_requests|GenerateRequestsPerDayPerProjectPerModel-FreeTier|quota exceeded|429 Too Many Requests/i.test(geminiErrText);
      const aviso = cuotaDiariaAgotada
        ? 'Límite diario de Gemini alcanzado (20/día). Informe generado localmente.'
        : 'Gemini no disponible – informe generado localmente.';
      return res.json({
        success: true,
        narrativa: fuenteFallback + narrativaLocal,
        fuente: 'local',
        aviso,
        geminiEstado: cuotaDiariaAgotada ? 'quota-daily' : 'unavailable'
      });
    }

  } catch (err) {
    console.error('Error narrativa-lotes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
// INFORME DIARIO – Datos mensuales por día (4 sectores)
// =====================================================
app.get('/api/informe-diario', async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]
    const [year, month, day] = fecha.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const maxDay = Math.min(day, daysInMonth)
    const mesStr = `${year}-${String(month).padStart(2, '0')}`

    // ── helpers SQL reutilizables ──
    const parseNum = (col) => sqlParseNumberIntl(col)
    const parseDt  = (col) => sqlParseDate(col)

    // ── 1. METAS (todas las columnas en una sola query) ──
    const metasRes = await query(`
      SELECT EXTRACT(DAY FROM "Dia"::date)::int AS dia,
             COALESCE("Indigo",0)::numeric   AS meta_indigo,
             COALESCE("Tejeduria",0)::numeric AS meta_tecelagem,
             COALESCE("Integrada",0)::numeric AS meta_acabamento,
             COALESCE("Revision",0)::numeric  AS meta_calidad
      FROM tb_metas
      WHERE to_char("Dia"::date, 'YYYY-MM') = $1
      ORDER BY dia
    `, [mesStr], 'informe-diario/metas')

    const metasPorDia = {}
    let metaMensualIndigo = 0, metaMensualTecelagem = 0, metaMensualAcabamento = 0, metaMensualCalidad = 0
    for (const m of metasRes.rows) {
      const d = m.dia
      metasPorDia[d] = {
        INDIGO: +m.meta_indigo,
        TECELAGEM: +m.meta_tecelagem,
        ACABAMENTO: +m.meta_acabamento,
        CALIDAD: +m.meta_calidad
      }
      metaMensualIndigo += +m.meta_indigo
      metaMensualTecelagem += +m.meta_tecelagem
      metaMensualAcabamento += +m.meta_acabamento
      metaMensualCalidad += +m.meta_calidad
    }

    // ── 2. PRODUCCIÓN INDIGO ──
    const indigoRes = await query(`
      SELECT EXTRACT(DAY FROM ${parseDt('"DT_BASE_PRODUCAO"')})::int AS dia,
        SUM(${parseNum('"METRAGEM"')}) AS metragem,
        SUM(${parseNum('"VELOC"')} * ${parseNum('"METRAGEM"')}) /
          NULLIF(SUM(${parseNum('"METRAGEM"')}), 0) AS velocidad,
        SUM(${parseNum('"METRAGEM"')}) /
          NULLIF(SUM(${parseNum('"VELOC"')} * ${parseNum('"METRAGEM"')}) /
                 NULLIF(SUM(${parseNum('"METRAGEM"')}), 0) * 1440, 0) * 100 AS eficiencia
      FROM tb_produccion
      WHERE ${parseDt('"DT_BASE_PRODUCAO"')} IS NOT NULL
        AND to_char(${parseDt('"DT_BASE_PRODUCAO"')}, 'YYYY-MM') = $1
        AND "SELETOR" = 'INDIGO'
      GROUP BY dia ORDER BY dia
    `, [mesStr], 'informe-diario/indigo')

    const indigoPorDia = {}
    for (const r of indigoRes.rows) indigoPorDia[r.dia] = r

    // ── 3. PRODUCCIÓN TECELAGEM ──
    const tecelagemRes = await query(`
      SELECT EXTRACT(DAY FROM ${parseDt('"DT_BASE_PRODUCAO"')})::int AS dia,
        SUM(${parseNum('"TEMPO LEIT MIN"')}) / 1440.0 AS telares,
        SUM(${parseNum('"METRAGEM ENCOLH"')}) AS metragem,
        SUM(${parseNum('"PONTOS_LIDOS"')}) /
          NULLIF(SUM(${parseNum('"PONTOS_100%"')}), 0) * 100.0 AS eficiencia,
        SUM(${parseNum('"BATIDAS"')} * ${parseNum('"METRAGEM ENCOLH"')}) /
          NULLIF(SUM(${parseNum('"METRAGEM ENCOLH"')}), 0) AS batidas,
        SUM(${parseNum('"RPM LEITURA"')} * ${parseNum('"PONTOS_LIDOS"')}) /
          NULLIF(SUM(${parseNum('"PONTOS_LIDOS"')}), 0) AS rpm
      FROM tb_produccion
      WHERE ${parseDt('"DT_BASE_PRODUCAO"')} IS NOT NULL
        AND to_char(${parseDt('"DT_BASE_PRODUCAO"')}, 'YYYY-MM') = $1
        AND "SELETOR" = 'TECELAGEM'
      GROUP BY dia ORDER BY dia
    `, [mesStr], 'informe-diario/tecelagem')

    const tecelagemPorDia = {}
    for (const r of tecelagemRes.rows) tecelagemPorDia[r.dia] = r

    // ── 4. PRODUCCIÓN ACABAMENTO (máquina 165001) ──
    const acabamentoRes = await query(`
      SELECT EXTRACT(DAY FROM ${parseDt('"DT_BASE_PRODUCAO"')})::int AS dia,
        SUM(${parseNum('"METRAGEM"')}) AS metragem,
        SUM(${parseNum('"VELOC"')} * ${parseNum('"METRAGEM"')}) /
          NULLIF(SUM(${parseNum('"METRAGEM"')}), 0) AS velocidad,
        SUM(${parseNum('"METRAGEM"')}) /
          NULLIF(SUM(${parseNum('"VELOC"')} * ${parseNum('"METRAGEM"')}) /
                 NULLIF(SUM(${parseNum('"METRAGEM"')}), 0) * 1440, 0) * 100 AS eficiencia
      FROM tb_produccion
      WHERE ${parseDt('"DT_BASE_PRODUCAO"')} IS NOT NULL
        AND to_char(${parseDt('"DT_BASE_PRODUCAO"')}, 'YYYY-MM') = $1
        AND "MAQUINA" = '165001'
      GROUP BY dia ORDER BY dia
    `, [mesStr], 'informe-diario/acabamento')

    const acabamentoPorDia = {}
    for (const r of acabamentoRes.rows) acabamentoPorDia[r.dia] = r

    // ── 5. CALIDAD – metros total y PRIMEIRA ──
    const calidadRes = await query(`
      SELECT EXTRACT(DAY FROM ${parseDt('"DAT_PROD"')})::int AS dia,
        SUM(${parseNum('"METRAGEM"')}) AS metragem_total,
        SUM(CASE WHEN TRIM("QUALIDADE") = 'PRIMEIRA' THEN ${parseNum('"METRAGEM"')} ELSE 0 END) AS metragem_primeira
      FROM tb_calidad
      WHERE ${parseDt('"DAT_PROD"')} IS NOT NULL
        AND to_char(${parseDt('"DAT_PROD"')}, 'YYYY-MM') = $1
        AND "EMP" = 'STC'
      GROUP BY dia ORDER BY dia
    `, [mesStr], 'informe-diario/calidad-metros')

    const calidadPorDia = {}
    for (const r of calidadRes.rows) {
      calidadPorDia[r.dia] = {
        metragem_total: +r.metragem_total || 0,
        metragem_primeira: +r.metragem_primeira || 0
      }
    }

    // ── 6. CALIDAD – Pts/100m² ──
    const puntosRes = await query(`
      WITH pts AS (
        SELECT EXTRACT(DAY FROM sub.dt)::int AS dia,
               SUM(pont_avg) AS pontuacao
        FROM (
          SELECT "EMP", ${parseDt('"DAT_PROD"')} AS dt, "QUALIDADE", "PEÇA",
                 AVG(${parseNum('"PONTUACAO"')}) AS pont_avg
          FROM tb_calidad
          WHERE ${parseDt('"DAT_PROD"')} IS NOT NULL
            AND to_char(${parseDt('"DAT_PROD"')}, 'YYYY-MM') = $1
            AND TRIM("QUALIDADE") = 'PRIMEIRA'
            AND "EMP" = 'STC'
          GROUP BY "EMP", ${parseDt('"DAT_PROD"')}, "QUALIDADE", "PEÇA"
        ) sub
        GROUP BY dia
      ),
      ancho AS (
        SELECT EXTRACT(DAY FROM ${parseDt('"DAT_PROD"')})::int AS dia,
               SUM(${parseNum('"METRAGEM"')}) AS metros,
               SUM(${parseNum('"METRAGEM"')} * ${parseNum('"LARGURA"')}) /
                 NULLIF(SUM(${parseNum('"METRAGEM"')}), 0) AS ancho_pond
        FROM tb_calidad
        WHERE ${parseDt('"DAT_PROD"')} IS NOT NULL
          AND to_char(${parseDt('"DAT_PROD"')}, 'YYYY-MM') = $1
          AND TRIM("QUALIDADE") = 'PRIMEIRA'
          AND "EMP" = 'STC'
        GROUP BY dia
      )
      SELECT ancho.dia,
        CASE WHEN ancho.metros > 0 AND ancho.ancho_pond > 0
          THEN (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0 END AS pts100m2
      FROM ancho LEFT JOIN pts ON ancho.dia = pts.dia
      ORDER BY ancho.dia
    `, [mesStr], 'informe-diario/calidad-puntos')

    for (const r of puntosRes.rows) {
      if (!calidadPorDia[r.dia]) calidadPorDia[r.dia] = {}
      calidadPorDia[r.dia].puntos100m2 = +r.pts100m2 || 0
    }

    // ── 7. Construir array de días ──
    // Detectar primer día con meta > 0
    let primerDiaIndigo = null, primerDiaTecelagem = null, primerDiaAcabamento = null, primerDiaCalidad = null
    for (let i = 1; i <= daysInMonth; i++) {
      if (primerDiaIndigo === null && (metasPorDia[i]?.INDIGO || 0) > 0) primerDiaIndigo = i
      if (primerDiaTecelagem === null && (metasPorDia[i]?.TECELAGEM || 0) > 0) primerDiaTecelagem = i
      if (primerDiaAcabamento === null && (metasPorDia[i]?.ACABAMENTO || 0) > 0) primerDiaAcabamento = i
      if (primerDiaCalidad === null && (metasPorDia[i]?.CALIDAD || 0) > 0) primerDiaCalidad = i
    }

    // Producción acumulada hasta maxDay
    let acumIndigo = 0, acumTecelagem = 0, acumAcabamento = 0, acumCalidad = 0
    for (let i = primerDiaIndigo || 1; i <= maxDay; i++) acumIndigo += +(indigoPorDia[i]?.metragem || 0)
    for (let i = primerDiaTecelagem || 1; i <= maxDay; i++) acumTecelagem += +(tecelagemPorDia[i]?.metragem || 0)
    for (let i = primerDiaAcabamento || 1; i <= maxDay; i++) acumAcabamento += +(acabamentoPorDia[i]?.metragem || 0)
    for (let i = primerDiaCalidad || 1; i <= maxDay; i++) acumCalidad += +(calidadPorDia[i]?.metragem_total || 0)

    const dayNames = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']
    let futIndigo = 0, futTecelagem = 0, futAcabamento = 0, futCalidad = 0

    // Función auxiliar para calcular meta ajustada
    function calcMetaAjustada(sector, dayNum, primerDia, metaMensual, acumTotal, futAcum, porDia, metaKey, metragKey) {
      const metaDia = metasPorDia[dayNum]?.[metaKey] || 0
      if (primerDia === null || dayNum < primerDia || metaDia === 0) return { ma: null, futAcum }
      
      if (dayNum <= maxDay) {
        let prodAcHasta = 0
        for (let i = primerDia; i <= dayNum; i++) prodAcHasta += +(porDia[i]?.[metragKey] || 0)
        let diasPost = 0
        for (let i = dayNum + 1; i <= daysInMonth; i++) {
          if ((metasPorDia[i]?.[metaKey] || 0) > 0) diasPost++
        }
        return { ma: diasPost > 0 ? (metaMensual - prodAcHasta) / diasPost : null, futAcum }
      } else {
        let diasRest = 0
        for (let i = dayNum; i <= daysInMonth; i++) {
          if ((metasPorDia[i]?.[metaKey] || 0) > 0) diasRest++
        }
        if (diasRest > 0) {
          const ma = (metaMensual - acumTotal - futAcum) / diasRest
          return { ma, futAcum: futAcum + ma }
        }
        return { ma: null, futAcum }
      }
    }

    const days = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      const metaDiaIndigo = metasPorDia[d]?.INDIGO || 0
      const metaDiaTecelagem = metasPorDia[d]?.TECELAGEM || 0
      const metaDiaAcabamento = metasPorDia[d]?.ACABAMENTO || 0
      const metaDiaCalidad = metasPorDia[d]?.CALIDAD || 0

      const prodI = d <= maxDay ? +(indigoPorDia[d]?.metragem || 0) : 0
      const prodT = d <= maxDay ? +(tecelagemPorDia[d]?.metragem || 0) : 0
      const prodA = d <= maxDay ? +(acabamentoPorDia[d]?.metragem || 0) : 0
      const prodC = d <= maxDay ? +(calidadPorDia[d]?.metragem_total || 0) : 0

      const rI = calcMetaAjustada('indigo', d, primerDiaIndigo, metaMensualIndigo, acumIndigo, futIndigo, indigoPorDia, 'INDIGO', 'metragem')
      futIndigo = rI.futAcum
      const rT = calcMetaAjustada('tecelagem', d, primerDiaTecelagem, metaMensualTecelagem, acumTecelagem, futTecelagem, tecelagemPorDia, 'TECELAGEM', 'metragem')
      futTecelagem = rT.futAcum
      const rA = calcMetaAjustada('acabamento', d, primerDiaAcabamento, metaMensualAcabamento, acumAcabamento, futAcabamento, acabamentoPorDia, 'ACABAMENTO', 'metragem')
      futAcabamento = rA.futAcum
      const rC = calcMetaAjustada('calidad', d, primerDiaCalidad, metaMensualCalidad, acumCalidad, futCalidad, calidadPorDia, 'CALIDAD', 'metragem_total')
      futCalidad = rC.futAcum

      let primeraCalidadPct = null
      if (d <= maxDay && (calidadPorDia[d]?.metragem_total || 0) > 0) {
        primeraCalidadPct = ((calidadPorDia[d]?.metragem_primeira || 0) / calidadPorDia[d].metragem_total) * 100
      }

      days.push({
        dayNumber: d,
        dayLabel: `${String(d).padStart(2, '0')}- ${dayNames[dow]}`,
        hasData: d <= maxDay ? !!(indigoPorDia[d] || tecelagemPorDia[d] || acabamentoPorDia[d] || calidadPorDia[d]) : false,
        indigo: {
          eficiencia: d <= maxDay ? +(indigoPorDia[d]?.eficiencia || 0) || null : null,
          produccion: prodI,
          meta: metaDiaIndigo,
          saldo: d <= maxDay ? prodI - metaDiaIndigo : null,
          metaAjustada: rI.ma != null ? +rI.ma.toFixed(0) : null,
          velocidad: d <= maxDay ? +(indigoPorDia[d]?.velocidad || 0) || null : null
        },
        tecelagem: {
          telares: d <= maxDay ? +(tecelagemPorDia[d]?.telares || 0) || null : null,
          batidas: d <= maxDay ? +(tecelagemPorDia[d]?.batidas || 0) || null : null,
          rpm: d <= maxDay ? +(tecelagemPorDia[d]?.rpm || 0) || null : null,
          eficiencia: d <= maxDay ? +(tecelagemPorDia[d]?.eficiencia || 0) || null : null,
          produccion: prodT,
          meta: metaDiaTecelagem,
          saldo: d <= maxDay ? prodT - metaDiaTecelagem : null,
          metaAjustada: rT.ma != null ? +rT.ma.toFixed(0) : null
        },
        acabamento: {
          eficiencia: d <= maxDay ? +(acabamentoPorDia[d]?.eficiencia || 0) || null : null,
          produccion: prodA,
          meta: metaDiaAcabamento,
          saldo: d <= maxDay ? prodA - metaDiaAcabamento : null,
          metaAjustada: rA.ma != null ? +rA.ma.toFixed(0) : null,
          primeraCalidad: primeraCalidadPct
        },
        calidad: {
          puntos100m2: d <= maxDay ? +(calidadPorDia[d]?.puntos100m2 || 0) || null : null,
          produccion: prodC,
          meta: metaDiaCalidad,
          saldo: d <= maxDay ? prodC - metaDiaCalidad : null,
          metaAjustada: rC.ma != null ? +rC.ma.toFixed(0) : null
        }
      })
    }

    res.json({ fecha, year, month, daysInMonth, days })
  } catch (err) {
    console.error('Error en /api/informe-diario:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// VERIFICACIÓN PARTIDAS POR ROLADA (ÍNDIGO)
// =====================================================
app.get('/api/produccion/partidas-por-rolada', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const tsInicio = sqlBuildTimestamp('"DT_INICIO"', '"HORA_INICIO"')
    const tsFinal  = sqlBuildTimestamp('"DT_FINAL"',  '"HORA_FINAL"')
    const metragem = sqlParseNumberIntl('"METRAGEM"')
    const veloc    = sqlParseNumberIntl('"VELOC"')

    const sql = `
      SELECT
        "PARTIDA"                                                     AS "PARTIDA",
        MAX("BASE URDUME")                                            AS "BASE_URDUME",
        to_char(MIN(${tsInicio}), 'DD/MM/YY HH24:MI')                AS "HORA_INICIAL",
        to_char(MAX(${tsFinal}),  'DD/MM/YY HH24:MI')                AS "HORA_FINAL",
        ROUND(SUM(${metragem}), 0)                                    AS "METROS",
        ROUND(AVG(${veloc}),    1)                                    AS "VELOC"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND "FILIAL"  = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
        AND "PARTIDA" IS NOT NULL AND "PARTIDA" <> ''
      GROUP BY "PARTIDA"
      ORDER BY MIN(${tsInicio}) ASC NULLS LAST, "PARTIDA" ASC
    `
    const result = await query(sql, [rolada], 'partidas-por-rolada')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/produccion/partidas-por-rolada:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// VERIFICACIÓN PARTIDAS + COBERTURA RTF POR ROLADA
// FULL OUTER JOIN: muestra partidas sin RTF (unmatched),
// partidas con RTF (matched, N filas si N archivos) y
// RTFs cuyo match_partida no existe en producción (rtf_orphan)
// =====================================================
app.get('/api/produccion/partidas-rtf-por-rolada', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const tsInicio = sqlBuildTimestamp('"DT_INICIO"', '"HORA_INICIO"')
    const tsFinal  = sqlBuildTimestamp('"DT_FINAL"',  '"HORA_FINAL"')
    const metragem = sqlParseNumberIntl('"METRAGEM"')
    const veloc    = sqlParseNumberIntl('"VELOC"')

    const sql = `
      WITH prod AS (
        SELECT
          "PARTIDA",
          MAX("BASE URDUME")                                          AS base_urdume,
          to_char(MIN(${tsInicio}), 'DD/MM/YY HH24:MI')              AS hora_inicial,
          to_char(MAX(${tsFinal}),  'DD/MM/YY HH24:MI')              AS hora_final,
          MIN(${tsInicio})                                            AS ts_sort,
          ROUND(SUM(${metragem}), 0)                                  AS metros,
          ROUND(AVG(${veloc}), 1)                                     AS veloc
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "FILIAL" = '05'
          AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
          AND "PARTIDA" IS NOT NULL AND "PARTIDA" <> ''
        GROUP BY "PARTIDA"
      ),
      rtf AS (
        SELECT
          source_file,
          receita,
          comeco_raw,
          to_char(comeco_ts, 'DD/MM/YY HH24:MI')   AS comeco_fmt,
          comeco_ts,
          fim_raw,
          to_char(fim_ts,    'DD/MM/YY HH24:MI')   AS fim_fmt,
          fim_ts,
          (raw_header->>'metros')::numeric          AS rtf_metros,
          match_partida,
          match_rolada,
          match_score,
          match_confidence,
          match_mode
        FROM tb_benninger_rtf_links
        WHERE LTRIM(TRIM(COALESCE(match_rolada, '')), '0') = LTRIM(TRIM($1), '0')
      )
      SELECT
        COALESCE(p."PARTIDA", r.match_partida)      AS "PARTIDA",
        p.base_urdume                                AS "BASE_URDUME",
        p.hora_inicial                               AS "HORA_INICIAL",
        p.hora_final                                 AS "HORA_FINAL",
        p.metros                                     AS "METROS",
        p.veloc                                      AS "VELOC",
        r.source_file                                AS "SOURCE_FILE",
        r.receita                                    AS "RECEITA",
        r.comeco_raw                                 AS "COMECO_RAW",
        r.comeco_fmt                                 AS "COMECO_FMT",
        r.fim_raw                                    AS "FIM_RAW",
        r.fim_fmt                                    AS "FIM_FMT",
        r.rtf_metros                                 AS "RTF_METROS",
        r.match_partida                              AS "MATCH_PARTIDA",
        r.match_rolada                               AS "MATCH_ROLADA",
        r.match_score                                AS "MATCH_SCORE",
        r.match_confidence                           AS "MATCH_CONFIDENCE",
        r.match_mode                                 AS "MATCH_MODE",
        CASE
          WHEN p."PARTIDA" IS NULL THEN 'rtf_orphan'
          WHEN r.source_file IS NULL THEN 'unmatched'
          ELSE 'matched'
        END                                          AS "ROW_TYPE",
        COALESCE(p.ts_sort, r.comeco_ts)            AS _sort_ts
      FROM prod p
      FULL OUTER JOIN rtf r
        ON LTRIM(TRIM(COALESCE(r.match_partida, '')), '0') = LTRIM(TRIM(p."PARTIDA"), '0')
      ORDER BY
        COALESCE(p.ts_sort, r.comeco_ts) ASC NULLS LAST,
        COALESCE(p."PARTIDA", r.match_partida) ASC NULLS LAST,
        r.source_file ASC NULLS LAST
    `
    const result = await query(sql, [rolada], 'partidas-rtf-por-rolada')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/produccion/partidas-rtf-por-rolada:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function startServer() {
  try {
    // Esperar a PostgreSQL (en Podman/compose puede tardar unos segundos)
    const maxAttempts = Math.max(1, parseInt(process.env.PG_CONNECT_ATTEMPTS || '30', 10))
    const delayMs = Math.max(200, parseInt(process.env.PG_CONNECT_DELAY_MS || '1000', 10))
    let lastErr = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await pool.connect()
        client.release()
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        console.warn(`PostgreSQL no disponible (intento ${attempt}/${maxAttempts}): ${e.message}`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }

    if (lastErr) throw lastErr
    console.log('✓ Conexión a PostgreSQL exitosa')

    // Índices para endpoints de calidad (impacta en performance con muchos datos)
    ensureCalidadIndexes().catch((e) => console.warn('ensureCalidadIndexes falló:', e.message))
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 ========================================')
      console.log(`🚀 STC Backend API v2 - PostgreSQL`)
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
      console.log(`🚀 Database: ${process.env.PG_DATABASE || 'stc_produccion'}`)
      console.log(`🚀 Health check: http://localhost:${PORT}/api/health`)
      console.log('🚀 ========================================')
    })

    server.on('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`❌ Puerto ${PORT} ya está en uso (EADDRINUSE).`)
        console.error('❌ Ya hay otra instancia del backend levantada o algún proceso ocupando ese puerto.')
        console.error(`❌ Verificar proceso: Get-NetTCPConnection -LocalPort ${PORT} -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess`)
        console.error('❌ Liberar puerto: Stop-Process -Id <OwningProcess> -Force')
      } else {
        console.error('❌ Error iniciando servidor HTTP:', err.message)
      }
      process.exit(1)
    })
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message)
    process.exit(1)
  }
}

startServer()
