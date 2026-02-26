<template>
  <div class="w-full h-screen flex flex-col p-1 relative" ref="containerRef">
    <!-- Overlay de carga -->
    <div v-if="cargando" class="fixed inset-0 bg-white/40 backdrop-blur-xs flex items-center justify-center z-[9999] transition-all duration-300">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="relative">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-8 w-8 bg-blue-600 rounded-full animate-pulse opacity-10"></div>
          </div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando</span>
          <span class="text-xl text-slate-800 font-bold">Partida Tejeduría</span>
        </div>
      </div>
    </div>

    <main class="w-full flex-1 min-h-0 bg-white rounded-xl shadow-sm px-4 py-3 border border-slate-200/60 flex flex-col overflow-y-auto relative">

      <!-- ── Barra superior ──────────────────────────────────────────────── -->
      <div class="flex items-center justify-between gap-4 shrink-0 mb-3 pb-3 border-b border-slate-100 flex-wrap">
        <div class="flex items-center gap-5">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-9 w-auto object-contain opacity-90" />
          <div>
            <h3 class="text-base font-semibold text-slate-800 tracking-tight">Partida en Producción – TEJEDURÍA</h3>
            <p class="text-xs text-slate-400 mt-0.5">Eficiencia, paradas y recorrido por máquinas</p>
          </div>
          <div v-if="datos?.registros" class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md ml-2">
            <span class="text-xs text-slate-500">Registros:</span>
            <span class="text-sm font-semibold text-slate-700 tabular-nums">{{ datos.registros.length }}</span>
          </div>
        </div>

        <!-- Buscador de partida -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Partida:</label>
          <input
            v-model="inputPartida"
            type="text"
            placeholder="ej. 1-5352.16 ó 1535216"
            class="px-2.5 py-1.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-slate-700 w-44"
            @keyup.enter="buscar"
          />
          <button
            @click="buscar"
            :disabled="cargando || !inputPartida.trim()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
            </svg>
            <span>Buscar</span>
          </button>
          <button
            v-if="datos"
            @click="imprimir"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition-colors border border-slate-200"
            title="Imprimir / Exportar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      <!-- ── Error ───────────────────────────────────────────────────────── -->
      <div v-if="error" class="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
        ⚠️ {{ error }}
      </div>

      <!-- ── No encontrada ───────────────────────────────────────────────── -->
      <div v-if="datos && !datos.encontrada" class="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm text-center">
        No se encontraron registros de TEJEDURÍA para la partida <strong>{{ inputPartidaBuscada }}</strong>.
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           REPORTE
      ═══════════════════════════════════════════════════════════════════════ -->
      <div v-if="datos && datos.encontrada" ref="reporteRef" class="flex flex-col gap-0">

        <!-- ── Cabecera tipo formulario ───────────────────────────────────── -->
        <div class="border border-slate-300 rounded-lg overflow-hidden shadow-sm print:rounded-none">

          <!-- Título -->
          <div class="grid grid-cols-[auto_1fr_auto_auto] items-stretch bg-white border-b border-slate-200">
            <div class="px-3 py-2 border-r border-slate-200 flex items-center">
              <img src="/LogoSantana.jpg" alt="Logo" class="h-9 w-auto object-contain opacity-90" />
            </div>
            <div class="px-4 py-2 flex items-center justify-center font-semibold text-sm text-slate-700 border-r border-slate-200">
              SANTANA TEXTIL CHACO S.A. – UNIDAD V &nbsp;·&nbsp; "EFICIENCIA Y PARADAS"
            </div>
            <div class="px-3 py-2 text-xs font-medium text-slate-500 border-r border-slate-200 flex items-center">Sector</div>
            <div class="px-3 py-2 text-xs font-medium text-slate-500 flex items-center">Partida</div>
          </div>

          <!-- Sector / Partida -->
          <div class="grid grid-cols-[auto_1fr_auto_auto] items-stretch border-b border-slate-200">
            <div class="col-span-2 px-4 py-1.5 bg-white border-r border-slate-200 text-sm text-slate-500 italic flex items-center">&nbsp;</div>
            <div class="px-4 py-1.5 font-bold text-sm bg-slate-800 text-white border-r border-slate-200 uppercase tracking-wide flex items-center">TEJEDURÍA</div>
            <div class="px-4 py-1.5 font-bold text-sm text-blue-700 flex items-center">{{ inputPartidaBuscada }}</div>
          </div>

          <!-- Artículo / Nombre / Telar -->
          <div class="grid grid-cols-[80px_1fr_80px_1fr_60px_50px] items-center border-b border-slate-200 bg-slate-50/60">
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Artículo</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800 border-r border-slate-200">{{ enc.articulo }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Nombre</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800 border-r border-slate-200">{{ enc.nombre }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Telar</div>
            <div class="px-2 py-1 text-sm font-semibold text-blue-700">{{ enc.telar }}</div>
          </div>

          <!-- Trama / Pasadas / Grupo -->
          <div class="grid grid-cols-[80px_1fr_80px_50px_60px_50px] items-center border-b border-slate-200 bg-white">
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Trama</div>
            <div class="px-2 py-1 text-sm text-slate-700 border-r border-slate-200">{{ enc.trama }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Pasadas</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800 border-r border-slate-200">{{ enc.pasadas ?? '–' }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Grupo</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800">{{ enc.grupo }}</div>
          </div>

          <!-- Base / Roturas URDIDORA / Roturas INDIGO -->
          <div class="grid grid-cols-[80px_1fr_140px_80px_140px_80px] items-center border-b border-slate-200 bg-slate-50/60">
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Base</div>
            <div class="px-2 py-1 text-sm text-slate-700 border-r border-slate-200">{{ enc.base }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Rot. Urdidora 106</div>
            <div class="px-2 py-1 text-sm font-semibold tabular-nums" :class="colorRotUrd">
              {{ enc.rot_urd_106 != null ? enc.rot_urd_106.toFixed(2).replace('.', ',') : '–' }}
            </div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200 border-l border-slate-200">Rot. Indigo 103</div>
            <div class="px-2 py-1 text-sm font-semibold tabular-nums" :class="colorRotInd">
              {{ enc.rot_ind_103 != null ? enc.rot_ind_103.toFixed(2).replace('.', ',') : '–' }}
            </div>
          </div>

          <!-- OE's / Lote -->
          <div class="grid grid-cols-[80px_1fr_60px_1fr] items-center bg-white">
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">OE's</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800 border-r border-slate-200">{{ enc.oes || '–' }}</div>
            <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200">Lote</div>
            <div class="px-2 py-1 text-sm font-semibold text-slate-800">{{ enc.lote || '–' }}</div>
          </div>
        </div>

        <!-- ── Historial de máquinas ────────────────────────────────────────── -->
        <div v-if="hist.length || calidad.length" class="mt-5" style="font-family: Verdana, Ubuntu, 'Segoe UI', sans-serif;">

          <!-- Header -->
          <div class="flex items-center gap-3 mb-2 px-1">
            <div class="flex items-center gap-2">
              <span class="w-1 h-5 rounded-full bg-slate-700 inline-block"></span>
              <span class="text-[11px] font-bold tracking-widest uppercase text-slate-700">Recorrido por Máquinas</span>
            </div>
            <span class="text-[10px] font-bold bg-slate-700 text-white rounded-md px-2 py-0.5">{{ hist.length }}</span>
            <span v-if="calidad.length" class="text-[10px] font-bold bg-emerald-600 text-white rounded-md px-2 py-0.5">+ {{ calidad.length }} Calidad</span>
          </div>

          <!-- Tabla -->
          <div class="overflow-auto rounded-lg bg-white shadow-sm border border-slate-300">
            <table class="w-full text-[11px] text-slate-700 border-separate border-spacing-0">
              <thead class="sticky top-0 z-20">
                <tr class="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider border-b-2 border-slate-300">
                  <th class="px-2 py-2 text-center border-r border-slate-200 font-semibold w-6">#</th>
                  <th class="px-3 py-2 text-left border-r border-slate-200 font-semibold whitespace-nowrap">Máquina</th>
                  <th class="px-3 py-2 text-left border-r border-slate-200 font-semibold whitespace-nowrap">Partida</th>
                  <th class="px-3 py-2 text-left border-r border-slate-200 font-semibold whitespace-nowrap">Sector</th>
                  <th class="px-3 py-2 text-center border-r border-slate-200 font-semibold whitespace-nowrap">Fecha Ini</th>
                  <th class="px-3 py-2 text-center border-r border-slate-200 font-semibold">Hora</th>
                  <th class="px-3 py-2 text-center border-r border-slate-200 font-semibold whitespace-nowrap">Fecha Fin</th>
                  <th class="px-3 py-2 text-center border-r border-slate-200 font-semibold">Hora</th>
                  <th class="px-3 py-2 text-right border-r border-slate-200 font-semibold">Metros</th>
                  <th class="px-3 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Rot 106</th>
                  <th class="px-3 py-2 text-left border-r border-slate-200 font-semibold">Artículo</th>
                  <th class="px-3 py-2 text-center border-r border-slate-200 font-semibold">Color</th>
                  <th class="px-3 py-2 text-left font-semibold">Nombre</th>
                </tr>
              </thead>
              <tbody>
                <!-- Filas tb_produccion -->
                <tr
                  v-for="(h, i) in hist"
                  :key="'h'+i"
                  class="border-b border-slate-100 transition-colors hover:bg-sky-50"
                  :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'"
                >
                  <td class="px-2 py-1.5 text-center border-r border-slate-100 text-slate-300 font-semibold">{{ i + 1 }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 font-bold text-slate-800 tracking-wide">{{ h.maquina }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-600">{{ h.partida_display || '–' }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100">
                    <span class="inline-block px-2 py-0.5 rounded-md font-semibold text-[10px] tracking-wide"
                      :class="{
                        'bg-blue-100 text-blue-700':    h.seletor === 'TECELAGEM',
                        'bg-amber-100 text-amber-700':  h.seletor === 'URDIDEIRA' || h.seletor === 'URDIDORA',
                        'bg-violet-100 text-violet-700': h.seletor === 'INDIGO',
                        'bg-slate-100 text-slate-500':  !['TECELAGEM','URDIDEIRA','URDIDORA','INDIGO'].includes(h.seletor)
                      }">{{ h.seletor }}</span>
                  </td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 whitespace-nowrap text-slate-600">{{ formatFecha(h.dt_inicio) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 font-mono text-slate-700">{{ fmtHora(h.hora_inicio) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 whitespace-nowrap text-slate-600">{{ formatFecha(h.dt_final) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 font-mono text-slate-700">{{ fmtHora(h.hora_final) }}</td>
                  <td class="px-3 py-1.5 text-right border-r border-slate-100 font-bold text-slate-800">{{ fmtNum(h.metros, 0) }}</td>
                  <td class="px-3 py-1.5 text-right border-r border-slate-100 font-mono"
                    :class="h.rot_106 != null ? (h.rot_106 <= 1 ? 'text-green-700 font-bold' : h.rot_106 <= 2 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold') : 'text-slate-300'">
                    {{ (h.seletor === 'URDIDEIRA' || h.seletor === 'URDIDORA') && h.rot_106 != null ? h.rot_106.toFixed(2).replace('.', ',') : '–' }}
                  </td>
                  <td class="px-3 py-1.5 border-r border-slate-100 text-slate-600">{{ (h.artigo || '–').substring(0, 10) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 text-slate-500">{{ h.cor || '–' }}</td>
                  <td class="px-3 py-1.5 text-slate-600">{{ h.nm_mercado || '–' }}</td>
                </tr>

                <!-- Separador CALIDAD -->
                <tr v-if="calidad.length">
                  <td colspan="12" class="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest">
                    ✓ Calidad
                  </td>
                </tr>

                <!-- Filas tb_calidad -->
                <tr
                  v-for="(c, i) in calidad"
                  :key="'c'+i"
                  class="border-b border-emerald-100 transition-colors hover:bg-emerald-50"
                  :class="i % 2 === 0 ? 'bg-emerald-50/40' : 'bg-white'"
                >
                  <td class="px-2 py-1.5 text-center border-r border-slate-100 text-slate-300 font-semibold">{{ i + 1 }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 font-semibold text-emerald-800 leading-tight" style="font-size:10px;">{{ c.revisores || '–' }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-600">{{ c.partida || '–' }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100">
                    <span class="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 tracking-wide">CALIDAD</span>
                  </td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 whitespace-nowrap text-slate-600">{{ formatFecha(c.dat_inicio) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 font-mono text-slate-700">{{ c.hora_inicio || '–' }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 whitespace-nowrap text-slate-600">{{ formatFecha(c.dat_final) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 font-mono text-slate-700">{{ c.hora_final || '–' }}</td>
                  <td class="px-3 py-1.5 text-right border-r border-slate-100 font-bold text-slate-800">{{ fmtNum(c.metros, 0) }}</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 text-slate-300">–</td>
                  <td class="px-3 py-1.5 border-r border-slate-100 text-slate-600">{{ (c.artigo || '–').substring(0, 10) }}</td>
                  <td class="px-3 py-1.5 text-center border-r border-slate-100 text-slate-500">{{ c.cor || '–' }}</td>
                  <td class="px-3 py-1.5 text-slate-600">{{ c.nm_mercado || '–' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Tabla de datos ──────────────────────────────────────────────── -->
        <div class="overflow-auto bg-white rounded-lg shadow-sm border border-slate-300 mt-5">
          <table class="w-full text-[11px] text-slate-700 border-separate border-spacing-0">
            <thead class="sticky top-0 z-20">
              <tr class="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider border-b-2 border-slate-300">
                <th class="px-2 py-2 text-center border-r border-slate-200 font-semibold whitespace-nowrap">Fecha</th>
                <th class="px-2 py-2 text-center border-r border-slate-200 font-semibold">Tur</th>
                <th class="px-2 py-2 text-center border-r border-slate-200 font-semibold">Partida</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Metros<br>Crudos</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Metros<br>Termin.</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Metros Term.<br>Acumul.</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Paradas<br>Trama</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Paradas<br>Urdimbre</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Total<br>Paradas</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Eficiencia<br>%</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Roturas<br>TRAMA 105</th>
                <th class="px-2 py-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap">Roturas<br>URDIDO 105</th>
                <th class="px-2 py-2 text-right font-semibold">RPM</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in datos.registros"
                :key="i"
                :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
                class="hover:bg-blue-50 transition-colors"
              >
                <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ formatFecha(r.fecha) }}</td>
                <td class="px-2 py-1 text-center border-r border-slate-200 font-semibold">{{ r.turno }}</td>
                <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ r.partida }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ fmtNum(r.metros_crudos, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ fmtNum(r.metros_term, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200 font-medium text-blue-700">{{ fmtNum(r.metros_term_acum, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ r.paradas_trama }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ r.paradas_urdimbre }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200 font-semibold">{{ r.total_paradas }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorEfi(r.eficiencia)">
                  {{ r.eficiencia != null ? r.eficiencia.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorRt(r.rt_105)">
                  {{ r.rt_105 != null ? r.rt_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorRt(r.ru_105)">
                  {{ r.ru_105 != null ? r.ru_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right">{{ r.rpm != null ? r.rpm : '–' }}</td>
              </tr>
            </tbody>
            <!-- Fila de totales -->
            <tfoot>
              <tr class="bg-slate-800 text-white font-semibold text-[11px]">
                <td colspan="3" class="px-2 py-1.5 text-center border-r border-slate-600 text-[10px] uppercase tracking-wider">Total / Promedio</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">{{ fmtNum(tot.metros_crudos, 0) }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">{{ fmtNum(tot.metros_term, 0) }}</td>
                <td class="px-2 py-1.5 border-r border-slate-600"></td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">{{ tot.paradas_trama }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">{{ tot.paradas_urdimbre }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">{{ tot.total_paradas }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">
                  {{ tot.eficiencia != null ? tot.eficiencia.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">
                  {{ tot.rt_105 != null ? tot.rt_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600 tabular-nums">
                  {{ tot.ru_105 != null ? tot.ru_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ tot.rpm != null ? tot.rpm : '–' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- ── Barra de info inferior ─────────────────────────────────────── -->
        <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          <span class="flex items-center gap-1">
            <span class="font-medium text-slate-600">{{ datos.registros.length }}</span> turnos registrados
          </span>
          <span v-if="enc.roladas?.length" class="flex items-center gap-1">
            Rolada(s): <strong class="text-slate-600 font-semibold">{{ enc.roladas.join(', ') }}</strong>
          </span>
        </div>
      </div>

      <!-- ── Estado inicial ─────────────────────────────────────────────── -->
      <div v-if="!datos && !cargando && !error" class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
            <path d="M8 21h8M12 17v4"></path>
          </svg>
        </div>
        <p class="text-sm font-medium text-slate-500">Ingrese un número de partida y presione <strong>Buscar</strong></p>
        <p class="text-xs text-slate-300">Ej.: 1-5352.16 ó 1535216</p>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const inputPartida       = ref('')
const inputPartidaBuscada = ref('')
const cargando           = ref(false)
const error              = ref(null)
const datos              = ref(null)

const enc = computed(() => datos.value?.encabezado || {})
const tot = computed(() => datos.value?.totales || {})
const hist    = computed(() => datos.value?.historial || [])
const calidad = computed(() => datos.value?.calidad   || [])

// Convierte "1-5352.16" → "1535216" (elimina máscara)
function normalizarPartida(raw) {
  return raw.replace(/[^a-zA-Z0-9]/g, '')
}

// ── Buscar ──────────────────────────────────────────────────────────────────
async function buscar() {
  const raw = inputPartida.value.trim()
  if (!raw) return
  const p = normalizarPartida(raw)
  cargando.value = true
  error.value = null
  datos.value = null
  inputPartidaBuscada.value = raw   // mostrar con máscara en UI
  try {
    const res = await fetch(`${API}/api/produccion/partida-tejeduria?partida=${encodeURIComponent(p)}`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || `HTTP ${res.status}`)
    }
    datos.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// ── Formateo ────────────────────────────────────────────────────────────────
function formatFecha(f) {
  if (!f) return '–'
  const d = new Date(f)
  if (isNaN(d)) return String(f).substring(0, 10)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtNum(v, dec = 1) {
  if (v == null) return '–'
  const n = parseFloat(v)
  if (isNaN(n)) return '–'
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// "13.20" → "13:20" ; "18:40:00" → "18:40"
function fmtHora(h) {
  if (!h) return '–'
  const s = String(h).trim()
  // Si el DB ya devuelve formato TIME "HH:MM:SS" o "HH:MM"
  if (s.includes(':')) return s.substring(0, 5)
  // Formato europeo "13.20" → "13:20"
  const parts = s.split('.')
  const hh = parts[0].padStart(2, '0')
  const mm = (parts[1] || '00').padEnd(2, '0').substring(0, 2)
  return `${hh}:${mm}`
}

// ── Colores condicionales ────────────────────────────────────────────────────
function colorEfi(v) {
  if (v == null) return ''
  if (v >= 90) return 'text-green-700 font-semibold'
  if (v >= 80) return 'text-amber-600 font-semibold'
  return 'text-red-600 font-semibold'
}

function colorRt(v) {
  if (v == null) return ''
  if (v <= 2)  return 'text-green-700'
  if (v <= 4)  return 'text-amber-600'
  return 'text-red-600 font-semibold'
}

const colorRotUrd = computed(() => {
  const v = enc.value.rot_urd_106
  if (v == null) return 'text-slate-800'
  if (v <= 1) return 'text-green-700 font-bold'
  if (v <= 2) return 'text-amber-600 font-bold'
  return 'text-red-600 font-bold'
})

const colorRotInd = computed(() => {
  const v = enc.value.rot_ind_103
  if (v == null) return 'text-slate-800'
  if (v <= 1) return 'text-green-700 font-bold'
  if (v <= 2) return 'text-amber-600 font-bold'
  return 'text-red-600 font-bold'
})

// ── Imprimir ─────────────────────────────────────────────────────────────────
function imprimir() {
  window.print()
}
</script>
