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

