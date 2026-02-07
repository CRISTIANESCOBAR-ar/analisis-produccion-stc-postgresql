/**
 * Utilidad para generar Excel formateado con los datos de CalidadSectoresTabla
 * Replica el formato exacto del archivo formato-referencia.xlsx
 */

import ExcelJS from 'exceljs'

// Colores del tema de Excel convertidos a ARGB
// Theme 3 con diferentes tints
const COLORS = {
  // Azul claro (theme 3, tint ~0.75) - Para filas alternas
  blueLight: 'FFB4C6E7',
  // Azul más claro (theme 3, tint ~0.90) - Para ACABMTO
  blueLighter: 'FFD6DCE4',
  // Azul medio (theme 3, tint ~0.25) - Para headers
  blueMedium: 'FF8EA9DB',
  // Naranja claro (theme 9, tint ~0.60) - Para Pts 100²
  orangeLight: 'FFF4B183',
  // Verde para valores positivos
  green: 'FF3C7D22',
  // Rojo para valores negativos
  red: 'FFFF0000',
  // Blanco
  white: 'FFFFFFFF',
  // Negro para texto
  black: 'FF000000'
}

// Estilos de borde
const BORDERS = {
  thin: { style: 'thin', color: { argb: 'FF000000' } },
  medium: { style: 'medium', color: { argb: 'FF000000' } }
}

/**
 * Aplica estilo de celda con formato
 */
function styleCell(cell, options = {}) {
  const {
    value,
    bgColor,
    fontColor,
    fontSize = 10,
    bold = false,
    hAlign = 'center',
    vAlign = 'middle',
    rotation = 0,
    wrapText = false,
    borders = {}
  } = options

  if (value !== undefined) {
    cell.value = value
  }

  // Fuente
  cell.font = {
    name: 'Verdana',
    size: fontSize,
    bold: bold,
    color: { argb: fontColor || COLORS.black }
  }

  // Fondo
  if (bgColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    }
  }

  // Alineación
  cell.alignment = {
    horizontal: hAlign,
    vertical: vAlign,
    textRotation: rotation,
    wrapText: wrapText
  }

  // Bordes
  if (Object.keys(borders).length > 0) {
    cell.border = {}
    if (borders.top) cell.border.top = borders.top === 'medium' ? BORDERS.medium : BORDERS.thin
    if (borders.bottom) cell.border.bottom = borders.bottom === 'medium' ? BORDERS.medium : BORDERS.thin
    if (borders.left) cell.border.left = borders.left === 'medium' ? BORDERS.medium : BORDERS.thin
    if (borders.right) cell.border.right = borders.right === 'medium' ? BORDERS.medium : BORDERS.thin
  }
}

/**
 * Formatea número con separador de miles
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

/**
 * Formatea porcentaje
 */
function formatPercent(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

/**
 * Genera el workbook de Excel con los datos formateados
 * @param {Object} data - Datos para llenar el Excel
 * @returns {ExcelJS.Workbook}
 */
export async function generateExcelReport(data) {
  const {
    fecha,
    sectores,          // Array de { sector, metrosDia, metrosMes, percDia, percMes, metaPct }
    totals,            // { day, month }
    metaTargets,       // { day, month }
    differences,       // { day, month }
    pts100m2,          // { day, month }
    indigoData,        // { day: { metros, rot103, meta }, month: { metros, rot103, metaAcumulada } }
    indigoMetas,       // { rot103, estopaAzul }
    estopaAzulData,    // { day: { porcentaje }, month: { porcentaje } }
    tecelagemData,     // { day: {...}, month: {...} }
    acabamentoData     // { day: {...}, month: {...} }
  } = data

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'STC Dashboard'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Calidad Sectores', {
    views: [{ showGridLines: false }]
  })

  // Configurar anchos de columnas (B-Q)
  ws.getColumn('A').width = 2  // Margen izquierdo
  ws.getColumn('B').width = 5.3
  ws.getColumn('C').width = 3.9
  ws.getColumn('D').width = 6.7
  ws.getColumn('E').width = 3.7
  ws.getColumn('F').width = 3.7
  ws.getColumn('G').width = 3.7
  ws.getColumn('H').width = 3.7
  ws.getColumn('I').width = 3.7
  ws.getColumn('J').width = 3.7
  ws.getColumn('K').width = 3.7
  ws.getColumn('L').width = 3.9
  ws.getColumn('M').width = 3.9
  ws.getColumn('N').width = 3.9
  ws.getColumn('O').width = 3.9
  ws.getColumn('P').width = 3.9
  ws.getColumn('Q').width = 3.9

  // Configurar alturas de filas
  ws.getRow(5).height = 24
  ws.getRow(6).height = 24
  for (let i = 7; i <= 12; i++) ws.getRow(i).height = 23.1
  ws.getRow(13).height = 25
  ws.getRow(14).height = 23.1
  ws.getRow(15).height = 25
  ws.getRow(16).height = 3  // Separador
  ws.getRow(17).height = 30
  for (let i = 18; i <= 28; i++) ws.getRow(i).height = 22

  // Obtener sector por nombre
  const getSector = (nombre) => sectores.find(s => s.sector === nombre) || { metrosDia: 0, metrosMes: 0, percDia: 0, percMes: 0, metaPct: 0 }

  const sDefecto = getSector('S/ Def.')
  const fiacao = getSector('FIACAO')
  const indigo = getSector('INDIGO')
  const tecelagem = getSector('TECELAGEM')
  const acabamento = getSector('ACABMTO')
  const geral = getSector('GERAL')

  // ========================================
  // SECCIÓN 1: Tabla de Calidad (Filas 5-15)
  // ========================================

  // Fila 5 - Headers principales
  ws.mergeCells('B5:D5')
  styleCell(ws.getCell('B5'), {
    value: fecha,
    bgColor: COLORS.blueMedium,
    bold: true,
    fontSize: 11
  })

  ws.mergeCells('E5:K5')
  styleCell(ws.getCell('E5'), {
    value: 'Metros [m]',
    bgColor: COLORS.blueMedium,
    bold: true
  })

  ws.mergeCells('L5:Q5')
  styleCell(ws.getCell('L5'), {
    value: 'Porcentaje [%]',
    bgColor: COLORS.blueMedium,
    bold: true
  })

  // Fila 6 - Subheaders
  ws.mergeCells('B6:D6')
  styleCell(ws.getCell('B6'), { value: 'Sector', bgColor: COLORS.blueMedium, bold: true })

  ws.mergeCells('E6:G6')
  styleCell(ws.getCell('E6'), { value: 'Dia', bgColor: COLORS.blueMedium, bold: true })

  ws.mergeCells('H6:K6')
  styleCell(ws.getCell('H6'), { value: 'Acumulado', bgColor: COLORS.blueMedium, bold: true })

  ws.mergeCells('L6:M6')
  styleCell(ws.getCell('L6'), { value: 'Dia', bgColor: COLORS.blueMedium, bold: true })

  ws.mergeCells('N6:O6')
  styleCell(ws.getCell('N6'), { value: 'Mes', bgColor: COLORS.blueMedium, bold: true })

  ws.mergeCells('P6:Q6')
  styleCell(ws.getCell('P6'), { value: 'Meta', bgColor: COLORS.blueMedium, bold: true })

  // Función helper para filas de datos de sectores
  const addSectorRow = (rowNum, sector, isAlternate) => {
    const bg = isAlternate ? COLORS.blueLight : null

    ws.mergeCells(`B${rowNum}:D${rowNum}`)
    styleCell(ws.getCell(`B${rowNum}`), { value: sector.sector, bgColor: bg, hAlign: 'left' })

    ws.mergeCells(`E${rowNum}:G${rowNum}`)
    styleCell(ws.getCell(`E${rowNum}`), { value: formatNumber(sector.metrosDia), bgColor: bg })

    ws.mergeCells(`H${rowNum}:K${rowNum}`)
    styleCell(ws.getCell(`H${rowNum}`), { value: formatNumber(sector.metrosMes), bgColor: bg })

    ws.mergeCells(`L${rowNum}:M${rowNum}`)
    styleCell(ws.getCell(`L${rowNum}`), { value: formatPercent(sector.percDia), bgColor: bg })

    ws.mergeCells(`N${rowNum}:O${rowNum}`)
    styleCell(ws.getCell(`N${rowNum}`), { value: formatPercent(sector.percMes), bgColor: bg })

    ws.mergeCells(`P${rowNum}:Q${rowNum}`)
    styleCell(ws.getCell(`P${rowNum}`), { value: formatPercent(sector.metaPct), bgColor: bg })
  }

  // Filas 7-12: Datos de sectores
  addSectorRow(7, sDefecto, true)
  addSectorRow(8, fiacao, false)
  addSectorRow(9, indigo, true)
  addSectorRow(10, tecelagem, false)
  addSectorRow(11, acabamento, true)
  addSectorRow(12, geral, false)

  // Fila 13: Revisado (totales)
  ws.mergeCells('B13:D13')
  styleCell(ws.getCell('B13'), { value: 'Revisado', bold: true })

  ws.mergeCells('E13:G13')
  styleCell(ws.getCell('E13'), {
    value: formatNumber(totals.day),
    fontColor: totals.day >= metaTargets.day ? COLORS.green : COLORS.red,
    bold: true
  })

  ws.mergeCells('H13:K13')
  styleCell(ws.getCell('H13'), {
    value: formatNumber(totals.month),
    fontColor: totals.month >= metaTargets.month ? COLORS.green : COLORS.red,
    bold: true
  })

  ws.mergeCells('L13:M13')
  styleCell(ws.getCell('L13'), { value: '100' })

  ws.mergeCells('N13:O13')
  styleCell(ws.getCell('N13'), { value: '100' })

  ws.mergeCells('P13:Q13')
  styleCell(ws.getCell('P13'), { value: '100' })

  // Fila 14: Meta
  ws.mergeCells('B14:D14')
  styleCell(ws.getCell('B14'), { value: 'Meta', bold: true })

  ws.mergeCells('E14:G14')
  styleCell(ws.getCell('E14'), { value: formatNumber(metaTargets.day) })

  ws.mergeCells('H14:K14')
  styleCell(ws.getCell('H14'), { value: formatNumber(metaTargets.month) })

  ws.mergeCells('L14:M15')
  styleCell(ws.getCell('L14'), { value: 'Pts\n100²', bgColor: COLORS.orangeLight, wrapText: true })

  ws.mergeCells('N14:O14')
  styleCell(ws.getCell('N14'), { value: 'Dia', bgColor: COLORS.orangeLight })

  ws.mergeCells('P14:Q14')
  styleCell(ws.getCell('P14'), { value: 'Mes', bgColor: COLORS.orangeLight })

  // Fila 15: Diferencia
  ws.mergeCells('B15:D15')
  styleCell(ws.getCell('B15'), { value: 'Diferencia', bold: true })

  ws.mergeCells('E15:G15')
  const diffDayStr = (differences.day >= 0 ? '+' : '') + formatNumber(differences.day)
  styleCell(ws.getCell('E15'), {
    value: diffDayStr,
    fontColor: differences.day >= 0 ? COLORS.green : COLORS.red,
    bold: true
  })

  ws.mergeCells('H15:K15')
  const diffMonthStr = (differences.month >= 0 ? '+' : '') + formatNumber(differences.month)
  styleCell(ws.getCell('H15'), {
    value: diffMonthStr,
    fontColor: differences.month >= 0 ? COLORS.green : COLORS.red,
    bold: true
  })

  // L15 está combinada con L14

  ws.mergeCells('N15:O15')
  styleCell(ws.getCell('N15'), { value: formatPercent(pts100m2.day, 2), bgColor: COLORS.orangeLight })

  ws.mergeCells('P15:Q15')
  styleCell(ws.getCell('P15'), { value: formatPercent(pts100m2.month, 2), bgColor: COLORS.orangeLight })

  // ========================================
  // Fila 16: Separador
  // ========================================
  // (Ya configurada la altura arriba)

  // ========================================
  // SECCIÓN 2: Tabla de Producción (Filas 17-28)
  // ========================================

  // Fila 17: Headers
  styleCell(ws.getCell('B17'), { value: 'Sec', bgColor: COLORS.blueLight, bold: true, fontSize: 9 })

  ws.mergeCells('C17:E17')
  styleCell(ws.getCell('C17'), { value: 'Variable', bgColor: COLORS.blueLight, bold: true, fontSize: 9 })

  ws.mergeCells('F17:H17')
  styleCell(ws.getCell('F17'), { value: 'Meta Dia', bgColor: COLORS.blueLight, bold: true, fontSize: 9, wrapText: true })

  ws.mergeCells('I17:K17')
  styleCell(ws.getCell('I17'), { value: 'Prod. Dia', bgColor: COLORS.blueLight, bold: true, fontSize: 9, wrapText: true })

  ws.mergeCells('L17:N17')
  styleCell(ws.getCell('L17'), { value: 'Acumulado', bgColor: COLORS.blueLight, bold: true, fontSize: 9 })

  ws.mergeCells('O17:Q17')
  styleCell(ws.getCell('O17'), { value: 'Sob./Fal.\nMes', bgColor: COLORS.blueLight, bold: true, fontSize: 9, wrapText: true })

  // ========================================
  // INDIGO - Filas 18-20
  // ========================================
  ws.mergeCells('B18:B20')
  styleCell(ws.getCell('B18'), {
    value: 'INDIGO',
    bgColor: COLORS.blueLight,
    fontSize: 9,
    rotation: 90
  })

  // Fila 18: INDIGO Metros
  ws.mergeCells('C18:E18')
  styleCell(ws.getCell('C18'), { value: 'Metros', bgColor: COLORS.blueLight, fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F18:H18')
  styleCell(ws.getCell('F18'), { value: formatNumber(indigoData.day.meta), bgColor: COLORS.blueLight })

  ws.mergeCells('I18:K18')
  styleCell(ws.getCell('I18'), {
    value: formatNumber(indigoData.day.metros),
    bgColor: COLORS.blueLight,
    fontColor: indigoData.day.metros >= indigoData.day.meta ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L18:N18')
  styleCell(ws.getCell('L18'), {
    value: formatNumber(indigoData.month.metros),
    bgColor: COLORS.blueLight,
    fontColor: indigoData.month.metros >= indigoData.month.metaAcumulada ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O18:Q18')
  const indigoDiffMetros = indigoData.month.metros - indigoData.month.metaAcumulada
  styleCell(ws.getCell('O18'), {
    value: (indigoDiffMetros >= 0 ? '+' : '') + formatNumber(indigoDiffMetros),
    bgColor: COLORS.blueLight,
    fontColor: indigoDiffMetros >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 19: INDIGO Roturas 10³
  ws.mergeCells('C19:E19')
  styleCell(ws.getCell('C19'), { value: 'Roturas 10³', bgColor: COLORS.blueLight, fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F19:H19')
  styleCell(ws.getCell('F19'), { value: formatPercent(indigoMetas.rot103), bgColor: COLORS.blueLight })

  ws.mergeCells('I19:K19')
  styleCell(ws.getCell('I19'), {
    value: formatPercent(indigoData.day.rot103, 2),
    bgColor: COLORS.blueLight,
    fontColor: indigoData.day.rot103 <= indigoMetas.rot103 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L19:N19')
  styleCell(ws.getCell('L19'), {
    value: formatPercent(indigoData.month.rot103, 2),
    bgColor: COLORS.blueLight,
    fontColor: indigoData.month.rot103 <= indigoMetas.rot103 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O19:Q19')
  const indigoDiffRot = indigoMetas.rot103 - indigoData.month.rot103
  styleCell(ws.getCell('O19'), {
    value: (indigoDiffRot >= 0 ? '+' : '') + formatPercent(indigoDiffRot, 2),
    bgColor: COLORS.blueLight,
    fontColor: indigoDiffRot >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 20: INDIGO Est. Azul %
  ws.mergeCells('C20:E20')
  styleCell(ws.getCell('C20'), { value: 'Est. Azul %', bgColor: COLORS.blueLight, fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F20:H20')
  styleCell(ws.getCell('F20'), { value: formatPercent(indigoMetas.estopaAzul), bgColor: COLORS.blueLight })

  ws.mergeCells('I20:K20')
  styleCell(ws.getCell('I20'), {
    value: formatPercent(estopaAzulData.day.porcentaje, 2),
    bgColor: COLORS.blueLight,
    fontColor: estopaAzulData.day.porcentaje <= indigoMetas.estopaAzul ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L20:N20')
  styleCell(ws.getCell('L20'), {
    value: formatPercent(estopaAzulData.month.porcentaje, 2),
    bgColor: COLORS.blueLight,
    fontColor: estopaAzulData.month.porcentaje <= indigoMetas.estopaAzul ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O20:Q20')
  const indigoDiffEstopa = indigoMetas.estopaAzul - estopaAzulData.month.porcentaje
  styleCell(ws.getCell('O20'), {
    value: (indigoDiffEstopa >= 0 ? '+' : '') + formatPercent(indigoDiffEstopa, 2),
    bgColor: COLORS.blueLight,
    fontColor: indigoDiffEstopa >= 0 ? COLORS.green : COLORS.red
  })

  // ========================================
  // TECELAGEM - Filas 21-25
  // ========================================
  ws.mergeCells('B21:B25')
  styleCell(ws.getCell('B21'), {
    value: 'TECELAGEM',
    fontSize: 9,
    rotation: 90
  })

  // Fila 21: TECELAGEM Metros
  ws.mergeCells('C21:E21')
  styleCell(ws.getCell('C21'), { value: 'Metros', fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F21:H21')
  styleCell(ws.getCell('F21'), { value: formatNumber(tecelagemData.day.meta) })

  ws.mergeCells('I21:K21')
  styleCell(ws.getCell('I21'), {
    value: formatNumber(tecelagemData.day.metros),
    fontColor: tecelagemData.day.metros >= tecelagemData.day.meta ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L21:N21')
  styleCell(ws.getCell('L21'), {
    value: formatNumber(tecelagemData.month.metros),
    fontColor: tecelagemData.month.metros >= tecelagemData.month.metaAcumulada ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O21:Q21')
  const tejDiffMetros = tecelagemData.month.metros - tecelagemData.month.metaAcumulada
  styleCell(ws.getCell('O21'), {
    value: (tejDiffMetros >= 0 ? '+' : '') + formatNumber(tejDiffMetros),
    fontColor: tejDiffMetros >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 22: TECELAGEM Eficiencia %
  ws.mergeCells('C22:E22')
  styleCell(ws.getCell('C22'), { value: 'Eficiencia %', fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F22:H22')
  styleCell(ws.getCell('F22'), { value: formatNumber(tecelagemData.day.metaEfi) })

  ws.mergeCells('I22:K22')
  styleCell(ws.getCell('I22'), {
    value: formatPercent(tecelagemData.day.eficiencia),
    fontColor: tecelagemData.day.eficiencia >= tecelagemData.day.metaEfi ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L22:N22')
  styleCell(ws.getCell('L22'), {
    value: formatPercent(tecelagemData.month.eficiencia),
    fontColor: tecelagemData.month.eficiencia >= tecelagemData.month.metaEfi ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O22:Q22')
  const tejDiffEfi = tecelagemData.month.eficiencia - tecelagemData.month.metaEfi
  styleCell(ws.getCell('O22'), {
    value: (tejDiffEfi >= 0 ? '+' : '') + formatPercent(tejDiffEfi),
    fontColor: tejDiffEfi >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 23: TECELAGEM Rot. TRA 10⁵
  ws.mergeCells('C23:E23')
  styleCell(ws.getCell('C23'), { value: 'Rot. TRA 10⁵', fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F23:H23')
  styleCell(ws.getCell('F23'), { value: formatPercent(tecelagemData.day.metaRt105) })

  ws.mergeCells('I23:K23')
  styleCell(ws.getCell('I23'), {
    value: formatPercent(tecelagemData.day.rotTra105),
    fontColor: tecelagemData.day.rotTra105 <= tecelagemData.day.metaRt105 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L23:N23')
  styleCell(ws.getCell('L23'), {
    value: formatPercent(tecelagemData.month.rotTra105),
    fontColor: tecelagemData.month.rotTra105 <= tecelagemData.month.metaRt105 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O23:Q23')
  const tejDiffRt = tecelagemData.month.rotTra105 - tecelagemData.month.metaRt105
  styleCell(ws.getCell('O23'), {
    value: (tejDiffRt >= 0 ? '+' : '') + formatPercent(tejDiffRt),
    fontColor: tejDiffRt >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 24: TECELAGEM Rot. URD 10⁵
  ws.mergeCells('C24:E24')
  styleCell(ws.getCell('C24'), { value: 'Rot. URD 10⁵', fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F24:H24')
  styleCell(ws.getCell('F24'), { value: formatPercent(tecelagemData.day.metaRu105) })

  ws.mergeCells('I24:K24')
  styleCell(ws.getCell('I24'), {
    value: formatPercent(tecelagemData.day.rotUrd105),
    fontColor: tecelagemData.day.rotUrd105 <= tecelagemData.day.metaRu105 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L24:N24')
  styleCell(ws.getCell('L24'), {
    value: formatPercent(tecelagemData.month.rotUrd105),
    fontColor: tecelagemData.month.rotUrd105 <= tecelagemData.month.metaRu105 ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O24:Q24')
  const tejDiffRu = tecelagemData.month.rotUrd105 - tecelagemData.month.metaRu105
  styleCell(ws.getCell('O24'), {
    value: (tejDiffRu >= 0 ? '+' : '') + formatPercent(tejDiffRu),
    fontColor: tejDiffRu >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 25: TECELAGEM Est. Azul %
  ws.mergeCells('C25:E25')
  styleCell(ws.getCell('C25'), { value: 'Est. Azul %', fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F25:H25')
  styleCell(ws.getCell('F25'), { value: formatPercent(tecelagemData.day.metaEstopaAzul) })

  ws.mergeCells('I25:K25')
  styleCell(ws.getCell('I25'), {
    value: formatPercent(tecelagemData.day.estopaAzulPct, 2),
    fontColor: tecelagemData.day.estopaAzulPct <= tecelagemData.day.metaEstopaAzul ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L25:N25')
  styleCell(ws.getCell('L25'), {
    value: formatPercent(tecelagemData.month.estopaAzulPct, 2),
    fontColor: tecelagemData.month.estopaAzulPct <= tecelagemData.month.metaEstopaAzul ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O25:Q25')
  const tejDiffEstopa = tecelagemData.month.metaEstopaAzul - tecelagemData.month.estopaAzulPct
  styleCell(ws.getCell('O25'), {
    value: (tejDiffEstopa >= 0 ? '+' : '') + formatPercent(tejDiffEstopa, 2),
    fontColor: tejDiffEstopa >= 0 ? COLORS.green : COLORS.red
  })

  // ========================================
  // ACABMTO - Filas 26-28
  // ========================================
  ws.mergeCells('B26:B28')
  styleCell(ws.getCell('B26'), {
    value: 'ACABMTO',
    bgColor: COLORS.blueLighter,
    fontSize: 9,
    rotation: 90
  })

  // Fila 26: ACABMTO Metros
  ws.mergeCells('C26:E26')
  styleCell(ws.getCell('C26'), { value: 'Metros', bgColor: COLORS.blueLighter, fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F26:H26')
  styleCell(ws.getCell('F26'), { value: formatNumber(acabamentoData.day.meta), bgColor: COLORS.blueLighter })

  ws.mergeCells('I26:K26')
  styleCell(ws.getCell('I26'), {
    value: formatNumber(acabamentoData.day.metros),
    bgColor: COLORS.blueLighter,
    fontColor: acabamentoData.day.metros >= acabamentoData.day.meta ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L26:N26')
  styleCell(ws.getCell('L26'), {
    value: formatNumber(acabamentoData.month.metros),
    bgColor: COLORS.blueLighter,
    fontColor: acabamentoData.month.metros >= acabamentoData.month.metaAcumulada ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O26:Q26')
  const acabDiffMetros = acabamentoData.month.metros - acabamentoData.month.metaAcumulada
  styleCell(ws.getCell('O26'), {
    value: (acabDiffMetros >= 0 ? '+' : '') + formatNumber(acabDiffMetros),
    bgColor: COLORS.blueLighter,
    fontColor: acabDiffMetros >= 0 ? COLORS.green : COLORS.red
  })

  // Fila 27: vacía (pero con formato)
  ws.mergeCells('C27:D27')
  styleCell(ws.getCell('C27'), { bgColor: COLORS.blueLighter })
  // Las demás celdas de la fila 27 mantienen formato pero están vacías

  // Fila 28: ACABMTO ENC URD %
  ws.mergeCells('C28:E28')
  styleCell(ws.getCell('C28'), { value: 'ENC URD %', bgColor: COLORS.blueLighter, fontSize: 9, hAlign: 'left' })

  ws.mergeCells('F28:H28')
  styleCell(ws.getCell('F28'), { value: formatPercent(acabamentoData.day.metaEncUrd, 2), bgColor: COLORS.blueLighter })

  ws.mergeCells('I28:K28')
  styleCell(ws.getCell('I28'), {
    value: formatPercent(acabamentoData.day.encUrdPct, 2),
    bgColor: COLORS.blueLighter,
    // ENC URD es negativo, menor es mejor (más cercano a meta negativa)
    fontColor: acabamentoData.day.encUrdPct <= acabamentoData.day.metaEncUrd ? COLORS.green : COLORS.red
  })

  ws.mergeCells('L28:N28')
  styleCell(ws.getCell('L28'), {
    value: formatPercent(acabamentoData.month.encUrdPct, 2),
    bgColor: COLORS.blueLighter,
    fontColor: acabamentoData.month.encUrdPct <= acabamentoData.month.metaEncUrd ? COLORS.green : COLORS.red
  })

  ws.mergeCells('O28:Q28')
  const acabDiffEncUrd = acabamentoData.month.encUrdPct - acabamentoData.month.metaEncUrd
  styleCell(ws.getCell('O28'), {
    value: (acabDiffEncUrd >= 0 ? '+' : '') + formatPercent(acabDiffEncUrd, 2),
    bgColor: COLORS.blueLighter,
    fontColor: acabDiffEncUrd >= 0 ? COLORS.green : COLORS.red
  })

  // Aplicar bordes a todas las celdas del rango
  applyBordersToRange(ws, 5, 15, 2, 17)
  applyBordersToRange(ws, 17, 28, 2, 17)

  return workbook
}

/**
 * Aplica bordes a un rango de celdas
 */
function applyBordersToRange(ws, startRow, endRow, startCol, endCol) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = ws.getCell(row, col)
      if (!cell.border) cell.border = {}
      
      // Borde izquierdo
      if (col === startCol) {
        cell.border.left = BORDERS.thin
      }
      // Borde derecho
      if (col === endCol) {
        cell.border.right = BORDERS.thin
      }
      // Borde superior
      if (row === startRow) {
        cell.border.top = BORDERS.thin
      }
      // Borde inferior
      if (row === endRow) {
        cell.border.bottom = BORDERS.thin
      }
    }
  }
}

/**
 * Descarga el Excel como archivo
 */
export async function downloadExcel(workbook, filename = 'reporte-calidad.xlsx') {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default {
  generateExcelReport,
  downloadExcel
}
