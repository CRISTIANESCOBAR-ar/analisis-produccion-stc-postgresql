
import pg from 'pg';
import 'dotenv/config';

// Parameter Mapping: Config Name -> Data Property Name (from tb_CALIDAD_FIBRA)
const PARAM_MAP = {
    'MIC': 'MIC',
    'STR': 'STR',
    'LEN': 'UHML',
    'UNF': 'UI',
    'SFI': 'SF',
    'ELG': 'ELG',
    'SCI': 'SCI',
    'MAT': 'MAT',
    'TRASH': 'TrCNT',
    '+b': 'PLUS_B',
    'RD': 'RD',
    'MST': 'MST'
};

/* --- ARGENTINE GRADE CLASSIFICATION CONFIG --- */
// Higher score = Better grade.
// The "min" logic will take the lowest score among Rd, +b, and Trash.
const GRADE_DEFINITIONS = [
    { label: 'C', score: 5 },
    { label: 'C 1/4', score: 4 },
    { label: 'C 1/2', score: 3 },
    { label: 'C 3/4', score: 2 },
    { label: 'D', score: 1 },
    { label: 'Fuera de Estándar', score: 0 }
];

// Configuration for thresholds
// Each parameter logic returns a score.
const ARGENTINE_GRADE_CONFIG = {
    // Rd (Higher is better)
    rd: [
        { min: 75, score: 5 },  // > 75 -> C
        { min: 74, score: 4 },  // 74-75 -> C 1/4
        { min: 72, score: 3 },  // 72-74 -> C 1/2
        { min: 71, score: 2 },  // 71-72 -> C 3/4
        { min: 69, score: 1 },  // 69-71 -> D
        { min: 0, score: 0 }    // < 69 -> Fuera
    ],
    // +b (Lower is better generally for "White" grades, but specific ranges apply)
    // User specs: C (8.5-9.5), C 1/2 (10.0-11.0), D (> 11.5)
    // Inferred Gaps: C 1/4 (9.5-10.0), C 3/4 (11.0-11.5)
    // Handling < 8.5? Assuming it's acceptable/good (C) or handled elsewhere. 
    // For now, will strict check max bounds.
    plusB: [
        { max: 9.5, score: 5 },   // <= 9.5 -> C (Includes < 8.5)
        { max: 10.0, score: 4 },  // 9.5 - 10.0 -> C 1/4
        { max: 11.0, score: 3 },  // 10.0 - 11.0 -> C 1/2
        { max: 11.5, score: 2 },  // 11.0 - 11.5 -> C 3/4
        { max: 999, score: 1 }    // > 11.5 -> D (Actually mapped to D, but if way off could be 0)
    ],
    // Trash (Area/TrAr) (Lower is better)
    // User specs updated: 
    // < 0.5 -> C
    // 0.6 - 1.2 -> C 1/2
    // > 1.2 -> D (or D+)
    // Inferred Gaps: 0.5 - 0.6 (C 1/4)
    trash: [
        { max: 0.5, score: 5 },   // < 0.5 -> C
        { max: 0.6, score: 4 },   // 0.5-0.6 -> C 1/4
        { max: 1.2, score: 3 },   // 0.6-1.2 -> C 1/2
        { max: 999, score: 1 }    // > 1.2 -> D
    ]
};

function getGradeFromScore(score) {
    return GRADE_DEFINITIONS.find(g => g.score === score) || GRADE_DEFINITIONS[GRADE_DEFINITIONS.length - 1]; // Fallback to last
}

/**
 * Determines the Argentine Grade component for a single value based on rules.
 * @param {number} val Value to check
 * @param {Array} rules
 * @param {string} type 'min' (val >= rule.min) or 'max' (val <= rule.max)
 */
function evaluateComponent(val, rules, type) {
    if (val === null || val === undefined) return { score: -1, label: 'Dato Insuficiente' }; // -1 indicates missing
    
    for (const rule of rules) {
        if (type === 'min') {
            if (val >= rule.min) return getGradeFromScore(rule.score);
        } else if (type === 'max') {
            if (val <= rule.max) return getGradeFromScore(rule.score);
        }
    }
    return getGradeFromScore(0);
}

export function classifyArgentineGrade(rd, plusB, trash) {
    // 1. Evaluate individual components
    const gradeRd = evaluateComponent(rd, ARGENTINE_GRADE_CONFIG.rd, 'min');
    
    // Special handling for +b
    const gradePlusB = evaluateComponent(plusB, ARGENTINE_GRADE_CONFIG.plusB, 'max');

    const gradeTrash = evaluateComponent(trash, ARGENTINE_GRADE_CONFIG.trash, 'max');

    // 2. Determine Limiting Factor (Min Score) ignoring missing data
    // Filter out missing data scores (-1)
    const scores = [
        { key: 'rd', s: gradeRd.score }, 
        { key: 'plusB', s: gradePlusB.score }, 
        { key: 'trash', s: gradeTrash.score }
    ].filter(x => x.s !== -1);

    if (scores.length === 0) {
        return {
            finalGrade: 'Dato Insuficiente',
            components: {
                rd: { val: rd, grade: 'N/A', score: 0 },
                plusB: { val: plusB, grade: 'N/A', score: 0 },
                trash: { val: trash, grade: 'N/A', score: 0 }
            },
            diagnostic: 'No hay suficientes datos válidos para clasificar el grado.'
        };
    }

    const minScore = Math.min(...scores.map(x => x.s));
    
    // Find label for minScore
    const finalGradeObj = getGradeFromScore(minScore);
    const finalGradeLabel = finalGradeObj ? finalGradeObj.label : 'Fuera de Estándar';

    // 3. Generate Diagnostic
    const factors = [];
    if (gradeRd.score === minScore) factors.push(`Brillo (Rd: ${rd?.toFixed(1)})`);
    if (gradePlusB.score === minScore) factors.push(`Amarillez (+b: ${plusB?.toFixed(1)})`);
    if (gradeTrash.score === minScore) factors.push(`Basura (TrAr: ${trash?.toFixed(2)})`);

    let diagnostic = `Grado Estimado: ${finalGradeLabel}.`;
    if (minScore < 5) { // If not Perfect C
        diagnostic += ` Limitado por: ${factors.join(', ')}.`;
        
        const details = [];
        if (gradeRd.score !== -1 && gradeRd.score < 5) details.push(`Rd es ${gradeRd.label}`);
        if (gradePlusB.score !== -1 && gradePlusB.score < 5) details.push(`+b es ${gradePlusB.label}`);
        if (gradeTrash.score !== -1 && gradeTrash.score < 5) details.push(`TrAr es ${gradeTrash.label}`);
        
        if (details.length > 0) diagnostic += ` Motivo: ${details.join(', ')}.`;
    } else {
        diagnostic += ` Calidad Premium (C) en parámetros disponibles.`;
    }
    
    // Add warnings for missing data
    if (scores.length < 3) {
         const missing = [];
         if (gradeRd.score === -1) missing.push('Rd');
         if (gradePlusB.score === -1) missing.push('+b');
         if (gradeTrash.score === -1) missing.push('TrAr');
         diagnostic += ` (Nota: Faltan datos de ${missing.join(', ')} para evaluación completa).`;
    }

    return {
        finalGrade: finalGradeLabel,
        components: {
            rd: { val: rd, grade: gradeRd.label, score: gradeRd.score },
            plusB: { val: plusB, grade: gradePlusB.label, score: gradePlusB.score },
            trash: { val: trash, grade: gradeTrash.label, score: gradeTrash.score }
        },
        diagnostic
    };
}


function parseVal(val) {
    if (val === null || val === undefined || val === '') return null;
    // Normalize comma to dot for parsing (European/Latam format support)
    if (typeof val === 'string') {
        val = val.replace(',', '.');
    }
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

/**
 * Main Audit Logic
 * @param {Array} bales - Array of bale objects (from DB or CSV)
 * @param {Object} config - Configuration object { tolerancias: [Array of rules] }
 * @returns {Object} { overallStatus: 'IDEAL'|'ADVERTENCIA'|'RECHAZO', details: [], parameterResults: {} }
 */
export function auditMix(bales, config) {
    const results = {};
    let overallStatus = 'IDEAL';
    const conclusionDetails = [];

    const validBalesCount = bales.length;
    if (validBalesCount === 0) {
        return { overallStatus: 'RECHAZO', details: ['No hay pacas seleccionadas.'], parameterResults: {} };
    }

    if (!config || !config.tolerancias) {
        return { overallStatus: 'RECHAZO', details: ['No hay configuración activa.'], parameterResults: {} };
    }

    // Process each rule in configuration
    config.tolerancias.forEach(rule => {
        const paramName = rule.parametro;
        // Try mapped name first, then fallback to paramName itself (e.g. if config uses 'UHML' directly)
        const dataKey = PARAM_MAP[paramName] || paramName;

        // Extract valid numbers (Robust key search)
        const values = bales.map(b => {
             // Try exact match, then lowercase, then uppercase variant
             let rawVal = b[dataKey];
             if (rawVal === undefined) rawVal = b[dataKey.toLowerCase()];
             if (rawVal === undefined) rawVal = b[dataKey.toUpperCase()];
             
             return {
                id: b.LOTE || b.id || 'N/A',
                val: parseVal(rawVal)
             };
        }).filter(v => v.val !== null);

        if (values.length === 0) {
            // Check if we accidentally filtered everything or just didn't find keys
            // If bales has length but values is 0, it means we failed to map keys OR data is null
            results[paramName] = { status: 'SIN_DATOS', issues: ['Sin datos suficientes (Key mismatch?)'] };
            return; // Skip checks
        }

        // Stats
        const sum = values.reduce((a, b) => a + b.val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values.map(v => v.val));
        const max = Math.max(...values.map(v => v.val));

        let paramStatus = 'IDEAL';
        let issues = [];
        let failedBales = []; // List of { id, val, listReason }

        // --- CHECK 1: PROMEDIO (Average) ---
        // logic: valor_ideal_min is "Minimum Target Average" (except maybe for +b?)
        // Assuming config UI logic: 
        // For +b: UI sets "promedio_objetivo_max".
        // For others: UI sets "valor_ideal_min" (implies min avg).
        
        if (rule.valor_ideal_min !== null && rule.valor_ideal_min !== undefined) {
            const targetMin = parseFloat(rule.valor_ideal_min);
            // If param is +b, valor_ideal_min might be NULL in DB as seen in seed data.
            if (!isNaN(targetMin) && avg < targetMin) {
                issues.push(`Promedio bajo (${avg.toFixed(2)} < ${targetMin})`);
                paramStatus = 'RECHAZO'; 
            }
        }
        
        if (rule.promedio_objetivo_max !== null && rule.promedio_objetivo_max !== undefined) {
             const targetMax = parseFloat(rule.promedio_objetivo_max);
             if (!isNaN(targetMax) && avg > targetMax) {
                 issues.push(`Promedio alto (${avg.toFixed(2)} > ${targetMax})`);
                 paramStatus = 'RECHAZO';
             }
        }

        // --- CHECK 2: HARD CAPS (Absolute Limits) ---
        let hardCapIssues = 0;
        if (rule.limite_max_absoluto !== null && rule.limite_max_absoluto !== undefined) {
            const hardMax = parseFloat(rule.limite_max_absoluto);
            if (!isNaN(hardMax)) {
                const violations = values.filter(v => v.val > hardMax);
                if (violations.length > 0) {
                    hardCapIssues += violations.length;
                    issues.push(`${violations.length} pacas exceden límite absoluto ${hardMax}`);
                    paramStatus = 'RECHAZO';
                    violations.forEach(v => failedBales.push({ id: v.id, val: v.val, reason: 'Hard Cap Max' }));
                }
            }
        }
        // Note: limite_min_absoluto exists in schema? Yes per update v2.
        if (rule.limite_min_absoluto !== null && rule.limite_min_absoluto !== undefined) {
            const hardMin = parseFloat(rule.limite_min_absoluto);
            if (!isNaN(hardMin)) {
                const violations = values.filter(v => v.val < hardMin);
                if (violations.length > 0) {
                     hardCapIssues += violations.length;
                     issues.push(`${violations.length} pacas debajo del límite absoluto ${hardMin}`);
                     paramStatus = 'RECHAZO';
                     violations.forEach(v => failedBales.push({ id: v.id, val: v.val, reason: 'Hard Cap Min' }));
                }
            }
        }

        // --- CHECK 3: DISTRIBUTION (Tolerance Range) ---
        let outlierPct = 0;
        let acceptedRange = null;

        if (rule.rango_tol_min !== null && rule.rango_tol_max !== null) {
            const tolMin = parseFloat(rule.rango_tol_min);
            const tolMax = parseFloat(rule.rango_tol_max);
            acceptedRange = [tolMin, tolMax];

            if (!isNaN(tolMin) && !isNaN(tolMax)) {
                const outliers = values.filter(v => v.val < tolMin || v.val > tolMax);
                outlierPct = (outliers.length / values.length) * 100;

                const minIdealPct = rule.porcentaje_min_ideal || 80; // Default 80%
                const maxOutlierPct = 100 - minIdealPct; // e.g., 20% allowed outside

                if (outlierPct > maxOutlierPct) {
                    issues.push(`Dispersión Alta: ${outlierPct.toFixed(1)}% fuera de rango [${tolMin}-${tolMax}] (Max permitido: ${maxOutlierPct}%)`);
                    if (paramStatus !== 'RECHAZO') paramStatus = 'RECHAZO'; // Fail strictly
                    
                    // Add outliers to failedBales labeled as Tolerance
                    outliers.forEach(v => {
                        // Avoid duplicates if already added by hard cap (though ranges should align)
                        if (!failedBales.find(fb => fb.id === v.id)) {
                             failedBales.push({ id: v.id, val: v.val, reason: 'Out of Tolerance' });
                        }
                    });
                }
            }
        }

        // Aggregate Status
        if (paramStatus === 'RECHAZO') overallStatus = 'RECHAZO';
        else if (paramStatus === 'ADVERTENCIA' && overallStatus !== 'RECHAZO') overallStatus = 'ADVERTENCIA';

        if (issues.length > 0) {
            conclusionDetails.push(`${paramName}: ${issues.join('. ')}`);
        }

        results[paramName] = {
            status: paramStatus,
            avg: avg.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            // Expose Targets for Frontend Comparison
            targets: {
                minAvg: rule.valor_ideal_min,
                maxAvg: rule.promedio_objetivo_max,
                hardMax: rule.limite_max_absoluto,
                hardMin: rule.limite_min_absoluto,
                toleranceMin: rule.rango_tol_min,
                toleranceMax: rule.rango_tol_max,
                minIdealPct: rule.porcentaje_min_ideal
            },
            count: values.length,
            hardCapViolations: hardCapIssues,
            distribution: {
                outliersPct: outlierPct.toFixed(1),
                range: acceptedRange
            },
            issues: issues,
            failedBales // Return the list of failing bale IDs
        };
    });

    // Calulate Argentine Grade for the WHOLE MIX (Average)
    // Needs direct access to bale data values for Rd, +b, and Trash if not present in "results" (results only has configured params)
    // We compute the averages manually from the bales array to ensure we have them even if not in "config.tolerancias".
    
    const calculateAverage = (keyVariants) => {
        let total = 0;
        let count = 0;
        bales.forEach(b => {
             // Find property
             let val = undefined;
             for (const k of keyVariants) {
                 if (b[k] !== undefined) { val = b[k]; break; }
                 if (b[k.toLowerCase()] !== undefined) { val = b[k.toLowerCase()]; break; }
                 if (b[k.toUpperCase()] !== undefined) { val = b[k.toUpperCase()]; break; }
             }
             const parsed = parseVal(val);
             if (parsed !== null) {
                 total += parsed;
                 count++;
             }
        });
        return count > 0 ? total / count : null;
    };

    const avgRd = calculateAverage(['RD', 'Rd', 'Reflectance']);
    const avgPlusB = calculateAverage(['PLUS_B', '+b', 'plus_b', 'Yellow']);
    const avgTrash = calculateAverage(['TrAr', 'TrArea', 'TrashArea', 'TRASH_AREA']); // Use TrAr as requested

    const argentineGrade = classifyArgentineGrade(avgRd, avgPlusB, avgTrash);

    return {
        overallStatus,
        details: conclusionDetails,
        parameterResults: results,
        argentineGrade 
    };
}
