import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add crypto import
if (!content.includes("import crypto from 'crypto'")) {
    content = content.replace("import fs from 'fs'", "import fs from 'fs'\nimport crypto from 'crypto'");
}

// 2. Add helper functions
const helpers = `
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function buildCacheKey({ lotes, fecha, formato, modelo, dataHash, origen }) {
  return sha256(\`\${lotes}|\${fecha || ''}|\${formato || 'actual'}|\${modelo || ''}|\${dataHash}|\${origen}\`);
}

function hashRowsPayload(dataset) {
  // Extract essential fields for deterministic hash
  const norm = dataset.map(r => ({
    p: r.partida, a: r.articulo, t: r.indicadores_tejeduria?.telar_asignado, e: r.indicadores_tejeduria?.eficiencia_porcentaje,
    d: r.conteo_defectos_revisadora?.detalle_frecuencia_codigo
  }));
  return sha256(JSON.stringify(norm));
}
`;

if (!content.includes('function buildCacheKey')) {
    content = content.replace('function buildNarrativaStructuredFields', helpers + '\nfunction buildNarrativaStructuredFields');
}

// 3. Find the endpoint
const endpointStart = `app.get('/api/calidad/analisis-patrones-teje', async (req, res) => {`;
const endpointEnd = `});`; // this is risky, let's find it carefully

let startIndex = content.indexOf(endpointStart);
if (startIndex === -1) {
    console.error("Endpoint not found");
    process.exit(1);
}

// Find the IA invocation part inside the endpoint
const aiCallStart = `    // 2) Invocar la API de Gemini para análisis de patrones en cascada`;
const aiIndex = content.indexOf(aiCallStart, startIndex);

if (aiIndex === -1) {
    console.error("AI call not found");
    process.exit(1);
}

// We will inject cache checking BEFORE the AI call, right after `cleanDataForAI` mapping.
const cleanDataDef = `          defectos: r.conteo_defectos_revisadora.detalle_frecuencia_codigo
        }));`;

const cleanDataIdx = content.indexOf(cleanDataDef, aiIndex);
if (cleanDataIdx === -1) {
    console.error("cleanData mapping not found");
    process.exit(1);
}
const endOfCleanData = cleanDataIdx + cleanDataDef.length;

const cacheInjection = `

        // --- CACHE LOOKUP ---
        const origenStr = 'Tejeduría - Patrones de Defectos';
        const formatoKey = 'patrones-teje';
        const modeloKey = 'gemini-2.5-flash'; // Or whatever model is requested
        const dataHash = hashRowsPayload(cleanDataForAI);
        const cacheKey = buildCacheKey({
            lotes: 'teje_patrones',
            fecha: \`\${isoInicio}_\${isoFin}\`,
            formato: formatoKey,
            modelo: modeloKey,
            dataHash,
            origen: origenStr
        });

        try {
            const hit = await pool.query(
                'SELECT narrativa, json_analisis_ia, modelo_usado, token_info FROM tb_narrativa_cache WHERE cache_key = $1 AND origen = $2',
                [cacheKey, origenStr]
            );
            if (hit.rows.length) {
                await pool.query(
                    'UPDATE tb_narrativa_cache SET hits = hits + 1, last_hit_at = NOW() WHERE cache_key = $1 AND origen = $2',
                    [cacheKey, origenStr]
                );
                const cached = hit.rows[0];
                console.log(\`✓ Caché HIT Patrones Tejeduria fecha=\${isoInicio}_\${isoFin}\`);
                return res.json({
                    success: true,
                    narrativa: cached.narrativa,
                    fuente: 'cache',
                    modelo: cached.modelo_usado,
                    jsonAnalisisIA: cached.json_analisis_ia,
                    tokenInfo: cached.token_info || null,
                    dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2,
                    ...buildNarrativaStructuredFields(cached.narrativa),
                });
            }
        } catch (e) {
            console.warn('Cache lookup falló (continuamos):', e.message);
        }
`;

// Insert the cache lookup
content = content.substring(0, endOfCleanData) + cacheInjection + content.substring(endOfCleanData);

// Now, update the part where AI finishes and inserts to log
const generateContentCall = `const result = await genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }).generateContent(promptText);`;
const gcIdx = content.indexOf(generateContentCall, endOfCleanData);

if (gcIdx === -1) {
    console.error("generateContentCall not found");
    process.exit(1);
}

const aiResponseEnd = `const narrativa = result.response.text();`;
const resIdx = content.indexOf(aiResponseEnd, gcIdx);
if (resIdx === -1) {
    console.error("aiResponseEnd not found");
    process.exit(1);
}
const endOfResIdx = resIdx + aiResponseEnd.length;

const aiTrackingInjection = `

        // --- TRACKING & COSTOS ---
        const usage = result.response.usageMetadata || {};
        const tokensEntrada  = usage.promptTokenCount     || 0;
        const tokensSalida   = usage.candidatesTokenCount || 0;
        const tokensTotal    = usage.totalTokenCount      || (tokensEntrada + tokensSalida);
        const p = { in: 0.15, out: 0.60 }; // gemini-2.5-flash
        const costoUSD = (tokensEntrada / 1_000_000) * p.in + (tokensSalida / 1_000_000) * p.out;
        const tokenInfo = { tokensEntrada, tokensSalida, tokensTotal, costoUSD: +costoUSD.toFixed(6) };

        try {
            await pool.query(
                \`INSERT INTO tb_narrativa_cache (cache_key, lotes, fecha, formato, modelo, data_hash, narrativa, json_analisis_ia, modelo_usado, token_info, origen)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 ON CONFLICT (cache_key) DO UPDATE SET narrativa=EXCLUDED.narrativa, json_analisis_ia=EXCLUDED.json_analisis_ia, modelo_usado=EXCLUDED.modelo_usado, token_info=EXCLUDED.token_info, last_hit_at=NOW(), origen=EXCLUDED.origen\`,
                [cacheKey, 'teje_patrones', \`\${isoInicio}_\${isoFin}\`, formatoKey, modeloKey, dataHash, narrativa, dataset, modeloKey, JSON.stringify(tokenInfo), origenStr]
            );
        } catch (e) {
            console.warn('No pude guardar en cache:', e.message);
        }

        try {
            await pool.query(
                \`INSERT INTO tb_narrativa_log (lotes, fecha_corte, formato, idioma, modelo, tokens_entrada, tokens_salida, tokens_total, costo_usd, fuente, desde_cache, origen)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'gemini',FALSE,$10)\`,
                ['teje_patrones', \`\${isoInicio}_\${isoFin}\`, formatoKey, 'es', modeloKey, tokensEntrada, tokensSalida, tokensTotal, costoUSD.toFixed(6), origenStr]
            );
        } catch (e) {
            console.warn('No pude registrar en log de costos:', e.message);
        }
`;

content = content.substring(0, endOfResIdx) + aiTrackingInjection + content.substring(endOfResIdx);

// Also we need to make sure the final return includes tokenInfo!
// Original: return res.json({ success: true, narrativa, fuente: 'gemini', ...buildNarrativaStructuredFields(narrativa), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });
const returnRes = `return res.json({ success: true, narrativa, fuente: 'gemini', ...buildNarrativaStructuredFields(narrativa), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });`;
const returnResIdx = content.indexOf(returnRes, endOfResIdx);

if (returnResIdx !== -1) {
    const newReturnRes = `return res.json({ success: true, narrativa, fuente: 'gemini', tokenInfo, ...buildNarrativaStructuredFields(narrativa), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });`;
    content = content.substring(0, returnResIdx) + newReturnRes + content.substring(returnResIdx + returnRes.length);
} else {
    console.warn("Could not find the exact return statement to modify. Will try regex.");
    content = content.replace(/return res\.json\(\{ success: true, narrativa, fuente: 'gemini'(.*)\}\);/, "return res.json({ success: true, narrativa, fuente: 'gemini', tokenInfo $1});");
}

fs.writeFileSync(path, content, 'utf8');
console.log('Update successful!');
