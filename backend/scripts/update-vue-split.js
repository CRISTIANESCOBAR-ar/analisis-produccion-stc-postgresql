import fs from 'fs';

const path = 'c:/stc-produccion-v2/frontend/src/components/produccion/AnalisisPatronesTeje.vue';
let content = fs.readFileSync(path, 'utf8');

// 1. loading to loadingData / loadingIA refs
content = content.replace("const loading = ref(false)", "const loadingData = ref(false)\nconst loadingIA = ref(false)");

// 2. HTML replacements
content = content.replace(":disabled=\"loading ||", ":disabled=\"(loadingData || loadingIA) ||");
content = content.replace("v-if=\"loading\"", "v-if=\"loadingData || loadingIA\""); // wait, for button spinner
content = content.replace("<span>{{ loading ? 'Analizando...' : 'Analizar con IA' }}</span>", "<span>{{ loadingData ? 'Cargando datos...' : (loadingIA ? 'Analizando...' : 'Analizar con IA') }}</span>");

// 3. For the AI section loading
content = content.replace("<!-- Cargando -->\n            <div v-if=\"loading\"", "<!-- Cargando -->\n            <div v-if=\"loadingIA\"");

// 4. Update the execution method
const oldEjecutar = `// Ejecución del endpoint
async function ejecutarAnalisis() {
  if (!fechaInicio.value || !fechaFin.value) return

  loading.value = true
  error.value = null
  firstRun.value = false

  try {
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value
    })
    
    const response = await fetch(\`\${API_BASE}/api/calidad/analisis-patrones-teje?\${params}\`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Error en la petición de análisis')
    }

    if (data.success) {
      dataset.value = Array.isArray(data.dataset) ? data.dataset : []
      defects.value = Array.isArray(data.defects) ? data.defects : []
      totalMetros.value = Number(data.total_metros || 0)
      totalAreaM2.value = Number(data.total_area_m2 || 0)
      analisis.value = data.narrativa || data.analisis || ''
      tokenInfo.value = data.tokenInfo || null
      fuente.value = data.fuente || ''
      modelo.value = data.modelo || ''
    } else {
      throw new Error(data.error || 'No se pudo generar el análisis')
    }
  } catch (err) {
    console.error('[analisis-patrones-teje] failed:', err)
    error.value = err.message
    Swal.fire({
      icon: 'error',
      title: 'Error de análisis',
      text: err.message || 'No se pudo realizar el análisis de patrones.'
    })
  } finally {
    loading.value = false
  }
}`;

const newEjecutar = `// Ejecución del endpoint
async function ejecutarAnalisis() {
  if (!fechaInicio.value || !fechaFin.value) return

  loadingData.value = true
  error.value = null
  firstRun.value = false
  analisis.value = ''
  tokenInfo.value = null
  fuente.value = ''
  modelo.value = ''

  try {
    // 1. Obtener Datos
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value
    })
    
    const resDatos = await fetch(\`\${API_BASE}/api/calidad/datos-patrones-teje?\${params}\`)
    const dataDatos = await resDatos.json()

    if (!resDatos.ok) throw new Error(dataDatos.error || 'Error obteniendo datos de calidad')
    
    if (dataDatos.success) {
      dataset.value = Array.isArray(dataDatos.dataset) ? dataDatos.dataset : []
      defects.value = Array.isArray(dataDatos.defects) ? dataDatos.defects : []
      totalMetros.value = Number(dataDatos.total_metros || 0)
      totalAreaM2.value = Number(dataDatos.total_area_m2 || 0)
    } else {
      throw new Error('Formato de datos inválido')
    }
    
    loadingData.value = false;

    // Si no hay datos, cortamos acá
    if (dataset.value.length === 0) {
      analisis.value = 'No se encontraron registros de tejeduría en el rango de fechas seleccionado.';
      return;
    }

    // 2. Ejecutar IA
    loadingIA.value = true;
    
    const resIA = await fetch(\`\${API_BASE}/api/calidad/ia-patrones-teje\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset: dataset.value,
        defects: defects.value,
        totalMetros: totalMetros.value,
        totalAreaM2: totalAreaM2.value,
        fechaInicio: fechaInicio.value,
        fechaFin: fechaFin.value
      })
    });
    
    const dataIA = await resIA.json();
    
    if (!resIA.ok) throw new Error(dataIA.error || 'Error en análisis de IA');
    
    analisis.value = dataIA.narrativa || dataIA.analisis || '';
    tokenInfo.value = dataIA.tokenInfo || null;
    fuente.value = dataIA.fuente || '';
    modelo.value = dataIA.modelo || '';

  } catch (err) {
    console.error('[analisis-patrones-teje] failed:', err)
    error.value = err.message
    Swal.fire({
      icon: 'error',
      title: 'Error de análisis',
      text: err.message || 'Ocurrió un error en el proceso.'
    })
  } finally {
    loadingData.value = false
    loadingIA.value = false
  }
}`;

content = content.replace(oldEjecutar, newEjecutar);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated vue frontend split");
