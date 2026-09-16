/**
 * Helpers y funciones puras para el componente AnalisisEficienciaCalidad.
 * Desarrollado con TDD para garantizar robustez, precisión matemática y cero dependencias externas.
 */

/**
 * Formatea una fecha como YYYY-MM-DD usando componentes locales.
 */
export function formatDateISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene el rango de fechas por defecto:
 * - Si es día > 1: desde el 1° del mes actual hasta ayer.
 * - Si es día 1: desde el 1° del mes anterior hasta el último día del mes anterior (ayer).
 */
export function getDefaultDateRange(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const currentDay = d.getDate();

  if (currentDay === 1) {
    // Ayer es el último día del mes anterior
    const yesterday = new Date(d);
    yesterday.setDate(yesterday.getDate() - 1);

    // Inicio es el primer día de ese mes anterior
    const startPrevMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);

    return {
      fechaInicio: formatDateISO(startPrevMonth),
      fechaFin: formatDateISO(yesterday)
    };
  }

  // Día normal: 1° del mes actual hasta ayer
  const startCurrentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const yesterday = new Date(d);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    fechaInicio: formatDateISO(startCurrentMonth),
    fechaFin: formatDateISO(yesterday)
  };
}

/**
 * Extrae tramas únicas ordenadas alfabéticamente a partir de registros de producción / roturas.
 */
export function extractDistinctTramas(rows) {
  if (!Array.isArray(rows)) return [];
  const set = new Set();
  for (const r of rows) {
    let raw = r;
    if (typeof r === 'object' && r !== null) {
      raw = r.trama ?? r.TRAMA ?? r['TRAMA REDUZIDA 1'];
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Normaliza una fecha proveniente de DB (YYYY-MM-DD o DD/MM/YYYY o ISO).
 */
function normalizeDateKey(val) {
  if (!val) return null;
  const str = String(val).trim();
  // Formato YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  // Formato DD/MM/YYYY
  const parts = str.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return str;
}

/**
 * Consolida registros diarios de producción, calidad, metas y defectos específicos.
 */
export function mergeMetricasPorFecha({ produccion = [], calidad = [], metas = [], defectos = null }) {
  const map = new Map();

  const getOrCreate = (fechaStr) => {
    if (!map.has(fechaStr)) {
      map.set(fechaStr, {
        fecha: fechaStr,
        eficiencia: null,
        ru105: null,
        rt105: null,
        calidad: null,
        pts100: null,
        metaEfi: null,
        metaRu105: null,
        metaRt105: null,
        metaRevision: null
      });
    }
    return map.get(fechaStr);
  };

  // 1. Producción
  for (const p of (produccion || [])) {
    const fecha = normalizeDateKey(p.FECHA_DB || p.FECHA);
    if (!fecha) continue;
    const entry = getOrCreate(fecha);
    entry.eficiencia = p.EFICIENCIA_TELAR != null ? Number(p.EFICIENCIA_TELAR) : null;
    entry.ru105 = p.RU105_TELAR != null ? Number(p.RU105_TELAR) : null;
    entry.rt105 = p.RT105_TELAR != null ? Number(p.RT105_TELAR) : null;
  }

  // 2. Calidad
  const areaByDate = new Map();
  for (const c of (calidad || [])) {
    const fecha = normalizeDateKey(c.FECHA_DB || c.FECHA);
    if (!fecha) continue;
    const entry = getOrCreate(fecha);
    entry.calidad = c.CALIDAD_PERCENT != null ? Number(c.CALIDAD_PERCENT) : null;
    entry.pts100 = c.PTS_100M2 != null ? Number(c.PTS_100M2) : null;
    if (c.AREA_M2) {
      areaByDate.set(fecha, c.AREA_M2);
    }
  }

  // 3. Metas
  for (const m of (metas || [])) {
    const fecha = normalizeDateKey(m.dia || m.FECHA_DB || m.fecha);
    if (!fecha) continue;
    const entry = getOrCreate(fecha);
    entry.metaEfi = m.meta_efi != null ? Number(m.meta_efi) : null;
    entry.metaRu105 = m.meta_ru105 != null ? Number(m.meta_ru105) : null;
    entry.metaRt105 = m.meta_rt105 != null ? Number(m.meta_rt105) : null;
    entry.metaRevision = m.meta_revision != null ? Number(m.meta_revision) : null;
  }

  // 4. Defectos (Si están definidos, sobreescriben pts100)
  if (defectos !== null) {
    for (const d of (defectos || [])) {
      const fecha = normalizeDateKey(d.FECHA_DB || d.FECHA);
      if (!fecha) continue;
      const entry = getOrCreate(fecha);
      const area = areaByDate.get(fecha);
      
      if (area > 0 && d.PONTOS_DEFECTO != null) {
        entry.pts100 = (Number(d.PONTOS_DEFECTO) * 100) / area;
      } else {
        // Si no hay área pero hay puntos, el pts100 es incalculable (null).
        // Si hay área pero no hay puntos para ese día, pts100 = 0.
        entry.pts100 = area > 0 ? 0 : null;
      }
    }
    
    // Para los días que no tuvieron registros de los defectos seleccionados, forzamos a 0
    for (const entry of map.values()) {
      const area = areaByDate.get(entry.fecha);
      const hasDefect = (defectos || []).some(d => normalizeDateKey(d.FECHA_DB || d.FECHA) === entry.fecha);
      if (!hasDefect && area > 0) {
        entry.pts100 = 0;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Calcula estadísticas para la tabla resumen del período:
 * avg, min, max, metaAvg, desvio, isAlert.
 */
export function calculateResumenStats(data) {
  const metricConfigs = [
    { key: 'eficiencia', label: 'Eficiencia %', metaKey: 'metaEfi', unit: '%', isHigherWorse: false },
    { key: 'ru105', label: 'RU105 (Urd.', metaKey: 'metaRu105', unit: '', isHigherWorse: true },
    { key: 'rt105', label: 'RT105 (Trama)', metaKey: 'metaRt105', unit: '', isHigherWorse: true },
    { key: 'calidad', label: 'Calidad %', metaKey: null, unit: '%', isHigherWorse: false },
    { key: 'pts100', label: 'Pts / 100m²', metaKey: null, unit: '', isHigherWorse: true }
  ];

  const result = {};

  for (const cfg of metricConfigs) {
    const vals = (data || [])
      .map((d) => d[cfg.key])
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    const metaVals = cfg.metaKey
      ? (data || [])
          .map((d) => d[cfg.metaKey])
          .filter((v) => v !== null && v !== undefined && !isNaN(v))
      : [];

    if (!vals.length) {
      result[cfg.key] = {
        label: cfg.label,
        avg: null,
        min: null,
        max: null,
        metaAvg: null,
        desvio: null,
        isAlert: false
      };
      continue;
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = Number((sum / vals.length).toFixed(2));

    let metaAvg = null;
    let desvio = null;
    let isAlert = false;

    if (metaVals.length > 0) {
      const metaSum = metaVals.reduce((a, b) => a + b, 0);
      metaAvg = Number((metaSum / metaVals.length).toFixed(2));
      desvio = Number((avg - metaAvg).toFixed(2));

      // Reglas de alerta:
      // Si roturas (higher is worse): avg > metaAvg es alerta
      // Si eficiencia (higher is better): avg < metaAvg es alerta
      if (cfg.isHigherWorse) {
        isAlert = avg > metaAvg;
      } else {
        isAlert = avg < metaAvg;
      }
    }

    result[cfg.key] = {
      label: cfg.label,
      avg,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      metaAvg,
      desvio,
      isAlert
    };
  }

  return result;
}

/**
 * Construye la configuración de ECharts para el gráfico de análisis.
 */
export function buildEChartsOption(data = [], { title = '', drawAsArea = false } = {}) {
  const dates = (data || []).map((d) => {
    const parts = d.fecha.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.fecha;
  });

  const seriesDef = [
    {
      name: 'Eficiencia %',
      type: 'line',
      yAxisIndex: 0,
      smooth: true,
      data: (data || []).map((d) => d.eficiencia),
      itemStyle: { color: '#2563eb' },
      lineStyle: { width: 3 }
    },
    {
      name: 'Calidad %',
      type: 'line',
      yAxisIndex: 0,
      smooth: true,
      data: (data || []).map((d) => d.calidad),
      itemStyle: { color: '#16a34a' },
      lineStyle: { width: 3 }
    },
    {
      name: 'RU105',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      data: (data || []).map((d) => d.ru105),
      itemStyle: { color: '#ea580c' },
      lineStyle: { type: 'dashed', width: 2 }
    },
    {
      name: 'RT105',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      data: (data || []).map((d) => d.rt105),
      itemStyle: { color: '#dc2626' },
      lineStyle: { type: 'dashed', width: 2 }
    },
    {
      name: 'Pts/100m²',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      data: (data || []).map((d) => d.pts100),
      itemStyle: { color: '#9333ea' },
      lineStyle: { type: drawAsArea ? 'solid' : 'dotted', width: 2 },
      areaStyle: drawAsArea ? { opacity: 0.2, color: '#9333ea' } : undefined
    },
    {
      name: 'Meta EFI %',
      type: 'line',
      yAxisIndex: 0,
      smooth: false,
      data: (data || []).map((d) => d.metaEfi),
      itemStyle: { color: '#60a5fa' },
      lineStyle: { type: 'dashed', width: 1.5 },
      symbol: 'none'
    },
    {
      name: 'Meta RU105',
      type: 'line',
      yAxisIndex: 1,
      smooth: false,
      data: (data || []).map((d) => d.metaRu105),
      itemStyle: { color: '#fb923c' },
      lineStyle: { type: 'dashed', width: 1.5 },
      symbol: 'none'
    },
    {
      name: 'Meta RT105',
      type: 'line',
      yAxisIndex: 1,
      smooth: false,
      data: (data || []).map((d) => d.metaRt105),
      itemStyle: { color: '#f87171' },
      lineStyle: { type: 'dashed', width: 1.5 },
      symbol: 'none'
    }
  ];

  return {
    title: title ? { text: title, left: 'center', textStyle: { fontSize: 14 } } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params) => {
        if (!Array.isArray(params) || !params.length) return '';
        const header = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #475569;padding-bottom:2px">${params[0].axisValue}</div>`;
        const lines = params
          .filter((p) => p.value !== null && p.value !== undefined)
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
                <span>${p.marker} ${p.seriesName}:</span>
                <span style="font-weight:bold">${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
              </div>`
          );
        return header + lines.join('');
      }
    },
    legend: {
      bottom: 0,
      selectedMode: true,
      selected: {
        'Eficiencia %': true,
        'Calidad %': true,
        'RU105': true,
        'RT105': true,
        'Pts/100m²': true,
        'Meta EFI %': false,
        'Meta RU105': false,
        'Meta RT105': false
      },
      textStyle: { fontSize: 11 }
    },
    grid: {
      top: 30,
      right: '3%',
      bottom: 60,
      left: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: buildXAxisLabel(dates.length)
    },
    yAxis: [
      {
        type: 'value',
        name: '% (Eficiencia / Calidad)',
        min: 0,
        max: 100,
        position: 'left',
        axisLabel: { formatter: '{value}%', fontSize: 11 }
      },
      {
        type: 'value',
        name: 'Roturas / Pts/100m²',
        position: 'right',
        splitLine: { show: false },
        axisLabel: { fontSize: 11 }
      }
    ],
    series: seriesDef
  };
}

/**
 * Construye la configuración de axisLabel del eje X según la cantidad de puntos.
 * - ≤ 15 puntos: horizontal (rotate: 0), mostrar todas las etiquetas.
 * - 16–45 puntos: inclinadas a 45°, mostrar todas.
 * - 46–90 puntos: verticales a 90°, mostrar todas.
 * - > 90 puntos: verticales a 90°, intercalar etiquetas (interval: 1 = cada 2).
 */
export function buildXAxisLabel(pointCount) {
  if (pointCount <= 15) {
    return { fontSize: 11, rotate: 0, interval: 0 };
  }
  if (pointCount <= 45) {
    return { fontSize: 11, rotate: 90, interval: 0 };
  }
  if (pointCount <= 90) {
    return { fontSize: 10, rotate: 90, interval: 0 };
  }
  // > 90 puntos: vertical + intercaladas
  return { fontSize: 10, rotate: 90, interval: 1 };
}

