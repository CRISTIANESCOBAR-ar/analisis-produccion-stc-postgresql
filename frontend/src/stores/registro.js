import { defineStore } from 'pinia'

export const useRegistroStore = defineStore('registro', {
  state: () => ({
    registros: [],
    oeFilter: '',
    neFilter: ''
  }),
  actions: {
    agregar(registro) { 
      this.registros.unshift(registro) 
    },
    eliminar(idx) { 
      this.registros.splice(idx, 1) 
    },
    actualizar(idx, nuevo) { 
      this.registros.splice(idx, 1, nuevo) 
    },
    reset() { 
      this.registros.splice(0, this.registros.length) 
    },
    setOeFilter(v) { 
      this.oeFilter = v 
    },
    setNeFilter(v) { 
      this.neFilter = v 
    },
    resetFilters() { 
      this.oeFilter = ''
      this.neFilter = '' 
    }
  }
})
