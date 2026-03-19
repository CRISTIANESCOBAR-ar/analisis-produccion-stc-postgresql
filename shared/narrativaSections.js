export const NARRATIVA_SECTION_DEFS = [
  {
    id: 'resumen-ejecutivo',
    heading: '🚦 RESUMEN EJECUTIVO:',
    title: 'Resumen Ejecutivo',
    icon: '🚦',
    audiences: ['produccion', 'mecanica', 'calidad'],
    description: 'Decision y foco inmediato',
  },
  {
    id: 'comparativa-consolidada',
    heading: '📊 COMPARATIVA CONSOLIDADA:',
    title: 'Comparativa Consolidada',
    icon: '📊',
    audiences: ['produccion', 'calidad'],
    description: 'KPIs y referencia objetivo',
  },
  {
    id: 'novedades-dia',
    heading: '📅 NOVEDADES DEL DÍA:',
    title: 'Novedades del Dia',
    icon: '📅',
    audiences: ['produccion', 'mecanica', 'calidad'],
    description: 'Cambios del corte analizado',
  },
  {
    id: 'plan-accion-priorizado',
    heading: '🛠 PLAN DE ACCIÓN PRIORIZADO (24h):',
    title: 'Plan de Accion',
    icon: '🛠',
    audiences: ['produccion', 'mecanica'],
    description: 'Acciones de las proximas 24h',
  },
  {
    id: 'detalle-tecnico-ne',
    heading: '🧵 DETALLE TÉCNICO POR NE:',
    title: 'Detalle Tecnico por Ne',
    icon: '🧵',
    audiences: ['mecanica', 'calidad'],
    description: 'Desvio puntual por titulo',
  },
  {
    id: 'correlacion-produccion-oe',
    heading: '🔗 CORRELACIÓN CON PRODUCCIÓN OE:',
    title: 'Correlacion con Produccion OE',
    icon: '🔗',
    audiences: ['produccion', 'mecanica'],
    description: 'Cruce entre ensayo y proceso',
  },
  {
    id: 'contexto-cardas',
    heading: '🧺 CONTEXTO OPERATIVO CARDAS:',
    title: 'Contexto Operativo Cardas',
    icon: '🧺',
    audiences: ['produccion', 'mecanica'],
    description: 'Contexto previo al OE',
  },
  {
    id: 'proveedores-clave',
    heading: '📦 PROVEEDORES CLAVE',
    title: 'Proveedores Clave',
    icon: '📦',
    audiences: ['calidad'],
    description: 'Participacion y riesgo por proveedor',
  },
  {
    id: 'diagnostico-mecanico',
    heading: '🔬 DIAGNÓSTICO MECÁNICO — Paradoja de la Fibra:',
    title: 'Diagnostico Mecanico',
    icon: '🔬',
    audiences: ['produccion', 'mecanica', 'calidad'],
    description: 'Materia prima vs proceso',
  },
  {
    id: 'estado-operativo',
    heading: '🚀 ESTADO OPERATIVO:',
    title: 'Estado Operativo',
    icon: '🚀',
    audiences: ['produccion', 'mecanica', 'calidad'],
    description: 'Decision final y validacion',
  },
]

export const NARRATIVA_VIEW_PRESETS = [
  {
    id: 'completo',
    label: 'Completo',
    description: 'Muestra todas las areas del informe',
  },
  {
    id: 'produccion',
    label: 'Produccion',
    description: 'Decision, novedades y continuidad operativa',
  },
  {
    id: 'mecanica',
    label: 'Mecanica',
    description: 'Proceso, correlacion y acciones tecnicas',
  },
  {
    id: 'calidad',
    label: 'Calidad',
    description: 'Comparativas, proveedores y lectura tecnica',
  },
  {
    id: 'custom',
    label: 'Personalizada',
    description: 'Seleccion manual de bloques',
  },
]

const SOURCE_LINE_RE = /^(?:✨|⚡|💾)\s*Fuente:/u

function trimEmptyLines(lines = []) {
  let start = 0
  let end = lines.length

  while (start < end && !String(lines[start] || '').trim()) start += 1
  while (end > start && !String(lines[end - 1] || '').trim()) end -= 1

  return lines.slice(start, end)
}

function cloneSectionMeta(def) {
  return {
    id: def.id,
    heading: def.heading,
    title: def.title,
    icon: def.icon,
    audiences: [...def.audiences],
    description: def.description,
  }
}

function stripMarkdown(line) {
  return String(line || '')
    .trim()
    .replace(/^#{1,4}\s*/, '')       // ## headings
    .replace(/^\*{1,3}(.+?)\*{1,3}$/, '$1') // **bold** / ***bold***
    .replace(/^\*{1,3}/, '')          // leading *
    .replace(/\*{1,3}$/, '')          // trailing *
    .trim()
}

function matchSectionDefinition(line) {
  const trimmed = stripMarkdown(line)
  return NARRATIVA_SECTION_DEFS.find((section) => trimmed === section.heading || trimmed.startsWith(section.heading)) || null
}

function buildSectionPayload(def, contentLines) {
  const content = trimEmptyLines(contentLines).join('\n').trim()
  return {
    ...cloneSectionMeta(def),
    content,
    text: content ? `${def.heading}\n${content}` : def.heading,
  }
}

export function parseNarrativaStructure(rawText = '') {
  const source = String(rawText || '').replace(/\r/g, '')
  const lines = source.split('\n')
  let cursor = 0
  let sourceLine = ''

  while (cursor < lines.length && !String(lines[cursor] || '').trim()) cursor += 1
  if (cursor < lines.length && SOURCE_LINE_RE.test(String(lines[cursor] || '').trim())) {
    sourceLine = String(lines[cursor] || '').trim()
    cursor += 1
    while (cursor < lines.length && !String(lines[cursor] || '').trim()) cursor += 1
  }

  const introLines = []
  const sections = []
  let currentDef = null
  let currentLines = []

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]
    const matchedDef = matchSectionDefinition(line)

    if (matchedDef) {
      if (currentDef) sections.push(buildSectionPayload(currentDef, currentLines))
      currentDef = matchedDef
      currentLines = []
      continue
    }

    if (currentDef) currentLines.push(line)
    else introLines.push(line)
  }

  if (currentDef) sections.push(buildSectionPayload(currentDef, currentLines))

  const intro = trimEmptyLines(introLines).join('\n').trim()
  if (!sections.length && intro) {
    return {
      sourceLine,
      intro: '',
      sections: [
        {
          id: 'texto-completo',
          heading: '📄 INFORME COMPLETO:',
          title: 'Informe Completo',
          icon: '📄',
          audiences: ['produccion', 'mecanica', 'calidad'],
          description: 'Texto completo sin segmentacion',
          content: intro,
          text: intro,
        },
      ],
    }
  }

  return {
    sourceLine,
    intro,
    sections,
  }
}

export function getNarrativaPresetSectionIds(presetId, sections = NARRATIVA_SECTION_DEFS) {
  if (presetId === 'completo') return sections.map((section) => section.id)
  if (presetId === 'custom') return sections.map((section) => section.id)
  return sections
    .filter((section) => Array.isArray(section.audiences) && section.audiences.includes(presetId))
    .map((section) => section.id)
}

export function findNarrativaPresetBySectionIds(sectionIds = [], sections = NARRATIVA_SECTION_DEFS) {
  const currentIds = [...new Set(sectionIds)].sort()
  if (!currentIds.length) return 'custom'

  for (const preset of NARRATIVA_VIEW_PRESETS) {
    if (preset.id === 'custom') continue
    const presetIds = getNarrativaPresetSectionIds(preset.id, sections).slice().sort()
    if (presetIds.length !== currentIds.length) continue
    if (presetIds.every((id, index) => id === currentIds[index])) return preset.id
  }

  return 'custom'
}
