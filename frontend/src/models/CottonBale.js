export class CottonBale {
  /**
   * @param {Object} data - Datos iniciales basados en tb_est_mp
   */
  constructor(data = {}) {
    // Helper para parsear números locales (ej: "1.234,56" -> 1234.56)
    const parseLocalNum = (val) => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') return val;
      
      let cleanVal = val.toString().trim();
      
      // Si tiene puntos y comas, asumimos formato europeo 1.000,00
      if (cleanVal.includes('.') && cleanVal.includes(',')) {
        // Eliminar puntos de miles y reemplazar coma por punto decimal
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
      } 
      // Si solo tiene comas, asumimos decimal 4,34 o 110,00 (sin miles)
      else if (cleanVal.includes(',')) {
        cleanVal = cleanVal.replace(',', '.');
      }
      
      const num = parseFloat(cleanVal);
      return isNaN(num) ? 0 : num;
    };

    // Mapeo flexible de propiedades (DB keys pueden variar en formato)
    const getVal = (keys) => {
      // Intentamos obtener el valor por cada key posible
      for (const k of keys) {
        if (data[k] !== undefined) return data[k];
      }
      return undefined;
    };

    this.PRODUTOR = getVal(['PRODUTOR', 'productor']) || '';
    this.DESTINO = getVal(['DESTINO', 'destino']) || '';
    this.LOTE = getVal(['LOTE', 'lote']) || '';
    this.TP = getVal(['TP', 'tp']) || '';
    this.CLASSIF = getVal(['CLASSIF', 'classif']) || '';
    this.COR = getVal(['COR', 'cor']) || '';
    
    // Mapeo especifico para claves con espacios o variantes
    this.QTDE_ESTOQUE = parseLocalNum(getVal(['QTDE ESTOQUE', 'QTDE_ESTOQUE', 'qtde_estoque']));
    
    // Propiedades numéricas de calidad
    this.SCI = parseLocalNum(getVal(['SCI', 'sci']));
    this.MST = parseLocalNum(getVal(['MST', 'mst']));
    this.MIC = parseLocalNum(getVal(['MIC', 'mic']));
    this.MAT = parseLocalNum(getVal(['MAT', 'mat']));
    this.UHML = parseLocalNum(getVal(['UHML', 'uhml']));
    this.UI = parseLocalNum(getVal(['UI', 'ui']));
    this.SF = parseLocalNum(getVal(['SF', 'sf']));
    this.STR = parseLocalNum(getVal(['STR', 'str']));
    this.ELG = parseLocalNum(getVal(['ELG', 'elg']));
    this.RD = parseLocalNum(getVal(['RD', 'rd']));
    this.PLUS_B = parseLocalNum(getVal(['+b', 'PLUS_B', 'plus_b'])); 

    this.TIPO = getVal(['TIPO', 'tipo']) || '';
    this.TrCNT = parseLocalNum(getVal(['TrCNT', 'trcnt']));
    this.TrAR = parseLocalNum(getVal(['TrAR', 'trar']));
    this.TRID = parseLocalNum(getVal(['TRID', 'trid']));
    this.PESO = parseLocalNum(getVal(['PESO', 'peso']));
    this.PESO_MEDIO = parseLocalNum(getVal(['PESO_MEDIO', 'PESO MEDIO', 'peso_medio']));
    this.CORTEZA = parseLocalNum(getVal(['CORTEZA', 'corteza']));
  }

  // Método opcional para validación o formateo extra si fuera necesario
}
