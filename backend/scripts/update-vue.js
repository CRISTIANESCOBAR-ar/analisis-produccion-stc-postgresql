import fs from 'fs';

const path = 'c:/stc-produccion-v2/frontend/src/components/produccion/AnalisisPatronesTeje.vue';
let content = fs.readFileSync(path, 'utf8');

// 1. Update HTML
const oldHtml = `            <!-- Datos analizados -->
            <div v-else-if="analisis" class="markdown-container text-xs text-slate-700 leading-relaxed font-sans pb-2" v-html="mdToHtml(analisis)"></div>`;

const newHtml = `            <!-- Datos analizados -->
            <div v-else-if="analisis" class="flex flex-col gap-3 pb-2">
              <div v-if="tokenInfo" class="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-[10px]">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Fuente:</span>
                  <span class="px-2 py-0.5 rounded-full font-bold" :class="fuente === 'cache' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'">
                    {{ fuente === 'cache' ? 'Caché (Instantáneo)' : 'Gemini AI' }}
                  </span>
                </div>
                <div class="h-3 w-px bg-slate-200"></div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Tokens:</span>
                  <span class="font-bold text-slate-700">{{ tokenInfo.tokensTotal.toLocaleString('es-AR') }}</span>
                </div>
                <div class="h-3 w-px bg-slate-200"></div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Costo:</span>
                  <span class="font-bold" :class="tokenInfo.costoUSD < 0.001 ? 'text-emerald-600' : 'text-amber-600'">
                    U$S {{ tokenInfo.costoUSD < 0.0001 ? '< 0.0001' : tokenInfo.costoUSD.toFixed(4) }}
                  </span>
                </div>
              </div>
              <div class="markdown-container text-xs text-slate-700 leading-relaxed font-sans" v-html="mdToHtml(analisis)"></div>
            </div>`;

if(content.includes(oldHtml)) {
    content = content.replace(oldHtml, newHtml);
} else {
    console.warn("Could not find old HTML to replace");
}

// 2. Add refs
const oldRefs = `const error = ref(null)`;
const newRefs = `const error = ref(null)\nconst tokenInfo = ref(null)\nconst fuente = ref('')\nconst modelo = ref('')`;
if(content.includes(oldRefs)) {
    content = content.replace(oldRefs, newRefs);
}

// 3. Update execution assignment
const oldAssign = `      analisis.value = data.analisis || ''
    } else {`;
const newAssign = `      analisis.value = data.narrativa || data.analisis || ''
      tokenInfo.value = data.tokenInfo || null
      fuente.value = data.fuente || ''
      modelo.value = data.modelo || ''
    } else {`;

if(content.includes(oldAssign)) {
    content = content.replace(oldAssign, newAssign);
}

fs.writeFileSync(path, content, 'utf8');
console.log("Updated frontend successfully!");
