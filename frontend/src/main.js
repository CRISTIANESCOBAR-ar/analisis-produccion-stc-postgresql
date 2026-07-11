import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueTippy from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light.css'
import './components/ensayos/unregister-sw.js'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// VueTippy debe registrarse ANTES del router para que el directive v-tippy
// esté disponible cuando se renderice por primera vez SidebarCompact.
app.use(VueTippy, {
  directive: 'tippy',
  defaultProps: {
    placement: 'top',
    allowHTML: true,
    theme: 'light'
  }
})
app.use(router)

// Esperar a que el router termine su primera navegación antes de montar la app.
// Esto evita que useRouter()/useRoute() fallen durante el render inicial.
router.isReady().then(() => {
  app.mount('#app')
})
