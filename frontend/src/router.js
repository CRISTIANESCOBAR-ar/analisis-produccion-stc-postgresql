import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/resumen'
  },
  {
    path: '/uster',
    // Fuera de esta App — redirigir al Resumen de Ensayos
    redirect: '/resumen'
  },
  {
    path: '/uster-cardas',
    redirect: '/resumen'
  },
  {
    path: '/tenso',
    redirect: '/resumen'
  },
  {
    path: '/benninger-rtf',
    component: () => import('./components/ensayos/BenningerRTF.vue'),
    meta: { title: 'Benninger RTF' }
  },
  {
    path: '/benninger-rtf-partidas-secuencia',
    component: () => import('./components/ensayos/BenningerRTFPartidasSecuencia.vue'),
    meta: { title: 'Benninger RTF Partidas Secuencia' }
  },
  {
    path: '/benninger-impacto',
    component: () => import('./components/ensayos/BenningerImpactDashboard.vue'),
    meta: { title: 'Benninger Impacto Hilo' }
  },
  { 
    path: '/resumen', 
    component: () => import('./components/ensayos/ResumenEnsayos.vue'), 
    meta: { title: 'Resumen Ensayos' } 
  },
  {
    path: '/resumen-cardas',
    component: () => import('./components/ensayos/ResumenEnsayosCardas.vue'),
    meta: { title: 'Resumen Ensayos Cardas' }
  },
  {
    path: '/resumen-semanal-hilanderia',
    component: () => import('./components/ensayos/ResumenSemanalHilanderia.vue'),
    meta: { title: 'Resumen Semanal Hilanderia' }
  },
  {
    path: '/golden-batch',
    component: () => import('./components/GoldenBatchCorrelation.vue'),
    meta: { title: 'Motor de Correlación Golden Batch' }
  },
  {
    path: '/analisis-calidad-fibra',
    component: () => import('./components/ensayos/AnalisisCalidadFibra.vue'),
    meta: { title: 'Análisis Calidad Fibra' }
  },
  {
    path: '/parametros-hvi',
    component: () => import('./components/ensayos/ParametrosHVI.vue'),
    meta: { title: 'Parámetros HVI' }
  },
  {
    path: '/hvi',
    component: () => import('./components/ensayos/HVI.vue'),
    meta: { title: 'Carga HVI' }
  },
  {
    path: '/resumen-hvi-datos',
    component: () => import('./components/ensayos/ResumenHVIDatos.vue'),
    meta: { title: 'Resumen Datos HVI' }
  },
  {
    path: '/detalle-mistura-lote',
    component: () => import('./components/ensayos/DetalleMisturaLote.vue'),
    meta: { title: 'Detalle MISTURA por Lote' }
  },
  {
    path: '/correlacion-mezcla-hilo',
    component: () => import('./components/ensayos/CorrelacionMezclaHilo.vue'),
    meta: { title: 'Correlación Mezcla → Hilo' }
  },
  {
    path: '/dashboard-mezcla',
    component: () => import('./components/ensayos/DashboardMezclaHilo.vue'),
    meta: { title: 'Dashboard Mezcla → Hilo' }
  },
  // {
  //   path: '/relato-ia-integral',
  //   component: () => import('./components/ensayos/RelatoIntegralIAView.vue'),
  //   meta: { title: 'Relato Integral IA' }
  // },
  {
    path: '/informe-auditoria-lote',
    component: () => import('./components/ensayos/InformeAuditoriaLote.vue'),
    meta: { title: 'Informe Auditoría por Lote' }
  },
  { 
    path: '/resumen-diario', 
    component: () => import('./components/ensayos/ResumenDiario.vue'), 
    meta: { title: 'Resumen Diario' } 
  },
  { 
    path: '/stats', 
    component: () => import('./components/UsterStatsPage.vue'), 
    meta: { title: 'Gráficos Ensayos' } 
  },
  { 
    path: '/import-control', 
    component: () => import('./components/produccion/ImportControl.vue'), 
    meta: { title: 'Control de Importaciones' } 
  },
  { 
    path: '/importaciones', 
    component: () => import('./components/produccion/ImportControl.vue'), 
    meta: { title: 'Control de Importaciones' } 
  },
  {
    path: '/meta-por-revisor',
    component: () => import('./components/produccion/MetaPorRevisor.vue'),
    meta: { title: 'Meta por Revisor - Control de Calidad' }
  },
  { 
    path: '/revision-cq', 
    component: () => import('./components/produccion/RevisionCQ.vue'), 
    meta: { title: 'Metros por Revisor - Control de Calidad' } 
  },
  { 
    path: '/desempeno-revisores', 
    component: () => import('./components/produccion/DesempenoRevisores.vue'), 
    meta: { title: 'Desempeño de Revisores - Control de Calidad' } 
  },
  { 
    path: '/analisis-mesa-test', 
    component: () => import('./components/produccion/AnalisisMesaTest.vue'), 
    meta: { title: 'Mesa de Test - Control de Calidad' } 
  },
  {
    path: '/calidad-sectores',
    component: () => import('./components/produccion/CalidadSectoresTabla.vue'),
    meta: { title: 'Metros por Sector - Control de Calidad' }
  },
  {
    path: '/consulta-calidad-partida',
    component: () => import('./components/produccion/ConsultaPartidaCalidad.vue'),
    meta: { title: 'Consulta Detalle Partida - Calidad' }
  },
  {
    path: '/partida-tejeduria',
    component: () => import('./components/produccion/PartidaTejeduria.vue'),
    meta: { title: 'Partida en Producción – Tejeduría' }
  },
  {
    path: '/pts-tejeduria',
    component: () => import('./components/produccion/PtsPorPartida.vue'),
    meta: { title: 'Pts/100m² por Partida – Tejeduría' }
  },
  {
    path: '/defecto-tejeduria',
    component: () => import('./components/produccion/DefectoPorPartida.vue'),
    meta: { title: 'Defecto → Partidas – Tejeduría' }
  },
  {
    path: '/heatmap-tejeduria',
    component: () => import('./components/produccion/HeatmapTelarDefecto.vue'),
    meta: { title: 'Mapa de Calor Telar × Defecto – Tejeduría' }
  },
  {
    path: '/caida-telares',
    component: () => import('./components/produccion/CaidaTelares.vue'),
    meta: { title: 'Caida de Telares' }
  },
  {
    path: '/performance-revisores',
    component: () => import('./components/produccion/PerformanceMensualRevisores.vue'),
    meta: { title: 'Performance Mensual Revisores - Control de Calidad' }
  },
  {
    path: '/analisis-patrones-teje',
    component: () => import('./components/produccion/AnalisisPatronesTeje.vue'),
    meta: { title: 'Análisis de Patrones de Defectos (IA)' }
  },
  {
    path: '/relato-ia-teje',
    component: () => import('./components/produccion/RelatoIaTejeView.vue'),
    meta: { title: 'Relato de Calidad y Patrones (IA)' }
  },
  {
    path: '/residuos-indigo-tejeduria',
    component: () => import('./components/ResiduosIndigoTejeduria.vue'),
    meta: { title: 'Residuos INDIGO y TEJEDURIA' }
  },
  {
    path: '/analisis-residuos-indigo',
    component: () => import('./components/AnalisisResiduosIndigo.vue'),
    meta: { title: 'Analisis Residuos de Indigo' }
  },
  {
    path: '/consulta-rolada-indigo',
    component: () => import('./components/ConsultaRoladaIndigo.vue'),
    meta: { title: 'Consulta ROLADA INDIGO' }
  },
  {
    path: '/informe-produccion-indigo',
    component: () => import('./components/InformeProduccionIndigo.vue'),
    meta: { title: 'ROLADAS del Mes' }
  },
  {
    path: '/verificacion-partidas-rolada',
    component: () => import('./components/VerificacionPartidasRolada.vue'),
    meta: { title: 'Verificación Partidas por Rolada' }
  },
  {
    path: '/auditoria-rtf-secuencia',
    component: () => import('./components/AuditoriaRTFSecuencia.vue'),
    meta: { title: 'Auditoría RTF — Secuencia Benninger' }
  },
  {
    path: '/seguimiento-roladas',
    component: () => import('./components/SeguimientoRoladas.vue'),
    meta: { title: 'Seguimiento de Roladas' }
  },
  {
    path: '/seguimiento-roladas-fibra',
    component: () => import('./components/SeguimientoRoladasFibra.vue'),
    meta: { title: 'Seguimiento Roladas + Fibra HVI' }
  },
  {
    path: '/grafico-metricas-diarias',
    component: () => import('./components/GraficoMetricasDiarias.vue'),
    meta: { title: 'Grafico de Metricas Diarias' }
  },
  {
    path: '/configuracion-estandares',
    component: () => import('./components/configuracion/ConfiguracionEstandares.vue'),
    meta: { title: 'Configuración Estándares y Mezclas' }
  },
  {
    path: '/inventario',
    // Temporalmente deshabilitado: la vista de Inventario se sirve desde otra App.
    // Evitamos acceso por URL redirigiendo al root.
    redirect: '/',
  },
  {
    path: '/informe-diario',
    component: () => import('./components/produccion/InformeDiario.vue'),
    meta: { title: 'Informe STC Diario' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const routeTitleGroups = [
  {
    title: 'Laboratorio Hilandería',
    paths: [
      '/resumen',
      '/resumen-cardas',
      '/resumen-semanal-hilanderia',
      '/analisis-calidad-fibra',
      '/golden-batch',
      '/informe-auditoria-lote',
      '/resumen-diario',
      '/stats',
      '/benninger-rtf',
      '/benninger-rtf-partidas-secuencia',
      '/benninger-impacto'
    ]
  },
  {
    title: 'Producción',
    paths: ['/import-control', '/importaciones', '/informe-diario']
  },
  // Inventarios: eliminado de los grupos de título — gestionado por otra App
  {
    title: 'Control de Calidad',
    paths: [
      '/revision-cq',
      '/meta-por-revisor',
      '/desempeno-revisores',
      '/analisis-mesa-test',
      '/calidad-sectores',
      '/consulta-calidad-partida',
      '/partida-tejeduria',
      '/pts-tejeduria',
      '/defecto-tejeduria',
      '/heatmap-tejeduria',
      '/caida-telares',
      '/performance-revisores',
      '/analisis-patrones-teje'
    ]
  },
  {
    title: 'ÍNDIGO',
    paths: [
      '/residuos-indigo-tejeduria',
      '/analisis-residuos-indigo',
      '/consulta-rolada-indigo',
      '/informe-produccion-indigo',
      '/verificacion-partidas-rolada',
      '/auditoria-rtf-secuencia',
      '/seguimiento-roladas',
      '/seguimiento-roladas-fibra',
      '/grafico-metricas-diarias'
    ]
  },
  {
    title: 'Configuración',
    paths: ['/parametros-hvi', '/detalle-mistura-lote', '/correlacion-mezcla-hilo', '/dashboard-mezcla', '/relato-ia-integral', '/configuracion-estandares']
  }
]

function getRouteGroupTitle(path) {
  const group = routeTitleGroups.find(entry => entry.paths.includes(path))
  return group ? group.title : ''
}

router.beforeEach((to, from, next) => {
  const baseTitle = 'Santana Produccion'
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title.trim() : ''
  const groupTitle = getRouteGroupTitle(to.path)
  const titleParts = [groupTitle, pageTitle].filter(Boolean)

  // Detect PWA/standalone display to avoid duplicating app name
  let isPWA = false
  if (typeof window !== 'undefined') {
    try {
      const mm = window.matchMedia
      isPWA = (mm && (mm('(display-mode: standalone)').matches || mm('(display-mode: fullscreen)').matches)) ||
              window.navigator.standalone === true ||
              (document.referrer && document.referrer.startsWith('android-app://'))
    } catch (e) {
      isPWA = false
    }
  }

  if (isPWA) {
    // Installed app: let the platform show app name; set only page/group
    document.title = titleParts.length ? titleParts.join(' - ') : baseTitle
  } else {
    // Browser tab: include app name suffix
    document.title = titleParts.length ? `${titleParts.join(' - ')} | ${baseTitle}` : baseTitle
  }

  next()
})

export default router

