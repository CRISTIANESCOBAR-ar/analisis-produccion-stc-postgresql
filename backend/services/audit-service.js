
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

function parseVal(val) {
    if (val === null || val === undefined || val === '') return null;
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

    return {
        overallStatus,
        details: conclusionDetails,
        parameterResults: results
    };
}
