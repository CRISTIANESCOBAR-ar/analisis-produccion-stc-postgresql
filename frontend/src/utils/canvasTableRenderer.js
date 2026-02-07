/**
 * Renderer de tabla usando Canvas 2D
 * Genera imagen que replica exactamente las dimensiones de la UI
 */
// Nota: Los accesos dinámicos son seguros - datos controlados para rendering
/* eslint-disable security/detect-object-injection */

// Colores
const COLORS = {
  headerBg: '#B4C6E7',
  altRowBg: '#B4C6E7',
  white: '#FFFFFF',
  black: '#000000',
  green: '#3C7D22',
  red: '#FF0000',
  borderColor: '#0C769E'
}

// Grosores de borde
const BORDER = {
  thin: 1,
  medium: 2,
  thick: 3,
  double: 2
}

// Configuración - EXACTA del CSS de la UI
const CONFIG = {
  fontSize: 10,
  fontFamily: 'Verdana, sans-serif',
  cellPadding: 4,
  borderColor: '#0C769E'
}

// Anchos de columnas EXACTOS del CSS Grid (16 columnas) - Aumentados 5%
const COL_WIDTHS_T1 = [34, 23, 44, 23, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23]

// Alturas de filas EXACTAS del CSS Grid (22 filas)
const ROW_HEIGHTS = [32, 32, 31, 31, 31, 31, 31, 31, 33, 31, 33, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31]

/**
 * Formatea número con separador de miles
 */
function fmt(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  const fixed = decimals === 0 ? Math.round(num) : Number(num.toFixed(decimals))
  return fixed.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Formatea con signo
 */
function fmtSign(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  const formatted = fmt(Math.abs(num), decimals)
  if (num >= 0) return `+${formatted}`
  return `-${formatted}`
}

/**
 * Formatea porcentaje sin decimales
 */
function fmtPct(num) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return Math.round(num).toString()
}

/**
 * Formatea porcentaje con 1 decimal
 */
function fmtPct1(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.0'
  return num.toFixed(1)
}

/**
 * Formatea porcentaje con 2 decimales
 */
function fmtPct2(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00'
  return num.toFixed(2)
}

/**
 * Calcula la posición X de una celda basada en colIndex (1-based)
 */
function getColX(colIndex) {
  let x = 0
  for (let i = 0; i < colIndex - 1; i++) {
    x += COL_WIDTHS_T1[i] || 0
  }
  return x
}

/**
 * Calcula la posición Y de una celda basada en rowIndex (1-based)
 */
function getRowY(rowIndex) {
  let y = 0
  for (let i = 0; i < rowIndex - 1; i++) {
    y += ROW_HEIGHTS[i] || 0
  }
  return y
}

/**
 * Calcula el ancho de una celda basado en colIndex y colSpan
 */
function getCellWidth(colIndex, colSpan) {
  let width = 0
  for (let i = colIndex - 1; i < colIndex - 1 + colSpan; i++) {
    width += COL_WIDTHS_T1[i] || 0
  }
  return width
}

/**
 * Calcula la altura de una celda basado en rowIndex y rowSpan
 */
function getCellHeight(rowIndex, rowSpan) {
  let height = 0
  for (let i = rowIndex - 1; i < rowIndex - 1 + rowSpan; i++) {
    height += ROW_HEIGHTS[i] || 0
  }
  return height
}

/**
 * Dibuja el fondo de una celda
 */
function drawCellBg(ctx, x, y, width, height, bgColor) {
  ctx.fillStyle = bgColor
  ctx.fillRect(x, y, width, height)
}

/**
 * Dibuja texto en una celda
 */
function drawCellText(ctx, text, x, y, width, height, options = {}) {
  const {
    align = 'center',
    color = COLORS.black,
    bold = false,
    fontSize = CONFIG.fontSize,
    valign = 'middle'
  } = options

  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${CONFIG.fontFamily}`
  
  // Configurar alineación vertical
  if (valign === 'bottom') {
    ctx.textBaseline = 'bottom'
  } else if (valign === 'top') {
    ctx.textBaseline = 'top'
  } else {
    ctx.textBaseline = 'middle'
  }

  let textX
  if (align === 'left') {
    ctx.textAlign = 'left'
    textX = x + CONFIG.cellPadding
  } else if (align === 'right') {
    ctx.textAlign = 'right'
    textX = x + width - CONFIG.cellPadding
  } else {
    ctx.textAlign = 'center'
    textX = x + width / 2
  }

  // Soporte para texto con múltiples líneas
  const lines = String(text).split('\n')
  if (lines.length > 1) {
    const lineHeight = fontSize * 1.2
    const totalHeight = lineHeight * lines.length
    let startY
    if (valign === 'bottom') {
      startY = y + height - totalHeight + lineHeight / 2
    } else if (valign === 'top') {
      startY = y + lineHeight / 2
    } else {
      startY = y + (height - totalHeight) / 2 + lineHeight / 2
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, textX, startY + i * lineHeight)
    })
  } else {
    let textY
    if (valign === 'bottom') {
      textY = y + height - CONFIG.cellPadding
    } else if (valign === 'top') {
      textY = y + CONFIG.cellPadding
    } else {
      textY = y + height / 2
    }
    ctx.fillText(text, textX, textY)
  }
  ctx.restore()
}

/**
 * Dibuja texto vertical (rotado 90°)
 */
function drawRotatedText(ctx, text, x, y, width, height, options = {}) {
  const { color = COLORS.black, fontSize = 10, bold = false } = options

  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${CONFIG.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/**
 * Genera la estructura de celdas para el canvas
 */
function buildCellDefinitions(data) {
  const {
    fecha,
    sectores,
    totals,
    metaTargets,
    differences,
    pts100m2,
    indigoData,
    indigoMetas,
    estopaAzulData,
    tecelagemData,
    acabamentoData
  } = data

  const getSector = (nombre) => sectores.find(s => s.sector === nombre) || {
    metrosDia: 0, metrosMes: 0, percDia: 0, percMes: 0, metaPct: 0
  }

  const sDefecto = getSector('S/ Def.')
  const fiacao = getSector('FIACAO')
  const indigo = getSector('INDIGO')
  const tecelagem = getSector('TECELAGEM')
  const acabamento = getSector('ACABMTO')
  const geral = getSector('GERAL')

  const totalDia = totals.day
  const totalMes = totals.month

  return [
    // Fila 1 - Headers principales
    { rowIndex: 1, colIndex: 1, colSpan: 3, rowSpan: 1, text: fecha, bold: true, bgColor: '#215C98', color: COLORS.white },
    { rowIndex: 1, colIndex: 4, colSpan: 7, rowSpan: 1, text: 'Metros [m]', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 1, colIndex: 11, colSpan: 6, rowSpan: 1, text: 'Porcentaje [%]', bold: true, bgColor: COLORS.headerBg },

    // Fila 2 - Subheaders
    { rowIndex: 2, colIndex: 1, colSpan: 3, rowSpan: 1, text: 'Sector', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 2, colIndex: 4, colSpan: 3, rowSpan: 1, text: 'Dia', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 2, colIndex: 7, colSpan: 4, rowSpan: 1, text: 'Acumulado', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 2, colIndex: 11, colSpan: 2, rowSpan: 1, text: 'Dia', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 2, colIndex: 13, colSpan: 2, rowSpan: 1, text: 'Mes', bold: true, bgColor: COLORS.headerBg },
    { rowIndex: 2, colIndex: 15, colSpan: 2, rowSpan: 1, text: 'Meta', bold: true, bgColor: COLORS.headerBg },

    // Fila 3 - S/ Def.
    { rowIndex: 3, colIndex: 1, colSpan: 3, rowSpan: 1, text: sDefecto.sector, align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 3, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(sDefecto.metrosDia), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 3, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(sDefecto.metrosMes), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 3, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(sDefecto.percDia), bgColor: '#DAE9F8' },
    { rowIndex: 3, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(sDefecto.percMes), bgColor: '#DAE9F8' },
    { rowIndex: 3, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(sDefecto.metaPct), bgColor: '#DAE9F8' },

    // Fila 4 - FIACAO
    { rowIndex: 4, colIndex: 1, colSpan: 3, rowSpan: 1, text: fiacao.sector, align: 'center', bgColor: COLORS.white },
    { rowIndex: 4, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(fiacao.metrosDia), align: 'center', bgColor: COLORS.white },
    { rowIndex: 4, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(fiacao.metrosMes), align: 'center', bgColor: COLORS.white },
    { rowIndex: 4, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(fiacao.percDia), bgColor: COLORS.white },
    { rowIndex: 4, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(fiacao.percMes), bgColor: COLORS.white },
    { rowIndex: 4, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(fiacao.metaPct), bgColor: COLORS.white },

    // Fila 5 - INDIGO
    { rowIndex: 5, colIndex: 1, colSpan: 3, rowSpan: 1, text: indigo.sector, align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 5, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(indigo.metrosDia), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 5, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(indigo.metrosMes), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 5, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(indigo.percDia), bgColor: '#DAE9F8' },
    { rowIndex: 5, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(indigo.percMes), bgColor: '#DAE9F8' },
    { rowIndex: 5, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(indigo.metaPct), bgColor: '#DAE9F8' },

    // Fila 6 - TECELAGEM
    { rowIndex: 6, colIndex: 1, colSpan: 3, rowSpan: 1, text: tecelagem.sector, align: 'center', bgColor: COLORS.white },
    { rowIndex: 6, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(tecelagem.metrosDia), align: 'center', bgColor: COLORS.white },
    { rowIndex: 6, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(tecelagem.metrosMes), align: 'center', bgColor: COLORS.white },
    { rowIndex: 6, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(tecelagem.percDia), bgColor: COLORS.white },
    { rowIndex: 6, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(tecelagem.percMes), bgColor: COLORS.white },
    { rowIndex: 6, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(tecelagem.metaPct), bgColor: COLORS.white },

    // Fila 7 - ACABMTO
    { rowIndex: 7, colIndex: 1, colSpan: 3, rowSpan: 1, text: acabamento.sector, align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 7, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(acabamento.metrosDia), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 7, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(acabamento.metrosMes), align: 'center', bgColor: '#DAE9F8' },
    { rowIndex: 7, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(acabamento.percDia), bgColor: '#DAE9F8' },
    { rowIndex: 7, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(acabamento.percMes), bgColor: '#DAE9F8' },
    { rowIndex: 7, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(acabamento.metaPct), bgColor: '#DAE9F8' },

    // Fila 8 - GERAL
    { rowIndex: 8, colIndex: 1, colSpan: 3, rowSpan: 1, text: geral.sector, align: 'center', bgColor: COLORS.white },
    { rowIndex: 8, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(geral.metrosDia), align: 'center', bgColor: COLORS.white },
    { rowIndex: 8, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(geral.metrosMes), align: 'center', bgColor: COLORS.white },
    { rowIndex: 8, colIndex: 11, colSpan: 2, rowSpan: 1, text: fmtPct2(geral.percDia), bgColor: COLORS.white },
    { rowIndex: 8, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(geral.percMes), bgColor: COLORS.white },
    { rowIndex: 8, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(geral.metaPct), bgColor: COLORS.white },

    // Fila 9 - Revisado
    { rowIndex: 9, colIndex: 1, colSpan: 3, rowSpan: 1, text: 'Revisado', bold: true, bgColor: COLORS.white },
    { rowIndex: 9, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(totalDia), bold: true, bgColor: COLORS.white, 
      color: totalDia >= metaTargets.day ? COLORS.green : COLORS.red },
    { rowIndex: 9, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(totalMes), bold: true, bgColor: COLORS.white,
      color: totalMes >= metaTargets.month ? COLORS.green : COLORS.red },
    { rowIndex: 9, colIndex: 11, colSpan: 2, rowSpan: 1, text: '100', bold: true, bgColor: COLORS.white },
    { rowIndex: 9, colIndex: 13, colSpan: 2, rowSpan: 1, text: '100', bold: true, bgColor: COLORS.white },
    { rowIndex: 9, colIndex: 15, colSpan: 2, rowSpan: 1, text: '100', bold: true, bgColor: COLORS.white },

    // Fila 10 - Meta
    { rowIndex: 10, colIndex: 1, colSpan: 3, rowSpan: 1, text: 'Meta', bgColor: COLORS.white },
    { rowIndex: 10, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(metaTargets.day), bgColor: COLORS.white },
    { rowIndex: 10, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmt(metaTargets.month), bgColor: COLORS.white },
    { rowIndex: 10, colIndex: 11, colSpan: 2, rowSpan: 1, text: 'Pts', bgColor: '#B5E6A2', valign: 'bottom' },
    { rowIndex: 10, colIndex: 13, colSpan: 2, rowSpan: 1, text: 'Dia', bgColor: '#B5E6A2' },
    { rowIndex: 10, colIndex: 15, colSpan: 2, rowSpan: 1, text: 'Mes', bgColor: '#B5E6A2' },

    // Fila 11 - Diferencia
    { rowIndex: 11, colIndex: 1, colSpan: 3, rowSpan: 1, text: 'Diferencia', bold: true, bgColor: COLORS.white },
    { rowIndex: 11, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtSign(differences.day), bold: true, bgColor: COLORS.white,
      color: differences.day >= 0 ? COLORS.green : COLORS.red },
    { rowIndex: 11, colIndex: 7, colSpan: 4, rowSpan: 1, text: fmtSign(differences.month), bold: true, bgColor: COLORS.white,
      color: differences.month >= 0 ? COLORS.green : COLORS.red },
    { rowIndex: 11, colIndex: 11, colSpan: 2, rowSpan: 1, text: '100m²', bgColor: '#B5E6A2', valign: 'top' },
    { rowIndex: 11, colIndex: 13, colSpan: 2, rowSpan: 1, text: fmtPct2(pts100m2.day), bold: true, bgColor: COLORS.white },
    { rowIndex: 11, colIndex: 15, colSpan: 2, rowSpan: 1, text: fmtPct2(pts100m2.month), bold: true, bgColor: COLORS.white },

    // Fila 12 - Headers Tabla 2
    { rowIndex: 12, colIndex: 1, colSpan: 1, rowSpan: 1, text: 'Sec', bold: true, bgColor: '#A6C9EC' },
    { rowIndex: 12, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Variable', bold: true, bgColor: '#A6C9EC' },
    { rowIndex: 12, colIndex: 4, colSpan: 3, rowSpan: 1, text: 'Meta Día', bold: true, bgColor: '#A6C9EC' },
    { rowIndex: 12, colIndex: 7, colSpan: 3, rowSpan: 1, text: 'Prod. Día', bold: true, bgColor: '#A6C9EC' },
    { rowIndex: 12, colIndex: 10, colSpan: 4, rowSpan: 1, text: 'Acumulado', bold: true, bgColor: '#A6C9EC' },
    { rowIndex: 12, colIndex: 14, colSpan: 3, rowSpan: 1, text: 'Sob./Fal.\nMes', bold: true, bgColor: '#A6C9EC' },

    // INDIGO (filas 13-15)
    { rowIndex: 13, colIndex: 1, colSpan: 1, rowSpan: 3, text: 'INDIGO', vertical: true, bgColor: '#DAE9F8' },
    { rowIndex: 13, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Metros', bgColor: '#DAE9F8' },
    { rowIndex: 13, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(indigoData.day.meta), bgColor: '#DAE9F8' },
    { rowIndex: 13, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmt(indigoData.day.metros), bgColor: '#DAE9F8',
      color: indigoData.day.metros >= indigoData.day.meta ? COLORS.green : COLORS.red },
    { rowIndex: 13, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmt(indigoData.month.metros), bgColor: '#DAE9F8',
      color: indigoData.month.metros >= indigoData.month.metaAcumulada ? COLORS.green : COLORS.red },
    { rowIndex: 13, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(indigoData.month.metros - indigoData.month.metaAcumulada), bgColor: '#DAE9F8',
      color: (indigoData.month.metros - indigoData.month.metaAcumulada) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 14, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Roturas 10³', bgColor: '#DAE9F8' },
    { rowIndex: 14, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct(indigoMetas.rot103), bgColor: '#DAE9F8' },
    { rowIndex: 14, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct2(indigoData.day.rot103), bgColor: '#DAE9F8',
      color: indigoData.day.rot103 <= indigoMetas.rot103 ? COLORS.green : COLORS.red },
    { rowIndex: 14, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct2(indigoData.month.rot103), bgColor: '#DAE9F8',
      color: indigoData.month.rot103 <= indigoMetas.rot103 ? COLORS.green : COLORS.red },
    { rowIndex: 14, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(indigoData.month.rot103 - indigoMetas.rot103, 2), bgColor: '#DAE9F8',
      color: (indigoMetas.rot103 - indigoData.month.rot103) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 15, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Est. Azul %', bgColor: '#DAE9F8' },
    { rowIndex: 15, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct(indigoMetas.estopaAzul), bgColor: '#DAE9F8' },
    { rowIndex: 15, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct2(estopaAzulData.day.porcentaje), bgColor: '#DAE9F8',
      color: estopaAzulData.day.porcentaje <= indigoMetas.estopaAzul ? COLORS.green : COLORS.red },
    { rowIndex: 15, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct2(estopaAzulData.month.porcentaje), bgColor: '#DAE9F8',
      color: estopaAzulData.month.porcentaje <= indigoMetas.estopaAzul ? COLORS.green : COLORS.red },
    { rowIndex: 15, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(estopaAzulData.month.porcentaje - indigoMetas.estopaAzul, 2), bgColor: '#DAE9F8',
      color: (indigoMetas.estopaAzul - estopaAzulData.month.porcentaje) >= 0 ? COLORS.green : COLORS.red },

    // TECELAGEM (filas 16-20)
    { rowIndex: 16, colIndex: 1, colSpan: 1, rowSpan: 5, text: 'TECELAGEM', vertical: true },
    { rowIndex: 16, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Metros' },
    { rowIndex: 16, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(tecelagemData.day.meta) },
    { rowIndex: 16, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmt(tecelagemData.day.metros),
      color: tecelagemData.day.metros >= tecelagemData.day.meta ? COLORS.green : COLORS.red },
    { rowIndex: 16, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmt(tecelagemData.month.metros),
      color: tecelagemData.month.metros >= tecelagemData.month.metaAcumulada ? COLORS.green : COLORS.red },
    { rowIndex: 16, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(tecelagemData.month.metros - tecelagemData.month.metaAcumulada),
      color: (tecelagemData.month.metros - tecelagemData.month.metaAcumulada) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 17, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Eficiencia %' },
    { rowIndex: 17, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(tecelagemData.day.metaEfi) },
    { rowIndex: 17, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.eficiencia),
      color: tecelagemData.day.eficiencia >= tecelagemData.day.metaEfi ? COLORS.green : COLORS.red },
    { rowIndex: 17, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct1(tecelagemData.month.eficiencia),
      color: tecelagemData.month.eficiencia >= tecelagemData.month.metaEfi ? COLORS.green : COLORS.red },
    { rowIndex: 17, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(tecelagemData.month.eficiencia - tecelagemData.month.metaEfi, 1),
      color: (tecelagemData.month.eficiencia - tecelagemData.month.metaEfi) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 18, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Rot. TRA 10⁵' },
    { rowIndex: 18, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.metaRt105) },
    { rowIndex: 18, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.rotTra105),
      color: tecelagemData.day.rotTra105 <= tecelagemData.day.metaRt105 ? COLORS.green : COLORS.red },
    { rowIndex: 18, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct1(tecelagemData.month.rotTra105),
      color: tecelagemData.month.rotTra105 <= tecelagemData.month.metaRt105 ? COLORS.green : COLORS.red },
    { rowIndex: 18, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(tecelagemData.month.rotTra105 - tecelagemData.month.metaRt105, 1),
      color: (tecelagemData.month.metaRt105 - tecelagemData.month.rotTra105) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 19, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Rot. URD 10⁵' },
    { rowIndex: 19, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.metaRu105) },
    { rowIndex: 19, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.rotUrd105),
      color: tecelagemData.day.rotUrd105 <= tecelagemData.day.metaRu105 ? COLORS.green : COLORS.red },
    { rowIndex: 19, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct1(tecelagemData.month.rotUrd105),
      color: tecelagemData.month.rotUrd105 <= tecelagemData.month.metaRu105 ? COLORS.green : COLORS.red },
    { rowIndex: 19, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(tecelagemData.month.rotUrd105 - tecelagemData.month.metaRu105, 1),
      color: (tecelagemData.month.metaRu105 - tecelagemData.month.rotUrd105) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 20, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Est. Azul %' },
    { rowIndex: 20, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.metaEstopaAzul) },
    { rowIndex: 20, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct1(tecelagemData.day.estopaAzulPct),
      color: tecelagemData.day.estopaAzulPct <= tecelagemData.day.metaEstopaAzul ? COLORS.green : COLORS.red },
    { rowIndex: 20, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct1(tecelagemData.month.estopaAzulPct),
      color: tecelagemData.month.estopaAzulPct <= tecelagemData.month.metaEstopaAzul ? COLORS.green : COLORS.red },
    { rowIndex: 20, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(tecelagemData.month.metaEstopaAzul - tecelagemData.month.estopaAzulPct, 1),
      color: (tecelagemData.month.metaEstopaAzul - tecelagemData.month.estopaAzulPct) >= 0 ? COLORS.green : COLORS.red },

    // ACABAMENTO (filas 21-22)
    { rowIndex: 21, colIndex: 1, colSpan: 1, rowSpan: 2, text: 'ACAB', vertical: true, bgColor: '#E8D5F0' },
    { rowIndex: 21, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'Metros', bgColor: '#E8D5F0' },
    { rowIndex: 21, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmt(acabamentoData.day.meta), bgColor: '#E8D5F0' },
    { rowIndex: 21, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmt(acabamentoData.day.metros), bgColor: '#E8D5F0',
      color: acabamentoData.day.metros >= acabamentoData.day.meta ? COLORS.green : COLORS.red },
    { rowIndex: 21, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmt(acabamentoData.month.metros), bgColor: '#E8D5F0',
      color: acabamentoData.month.metros >= acabamentoData.month.metaAcumulada ? COLORS.green : COLORS.red },
    { rowIndex: 21, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(acabamentoData.month.metros - acabamentoData.month.metaAcumulada), bgColor: '#E8D5F0',
      color: (acabamentoData.month.metros - acabamentoData.month.metaAcumulada) >= 0 ? COLORS.green : COLORS.red },

    { rowIndex: 22, colIndex: 2, colSpan: 2, rowSpan: 1, text: 'ENC URD %', bgColor: '#E8D5F0' },
    { rowIndex: 22, colIndex: 4, colSpan: 3, rowSpan: 1, text: fmtPct2(acabamentoData.day.metaEncUrd), bgColor: '#E8D5F0' },
    { rowIndex: 22, colIndex: 7, colSpan: 3, rowSpan: 1, text: fmtPct2(acabamentoData.day.encUrdPct), bgColor: '#E8D5F0',
      color: acabamentoData.day.encUrdPct >= acabamentoData.day.metaEncUrd ? COLORS.green : COLORS.red },
    { rowIndex: 22, colIndex: 10, colSpan: 4, rowSpan: 1, text: fmtPct2(acabamentoData.month.encUrdPct), bgColor: '#E8D5F0',
      color: acabamentoData.month.encUrdPct >= acabamentoData.month.metaEncUrd ? COLORS.green : COLORS.red },
    { rowIndex: 22, colIndex: 14, colSpan: 3, rowSpan: 1, 
      text: fmtSign(acabamentoData.month.encUrdPct - acabamentoData.month.metaEncUrd), bgColor: '#E8D5F0',
      color: (acabamentoData.month.encUrdPct - acabamentoData.month.metaEncUrd) >= 0 ? COLORS.green : COLORS.red }
  ]
}

/**
 * Renderiza una celda individual en el canvas
 */
function renderCell(ctx, cell) {
  const x = getColX(cell.colIndex)
  const y = getRowY(cell.rowIndex)
  const width = getCellWidth(cell.colIndex, cell.colSpan)
  const height = getCellHeight(cell.rowIndex, cell.rowSpan)

  // Fondo
  if (cell.bgColor) {
    drawCellBg(ctx, x, y, width, height, cell.bgColor)
  }

  // Texto
  if (cell.text !== undefined && cell.text !== null) {
    const textOptions = {
      align: cell.align || 'center',
      color: cell.color || COLORS.black,
      bold: cell.bold || false,
      fontSize: CONFIG.fontSize,
      valign: cell.valign || 'middle'
    }
    
    if (cell.vertical) {
      drawRotatedText(ctx, cell.text, x, y, width, height, textOptions)
    } else {
      drawCellText(ctx, cell.text, x, y, width, height, textOptions)
    }
  }

  // Bordes básicos
  ctx.strokeStyle = COLORS.borderColor
  ctx.lineWidth = 1
  
  // Para las celdas de Pts (fila 10, col 11-12) y 100m² (fila 11, col 11-12), 
  // dibujar bordes personalizados sin línea entre ellas
  if (cell.rowIndex === 10 && cell.colIndex === 11) {
    // Celda "Pts": dibujar solo bordes superior, izquierdo y derecho
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + width, y) // superior
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + height) // izquierdo
    ctx.moveTo(x + width, y)
    ctx.lineTo(x + width, y + height) // derecho
    ctx.stroke()
  } else if (cell.rowIndex === 11 && cell.colIndex === 11) {
    // Celda "100m²": dibujar solo bordes inferior, izquierdo y derecho (derecho más grueso)
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height) // inferior
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + height) // izquierdo
    ctx.stroke()
    // Borde derecho más grueso
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + width, y)
    ctx.lineTo(x + width, y + height) // derecho
    ctx.stroke()
    ctx.lineWidth = 1 // Restaurar grosor
  } else {
    // Para el resto de celdas, dibujar borde completo
    ctx.strokeRect(x, y, width, height)
  }
  
  // Borde inferior más grueso para la fila 2 (encabezados)
  if (cell.rowIndex === 2) {
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.stroke()
  }
  
  // Borde inferior doble para la fila 8 (GERAL)
  if (cell.rowIndex === 8) {
    ctx.lineWidth = 1
    // Primera línea
    ctx.beginPath()
    ctx.moveTo(x, y + height - 3)
    ctx.lineTo(x + width, y + height - 3)
    ctx.stroke()
    // Espacio blanco entre líneas
    ctx.fillStyle = COLORS.white
    ctx.fillRect(x, y + height - 2, width, 1)
    // Segunda línea
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.stroke()
  }
  
  // Borde inferior negro 4px para la fila 11
  if (cell.rowIndex === 11) {
    ctx.strokeStyle = COLORS.black
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.stroke()
  }
  
  // Borde derecho triple para columna 3, filas 1-11
  if (cell.rowIndex >= 1 && cell.rowIndex <= 11) {
    const cellEndCol = cell.colIndex + cell.colSpan - 1
    if (cellEndCol === 3) {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x + width, y)
      ctx.lineTo(x + width, y + height)
      ctx.stroke()
    }
  }
  
  // Borde derecho triple para columna 10, filas 1-11
  if (cell.rowIndex >= 1 && cell.rowIndex <= 11) {
    const cellEndCol = cell.colIndex + cell.colSpan - 1
    if (cellEndCol === 10) {
      ctx.strokeStyle = COLORS.borderColor
      ctx.lineWidth = cell.rowIndex <= 10 ? 3 : 2
      ctx.beginPath()
      ctx.moveTo(x + width, y)
      ctx.lineTo(x + width, y + height)
      ctx.stroke()
    }
  }
  
  // Borde inferior negro de 4px para toda la fila 10 (Meta) excepto columnas 11-12
  if (cell.rowIndex === 10 && !(cell.colIndex >= 11 && cell.colIndex <= 12)) {
    ctx.strokeStyle = COLORS.black
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.stroke()
  }
  
  // Borde superior 3px para fila 10, columnas 11-16
  if (cell.rowIndex === 10 && cell.colIndex >= 11 && cell.colIndex <= 16) {
    ctx.strokeStyle = COLORS.borderColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + width, y)
    ctx.stroke()
  }
  
  // Borde superior 2px para fila 11, columnas 13-16
  if (cell.rowIndex === 11 && cell.colIndex >= 13 && cell.colIndex <= 16) {
    ctx.strokeStyle = COLORS.borderColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + width, y)
    ctx.stroke()
  }
  
  // Borde derecho 4px para columna 10, fila 14
  if (cell.rowIndex === 14) {
    const cellEndCol = cell.colIndex + cell.colSpan - 1
    if (cellEndCol === 10) {
      ctx.strokeStyle = COLORS.borderColor
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(x + width, y)
      ctx.lineTo(x + width, y + height)
      ctx.stroke()
    }
  }
  
  // Borde superior de 3px en la primera fila de TECELAGEM (fila 16)
  if (cell.rowIndex === 16) {
    ctx.strokeStyle = COLORS.borderColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + width, y)
    ctx.stroke()
  }
  
  // Borde inferior de 3px en la última fila de TECELAGEM (fila 20)
  if (cell.rowIndex === 20) {
    ctx.strokeStyle = COLORS.borderColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.stroke()
  }
}

/**
 * Genera el canvas con la tabla
 */
export function generateTableCanvas(data) {
  const cells = buildCellDefinitions(data)
  
  // Calcular dimensiones exactas de la UI
  const totalWidth = COL_WIDTHS_T1.reduce((a, b) => a + b, 0)
  const totalHeight = ROW_HEIGHTS.reduce((a, b) => a + b, 0)

  // Crear canvas con alta resolución
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = totalWidth * scale
  canvas.height = totalHeight * scale
  
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // Fondo blanco
  ctx.fillStyle = COLORS.white
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  // Renderizar todas las celdas
  cells.forEach(cell => {
    renderCell(ctx, cell)
  })

  return canvas
}

/**
 * Genera la imagen como Blob
 */
export async function generateTableImage(data) {
  const canvas = generateTableCanvas(data)
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Error creando blob'))
      }
    }, 'image/png', 1.0)
  })
}

/**
 * Copia la imagen al portapapeles
 */
export async function copyTableToClipboard(data) {
  const blob = await generateTableImage(data)
  
  if (navigator.clipboard && navigator.clipboard.write) {
    const clipboardItem = new ClipboardItem({ 'image/png': blob })
    await navigator.clipboard.write([clipboardItem])
    return true
  }
  
  throw new Error('Clipboard API no disponible')
}

export default {
  generateTableCanvas,
  generateTableImage,
  copyTableToClipboard
}
