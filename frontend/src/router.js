import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { 
    path: '/', 
    redirect: '/uster' 
  },
  { 
    path: '/uster', 
    component: () => import('./components/ensayos/Uster.vue'), 
    meta: { title: 'Uster' } 
  },
  { 
    path: '/tenso', 
    component: () => import('./components/ensayos/TensoRapid.vue'), 
    meta: { title: 'TensoRapid' } 
  },
  { 
    path: '/resumen', 
    component: () => import('./components/ensayos/ResumenEnsayos.vue'), 
    meta: { title: 'Resumen Ensayos' } 
  },
  {
    path: '/resumen-semanal-hilanderia',
    component: () => import('./components/ensayos/ResumenSemanalHilanderia.vue'),
    meta: { title: 'Resumen Semanal Hilanderia' }
  },
  {
    path: '/analisis-calidad-fibra',
    component: () => import('./components/ensayos/AnalisisCalidadFibra.vue'),
    meta: { title: 'Análisis Calidad Fibra' }
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
    path: '/revision-cq', 
    component: () => import('./components/produccion/RevisionCQ.vue'), 
    meta: { title: 'Metros por Revisor - Control de Calidad' } 
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
  }
  ,
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title 
    ? `${to.meta.title} - STC Produção` 
    : 'STC Produção'
  next()
})

export default router

