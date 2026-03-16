export const QUALITY_MATRIX_VERSION = '2026-03-15-v1'

export const HVI_ROW_DEFS = [
  { key: 'str', label: 'STR — Tenacidad Fibra', unit: 'g/tex', dec: 2, thresholds: [27, 25], inverse: false },
  { key: 'sci', label: 'SCI — Indice Hilabilidad', unit: '', dec: 1, thresholds: [145, 130], inverse: false },
  { key: 'mic', label: 'MIC — Finura / Madurez', unit: 'mic', dec: 3, thresholds: null, inverse: false },
  { key: 'uhml', label: 'UHML — Longitud', unit: 'mm', dec: 2, thresholds: null, inverse: false },
  { key: 'ui', label: 'UI — Uniformidad Fibra', unit: '%', dec: 2, thresholds: [84, 82], inverse: false },
  { key: 'elg_fibra', label: 'ELG — Elong. Fibra', unit: '%', dec: 2, thresholds: null, inverse: false },
  { key: 'n_fardos', label: 'Fardos analizados', unit: '', dec: 0, thresholds: null, inverse: false },
]

export const HILO_ROW_DEFS = [
  { key: 'tenacidad', label: 'Tenacidad', unit: 'cN/tex', dec: 2, thresholds: [16, 14.5], inverse: false },
  { key: 'elongacion', label: 'Elongacion', unit: '%', dec: 2, thresholds: [8, 7.5], inverse: false },
  { key: 'cvm', label: 'CVm% — Irregularidad', unit: '%', dec: 2, thresholds: [12, 13], inverse: true },
  { key: 'vellosidad', label: 'H — Vellosidad', unit: '', dec: 2, thresholds: null, inverse: true },
  { key: 'neps_200', label: 'Neps +200%', unit: '/km', dec: 1, thresholds: [500, 700], inverse: true },
  { key: 'thin_50', label: 'Puntos Delgados -50%', unit: '/km', dec: 1, thresholds: null, inverse: true },
  { key: 'thick_50', label: 'Puntos Gruesos +50%', unit: '/km', dec: 1, thresholds: null, inverse: true },
  { key: 'n_uster', label: 'Ensayos Uster (por Ne)', unit: '', dec: 0, thresholds: null, inverse: false },
]

export const MATRIZ_REQUISITOS = {
  '7': {
    app: 'Trama',
    dest: ['TELAR'],
    sciMin: 115,
    strMin: 24,
    umb: {
      tenacidad: { ok: 14.0, w: 13.0, t: 'min' },
      elongacion: { ok: 7.0, w: 6.0, t: 'min' },
      cvm: { ok: 13.5, w: 14.5, t: 'max' },
      neps_200: { ok: 700, w: 850, t: 'max' },
      vellosidad: { ok: 7.0, w: 8.0, t: 'max' },
    },
  },
  '9': {
    app: 'Trama',
    dest: ['TELAR'],
    sciMin: 120,
    strMin: 25,
    umb: {
      tenacidad: { ok: 14.5, w: 13.5, t: 'min' },
      elongacion: { ok: 7.0, w: 6.5, t: 'min' },
      cvm: { ok: 13.0, w: 14.0, t: 'max' },
      neps_200: { ok: 600, w: 750, t: 'max' },
      vellosidad: { ok: 6.5, w: 7.5, t: 'max' },
    },
  },
  '10': {
    app: 'Urdimbre',
    dest: ['URDIDORA', 'INDIGO', 'TELAR'],
    sciMin: 130,
    strMin: 26,
    umb: {
      tenacidad: { ok: 16.0, w: 15.0, t: 'min' },
      elongacion: { ok: 8.0, w: 7.5, t: 'min' },
      cvm: { ok: 12.0, w: 13.0, t: 'max' },
      neps_200: { ok: 500, w: 650, t: 'max' },
      vellosidad: { ok: 6.0, w: 7.0, t: 'max' },
    },
  },
  '12.5': {
    app: 'Urdimbre',
    dest: ['URDIDORA', 'INDIGO', 'TELAR'],
    sciMin: 135,
    strMin: 27,
    umb: {
      tenacidad: { ok: 16.5, w: 15.5, t: 'min' },
      elongacion: { ok: 8.0, w: 7.5, t: 'min' },
      cvm: { ok: 11.5, w: 12.5, t: 'max' },
      neps_200: { ok: 450, w: 600, t: 'max' },
      vellosidad: { ok: 5.5, w: 6.5, t: 'max' },
    },
  },
  '14': {
    app: 'Urdimbre',
    dest: ['URDIDORA', 'INDIGO', 'TELAR'],
    sciMin: 140,
    strMin: 28,
    umb: {
      tenacidad: { ok: 17.0, w: 16.0, t: 'min' },
      elongacion: { ok: 8.5, w: 8.0, t: 'min' },
      cvm: { ok: 11.0, w: 12.0, t: 'max' },
      neps_200: { ok: 400, w: 550, t: 'max' },
      vellosidad: { ok: 5.0, w: 6.0, t: 'max' },
    },
  },
}

export const FLAME_UMB_AJUSTES = {
  cvm: { ok: 18.0, w: 20.0, t: 'max' },
  neps_200: { ok: 700, w: 850, t: 'max' },
}

export const PROC_VARS = {
  URDIDORA: { label: 'Urdidora', vars: ['elongacion', 'tenacidad', 'thin_50'], tip: 'Tension de urdido — elongacion y resistencia criticas' },
  INDIGO: { label: 'Indigo', vars: ['neps_200', 'cvm', 'vellosidad'], tip: 'Tenido en manta — neps y uniformidad de masa' },
  TELAR: { label: 'Telar aire', vars: ['tenacidad', 'elongacion', 'cvm', 'neps_200'], tip: 'Alta velocidad — exige tenacidad, CVm% y limpieza' },
}

export const ETA_DROP_RULES = {
  warn: 0.5,
  crit: 1.0,
}

export const SIDE_IMBALANCE_RULES = {
  thin_30_delta_pct: { ok: 10, w: 15, t: 'max' },
}

export const BENNINGER_RULES = {
  '10': {
    trabajo_b: { ok: 18.0, w: 15.0, t: 'min' },
    bloqueo: { tenacidad: 16.0, trabajo_b: 15.0 },
  },
  '12.5': {
    trabajo_b: { ok: 15.5, w: 15.0, t: 'min' },
    bloqueo: { tenacidad: 16.5, trabajo_b: 15.0 },
  },
  '14': {
    trabajo_b: { ok: 16.0, w: 15.5, t: 'min' },
    bloqueo: { tenacidad: 17.0, trabajo_b: 15.0 },
  },
}

export function resolveMatrizBaseByNe(neValue) {
  if (!Number.isFinite(Number(neValue))) return null
  const neNum = Number(neValue)
  let bestKey = null
  let bestNum = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const key of Object.keys(MATRIZ_REQUISITOS)) {
    const num = Number.parseFloat(key)
    if (!Number.isFinite(num)) continue
    const dist = Math.abs(num - neNum)
    if (dist < bestDist || (Math.abs(dist - bestDist) < 1e-9 && num > (bestNum ?? -Infinity))) {
      bestDist = dist
      bestNum = num
      bestKey = key
    }
  }

  return bestDist <= 2 ? bestKey : null
}

export function getMatrizRequisitos(neValue, isFlame = false) {
  const key = resolveMatrizBaseByNe(neValue)
  if (!key) return null
  const base = MATRIZ_REQUISITOS[key]
  if (!base || !isFlame || Number(neValue) < 9) return base
  return {
    ...base,
    app: 'Urdimbre Flame',
    umb: {
      ...base.umb,
      ...FLAME_UMB_AJUSTES,
    },
  }
}

export function getProcVarsForRow(proc, isFlame = false) {
  const base = PROC_VARS[proc]
  if (!base || !isFlame) return base
  if (proc === 'INDIGO') return { ...base, vars: ['neps_200', 'vellosidad'] }
  if (proc === 'TELAR') return { ...base, vars: ['tenacidad', 'elongacion', 'neps_200'] }
  return base
}

export function evalUmbral(value, umbral) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || !umbral) return 'sin-dato'
  const warn = Number.isFinite(Number(umbral.w)) ? Number(umbral.w) : Number(umbral.ok)
  if (umbral.t === 'min') {
    if (numeric >= Number(umbral.ok)) return 'ok'
    if (numeric >= warn) return 'warn'
    return 'crit'
  }
  if (numeric <= Number(umbral.ok)) return 'ok'
  if (numeric <= warn) return 'warn'
  return 'crit'
}

export function getBenningerReglas(neValue, isFlame = false) {
  if (isFlame) return null
  const key = resolveMatrizBaseByNe(neValue)
  if (!key) return null
  return BENNINGER_RULES[key] || null
}

export function computeEta(strFibra, tenacidadHilo) {
  const str = Number(strFibra)
  const ten = Number(tenacidadHilo)
  if (!Number.isFinite(str) || !Number.isFinite(ten) || str <= 0) return null
  return (ten / str) * 100
}

export function evaluateEtaAgainstWindow(etaActual, referenceEtas = [], dropRules = ETA_DROP_RULES) {
  const eta = Number(etaActual)
  const refs = (referenceEtas || []).map(Number).filter(Number.isFinite)
  if (!Number.isFinite(eta)) return { state: 'sin-dato', baseline: null, dropPts: null }
  if (!refs.length) return { state: 'sin-dato', baseline: null, dropPts: null }
  const baseline = refs.reduce((acc, value) => acc + value, 0) / refs.length
  const dropPts = baseline - eta
  if (dropPts <= dropRules.warn) return { state: 'ok', baseline, dropPts }
  if (dropPts <= dropRules.crit) return { state: 'warn', baseline, dropPts }
  return { state: 'crit', baseline, dropPts }
}

export function evaluateBenningerAptitude({ neValue, isFlame = false, tenacidad, trabajoB, strFibra, referenceEtas = [] }) {
  const benRules = getBenningerReglas(neValue, isFlame)
  const matrix = getMatrizRequisitos(neValue, isFlame)
  if (!benRules || !matrix) return { state: 'na', blocked: false, tenacidadState: 'na', trabajoBState: 'na', etaState: 'na', eta: null, baselineEta: null, reasons: [] }

  const tenacidadState = evalUmbral(tenacidad, matrix.umb?.tenacidad)
  const trabajoBState = evalUmbral(trabajoB, benRules.trabajo_b)
  const eta = computeEta(strFibra, tenacidad)
  const etaEval = evaluateEtaAgainstWindow(eta, referenceEtas)
  const blocked = Number(tenacidad) < Number(benRules.bloqueo.tenacidad) && Number(trabajoB) < Number(benRules.bloqueo.trabajo_b)

  let state = 'ok'
  if (blocked || tenacidadState === 'crit' || trabajoBState === 'crit' || etaEval.state === 'crit') {
    state = 'crit'
  } else if (tenacidadState === 'warn' || trabajoBState === 'warn' || etaEval.state === 'warn') {
    state = 'warn'
  }

  const reasons = []
  if (blocked) reasons.push('bloqueo_benninger')
  if (tenacidadState === 'warn' || tenacidadState === 'crit') reasons.push('tenacidad')
  if (trabajoBState === 'warn' || trabajoBState === 'crit') reasons.push('trabajo_b')
  if (etaEval.state === 'warn' || etaEval.state === 'crit') reasons.push('eta')

  return {
    state,
    blocked,
    tenacidadState,
    trabajoBState,
    etaState: etaEval.state,
    eta,
    baselineEta: etaEval.baseline,
    etaDropPts: etaEval.dropPts,
    reasons,
  }
}

export function evaluateSideImbalance({ left, right, rules = SIDE_IMBALANCE_RULES } = {}) {
  const liThin30 = Number(left?.thin_30)
  const lpThin30 = Number(right?.thin_30)
  const liNeps140 = Number(left?.neps_140)
  const lpNeps140 = Number(right?.neps_140)
  const liTenacidad = Number(left?.tenacidad)
  const lpTenacidad = Number(right?.tenacidad)

  if (!Number.isFinite(liThin30) || !Number.isFinite(lpThin30)) {
    return {
      state: 'sin-dato',
      dominantSide: null,
      deltaPct: null,
      deltaAbs: null,
      liThin30: Number.isFinite(liThin30) ? liThin30 : null,
      lpThin30: Number.isFinite(lpThin30) ? lpThin30 : null,
      liNeps140: Number.isFinite(liNeps140) ? liNeps140 : null,
      lpNeps140: Number.isFinite(lpNeps140) ? lpNeps140 : null,
      liTenacidad: Number.isFinite(liTenacidad) ? liTenacidad : null,
      lpTenacidad: Number.isFinite(lpTenacidad) ? lpTenacidad : null,
      neps140DeltaPct: null,
      tenacidadDeltaAbs: null,
    }
  }

  const dominantSide = lpThin30 === liThin30 ? 'EQ' : (lpThin30 > liThin30 ? 'LP' : 'LI')
  const lowerThin30 = Math.min(liThin30, lpThin30)
  const deltaAbs = Math.abs(lpThin30 - liThin30)
  const deltaPct = lowerThin30 > 0 ? (deltaAbs / lowerThin30) * 100 : null
  const state = deltaPct == null ? 'sin-dato' : evalUmbral(deltaPct, rules?.thin_30_delta_pct)

  const lowerNeps140 = Math.min(liNeps140, lpNeps140)
  const neps140DeltaPct = Number.isFinite(liNeps140) && Number.isFinite(lpNeps140) && lowerNeps140 > 0
    ? (Math.abs(lpNeps140 - liNeps140) / lowerNeps140) * 100
    : null
  const tenacidadDeltaAbs = Number.isFinite(liTenacidad) && Number.isFinite(lpTenacidad)
    ? lpTenacidad - liTenacidad
    : null

  return {
    state,
    dominantSide,
    deltaPct,
    deltaAbs,
    liThin30,
    lpThin30,
    liNeps140: Number.isFinite(liNeps140) ? liNeps140 : null,
    lpNeps140: Number.isFinite(lpNeps140) ? lpNeps140 : null,
    liTenacidad: Number.isFinite(liTenacidad) ? liTenacidad : null,
    lpTenacidad: Number.isFinite(lpTenacidad) ? lpTenacidad : null,
    neps140DeltaPct,
    tenacidadDeltaAbs,
  }
}

export function buildNarrativaMatrixPromptBlock() {
  const lines = Object.entries(MATRIZ_REQUISITOS).map(([neKey, regla]) => {
    const umb = regla.umb
    return `Ne ${neKey} (${regla.app}): Tenac ok>=${umb.tenacidad.ok} (warn ${umb.tenacidad.w}), Elong ok>=${umb.elongacion.ok} (warn ${umb.elongacion.w}), CVm ok<=${umb.cvm.ok} (warn ${umb.cvm.w}), Neps ok<=${umb.neps_200.ok} (warn ${umb.neps_200.w}) -> ${regla.dest.join('->')}`
  })

  lines.push(`Serie FLAME (Ne >= 9): conservar tenacidad/elongacion del Ne base y sustituir CVm por ok<=${FLAME_UMB_AJUSTES.cvm.ok} (warn ${FLAME_UMB_AJUSTES.cvm.w}) y Neps+200 por ok<=${FLAME_UMB_AJUSTES.neps_200.ok} (warn ${FLAME_UMB_AJUSTES.neps_200.w}).`)
  return lines.join('\n')
}

export function buildBenningerPromptBlock() {
  return [
    `Aptitud Benninger: si Trabajo B < ${BENNINGER_RULES['12.5'].bloqueo.trabajo_b} y Tenacidad < ${BENNINGER_RULES['12.5'].bloqueo.tenacidad} en Ne 12.5 -> bloqueo preventivo.`,
    `Evaluar Trabajo B por Ne de urdimbre: Ne 10 ok>=${BENNINGER_RULES['10'].trabajo_b.ok} (warn ${BENNINGER_RULES['10'].trabajo_b.w}), Ne 12.5 ok>=${BENNINGER_RULES['12.5'].trabajo_b.ok} (warn ${BENNINGER_RULES['12.5'].trabajo_b.w}), Ne 14 ok>=${BENNINGER_RULES['14'].trabajo_b.ok} (warn ${BENNINGER_RULES['14'].trabajo_b.w}).`,
    `Indice eta: comparar contra ventana historica/comparable del mismo Ne; advertir si cae >${ETA_DROP_RULES.warn} pts y critico si cae >${ETA_DROP_RULES.crit} pts.`,
    `Desbalanceo LI/LP en thin_30: warn >${SIDE_IMBALANCE_RULES.thin_30_delta_pct.w}% y objetivo operativo <${SIDE_IMBALANCE_RULES.thin_30_delta_pct.ok}%.`,
  ].join('\n')
}