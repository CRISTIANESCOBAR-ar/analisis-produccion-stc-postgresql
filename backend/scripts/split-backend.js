import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Rename endpoint to datos-patrones-teje
content = content.replace(
    "app.get('/api/calidad/analisis-patrones-teje', async (req, res) => {",
    "app.get('/api/calidad/datos-patrones-teje', async (req, res) => {"
);

// 2. We need to split the monolithic function.
// Let's find "// 2) Invocar la API de Gemini para análisis de patrones en cascada"
const splitStartStr = `// 2) Invocar la API de Gemini para análisis de patrones en cascada`;
const endpointEndStr = `    res.json({
      success: true,
      dataset: dataset,
      defects: defects,
      total_metros: totalMetros,
      total_area_m2: totalAreaM2,
      analisis: analisisIA
    });
  } catch (err) {
    console.error('Error en /api/calidad/analisis-patrones-teje:', err);
    res.status(500).json({ error: err.message });
  }
});`;

// Wait, the old endpoint ended with:
// return res.json({ success: true, narrativa: analisisIA, fuente: 'gemini', tokenInfo: req.tokenInfoForAI || null, ...buildNarrativaStructuredFields(analisisIA), dataset, defects, total_metros: totalMetros, total_area_m2: totalAreaM2 });
// Let's find exactly what's there.
const aiPartIndex = content.indexOf(splitStartStr);
if (aiPartIndex === -1) {
    console.error("AI part not found");
    process.exit(1);
}

// In the current file, at line 8737 it says:
// res.json({
//   success: true,
//   dataset: dataset,
//   defects: defects,
//   total_metros: totalMetros,
//   total_area_m2: totalAreaM2,
//   analisis: analisisIA
// });
// Oh wait! In my previous apply-cache.js script, I replaced the return statement, but the old fallback return statement `return res.json(...)` was at the very end of the cache block? No, I see at line 8737 the original `res.json({...})` is still there!

const splitEndIndex = content.indexOf('});', content.indexOf('res.status(500).json({ error: err.message });', aiPartIndex)) + 3;

const aiPartText = content.substring(aiPartIndex, splitEndIndex);

// Reconstruct the new GET endpoint end
const newGetEnd = `
    return res.json({
      success: true,
      dataset,
      defects,
      total_metros: totalMetros,
      total_area_m2: totalAreaM2
    });
  } catch (err) {
    console.error('Error en /api/calidad/datos-patrones-teje:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

// Reconstruct the new POST endpoint
const newPostEndpoint = `
app.post('/api/calidad/ia-patrones-teje', async (req, res) => {
  try {
    const { dataset, defects, totalMetros, totalAreaM2, fechaInicio, fechaFin } = req.body;
    
    if (!dataset || !defects || !fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para el análisis de IA.' });
    }

    const isoInicio = fechaInicio;
    const isoFin = fechaFin;

    // 2) Invocar la API de Gemini para análisis de patrones en cascada
    let analisisIA = 'El motor de diagnóstico de IA de Gemini se encuentra temporalmente desactivado durante la fase de alineación de datos de PostgreSQL.';
    if (process.env.GOOGLE_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        
        // Reducimos el payload para la IA para no saturar los límites de tokens
        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.articulo,
          maquina: r.indicadores_tejeduria?.telar_asignado,
          eficiencia: r.indicadores_tejeduria?.eficiencia_porcentaje,
          metros: r.indicadores_tejeduria?.metros_primeira,
          pts_100m2: r.conteo_defectos_revisadora?.pts_por_100m2,
          defectos: r.conteo_defectos_revisadora?.detalle_frecuencia_codigo
        }));

        const cleanDefectsForAI = defects.slice(0, 10);

        const prompt = \`Actúa como un Auditor e Ingeniero de Control de Calidad Textil experto. Analiza los siguientes conjuntos de datos del periodo seleccionado:

1. RESUMEN GLOBAL DE DEFECTOS DEL PERIODO (Total metros producidos: \${Number(totalMetros).toFixed(1)}m):
\${JSON.stringify(cleanDefectsForAI)}

2. DETALLE DE PARTIDAS CRÍTICAS (Las de peor desempeño):
\${JSON.stringify(cleanDataForAI)}

Tu objetivo es encontrar patrones de correlación clave que causan puntuaciones altas de Pts/100m² en el sector TEJE (defectos código 3xx, ej: paradas de telar 333, tramas 340, 382, 387) y proponer soluciones.

Por favor analiza los datos y genera una respuesta estructurada estrictamente en Markdown adecuada para un Jefe de Tejeduría (Supervisor):
1. **Vector Crítico Principal**: Identifica si los defectos se concentran en artículos específicos, telares específicos o correlaciones de eficiencia.
2. **Correlación Matemática de Culpabilidad**: Cuantifica qué códigos y sectores representan los peores pesos de defectos.
3. **Directiva de Acción de Planta**: Da instrucciones operativas claras y prácticas para el supervisor de planta.

IMPORTANTE: Sé directo, profesional, usa terminología textil y no uses formatos complejos.\`;

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
                    tokenInfo: cached.token_info || null,
                    ...buildNarrativaStructuredFields(cached.narrativa)
                });
            }
        } catch (e) { console.warn('Cache check fail:', e.message); }

        const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastErr = null;
        for (const modelName of FALLBACK_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            analisisIA = response.text();

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
            
            req.tokenInfoForAI = tokenInfo;
            req.modeloUsado = modelName;

            if (analisisIA) break;
          } catch (err) {
            lastErr = err.message;
            console.warn(\`Gemini [\${modelName}] falló en análisis de patrones:\`, err.message);
          }
        }

        if (!analisisIA) {
          analisisIA = \`Análisis de IA no disponible por cuotas o error en el servicio: \${lastErr}.
          
**Resumen Analítico Local (Reglas de Negocio):**
* Defecto principal: **Código \${defects[0]?.cod_def || '—'} - \${defects[0]?.desc_defeito || '—'}** con **\${defects[0]?.pts_100m2 || '—'} Pts/100m²** (\${defects[0]?.porcentaje || '—'}%).
* Partida más crítica: **Partida \${dataset[0]?.partida}** (Artigo: \${dataset[0]?.articulo}, Telar: \${dataset[0]?.indicadores_tejeduria?.telar_asignado}) con **\${dataset[0]?.conteo_defectos_revisadora?.pts_por_100m2} Pts/100m²**.\`;
        }
      } catch (aiErr) {
        console.error('Error general de IA en patrones:', aiErr);
        analisisIA = 'Error al invocar el servicio de inteligencia artificial de Gemini.';
      }
    } else {
      analisisIA = '**Servicio de IA desactivado (Falta GOOGLE_API_KEY en configuración).**';
    }

    return res.json({
      success: true,
      narrativa: analisisIA,
      fuente: 'gemini',
      tokenInfo: req.tokenInfoForAI || null,
      modelo: req.modeloUsado || 'gemini-2.5-flash',
      ...buildNarrativaStructuredFields(analisisIA)
    });
  } catch (err) {
    console.error('Error en /api/calidad/ia-patrones-teje:', err);
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.replace(aiPartText, newGetEnd + newPostEndpoint);
fs.writeFileSync(path, content, 'utf8');
console.log("Split successfully!");
