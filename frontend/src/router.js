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

