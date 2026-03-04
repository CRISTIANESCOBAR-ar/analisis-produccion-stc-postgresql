import fs from 'fs';

const filePath = 'c:\\stc-produccion-v2\\frontend\\src\\components\\inventario\\InventoryManager.vue';
let content = fs.readFileSync(filePath, 'utf8');

const startIndex = content.indexOf('<tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">', 100000); 
const endIndex = content.indexOf('</tfoot>', startIndex) + 8;

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
                       <div class="border border-slate-300 rounded-md overflow-hidden bg-white mb-2 shadow-sm w-[400px]">
                        <div class="px-3 py-2 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                          <h3 class="text-[12px] font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                          <span class="text-[10px] text-slate-500 font-mono ml-4">Calculado con recom. min compras</span>
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
                              <tr class="bg-slate-100/50">
                                <td class="px-3 py-1.5 font-bold text-slate-800">
                                  {{ v.label }}
                                  <span class="text-gray-400 font-normal ml-1">[{{ v.idealMin }} - {{ v.tolMin }}]</span>
                                </td>
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
                                <td class="px-3 py-1.5 pl-6 text-gray-600">{{ v.pctIdeal.toFixed(1) }}% (Ideal)</td>
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
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Porcentual Ideal</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctIdeal >= parseFloat(v.pctIdeal) ? 'text-emerald-600 font-bold' : 'text-red-500'">
                                  {{ v.pctIdeal.toFixed(1) }}%
                                </td>
                              </tr>
                              <tr class="bg-gray-50 border-b-2 border-gray-200">
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Porcentual Tol.</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctTolerancia <= v.tolLimitPct ? 'text-emerald-600 font-bold' : 'text-red-500'">
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
                  
                  <tr class="summary-matrix-row border-b border-gray-300 bg-white">
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
                    <td colspan="5" class="px-3 py-1.5 text-[11px] text-slate-500 italic bg-gray-50 border-r border-gray-200">
                       * Redondeo Inteligente orientado al Cuello de Botella ("Bottleneck-Aware Largest Remainder"). Se asigna recomendación mínima de compras HVI a camiones entrantes.
                    </td>
                  </tr>
                </tfoot>`;

if (startIndex !== -1 && endIndex > startIndex) {
    content = content.substring(0, startIndex) + newTfoot + content.substring(endIndex);
    fs.writeFileSync(filePath, content);
    console.log('Success! Replaced TFOOT block properly.');
} else {
    console.log('Failed to find exact tags', startIndex, endIndex);
}
