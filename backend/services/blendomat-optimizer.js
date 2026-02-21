/**
 * BlendomatOptimizer - Motor de cálculo de mezclas de algodón
 * 
 * Este servicio recibe el stock disponible, las reglas de mezcla activas,
 * las variables seleccionadas por el usuario y el tamaño de la mezcla (fardos).
 * 
 * Devuelve un plan de mezclas optimizado (Round Robin) y un reporte de lotes no usados.
 */

export function optimizeBlend(stock, rules, supervisionSettings, blendSize) {
    if (!blendSize || blendSize <= 0) {
        throw new Error("El tamaño de la mezcla (fardos) debe ser mayor a 0.");
    }
    if (!stock || stock.length === 0) {
        throw new Error("No hay stock disponible para procesar.");
    }

    // 1. PRE-PROCESAMIENTO: Clasificación de Fardos
    const classifiedStock = [];
    const rejectedStock = []; // Lotes que violan Hard Caps (Categoría C)

    // Mapeo de nombres de variables (UI/DB -> Reglas)
    const mapVarToRule = (v) => {
        if (v === 'UHML') return 'LEN';
        if (v === 'PLUS_B') return '+b';
        return v;
    };

    // Filtrar solo las reglas que el usuario seleccionó en supervisionSettings
    const activeRules = rules.filter(r => {
        const uiKey = r.parametro === 'LEN' ? 'UHML' : (r.parametro === '+b' ? 'PLUS_B' : r.parametro);
        const s = supervisionSettings[uiKey];
        return s && (s.target || s.hardCap || s.tolerance);
    });

    for (const bale of stock) {
        let isRejected = false;
        let rejectReason = '';
        let isTolerance = false;
        const toleranceReasons = [];

        // Evaluar cada regla activa
        for (const rule of activeRules) {
            const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
            const settings = supervisionSettings[uiKey];
            if (!settings) continue;

            const val = Number(bale[uiKey]);
            if (isNaN(val)) continue;

            // A. Chequeo de Hard Caps (Categoría C)
            if (settings.hardCap) {
                const hasMaxAbs = rule.limite_max_absoluto !== null && rule.limite_max_absoluto !== '';
                const hasMinAbs = rule.limite_min_absoluto !== null && rule.limite_min_absoluto !== '';
                
                const maxAbs = Number(rule.limite_max_absoluto);
                const minAbs = Number(rule.limite_min_absoluto);

                if (hasMaxAbs && !isNaN(maxAbs) && val > maxAbs) {
                    isRejected = true;
                    rejectReason = `${rule.parametro} Crítica: Por encima del máximo de ${maxAbs}.`;
                    break;
                }
                if (hasMinAbs && !isNaN(minAbs) && val < minAbs) {
                    isRejected = true;
                    rejectReason = `${rule.parametro} Crítica: Por debajo del mínimo de ${minAbs}.`;
                    break;
                }
            }

            // B. Chequeo de Tolerancia (Categoría B)
            // Solo se marca como tolerancia si el usuario activó la supervisión de tolerancia
            // y el valor cae dentro del rango.
            if (settings.tolerance) {
                const hasTolMin = rule.rango_tol_min !== null && rule.rango_tol_min !== '';
                const hasTolMax = rule.rango_tol_max !== null && rule.rango_tol_max !== '';
                const tolMin = Number(rule.rango_tol_min);
                const tolMax = Number(rule.rango_tol_max);

                if (hasTolMin && hasTolMax && !isNaN(tolMin) && !isNaN(tolMax)) {
                    if (val >= tolMin && val <= tolMax) {
                        isTolerance = true;
                        toleranceReasons.push(rule.parametro);
                    }
                }
            }
            
            // Nota: Si no cumple Hard Cap (o no está activo) y no entra en Tolerancia (o no está activo),
            // el fardo se considera Categoría A (Normal/Ideal) y puede usarse libremente.
            // Ya no rechazamos fardos implícitamente por no cumplir el ideal o la tolerancia.
        }

        // Clonar el fardo para no mutar el original y añadir metadatos
        const processedBale = { 
            ...bale, 
            _category: isRejected ? 'C' : (isTolerance ? 'B' : 'A'),
            _rejectReason: rejectReason,
            _toleranceReasons: toleranceReasons,
            _usedCount: 0,
            _availableCount: Number(bale.QTDE_ESTOQUE) || 0
        };

        if (isRejected) {
            rejectedStock.push(processedBale);
        } else if (processedBale._availableCount > 0) {
            classifiedStock.push(processedBale);
        }
    }

    // 2. BLENDING (Estrategia de Reemplazo de Lote Completo)
    const blends = [];
    let blendIndex = 1;

    // Helper: Calcular promedio de un parámetro en una receta
    const calculateRecipeAverage = (recipe, paramKey) => {
        let totalVal = 0;
        let totalCount = 0;
        recipe.forEach(b => {
            const val = Number(b[paramKey]);
            if (!isNaN(val)) {
                totalVal += val;
                totalCount++;
            }
        });
        return totalCount > 0 ? totalVal / totalCount : 0;
    };

    // Función auxiliar para verificar si podemos añadir un fardo Categoría B a la receta actual
    const canAddToleranceBaleToRecipe = (bale, currentRecipeArr) => {
        if (bale._category === 'A') return true; // Siempre podemos añadir A

        // Si es B, verificar restricciones de dispersión para cada regla que incumple
        for (const param of bale._toleranceReasons) {
            const rule = activeRules.find(r => r.parametro === param);
            if (!rule) continue;

            const minIdealPct = Number(rule.porcentaje_min_ideal) || 100;
            const maxTolerancePct = 100 - minIdealPct; // Ej. 100 - 80 = 20%
            const maxToleranceCount = Math.floor(blendSize * (maxTolerancePct / 100));

            // Contar cuántos fardos en la receta actual ya están en tolerancia para este parámetro
            const currentToleranceCount = currentRecipeArr.filter(b => b._category === 'B' && b._toleranceReasons.includes(param)).length;

            if (currentToleranceCount >= maxToleranceCount) {
                return false; // Límite alcanzado para este parámetro
            }
        }
        return true;
    };

    // Función para construir una receta desde cero (Round Robin priorizando lotes ancla)
    const buildRecipe = () => {
        let availableLots = classifiedStock.filter(b => b._availableCount > 0);
        if (availableLots.length === 0) return null;
        
        // Prioridad de Lotes 'Ancla': Ordenar por stock disponible descendente
        availableLots.sort((a, b) => b._availableCount - a._availableCount);

        let recipe = [];
        let lotIndex = 0;
        let attempts = 0;
        let tempCounts = new Map(); // Para no exceder el stock disponible durante la creación

        while (recipe.length < blendSize && attempts < availableLots.length) {
            const lot = availableLots[lotIndex];
            const usedInRecipe = tempCounts.get(lot) || 0;

            if (usedInRecipe < lot._availableCount) {
                if (lot._category === 'A' || (lot._category === 'B' && canAddToleranceBaleToRecipe(lot, recipe))) {
                    recipe.push({ ...lot });
                    tempCounts.set(lot, usedInRecipe + 1);
                    attempts = 0;
                    lotIndex = (lotIndex + 1) % availableLots.length;
                    continue;
                }
            }
            attempts++;
            lotIndex = (lotIndex + 1) % availableLots.length;
        }

        // OPTIMIZACIÓN DE PROMEDIOS (NUEVO)
        if (recipe.length === blendSize) {
            let improvementMade = true;
            let iterations = 0;
            const maxIterations = blendSize * 2; // Evitar bucles infinitos

            while (improvementMade && iterations < maxIterations) {
                improvementMade = false;
                iterations++;

                // Verificar cada regla activa para promedios
                for (const rule of activeRules) {
                    const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
                    
                    // Obtener objetivos de promedio
                    // Usamos valor_ideal_min como Objetivo Mínimo Promedio (según UI "Promedio Objetivo")
                    const targetMin = Number(rule.valor_ideal_min); 
                    const targetMax = Number(rule.promedio_objetivo_max); // Nuevo campo en DB

                    const currentAvg = calculateRecipeAverage(recipe, uiKey);

                    // Casos donde el promedio falla
                    const failMin = !isNaN(targetMin) && currentAvg < targetMin;
                    const failMax = !isNaN(targetMax) && currentAvg > targetMax;

                    if (failMin || failMax) {
                        // Buscar el "peor" fardo en la receta para reemplazar
                        // Si falla min, buscamos el valor más bajo. Si falla max, el más alto.
                        let worstBaleIndex = -1;
                        let worstValue = failMin ? Infinity : -Infinity;

                        recipe.forEach((b, idx) => {
                            const val = Number(b[uiKey]);
                            if (failMin && val < worstValue) {
                                worstValue = val;
                                worstBaleIndex = idx;
                            } else if (failMax && val > worstValue) {
                                worstValue = val;
                                worstBaleIndex = idx;
                            }
                        });

                        if (worstBaleIndex === -1) continue;

                        // Buscar un mejor candidato en el stock disponible (que no esté en receta actual?? No, usamos tempCounts para trackear uso interno)
                        // IMPORTANTE: availableLots contiene todos los lotes con _availableCount global > 0.
                        // Pero dentro de buildRecipe estamos simulando consumo con tempCounts.
                        
                        // Candidatos: Lotes con stock disponible (tempCounts < _availableCount)
                        // Y que mejoren el promedio (val > worstValue si failMin, val < worstValue si failMax)
                        const candidates = availableLots.filter(l => {
                            const used = tempCounts.get(l) || 0;
                            if (used >= l._availableCount) return false; // Sin stock

                            // Verificar reglas de tolerancia si es B
                            // Nota: Al reemplazar, la receta cambia, así que habría que re-verificar dispersion.
                            // Simplificación: Solo permitimos si cumple canAddTolerance (considerando que sacamos uno).
                            // Pero canAddTolerance usa la receta actual. Si sacamos uno, la cuenta baja.
                            
                            const val = Number(l[uiKey]);
                            if (failMin && val <= worstValue) return false; // No mejora
                            if (failMax && val >= worstValue) return false; // No mejora

                            return true;
                        });

                        // Ordenar candidatos por "mejor impacto" (mayor diferencia)
                        candidates.sort((a, b) => {
                            const valA = Number(a[uiKey]);
                            const valB = Number(b[uiKey]);
                            if (failMin) return valB - valA; // Mayor es mejor
                            return valA - valB; // Menor es mejor
                        });

                        // Intentar swap
                        for (const candidate of candidates) {
                            // Validar compatibilidad completa (Tolerancia en otras reglas)
                            // Clonamos receta temporalmente sin el worstBale
                            const tempRecipe = [...recipe];
                            tempRecipe.splice(worstBaleIndex, 1);

                            if (candidate._category === 'A' || canAddToleranceBaleToRecipe(candidate, tempRecipe)) {
                                // Realizar Swap
                                const oldBale = recipe[worstBaleIndex];
                                
                                // Actualizar contadores
                                tempCounts.set(oldBale, tempCounts.get(oldBale) - 1);
                                tempCounts.set(candidate, (tempCounts.get(candidate) || 0) + 1);

                                // Actualizar receta
                                recipe[worstBaleIndex] = { ...candidate };
                                improvementMade = true;
                                break; // Salir al siguiente loop de mejora
                            }
                        }
                    }
                    if (improvementMade) break; // Reiniciar chequeo de reglas desde 0
                }
            }
        }

        return recipe.length === blendSize ? recipe : null;
    };

    let currentRecipe = buildRecipe();

    while (currentRecipe) {
        // Contar cuántos fardos de cada lote hay en la receta actual
        const recipeCounts = new Map();
        currentRecipe.forEach(f => {
            // Usar una clave única para identificar el lote original
            const origLot = classifiedStock.find(l => l.LOTE === f.LOTE && l.PRODUTOR === f.PRODUTOR);
            recipeCounts.set(origLot, (recipeCounts.get(origLot) || 0) + 1);
        });

        // Calcular cuántas veces podemos repetir esta receta exacta
        let maxRepeats = Infinity;
        let depletedLots = [];

        for (const [lot, countInRecipe] of recipeCounts.entries()) {
            const possibleRepeats = Math.floor(lot._availableCount / countInRecipe);
            if (possibleRepeats < maxRepeats) {
                maxRepeats = possibleRepeats;
                depletedLots = [lot];
            } else if (possibleRepeats === maxRepeats) {
                depletedLots.push(lot);
            }
        }

        if (maxRepeats === 0 || maxRepeats === Infinity) break;

        // Generar las mezclas idénticas
        for (let i = 0; i < maxRepeats; i++) {
            blends.push({
                index: blendIndex++,
                fardos: currentRecipe.map(b => ({ ...b }))
            });
        }

        // Descontar el stock utilizado
        for (const [lot, countInRecipe] of recipeCounts.entries()) {
            const totalUsed = countInRecipe * maxRepeats;
            lot._availableCount -= totalUsed;
            lot._usedCount += totalUsed;
        }

        // Lógica de Agotamiento (Swap): Reemplazar lotes agotados
        let swapSuccessful = true;
        let nextRecipe = currentRecipe.map(b => ({ ...b })); // Clonar para modificar

        for (const depletedLot of depletedLots) {
            const neededCount = recipeCounts.get(depletedLot);
            
            // Buscar candidatos para reemplazo (mismo categoría, con stock suficiente, no en la receta actual)
            let candidates = classifiedStock.filter(l => 
                l._availableCount >= neededCount && 
                l._category === depletedLot._category &&
                !recipeCounts.has(l)
            );
            
            // Ordenar candidatos por stock (priorizar nuevos anclas)
            candidates.sort((a, b) => b._availableCount - a._availableCount);

            let replacement = null;
            for (const candidate of candidates) {
                // Verificar si el candidato cumple las reglas si es B
                let testRecipe = nextRecipe.filter(f => f.LOTE !== depletedLot.LOTE || f.PRODUTOR !== depletedLot.PRODUTOR);
                let isValid = true;
                if (candidate._category === 'B') {
                    for(let i=0; i<neededCount; i++) {
                        if (!canAddToleranceBaleToRecipe(candidate, testRecipe)) {
                            isValid = false;
                            break;
                        }
                        testRecipe.push({...candidate});
                    }
                }
                if (isValid) {
                    replacement = candidate;
                    break;
                }
            }

            if (replacement) {
                // Realizar el Swap en nextRecipe
                let replacedCount = 0;
                for (let i = 0; i < nextRecipe.length; i++) {
                    if (nextRecipe[i].LOTE === depletedLot.LOTE && nextRecipe[i].PRODUTOR === depletedLot.PRODUTOR) {
                        nextRecipe[i] = { ...replacement };
                        replacedCount++;
                        if (replacedCount === neededCount) break;
                    }
                }
                // Actualizar recipeCounts para el siguiente depletedLot en este mismo ciclo
                recipeCounts.delete(depletedLot);
                recipeCounts.set(replacement, neededCount);
            } else {
                // Si no encontramos un reemplazo 1:1 directo, fallamos el swap
                swapSuccessful = false;
                break;
            }
        }

        if (swapSuccessful) {
            currentRecipe = nextRecipe;
        } else {
            // Si no se pudo hacer swap (ej. no hay un lote con suficientes fardos), 
            // recalculamos una nueva receta desde cero con el stock restante.
            currentRecipe = buildRecipe();
        }
    }

    // 2.5 AGRUPACIÓN POR ESTABILIDAD DE RECETA
    // Agrupar mezclas consecutivas que sean exactamente iguales
    const getBlendSignature = (blendFardos) => {
        const counts = {};
        blendFardos.forEach(f => {
            const key = `${f.PRODUTOR}_${f.LOTE}`;
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.keys(counts).sort().map(k => `${k}:${counts[k]}`).join('|');
    };

    const groupedBlends = [];
    if (blends.length > 0) {
        let currentGroup = {
            start: blends[0].index,
            end: blends[0].index,
            signature: getBlendSignature(blends[0].fardos),
            fardos: blends[0].fardos
        };

        for (let i = 1; i < blends.length; i++) {
            const blend = blends[i];
            const signature = getBlendSignature(blend.fardos);
            
            if (signature === currentGroup.signature) {
                currentGroup.end = blend.index;
            } else {
                groupedBlends.push({
                    id: currentGroup.start === currentGroup.end ? `M${currentGroup.start}` : `M${currentGroup.start}-M${currentGroup.end}`,
                    fardos: currentGroup.fardos
                });
                currentGroup = {
                    start: blend.index,
                    end: blend.index,
                    signature: signature,
                    fardos: blend.fardos
                };
            }
        }
        groupedBlends.push({
            id: currentGroup.start === currentGroup.end ? `M${currentGroup.start}` : `M${currentGroup.start}-M${currentGroup.end}`,
            fardos: currentGroup.fardos
        });
    }

    // 3. OUTPUT: Generar Reporte de Remanentes
    const unusedStock = [];
    
    // Añadir los rechazados por Hard Cap
    rejectedStock.forEach(b => {
        unusedStock.push({
            PRODUTOR: b.PRODUTOR,
            LOTE: b.LOTE,
            MIC: b.MIC,
            STR: b.STR,
            LEN: b.UHML || b.LEN,
            Fardos: Number(b.QTDE_ESTOQUE),
            Peso: Number(b.PESO),
            Motivo: b._rejectReason
        });
    });

    // Añadir los remanentes (Categoría A o B que sobraron)
    classifiedStock.forEach(b => {
        if (b._availableCount > 0) {
            // Calcular peso proporcional sobrante
            const pesoUnitario = Number(b.PESO) / (Number(b.QTDE_ESTOQUE) || 1);
            const pesoSobrante = pesoUnitario * b._availableCount;

            let motivo = 'Sobrante de stock.';
            if (b._category === 'B') {
                motivo = 'Agotamiento de fibra de soporte (Límite de dispersión alcanzado).';
            }

            unusedStock.push({
                PRODUTOR: b.PRODUTOR,
                LOTE: b.LOTE,
                MIC: b.MIC,
                STR: b.STR,
                LEN: b.UHML || b.LEN,
                Fardos: b._availableCount,
                Peso: pesoSobrante,
                Motivo: motivo
            });
        }
    });

    // 4. OUTPUT: Formatear Plan de Mezclas para la UI
    // Agrupar por Lote para mostrar filas consolidadas
    const planRows = {};
    
    groupedBlends.forEach((blend, bIndex) => {
        const blendId = blend.id;
        
        // Contar fardos por lote en esta mezcla
        const loteCounts = {};
        blend.fardos.forEach(f => {
            const key = `${f.PRODUTOR}_${f.LOTE}`;
            if (!loteCounts[key]) loteCounts[key] = { count: 0, ref: f };
            loteCounts[key].count++;
        });

        // Añadir a las filas del plan
        Object.values(loteCounts).forEach(({ count, ref }) => {
            const key = `${ref.PRODUTOR}_${ref.LOTE}`;
            if (!planRows[key]) {
                planRows[key] = {
                    PRODUTOR: ref.PRODUTOR,
                    Estado: ref._category === 'A' ? 'USO' : 'TOLER.',
                    LOTE: ref.LOTE,
                    MIC: ref.MIC,
                    STR: ref.STR,
                    LEN: ref.UHML || ref.LEN,
                    mezclas: {}
                };
            }
            planRows[key].mezclas[blendId] = count;
        });
    });

    return {
        success: true,
        plan: Object.values(planRows),
        columnasMezcla: groupedBlends.map(b => b.id),
        remanentes: unusedStock,
        estadisticas: calcularEstadisticas(groupedBlends, activeRules)
    };
}

// Función auxiliar para calcular el pie de tabla
function calcularEstadisticas(blends, activeRules) {
    const stats = {};
    
    blends.forEach(blend => {
        const bId = blend.id;
        const fardos = blend.fardos;
        const totalFardos = fardos.length;
        const pesoTotal = fardos.reduce((sum, f) => sum + (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1)), 0);
        
        stats[bId] = {
            totalFardos,
            pesoTotal,
            pesoPromedio: pesoTotal / totalFardos,
            variables: {}
        };

        // Calcular promedios para variables clave (MIC, STR, LEN)
        ['MIC', 'STR', 'UHML'].forEach(vKey => {
            const ruleParam = vKey === 'UHML' ? 'LEN' : vKey;
            const rule = activeRules.find(r => r.parametro === ruleParam);
            
            // Promedio general ponderado por peso
            const sumPonderada = fardos.reduce((s, f) => s + ((Number(f[vKey]) || 0) * (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1))), 0);
            const prom = pesoTotal > 0 ? sumPonderada / pesoTotal : 0;
            
            stats[bId].variables[ruleParam] = {
                promedioGeneral: prom
            };

            // Si hay regla, calcular desglose 90/10
            if (rule) {
                const fardosA = fardos.filter(f => f._category === 'A' || !f._toleranceReasons.includes(ruleParam));
                const fardosB = fardos.filter(f => f._category === 'B' && f._toleranceReasons.includes(ruleParam));
                
                // Calcular promedios ponderados por peso para el desglose
                const sumPesoA = fardosA.reduce((s, f) => s + (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1)), 0);
                const sumPesoB = fardosB.reduce((s, f) => s + (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1)), 0);

                const sumA = fardosA.reduce((s, f) => s + ((Number(f[vKey]) || 0) * (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1))), 0);
                const sumB = fardosB.reduce((s, f) => s + ((Number(f[vKey]) || 0) * (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1))), 0);
                
                stats[bId].variables[ruleParam].promedioIdeal = sumPesoA > 0 ? sumA / sumPesoA : 0;
                stats[bId].variables[ruleParam].promedioTolerancia = sumPesoB > 0 ? sumB / sumPesoB : 0;
                stats[bId].variables[ruleParam].pctIdeal = (fardosA.length / totalFardos) * 100;
                stats[bId].variables[ruleParam].pctTolerancia = (fardosB.length / totalFardos) * 100;
            }
        });
    });

    return stats;
}
