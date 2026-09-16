/**
 * Generador de exportación a Excel con formato moderno para el Análisis Eficiencia vs Calidad.
 * Utiliza ExcelJS para aplicar estilos, anchos, colores corporativos y bordes.
 */

/**
 * Prepara la estructura de datos procesada para la exportación.
 */
export function prepareExcelExportData({ datos = [], resumenStats = {}, fechaInicio, fechaFin, trama, defectos = [] }) {
  const meta = {
    fechaInicio: fechaInicio || '',
    fechaFin: fechaFin || '',
    trama: (trama && trama.trim()) ? trama.trim() : 'Todas las tramas',
    defectos: (defectos && defectos.length > 0) ? defectos.join(', ') : 'Todos (Totales)',
    totalDias: (datos || []).length
  };

  const filasDiarias = (datos || []).map((d) => ({
    fecha: d.fecha,
    eficiencia: d.eficiencia != null ? Number(d.eficiencia.toFixed(2)) : '',
    ru105: d.ru105 != null ? Number(d.ru105.toFixed(2)) : '',
    rt105: d.rt105 != null ? Number(d.rt105.toFixed(2)) : '',
    calidad: d.calidad != null ? Number(d.calidad.toFixed(2)) : '',
    pts100: d.pts100 != null ? Number(d.pts100.toFixed(2)) : '',
    metaEfi: d.metaEfi != null ? Number(d.metaEfi.toFixed(2)) : '',
    metaRu105: d.metaRu105 != null ? Number(d.metaRu105.toFixed(2)) : '',
    metaRt105: d.metaRt105 != null ? Number(d.metaRt105.toFixed(2)) : ''
  }));

  const metricOrder = ['eficiencia', 'ru105', 'rt105', 'calidad', 'pts100'];
  const filasResumen = metricOrder.map((key) => {
    const s = resumenStats?.[key] || {};
    let estado = '-';
    if (s.metaAvg != null) {
      estado = s.isAlert ? '⚠️ Desvío desfavorable' : '✅ Conforme';
    }
    return {
      metrica: s.label || key,
      promedio: s.avg != null ? s.avg : '',
      minimo: s.min != null ? s.min : '',
      maximo: s.max != null ? s.max : '',
      metaPromedio: s.metaAvg != null ? s.metaAvg : '-',
      desvio: s.desvio != null ? s.desvio : '-',
      estado
    };
  });

  return { meta, filasDiarias, filasResumen };
}

/**
 * Crea y descarga un archivo .xlsx con formato moderno usando ExcelJS.
 */
export async function exportarAnalisisExcel(ExcelJS, { datos, resumenStats, fechaInicio, fechaFin, trama, defectos }) {
  const { meta, filasDiarias, filasResumen } = prepareExcelExportData({
    datos,
    resumenStats,
    fechaInicio,
    fechaFin,
    trama,
    defectos
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Santana Textiles Chaco';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // HOJA 1: RESUMEN DEL PERÍODO
  // -------------------------------------------------------------
  const wsResumen = workbook.addWorksheet('Resumen Período');
  wsResumen.views = [{ showGridLines: true }];

  // Título
  wsResumen.mergeCells('A1:G1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'SANTANA TEXTILES CHACO — INFORME DE EFICIENCIA VS CALIDAD';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(1).height = 32;

  // Metadata
  wsResumen.getCell('A3').value = 'Período:';
  wsResumen.getCell('B3').value = `${meta.fechaInicio} al ${meta.fechaFin} (${meta.totalDias} días)`;
  wsResumen.getCell('A4').value = 'Filtro de Trama:';
  wsResumen.getCell('B4').value = meta.trama;
  wsResumen.getCell('A5').value = 'Filtro de Defectos:';
  wsResumen.getCell('B5').value = meta.defectos;
  wsResumen.getCell('A6').value = 'Fecha de Generación:';
  wsResumen.getCell('B6').value = new Date().toLocaleString('es-AR');

  ['A3', 'A4', 'A5', 'A6'].forEach((c) => {
    wsResumen.getCell(c).font = { bold: true, color: { argb: 'FF475569' } };
  });

  // Cabecera de la tabla de resumen
  const resumenHeaders = ['Métrica', 'Promedio', 'Mínimo', 'Máximo', 'Meta Promedio', 'Desvío vs Meta', 'Estado'];
  const headerRowRes = wsResumen.addRow(resumenHeaders);
  headerRowRes.height = 24;
  headerRowRes.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FF64748B' } },
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF64748B' } }
    };
  });

  // Filas de resumen
  filasResumen.forEach((r, idx) => {
    const row = wsResumen.addRow([
      r.metrica,
      r.promedio,
      r.minimo,
      r.maximo,
      r.metaPromedio,
      r.desvio,
      r.estado
    ]);
    row.height = 20;

    const isZebra = idx % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNumber === 7 && r.estado.includes('⚠️')) {
        cell.font = { bold: true, color: { argb: 'FFDC2626' } };
      } else if (colNumber === 7 && r.estado.includes('✅')) {
        cell.font = { bold: true, color: { argb: 'FF16A34A' } };
      }
    });
  });

  // Ajustar anchos de columnas
  wsResumen.columns = [
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 26 }
  ];

  // -------------------------------------------------------------
  // HOJA 2: DATOS DIARIOS
  // -------------------------------------------------------------
  const wsDiarios = workbook.addWorksheet('Datos Diarios');
  wsDiarios.views = [{ showGridLines: true }];

  // Título
  wsDiarios.mergeCells('A1:I1');
  const t2 = wsDiarios.getCell('A1');
  t2.value = `DATOS DIARIOS — ${meta.trama} (${meta.fechaInicio} al ${meta.fechaFin})`;
  t2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  t2.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDiarios.getRow(1).height = 26;

  // Cabeceras
  const diariosHeaders = [
    'Fecha',
    'Eficiencia %',
    'RU105',
    'RT105',
    'Calidad %',
    'Pts / 100m²',
    'Meta EFI %',
    'Meta RU105',
    'Meta RT105'
  ];
  const headerRowDia = wsDiarios.addRow(diariosHeaders);
  headerRowDia.height = 22;
  headerRowDia.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } }
    };
  });

  // Filas diarias
  filasDiarias.forEach((d, idx) => {
    const row = wsDiarios.addRow([
      d.fecha,
      d.eficiencia,
      d.ru105,
      d.rt105,
      d.calidad,
      d.pts100,
      d.metaEfi,
      d.metaRu105,
      d.metaRt105
    ]);
    row.height = 19;

    const isZebra = idx % 2 === 1;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  wsDiarios.columns = [
    { width: 14 },
    { width: 15 },
    { width: 13 },
    { width: 13 },
    { width: 15 },
    { width: 15 },
    { width: 14 },
    { width: 14 },
    { width: 14 }
  ];

  // Descarga del buffer en navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  anchor.download = `Eficiencia_vs_Calidad_${meta.fechaInicio}_al_${meta.fechaFin}_${stamp}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
