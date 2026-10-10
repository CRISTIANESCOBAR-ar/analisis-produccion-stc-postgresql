import { domToPng } from 'modern-screenshot'

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
const kg = value => number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const datum = value => String(value ?? '').trim() || 'Sin dato'

export const textoDetalleIndigo = day => {
  const lines = [
    '🧵 *ESTOPA AZUL*',
    '*Detalle del día*',
    '',
    `📅 *Fecha:* ${day.Fecha}`,
    `⚖️ *Total:* ${kg(day.KgResiduo)} kg`,
    '',
    '📊 *RESUMEN POR MOTIVO*',
    ''
  ]
  for (const reason of day.Motivos || []) {
    lines.push(`• *${datum(reason.DESC_MOTIVO || reason.MOTIVO)}*`, `  ${kg(reason.TotalKg)} kg`, '')
  }
  lines.push(`📋 *REGISTROS DEL DÍA (${day.Registros?.length || 0})*`, '')
  for (const [index, row] of (day.Registros || []).entries()) {
    lines.push(
      `*Registro ${index + 1} · ${kg(row.Kg)} kg*`,
      `*Motivo:* ${datum(row.DESC_MOTIVO || row.MOTIVO)}`,
      `*Rolada:* ${datum(row.ROLADA)}`,
      `*Urdume:* ${datum(row.URDUME)}`,
      `*ID:* ${datum(row.ID)}`,
      `*Partida:* ${datum(row.PARTIDA)}`,
      `*Turno:* ${datum(row.TURNO)}`,
      ''
    )
  }
  return lines.join('\n').trim()
}

export const imagenDetalleIndigo = async (dialog, date) => {
  if (!dialog) throw new Error('No se encontró el detalle del día')
  const exportNode = document.createElement('div')
  exportNode.className = dialog.className
  for (const attr of dialog.attributes) if (attr.name.startsWith('data-v-')) exportNode.setAttribute(attr.name, attr.value)
  exportNode.setAttribute('aria-hidden', 'true')
  exportNode.style.cssText = "position:fixed;left:-12000px;top:0;width:1000px;max-width:none;height:auto;max-height:none;overflow:visible;display:flex;flex-direction:column;margin:0;background:white;font-family:'Trebuchet MS','Segoe UI',sans-serif;"
  for (const child of dialog.children) exportNode.appendChild(child.cloneNode(true))
  exportNode.querySelectorAll('.daily-detail-actions, .swal2-container').forEach(node => node.remove())
  exportNode.querySelectorAll('button').forEach(button => button.remove())
  exportNode.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
  const navigation = exportNode.querySelector('.daily-detail-navigation')
  navigation.replaceChildren(document.createTextNode(date))
  exportNode.querySelectorAll('.daily-detail-table').forEach(node => { node.style.cssText = 'overflow:visible;max-height:none;height:auto;flex:none;' })
  exportNode.querySelectorAll('th').forEach(node => { node.style.position = 'static' })
  const report = dialog.closest('.analysis-view')
  report.appendChild(exportNode)
  try {
    await document.fonts.ready
    const bounds = exportNode.getBoundingClientRect()
    const scale = Math.max(1, Math.min(3, Math.sqrt(20000000 / Math.max(1, bounds.width * bounds.height))))
    return await domToPng(exportNode, { scale, dpi: Math.round(96 * scale), backgroundColor: '#ffffff' })
  } finally { exportNode.remove() }
}
