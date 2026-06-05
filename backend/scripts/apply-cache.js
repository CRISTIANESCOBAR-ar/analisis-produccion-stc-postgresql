import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add crypto import
if (!content.includes("import crypto from 'crypto'")) {
    content = content.replace("import fs from 'fs'", "import fs from 'fs'\nimport crypto from 'crypto'");
}

// 2. Add helpers
const helpers = `
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function buildCacheKey({ lotes, fecha, formato, modelo, dataHash, origen }) {
  return sha256(\`\${lotes}|\${fecha || ''}|\${formato || 'actual'}|\${modelo || ''}|\${dataHash}|\${origen}\`);
}

function hashRowsPayload(dataset) {
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

// 3. Update cleanDataForAI and if (false && ...)
content = content.replace('if (false && process.env.GOOGLE_API_KEY)', 'if (process.env.GOOGLE_API_KEY)');

const oldCleanData = `        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.artigo,
          maquina: r.maquina,
          eficiencia: r.eficiencia,
          metros: r.metros_revisados,
          pts_100m2: r.pts_100m2,
          cod_def: r.cod_def,
          defecto: r.desc_defeito,
          puntos_defecto: r.puntos_defecto
        }));`;

const newCleanData = `        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.articulo,
          maquina: r.indicadores_tejeduria?.telar_asignado,
          eficiencia: r.indicadores_tejeduria?.eficiencia_porcentaje,
          metros: r.indicadores_tejeduria?.metros_primeira,
          pts_100m2: r.conteo_defectos_revisadora?.pts_por_100m2,
          defectos: r.conteo_defectos_revisadora?.detalle_frecuencia_codigo
        }));`;

content = content.replace(oldCleanData, newCleanData);

// 4. Update the fallback logic
const oldFallback = `* Partida más crítica: **Partida \${dataset[0].partida}** (Artigo: \${dataset[0].artigo}, Telar: \${dataset[0].maquina}) con **\${dataset[0].pts_100m2} Pts/100m²**.`;
const newFallback = `* Partida más crítica: **Partida \${dataset[0]?.partida}** (Artigo: \${dataset[0]?.articulo}, Telar: \${dataset[0]?.indicadores_tejeduria?.telar_asignado}) con **\${dataset[0]?.conteo_defectos_revisadora?.pts_por_100m2} Pts/100m²**.`;
content = content.replace(oldFallback, newFallback);

// 5. Inject Cache BEFORE API call
const promptGenStart = `        const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];`;

const cacheCheck = `
        const origenStr = 'Tejeduría - Patrones de Defectos';
        const formatoKey = 'patrones-teje';
        const modeloKey = 'gemini-2.5-flash';
        const dataHash = hashRowsPayload(cleanDataForAI);
        const cacheKey = buildCacheKey({ lotes: 'teje_patrones', fecha: \`\${isoInicio}_\${isoFin}\`, formato: formatoKey, modelo: modeloKey, dataHash, origen: origenStr });

        try {
            const hit = await pool.query('SELECT narrativa, json_analisis_ia, modelo_usado, token_info FROM tb_narrativa_cache WHERE cache_key = $1 AND origen = $2', [cacheKey, origenStr]);
            if (hit.rows.length) {
                await pool.query('UPDATE tb_narrativa_cache SET hits = hits + 1, last_hit_at = NOW() WHERE cache_key = $1 AND origen = $2', [cacheKey, origenStr]);
                const cached = hit.rows[0];
                return res.json({
                    success: true, narrativa: cached.narrativa, fuente: 'cache', modelo: cached.modelo_usado,
                    jsonAnalisisIA: cached.json_analisis_ia, tokenInfo: cached.token_info || null,
                    dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2,
                    ...buildNarrativaStructuredFields(cached.narrativa),
                });
            }
        } catch (e) { console.warn('Cache check fail:', e.message); }

        const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];`;

content = content.replace(promptGenStart, cacheCheck);

// 6. Inject tracking AFTER API call
const responseTextEnd = `analisisIA = response.text();`;
const trackingLogic = `analisisIA = response.text();

            // TRACKING
            const usage = result.response.usageMetadata || {};
            const tokensEntrada = usage.promptTokenCount || 0;
            const tokensSalida = usage.candidatesTokenCount || 0;
            const tokensTotal = usage.totalTokenCount || (tokensEntrada + tokensSalida);
            const p = { in: 0.15, out: 0.60 };
            const costoUSD = (tokensEntrada / 1_000_000) * p.in + (tokensSalida / 1_000_000) * p.out;
            const tokenInfo = { tokensEntrada, tokensSalida, tokensTotal, costoUSD: +costoUSD.toFixed(6) };

            try {
                await pool.query(
                    \`INSERT INTO tb_narrativa_cache (cache_key, lotes, fecha, formato, modelo, data_hash, narrativa, json_analisis_ia, modelo_usado, token_info, origen)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (cache_key) DO UPDATE SET narrativa=EXCLUDED.narrativa, json_analisis_ia=EXCLUDED.json_analisis_ia, modelo_usado=EXCLUDED.modelo_usado, token_info=EXCLUDED.token_info, last_hit_at=NOW(), origen=EXCLUDED.origen\`,
                    [cacheKey, 'teje_patrones', \`\${isoInicio}_\${isoFin}\`, formatoKey, modeloKey, dataHash, analisisIA, dataset, modelName, JSON.stringify(tokenInfo), origenStr]
                );
                await pool.query(
                    \`INSERT INTO tb_narrativa_log (lotes, fecha_corte, formato, idioma, modelo, tokens_entrada, tokens_salida, tokens_total, costo_usd, fuente, desde_cache, origen)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'gemini',FALSE,$10)\`,
                    ['teje_patrones', \`\${isoInicio}_\${isoFin}\`, formatoKey, 'es', modelName, tokensEntrada, tokensSalida, tokensTotal, costoUSD.toFixed(6), origenStr]
                );
            } catch (e) { console.warn('Cache/Log insert error:', e.message); }
            
            // Assign tokenInfo to a higher scope so it can be returned
            req.tokenInfoForAI = tokenInfo;
`;

content = content.replace(responseTextEnd, trackingLogic);

// 7. Update return
const oldReturn = `return res.json({ success: true, narrativa: analisisIA, fuente: 'gemini', ...buildNarrativaStructuredFields(analisisIA), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });`;
const newReturn = `return res.json({ success: true, narrativa: analisisIA, fuente: 'gemini', tokenInfo: req.tokenInfoForAI || null, ...buildNarrativaStructuredFields(analisisIA), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });`;

content = content.replace(oldReturn, newReturn);

fs.writeFileSync(path, content, 'utf8');
console.log("Success apply cache");
