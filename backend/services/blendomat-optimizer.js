/**
 * BlendomatOptimizer - Motor de cálculo de mezclas de algodón
 * 
 * Este servicio recibe el stock disponible, las reglas de mezcla activas,
 * las variables seleccionadas por el usuario y el tamaño de la mezcla (fardos).
 * 
 * Devuelve un plan de mezclas optimizado.
 * Soporta dos algoritmos:
 * 1. 'standard' (Round Robin): Optimiza el uso secuencial.
 * 2. 'stability' (Golden Batch/Proporcional): Optimiza la duración de bloques idénticos distribuyendo el consumo proporcionalmente al stock.
 */

export function optimizeBlend(stock, rules, supervisionSettings, blendSize, algorithm = 'standard') {
    if (!blendSize || blendSize <= 0) {
        throw new Error("El tamaño de la mezcla (fardos) debe ser mayor a 0.");
    }
    if (!stock || stock.length === 0) {
        throw new Error("No hay stock disponible para procesar.");
    }

    // Despachador de algoritmos
    if (algorithm === 'stability') {
        return optimizeBlendStability(stock, rules, supervisionSettings, blendSize, false);
    } else if (algorithm === 'stability-strict') {
        return optimizeBlendStability(stock, rules, supervisionSettings, blendSize, true);
    } else {
        return optimizeBlendStandard(stock, rules, supervisionSettings, blendSize);
    }
}

function toOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

// =================================================================================================
// ALGORITMO 2: ESTABILIDAD (GOLDEN BATCH / PROPORCIONAL)
// =================================================================================================
/**
 * @param {boolean} enforceToleranceCap - false = Golden Batch puro (max N, tolerancia informativa)
 *                                        true  = Golden Batch estricto (respeta cupo % B, N menor)
 */
function optimizeBlendStability(stock, rules, supervisionSettings, blendSize, enforceToleranceCap = false) {
    const classifiedStock = classifyStock(stock, rules, supervisionSettings);
    const activeRules = rules.filter(r => {
        const uiKey = r.parametro === 'LEN' ? 'UHML' : (r.parametro === '+b' ? 'PLUS_B' : r.parametro);
        const s = supervisionSettings[uiKey];
        return s && (s.target || s.hardCap || s.tolerance);
    });
    
    // Validar lotes disponibles (excluir rechazados)
    const availableLots = classifiedStock.filter(b => b._category !== 'C' && b._availableCount > 0);
    
    if (availableLots.length === 0) {
        return generateEmptyResult(classifiedStock, "No hay stock válido disponible.");
    }

    const blends = [];
    let blendIndex = 1;

    let iterations = 0;
    const MAX_ITERATIONS = 100;
    let remainingLots = [...availableLots];

    const findMaxHorizon = (lots) => {
        const total = lots.reduce((sum, l) => sum + l._availableCount, 0);
        let low = 1;
        let high = Math.floor(total / blendSize);
        let best = 0;

        const feasible = (h) => {
            const capacity = lots.reduce((sum, l) => sum + Math.floor(l._availableCount / h), 0);
            return capacity >= blendSize;
        };

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (feasible(mid)) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return best;
    };

    const buildRecipeForHorizon = (lots, horizon) => {
        const total = lots.reduce((sum, l) => sum + l._availableCount, 0);
        // Contar lotes con capacidad >= 1 para decidir si aplicar garantía de mínimo 1
        const eligibleCount = lots.filter(l => Math.floor(l._availableCount / horizon) >= 1).length;
        const guaranteeMin1 = eligibleCount <= blendSize;

        const candidates = lots.map((lot) => {
            const ideal = (lot._availableCount / total) * blendSize;
            const capacity = Math.floor(lot._availableCount / horizon);
            // Golden Batch: todos los lotes elegibles (capacity >= 1) reciben al menos 1 fardo
            // para mantener la distribución proporcional completa del stock.
            // Solo aplica si el total de elegibles <= blendSize (si hay más lotes que fardos,
            // la proporcionalidad estricta es imposible).
            const minAssign = (guaranteeMin1 && capacity >= 1) ? 1 : 0;
            const assigned = Math.min(Math.max(Math.floor(ideal), minAssign), capacity);
            return {
                lot,
                idealShare: ideal,
                capacity,
                assigned,
                remainder: ideal - Math.floor(ideal)
            };
        });

        let assignedTotal = candidates.reduce((sum, c) => sum + c.assigned, 0);
        let needed = blendSize - assignedTotal;

        if (needed > 0) {
            candidates.sort((a, b) => {
                const slackA = a.capacity - a.assigned;
                const slackB = b.capacity - b.assigned;
                if (slackB !== slackA) return slackB - slackA;
                return b.remainder - a.remainder;
            });

            let idx = 0;
            while (needed > 0 && idx < candidates.length) {
                const c = candidates[idx];
                if (c.assigned < c.capacity) {
                    c.assigned += 1;
                    needed -= 1;
                } else {
                    idx += 1;
                }
                if (idx >= candidates.length && needed > 0) idx = 0;
            }
        }

        if (needed > 0) return null;
        return candidates.filter(c => c.assigned > 0);
    };

    /**
     * GB + Norma: dado un array de candidates (con .assigned y .capacity),
     * recorta los lotes B al cupo máximo permitido por cada regla de tolerancia
     * y redistribuye los slots liberados a lotes A con capacidad disponible.
     * Retorna los candidates modificados, o null si no es posible completar blendSize.
     */
    const capToleranceInRecipe = (candidates) => {
        // Clonar asignaciones para no mutar hasta confirmar éxito
        const caps = candidates.map(c => ({ ...c }));

        for (const rule of activeRules) {
            const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
            const settings = supervisionSettings[uiKey];
            if (!settings || !settings.tolerance) continue;

            const minIdealPct = toOptionalNumber(rule.porcentaje_min_ideal);
            if (minIdealPct === null) continue;

            const maxBCount = Math.floor(blendSize * ((100 - minIdealPct) / 100));

            // Lotes B por esta variable
            const bCaps = caps.filter(c =>
                c.lot._category === 'B' &&
                Array.isArray(c.lot._toleranceReasons) &&
                c.lot._toleranceReasons.includes(rule.parametro)
            );

            const currentBCount = bCaps.reduce((sum, c) => sum + c.assigned, 0);
            if (currentBCount <= maxBCount) continue;

            // Reducir lotes B ordenados por mayor asignado primero
            let toFree = currentBCount - maxBCount;
            bCaps.sort((a, b) => b.assigned - a.assigned);
            for (const bc of bCaps) {
                if (toFree <= 0) break;
                const reduce = Math.min(bc.assigned - 1, toFree); // dejar min 1 si tenían asignación
                if (reduce > 0) { bc.assigned -= reduce; toFree -= reduce; }
            }
            // Si todavía hay exceso (todos B llegan a 1 y aún supera cupo), llevar a 0 los menos importantes
            if (toFree > 0) {
                bCaps.sort((a, b) => a.assigned - b.assigned);
                for (const bc of bCaps) {
                    if (toFree <= 0) break;
                    const reduce = Math.min(bc.assigned, toFree);
                    bc.assigned -= reduce; toFree -= reduce;
                }
            }

            // Redistribuir slots liberados a lotes A con capacidad disponible
            const freed = (currentBCount - maxBCount) - toFree;
            const aCaps = caps.filter(c => c.lot._category === 'A' && c.assigned < c.capacity)
                .sort((a, b) => (b.capacity - b.assigned) - (a.capacity - a.assigned));

            let toFill = freed;
            for (const ac of aCaps) {
                if (toFill <= 0) break;
                const canAdd = Math.min(ac.capacity - ac.assigned, toFill);
                ac.assigned += canAdd;
                toFill -= canAdd;
            }

            // Si no se pudieron redistribuir todos los slots, el plan no alcanza blendSize → null
            if (toFill > 0) return null;
        }

        const total = caps.reduce((sum, c) => sum + c.assigned, 0);
        if (total !== blendSize) return null;
        return caps.filter(c => c.assigned > 0);
    };

    while (remainingLots.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;

        const totalStock = remainingLots.reduce((sum, l) => sum + l._availableCount, 0);
        if (totalStock < blendSize) break;

        let blockDuration = findMaxHorizon(remainingLots);
        if (blockDuration <= 0) break;

        let activeRecipe = null;
        let recipeFardos = null;

        while (blockDuration > 0) {
            const rawRecipe = buildRecipeForHorizon(remainingLots, blockDuration);
            if (!rawRecipe) {
                blockDuration -= 1;
                continue;
            }

            // Modo Golden Batch: NO se optimiza calidad aquí.
            // La distribución proporcional de todos los lotes ES el Golden Batch.
            activeRecipe = rawRecipe;

            // GB + Norma: recortar lotes B al cupo de tolerancia y redistribuir a lotes A.
            // Si los lotes A no tienen capacidad suficiente para absorber los slots liberados,
            // retorna null → reducir blockDuration (a H menor, la capacidad de A lotses aumenta).
            if (enforceToleranceCap) {
                const capped = capToleranceInRecipe(rawRecipe);
                if (!capped) {
                    blockDuration -= 1;
                    continue;
                }
                activeRecipe = capped;
            }

            recipeFardos = [];
            activeRecipe.forEach(item => {
                for (let k = 0; k < item.assigned; k++) {
                    recipeFardos.push({ ...item.lot });
                }
            });

            // enforceToleranceCap=false (Golden Batch puro): solo hardCap individual bloquea.
            //   Si el stock tiene mayoria de lotes B, el cupo de tolerancia es imposible
            //   de cumplir sin excluir stock valido. Tolerancia aparece como aviso en el resultado.
            // enforceToleranceCap=true (Golden Batch estricto): tambien valida cupo % B.
            //   N resultante puede ser menor, pero el plan cumple las reglas de mezcla.
            const passesRules = validateRecipeAgainstRules(recipeFardos, activeRules, supervisionSettings, blendSize, !enforceToleranceCap);
            if (passesRules) break;

            blockDuration -= 1;
        }

        if (!activeRecipe || !recipeFardos || blockDuration <= 0) break;

        for (let i = 0; i < blockDuration; i++) {
            const mezclaFardos = recipeFardos.map(f => ({ ...f }));

            blends.push({
                index: blendIndex++,
                fardos: mezclaFardos
            });
        }

        activeRecipe.forEach(item => {
            const consumed = item.assigned * blockDuration;
            item.lot._availableCount -= consumed;
            item.lot._usedCount += consumed;
        });

        remainingLots = remainingLots.filter(l => l._availableCount > 0);
    }

    // 4. Agrupar
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

    return generateResult(classifiedStock, groupedBlends, rules, supervisionSettings);
}

/**
 * Valida una receta contra las reglas activas.
 * @param {boolean} hardCapOnly - Si true (modo estabilidad), solo verifica hardCap individual.
 *   La tolerancia (cupo % B) se omite porque el stock puede ser mayoritariamente B,
 *   y excluirlos destruiría la distribución proporcional del Golden Batch.
 *   Si false (modo estándar), además valida el cupo de dispersión de categoría B.
 * El 'target' nunca bloquea generación en ningún modo.
 */
function validateRecipeAgainstRules(recipeFardos, activeRules, supervisionSettings, blendSize, hardCapOnly = false) {
    for (const rule of activeRules) {
        const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
        const settings = supervisionSettings[uiKey];
        if (!settings) continue;

        const values = recipeFardos
            .map(f => Number(f[uiKey]))
            .filter(v => !Number.isNaN(v));

        if (values.length === 0) continue;

        // Hard cap individual (red de seguridad)
        if (settings.hardCap) {
            const maxAbs = toOptionalNumber(rule.limite_max_absoluto);
            const minAbs = toOptionalNumber(rule.limite_min_absoluto);
            const violatesHardCap = values.some(v => (maxAbs !== null && v > maxAbs) || (minAbs !== null && v < minAbs));
            if (violatesHardCap) return false;
        }

        // Tolerancia: cupo de dispersión de lotes B
        // En modo hardCapOnly (estabilidad) se omite: si el stock mismo es mayoritariamente
        // zona tolerancia, obligar el cupo vacía el plan completo.
        if (!hardCapOnly && settings.tolerance) {
            const minIdealPct = toOptionalNumber(rule.porcentaje_min_ideal);
            if (minIdealPct !== null) {
                const maxTolerancePct = 100 - minIdealPct;
                const maxToleranceCount = Math.floor(blendSize * (maxTolerancePct / 100));
                const toleranceCount = recipeFardos.filter(f =>
                    f._category === 'B' &&
                    Array.isArray(f._toleranceReasons) &&
                    f._toleranceReasons.includes(rule.parametro)
                ).length;
                if (toleranceCount > maxToleranceCount) return false;
            }
        }
        // NOTE: 'target' no bloquea generación en ningún modo.
    }

    return true;
}

/**
 * Optimización de calidad de la receta (hill climbing).
 * Reasigna fardos de lotes con peor calidad hacia lotes con mejor calidad
 * para acercarse a los targets (STR >= x, LEN >= x, MIC >= x).
 * Respeta las capacidades por horizonte.
 */
function optimizeRecipeQuality(candidates, activeRules, supervisionSettings) {
    // Calcular promedio ponderado de una variable en la receta actual
    const paramAvg = (cands, uiKey) => {
        let sum = 0, count = 0;
        cands.forEach(c => {
            if (c.assigned <= 0) return;
            const v = Number(c.lot[uiKey]);
            if (!Number.isNaN(v)) { sum += v * c.assigned; count += c.assigned; }
        });
        return count > 0 ? sum / count : 0;
    };

    let improved = true;
    let maxIter = candidates.length * 5;

    while (improved && maxIter-- > 0) {
        improved = false;

        for (const rule of activeRules) {
            const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
            const settings = supervisionSettings ? supervisionSettings[uiKey] : null;
            if (!settings || !settings.target) continue;

            const targetMin = toOptionalNumber(rule.valor_ideal_min);
            const targetMax = toOptionalNumber(rule.promedio_objetivo_max);

            const avg = paramAvg(candidates, uiKey);
            const belowTarget = targetMin !== null && avg < targetMin;
            const aboveTarget = targetMax !== null && avg > targetMax;

            if (!belowTarget && !aboveTarget) continue;

            // Lote de peor calidad con al menos 1 fardo asignado (candidato a reducir)
            let worstIdx = -1;
            let worstVal = belowTarget ? Infinity : -Infinity;
            candidates.forEach((c, idx) => {
                if (c.assigned <= 0) return;
                const v = Number(c.lot[uiKey]);
                if (Number.isNaN(v)) return;
                if (belowTarget && v < worstVal) { worstVal = v; worstIdx = idx; }
                if (aboveTarget && v > worstVal) { worstVal = v; worstIdx = idx; }
            });
            if (worstIdx === -1) continue;

            // Lote de mejor calidad con capacidad disponible (candidato a aumentar)
            let bestIdx = -1;
            let bestVal = belowTarget ? -Infinity : Infinity;
            candidates.forEach((c, idx) => {
                if (idx === worstIdx) return;
                if (c.assigned >= c.capacity) return; // sin margen de capacidad
                const v = Number(c.lot[uiKey]);
                if (Number.isNaN(v)) return;
                // Solo vale si mejora respecto al peor
                if (belowTarget && v > worstVal && v > bestVal) { bestVal = v; bestIdx = idx; }
                if (aboveTarget && v < worstVal && v < bestVal) { bestVal = v; bestIdx = idx; }
            });
            if (bestIdx === -1) continue;

            // Intercambio: quitar 1 del peor, dar 1 al mejor
            candidates[worstIdx].assigned -= 1;
            candidates[bestIdx].assigned += 1;
            improved = true;
            break; // reiniciar con el promedio actualizado
        }
    }

    return candidates.filter(c => c.assigned > 0);
}

// Helper para firma de mezcla (necesario moverlo a scope superior o duplicar si no es accesible)
function getBlendSignature(blendFardos) {
    const counts = {};
    blendFardos.forEach(f => {
        const key = `${f.PRODUTOR}_${f.LOTE}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).sort().map(k => `${k}:${counts[k]}`).join('|');
}


// =================================================================================================
// ALGORITMO 1: ESTÁNDAR (ROUND ROBIN / ORIGINAL)
// =================================================================================================
function optimizeBlendStandard(stock, rules, supervisionSettings, blendSize) {
    const classifiedStock = classifyStock(stock, rules, supervisionSettings);
    
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

    const activeRules = rules.filter(r => {
        const uiKey = r.parametro === 'LEN' ? 'UHML' : (r.parametro === '+b' ? 'PLUS_B' : r.parametro);
        const s = supervisionSettings[uiKey];
        return s && (s.target || s.hardCap || s.tolerance);
    });

    const canAddToleranceBaleToRecipe = (bale, currentRecipeArr) => {
        if (bale._category === 'A') return true; 

        for (const param of bale._toleranceReasons) {
            const rule = activeRules.find(r => r.parametro === param);
            if (!rule) continue;

            const minIdealPct = Number(rule.porcentaje_min_ideal) || 100;
            const maxTolerancePct = 100 - minIdealPct; 
            const maxToleranceCount = Math.floor(blendSize * (maxTolerancePct / 100));

            const currentToleranceCount = currentRecipeArr.filter(b => b._category === 'B' && b._toleranceReasons.includes(param)).length;

            if (currentToleranceCount >= maxToleranceCount) {
                return false; 
            }
        }
        return true;
    };

    const buildRecipe = (availableLots) => {
        if (availableLots.length === 0) return null;
        
        availableLots.sort((a, b) => b._availableCount - a._availableCount);

        let recipe = [];
        let lotIndex = 0;
        let attempts = 0;
        let tempCounts = new Map(); 

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

        // OPTIMIZACIÓN DE PROMEDIOS
        if (recipe.length === blendSize) {
            let improvementMade = true;
            let iterations = 0;
            const maxIterations = blendSize * 2; 

            while (improvementMade && iterations < maxIterations) {
                improvementMade = false;
                iterations++;

                for (const rule of activeRules) {
                    const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
                    
                    const targetMin = Number(rule.valor_ideal_min); 
                    const targetMax = Number(rule.promedio_objetivo_max);

                    const currentAvg = calculateRecipeAverage(recipe, uiKey);

                    const failMin = !isNaN(targetMin) && currentAvg < targetMin;
                    const failMax = !isNaN(targetMax) && currentAvg > targetMax;

                    if (failMin || failMax) {
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

                        const candidates = availableLots.filter(l => {
                            const used = tempCounts.get(l) || 0;
                            if (used >= l._availableCount) return false; 
                           
                            const val = Number(l[uiKey]);
                            if (failMin && val <= worstValue) return false; 
                            if (failMax && val >= worstValue) return false; 

                            return true;
                        });

                        candidates.sort((a, b) => {
                            const valA = Number(a[uiKey]);
                            const valB = Number(b[uiKey]);
                            if (failMin) return valB - valA; 
                            return valA - valB; 
                        });

                        for (const candidate of candidates) {
                            const tempRecipe = [...recipe];
                            tempRecipe.splice(worstBaleIndex, 1);

                            if (candidate._category === 'A' || canAddToleranceBaleToRecipe(candidate, tempRecipe)) {
                                const oldBale = recipe[worstBaleIndex];
                                tempCounts.set(oldBale, tempCounts.get(oldBale) - 1);
                                tempCounts.set(candidate, (tempCounts.get(candidate) || 0) + 1);
                                recipe[worstBaleIndex] = { ...candidate };
                                improvementMade = true;
                                break; 
                            }
                        }
                    }
                    if (improvementMade) break; 
                }
            }
        }

        return recipe.length === blendSize ? recipe : null;
    };

    let availableLots = classifiedStock.filter(b => b._availableCount > 0);
    let currentRecipe = buildRecipe(availableLots);

    while (currentRecipe) {
        const recipeCounts = new Map();
        currentRecipe.forEach(f => {
            const origLot = classifiedStock.find(l => l.LOTE === f.LOTE && l.PRODUTOR === f.PRODUTOR);
            recipeCounts.set(origLot, (recipeCounts.get(origLot) || 0) + 1);
        });

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

        for (let i = 0; i < maxRepeats; i++) {
            blends.push({
                index: blendIndex++,
                fardos: currentRecipe.map(b => ({ ...b }))
            });
        }

        for (const [lot, countInRecipe] of recipeCounts.entries()) {
            const totalUsed = countInRecipe * maxRepeats;
            lot._availableCount -= totalUsed;
            lot._usedCount += totalUsed; // Track used count
        }

        availableLots = classifiedStock.filter(b => b._availableCount > 0);
        currentRecipe = buildRecipe(availableLots);
    }

    // Agrupación
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

    return generateResult(classifiedStock, groupedBlends, rules, supervisionSettings);
}

// =================================================================================================
// HELPERS COMUNES
// =================================================================================================

function classifyStock(stock, rules, supervisionSettings) {
    const activeRules = rules.filter(r => {
        const uiKey = r.parametro === 'LEN' ? 'UHML' : (r.parametro === '+b' ? 'PLUS_B' : r.parametro);
        const s = supervisionSettings[uiKey];
        return s && (s.target || s.hardCap || s.tolerance);
    });

    return stock.map(bale => {
        let isRejected = false;
        let rejectReason = '';
        let isTolerance = false;
        const toleranceReasons = [];

        for (const rule of activeRules) {
            const uiKey = rule.parametro === 'LEN' ? 'UHML' : (rule.parametro === '+b' ? 'PLUS_B' : rule.parametro);
            const settings = supervisionSettings[uiKey];
            if (!settings) continue;

            const val = Number(bale[uiKey]);
            if (isNaN(val)) continue;

            if (settings.hardCap) {
                const maxAbs = toOptionalNumber(rule.limite_max_absoluto);
                const minAbs = toOptionalNumber(rule.limite_min_absoluto);
                if (maxAbs !== null && val > maxAbs) {
                    isRejected = true; rejectReason = `${rule.parametro} > Max ${maxAbs}`; break;
                }
                if (minAbs !== null && val < minAbs) {
                    isRejected = true; rejectReason = `${rule.parametro} < Min ${minAbs}`; break;
                }
            }

            if (settings.tolerance) {
                const tolMin = toOptionalNumber(rule.rango_tol_min);
                const tolMax = toOptionalNumber(rule.rango_tol_max);
                if (tolMin !== null && tolMax !== null) {
                    if (val >= tolMin && val <= tolMax) {
                        isTolerance = true; toleranceReasons.push(rule.parametro);
                    }
                }
            }
        }

        return {
            ...bale,
            _category: isRejected ? 'C' : (isTolerance ? 'B' : 'A'),
            _rejectReason: rejectReason,
            _toleranceReasons: toleranceReasons,
            _usedCount: 0,
            _availableCount: Number(bale.QTDE_ESTOQUE) || 0
        };
    });
}

function generateEmptyResult(stock, message) {
    return {
        success: true, // Frontend expects success=true to render, even if empty plan
        plan: [],
        columnasMezcla: [],
        remanentes: stock.map(b => ({
            PRODUTOR: b.PRODUTOR,
            LOTE: b.LOTE,
            Fardos: b._availableCount, // Puede ser 0 o lo que había
            Motivo: b._rejectReason || message
        })),
        estadisticas: {}
    };
}

function generateResult(classifiedStock, groupedBlends, rules, supervisionSettings) {
    // Regenerar activeRules para estadísticas (podría pasarse como argumento para no recalcular)
    const activeRules = rules.filter(r => {
        const uiKey = r.parametro === 'LEN' ? 'UHML' : (r.parametro === '+b' ? 'PLUS_B' : r.parametro);
        const s = supervisionSettings[uiKey];
        return s && (s.target || s.hardCap || s.tolerance);
    });

    // Generar Reporte de Remanentes
    const unusedStock = [];
    classifiedStock.forEach(b => {
        // Incluye los C (rechazados) y los A/B que sobraron (_availableCount > 0)
        let motivo = '';
        if (b._category === 'C') motivo = b._rejectReason;
        else if (b._availableCount > 0) {
             motivo = b._category === 'B' ? 'Sobrante (Tolerancia/Exceso)' : 'Sobrante';
        }

        // Si _usedCount > 0, significa que se usó parcialmente
        // Si _availableCount > 0, significa que sobró
        if (b._category === 'C' || b._availableCount > 0) {
             unusedStock.push({
                PRODUTOR: b.PRODUTOR,
                LOTE: b.LOTE,
                MIC: b.MIC,
                STR: b.STR,
                LEN: b.UHML || b.LEN,
                Fardos: b._category === 'C' ? Number(b.QTDE_ESTOQUE) : b._availableCount,
                Peso: (Number(b.PESO) / (Number(b.QTDE_ESTOQUE)||1)) * (b._category === 'C' ? Number(b.QTDE_ESTOQUE) : b._availableCount),
                Motivo: motivo
            });
        }
    });

    const planRows = {};
    groupedBlends.forEach((blend, bIndex) => {
        const blendId = blend.id;
        const loteCounts = {};
        blend.fardos.forEach(f => {
            const key = `${f.PRODUTOR}_${f.LOTE}`;
            if (!loteCounts[key]) loteCounts[key] = { count: 0, ref: f };
            loteCounts[key].count++;
        });

        Object.values(loteCounts).forEach(({ count, ref }) => {
            const key = `${ref.PRODUTOR}_${ref.LOTE}`;
            if (!planRows[key]) {
                planRows[key] = {
                    PRODUTOR: ref.PRODUTOR,
                    Estado: ref._category === 'A' ? 'USO' : (ref._category === 'B' ? 'TOLER.' : 'RECH.'),
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

    // Asegurarse de que planRows sea un array
    const planArray = Object.values(planRows);
    
    // Ordenar por Productor y Lote 
    planArray.sort((a,b) => (a.PRODUTOR > b.PRODUTOR) ? 1 : ((b.PRODUTOR > a.PRODUTOR) ? -1 : 0));

    return {
        success: true,
        plan: planArray,
        columnasMezcla: groupedBlends.map(b => b.id),
        remanentes: unusedStock,
        estadisticas: calcularEstadisticas(groupedBlends, activeRules)
    };
}

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

        ['MIC', 'STR', 'UHML'].forEach(vKey => {
            const ruleParam = vKey === 'UHML' ? 'LEN' : vKey;
            const rule = activeRules.find(r => r.parametro === ruleParam);
            
            const sumPonderada = fardos.reduce((s, f) => s + ((Number(f[vKey]) || 0) * (Number(f.PESO) / (Number(f.QTDE_ESTOQUE)||1))), 0);
            const prom = pesoTotal > 0 ? sumPonderada / pesoTotal : 0;
            
            stats[bId].variables[ruleParam] = {
                promedioGeneral: prom
            };

            if (rule) {
                const fardosA = fardos.filter(f => f._category === 'A' || !f._toleranceReasons.includes(ruleParam));
                const fardosB = fardos.filter(f => f._category === 'B' && f._toleranceReasons.includes(ruleParam));
                
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
