import fs from 'fs';
const filePath = 'c:\\stc-produccion-v2\\frontend\\src\\components\\inventario\\InventoryManager.vue';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE mixPlanSimulation computed to calculate stats properly
const simStatsStart = content.indexOf('    // Separar en lotRows (con DESCAR. añadidos) y truckRows');
const simStatsEnd = content.indexOf('  return {', simStatsStart);

let newStatsCode = `    // Asignar HVI de compras ideal a los camiones si no tenían
    const varResultsMap = {};
    varResults.forEach(v => varResultsMap[v.uiKey] = v);
    
    candidates.forEach(c => {
      if (c.type === 'truck') {
        c.MIC = varResultsMap['MIC']?.valorMinCompra ?? varResultsMap['MIC']?.idealMin ?? null;
        c.STR = varResultsMap['STR']?.valorMinCompra ?? varResultsMap['STR']?.idealMin ?? null;
        c.UHML = varResultsMap['UHML']?.valorMinCompra ?? varResultsMap['UHML']?.idealMin ?? null;
      }
    });

    // Separar en lotRows (con DESCAR. añadidos) y truckRows
    const lotRows = [
      ...candidates.filter(c => c.type === 'lot'),
      ...classifiedLots
        .filter(r => r.estado === 'DESCAR.' && r.stock > 0)
        .map(r => ({
          type: 'lot', PRODUTOR: r.PRODUTOR, LOTE: r.LOTE,
          estado: 'DESCAR.', stock: r.stock,
          balesPerMix: 0, usados: 0, sobrante: r.stock,
          recipe: 0, nPossible: Infinity, isBottleneck: false,
          motivo: 'Descartado por calidad HVI',
          MIC: r.MIC, STR: r.STR, UHML: r.UHML, pesoMedio: r.pesoMedio,
        })),
    ].sort((a, b) => {
      const zo = { 'USO': 0, 'TOLER.': 1, 'DESCAR.': 2 };
      if (zo[a.estado] !== zo[b.estado]) return zo[a.estado] - zo[b.estado];
      return (a.PRODUTOR + a.LOTE).localeCompare(b.PRODUTOR + b.LOTE);
    });
    const truckRows = candidates.filter(c => c.type === 'truck');

    // Calcular estadísticas detalladas (Peso, MIC, STR, LEN) sobre varResults
    let totalPesoMezcla = 0;
    candidates.forEach(c => {
      if(c.recipe > 0) totalPesoMezcla += (c.recipe * c.pesoMedio);
    });

    varResults.forEach(v => {
      let sumIdeal = 0, weightIdeal = 0;
      let sumTol = 0, weightTol = 0;
      
      candidates.forEach(c => {
        if(c.recipe > 0 && c[v.uiKey] !== null) {
          const val = c[v.uiKey];
          const qty = c.recipe;
          const isLowerBetter = v.uiKey === 'PLUS_B';
          let isIdeal = false;
          
          if(isLowerBetter) {
            isIdeal = val <= v.tolMax;
          } else {
            isIdeal = val >= v.tolMax;
          }

          if(isIdeal) {
            sumIdeal += (val * qty);
            weightIdeal += qty;
          } else {
            sumTol += (val * qty);
            weightTol += qty;
          }
        }
      });
      
      const totalWeight = weightIdeal + weightTol;
      v.promedioGeneral = totalWeight > 0 ? (sumIdeal + sumTol) / totalWeight : null;
      v.promedioIdeal = weightIdeal > 0 ? sumIdeal / weightIdeal : 0;
      v.promedioTolerancia = weightTol > 0 ? sumTol / weightTol : 0;
      v.pctIdeal = totalWeight > 0 ? (weightIdeal / totalWeight) * 100 : 0;
      v.pctTolerancia = totalWeight > 0 ? (weightTol / totalWeight) * 100 : 0;
    });

`;
content = content.substring(0, simStatsStart) + newStatsCode + content.substring(simStatsEnd);

// 2. Add totalPesoMezcla to returned object
const returnMatch = 'maxTolBalesPerMix,';
content = content.replace(returnMatch, returnMatch + '\\n    totalPesoMezcla,');


// 3. Update HTML summary table
const tfootStart = content.indexOf('<tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">');
const tfootEnd = content.indexOf('</tfoot>', tfootStart) + 8;

const newTfoot = `<tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">
                  <tr class="summary-matrix-row">
                    <td colspan="3" class="px-3 py-1.5 font-bold text-right text-gray-700 border-b border-gray-300">TOTALES LOTES</td>
                    <td class="px-3 py-1.5 text-center font-bold text-slate-800 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.stock,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.stock,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.usados,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.usados,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.sobrante,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.sobrante,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center text-gray-400 border-b border-gray-300">—</td>
                    <td colspan="3" rowspan="4" class="px-3 py-1.5 text-center font-bold text-gray-800 border-b border-gray-300 align-top pt-4">Mezcla</td>
                    <td rowspan="2" class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Cantidad</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Fardos</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300 bg-white">
                    <td colspan="7" rowspan="30" class="px-3 py-1.5 align-top border-r border-gray-300 bg-gray-50 p-4">
                       <div class="border border-slate-300 rounded-md overflow-hidden bg-white mb-2 shadow-sm">
                        <div class="px-3 py-2 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                          <h3 class="text-xs font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                          <span class="text-[10px] text-slate-500 font-mono">Calculado con recom. parcial de compras</span>
                        </div>
                        <table class="w-full">
                          <thead class="bg-gray-100">
                            <tr class="border-b border-gray-300">
                              <th class="px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Variable</th>
                              <th class="px-3 py-1.5 text-center text-[11px] font-semibold text-indigo-700 uppercase border-l border-gray-200">
                                M1-M{{ mixPlanSimulation.N_identical }}
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 text-[11px]">
                            <template v-for="v in mixPlanSimulation.varResults" :key="'res-'+v.label">
                              <!-- Variable header & Promedio -->
                              <tr class="bg-slate-50">
                                <td class="px-3 py-1.5 font-bold text-slate-800">{{ v.label }}</td>
                                <td class="px-3 py-1.5 border-l border-gray-200"></td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Promedio Bloque</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200 text-[12px]" 
                                  :class="v.promedioGeneral >= v.idealMin ? 'text-emerald-700 font-bold' : (v.promedioGeneral >= v.tolMin ? 'text-amber-600 font-bold' : 'text-red-600 font-bold')">
                                  {{ formatProjectionValue(v.promedioGeneral, 2) }}
                                </td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 text-gray-600">{{ v.pctIdeal }}% (Ideal)</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200">
                                  {{ formatProjectionValue(v.promedioIdeal, 2) }}
                                </td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 text-gray-600">{{ v.tolLimitPct }}% (Tolerancia)</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200">
                                  {{ formatProjectionValue(v.promedioTolerancia, 2) }}
                                </td>
                              </tr>
                              <tr class="bg-gray-50 border-t border-gray-100">
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Porcentual {{ v.pctIdeal }}%</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctIdeal >= v.pctIdeal ? 'text-emerald-600' : 'text-red-500'">
                                  {{ v.pctIdeal.toFixed(1) }}%
                                </td>
                              </tr>
                              <tr class="bg-gray-50 border-b-2 border-gray-200">
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Porcentual {{ v.tolLimitPct }}%</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctTolerancia <= v.tolLimitPct ? 'text-emerald-600' : 'text-red-500'">
                                  {{ v.pctTolerancia.toFixed(1) }}%
                                </td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                  
                  <tr class="summary-matrix-row bg-white">
                    <td class="px-3 py-1.5 text-center font-bold text-gray-800 border-r border-gray-200">M1-M{{ mixPlanSimulation.N_identical }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-gray-900">{{ mixPlanSimulation.fardosPorMezcla * mixPlanSimulation.N_identical }}</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300">
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-white">Bloques</td>
                    <td class="px-3 py-1.5 text-center font-bold text-slate-800 border-l border-gray-200">{{ mixPlanSimulation.N_identical }}</td>
                  </tr>

                  <tr class="summary-matrix-row">
                    <td rowspan="2" class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-200 bg-white">Peso</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Por Mezcla</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700 border-l border-gray-200">{{ formatThousandInteger(mixPlanSimulation.totalPesoMezcla) }} kg</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300">
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-white">Por Bloque</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-800 border-l border-gray-200">{{ formatThousandInteger(mixPlanSimulation.totalPesoMezcla * mixPlanSimulation.N_identical) }} kg</td>
                  </tr>
                  
                  <tr class="summary-matrix-row">
                    <td colspan="5" class="px-3 py-1.5 text-[10px] text-slate-500 italic bg-gray-50">
                       * Redondeo Inteligente orientado al Cuello de Botella ("Bottleneck-Aware Largest Remainder"). Se asigna recomendación mínima de compras HVI a camiones entrantes.
                    </td>
                  </tr>
                </tfoot>`;

content = content.substring(0, tfootStart) + newTfoot + content.substring(tfootEnd);

fs.writeFileSync(filePath, content);
console.log('Successfully patched stats summary');
