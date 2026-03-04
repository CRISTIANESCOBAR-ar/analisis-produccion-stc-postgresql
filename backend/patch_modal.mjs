import fs from 'fs';
const filePath = 'c:\\stc-produccion-v2\\frontend\\src\\components\\inventario\\InventoryManager.vue';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = '<template v-else>';
const startIdx = content.indexOf(startMarker, content.indexOf('<!-- Tabla Proyección de Bloques (Stock + Compra) -->') - 100);

const endMarker = '<!-- Footer -->';
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

const newTemplate = `          <template v-else>
            <div class="overflow-x-auto mb-6 border border-slate-300 rounded-lg shadow-sm">
              <div class="bg-indigo-700 border-b border-indigo-800 px-4 py-3 flex justify-between items-center text-white rounded-t-lg">
                <h3 class="text-sm font-bold flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Proyección de Consumo - {{ mixPlanSimulation.N_identical }} mezclas idénticas (Bloque Stock + Compra)
                </h3>
              </div>
              <table class="min-w-full divide-y divide-gray-200 text-[11px] compact-plan-table">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Productor</th>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Lote</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Stock</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Usados</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Sobrante</th>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Motivo Sobrante</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider border-l border-gray-300">MIC</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">STR</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">LEN</th>
                    <th class="px-3 py-2 text-center font-bold text-indigo-700 uppercase tracking-wider border-l border-gray-300 bg-indigo-50">
                      M1-M{{ mixPlanSimulation.N_identical }}
                    </th>
                    <th class="px-3 py-2 text-center font-bold text-teal-700 uppercase tracking-wider border-l border-gray-300 bg-teal-50">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <!-- Entrantes (Compras) -->
                  <tr v-for="(row, idx) in mixPlanSimulation.truckRows" :key="'tr-'+idx" class="hover:bg-gray-50 bg-emerald-50/20">
                    <td class="px-3 py-1.5 font-medium text-emerald-800">COMPRA</td>
                    <td class="px-3 py-1.5 text-slate-700">{{ row.LOTE }}</td>
                    <td class="px-3 py-1.5 text-center">
                      <span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold">USO</span>
                    </td>
                    <td class="px-3 py-1.5 text-center font-semibold text-slate-700">{{ row.stock }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700">{{ row.usados }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700">{{ row.sobrante }}</td>
                    <td class="px-3 py-1.5 text-slate-700">
                      <span class="font-medium text-slate-700">{{ row.motivo }}</span>
                    </td>
                    <td class="px-3 py-1.5 text-center text-gray-400 border-l border-gray-200">—</td>
                    <td class="px-3 py-1.5 text-center text-gray-400">—</td>
                    <td class="px-3 py-1.5 text-center text-gray-400">—</td>
                    <td class="px-3 py-1.5 text-center font-bold text-indigo-700 bg-indigo-50/50 border-l border-gray-200">
                      {{ row.recipe }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-teal-700 bg-teal-50/30 border-l border-gray-200">
                      {{ row.sobrante }}
                    </td>
                  </tr>
                  
                  <!-- Stock Existente -->
                  <tr v-for="(row, idx) in mixPlanSimulation.lotRows" :key="'lot-'+idx" class="hover:bg-gray-50">
                    <td class="px-3 py-1.5 font-medium text-gray-900">{{ row.PRODUTOR }}</td>
                    <td class="px-3 py-1.5 text-gray-600">{{ row.isFicticio ? row.comboName : row.LOTE }}</td>
                    <td class="px-3 py-1.5 text-center">
                      <span :class="row.estado === 'USO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {{ row.estado }}
                      </span>
                    </td>
                    <td class="px-3 py-1.5 text-center font-semibold text-slate-700">{{ row.stock }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700">{{ row.usados || '-' }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700">{{ row.sobrante }}</td>
                    <td class="px-3 py-1.5">
                      <span v-if="row.isBottleneck" class="font-bold text-red-600 ml-1">* Solo se usa {{ row.recipe }} por mezcla (BOTTLENECK)</span>
                      <span v-else-if="row.sobrante === 0" class="font-semibold text-emerald-700">{{ row.motivo }}</span>
                      <span v-else class="font-medium text-slate-700">{{ row.motivo }}</span>
                    </td>
                    <td class="px-3 py-1.5 text-center border-l border-gray-200">{{ row.MIC !== null ? formatProjectionValue(row.MIC, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center">{{ row.STR !== null ? formatProjectionValue(row.STR, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center">{{ row.UHML !== null ? formatProjectionValue(row.UHML, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center font-bold border-l border-gray-200" :class="row.recipe ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-300'">
                      {{ row.recipe || '-' }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-teal-700 bg-teal-50/30 border-l border-gray-200">
                      {{ row.sobrante }}
                    </td>
                  </tr>
                </tbody>

                <tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">
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
                    <td colspan="7" rowspan="4" class="px-3 py-1.5 align-top border-r border-gray-300 bg-gray-50">
                       <div class="h-full border border-slate-300 rounded-md overflow-hidden bg-white mt-1 w-2/3">
                        <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-300">
                          <h3 class="text-xs font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                        </div>
                        <table class="w-full compact-remanentes-table">
                          <thead class="bg-gray-50">
                            <tr class="border-b border-gray-300">
                              <th class="px-3 py-1 text-left text-[11px] font-semibold text-gray-600 uppercase">Variable</th>
                              <th class="px-3 py-1 text-center text-[11px] font-semibold text-indigo-700 uppercase border-l border-gray-200">
                                M1-M{{ mixPlanSimulation.N_identical }}
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            <tr v-for="v in mixPlanSimulation.varResults" :key="'res-'+v.label">
                              <td class="px-3 py-1 text-[11px] font-semibold text-gray-700">{{ v.label }} (Promedio Bloque)</td>
                              <td class="px-3 py-1 text-[11px] text-center font-mono border-l border-gray-200" 
                                :class="v.calcAvg >= v.idealMin ? 'text-emerald-700 font-bold' : (v.calcAvg >= v.tolMin ? 'text-amber-600 font-bold' : 'text-red-600 font-bold')">
                                {{ formatProjectionValue(v.calcAvg, 2) }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                  <tr class="summary-matrix-row bg-white">
                    <td class="px-3 py-1.5 text-center font-bold text-gray-800 border-r border-gray-200 align-top pt-2">M1-M{{ mixPlanSimulation.N_identical }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-gray-900 align-top pt-2">{{ mixPlanSimulation.fardosPorMezcla * mixPlanSimulation.N_identical }}</td>
                  </tr>
                  <tr class="summary-matrix-row">
                    <td colspan="2" class="px-3 py-1.5"></td>
                  </tr>
                  <tr class="summary-matrix-row">
                    <td colspan="5" class="px-3 py-1.5 text-[10px] text-slate-500 italic bg-gray-50 border-t border-gray-300">
                       * Redondeo Inteligente orientado al Cuello de Botella ("Bottleneck-Aware Largest Remainder").
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </template>
\n        <!-- Footer -->`;

const modified = content.substring(0, startIdx) + newTemplate + content.substring(endIdx + endMarker.length);
fs.writeFileSync(filePath, modified);
console.log('Successfully patched modal');