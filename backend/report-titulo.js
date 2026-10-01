export function parseMachineNumber(maquina) {
    if (!maquina) return 0;
    const str = String(maquina).trim();
    if (str.length === 0) return 0;
    const right2 = str.slice(-2);
    const val = parseInt(right2.replace(/\D/g, ''), 10);
    return isNaN(val) ? 0 : val;
}

export function processReportData(rawData, titulo) {
    // 1. Group by date
    const datesMap = new Map();

    for (const row of rawData) {
        const dateStr = row.data_producao || 'Sin Fecha';
        const maq = parseMachineNumber(row.maquina);
        const lado = row.lado ? String(row.lado).trim() : '';
        const turno = row.turno ? String(row.turno).trim() : '';

        if (!datesMap.has(dateStr)) {
            datesMap.set(dateStr, new Map());
        }
        
        const machinesMap = datesMap.get(dateStr);
        if (!machinesMap.has(maq)) {
            machinesMap.set(maq, {
                maquinaNum: maq,
                lados: new Set(),
                turnos: new Set()
            });
        }

        const mData = machinesMap.get(maq);
        if (lado) mData.lados.add(lado);
        if (turno) mData.turnos.add(turno);
    }

    // 2. Prepare structured data and find max machines per day
    const structuredRows = [];
    let maxMachines = 0;

    // Sort dates chronologically (assuming YYYY-MM-DD or DD/MM/YYYY, simple string sort for now or maintain order)
    const sortedDates = Array.from(datesMap.keys()).sort();

    for (const dateStr of sortedDates) {
        const machinesMap = datesMap.get(dateStr);
        // Sort machines ascending
        const sortedMachines = Array.from(machinesMap.values()).sort((a, b) => a.maquinaNum - b.maquinaNum);
        
        if (sortedMachines.length > maxMachines) {
            maxMachines = sortedMachines.length;
        }

        structuredRows.push({
            date: dateStr,
            machines: sortedMachines
        });
    }

    // 3. Build Headers
    const headers = ['Fecha', 'TÍTULO'];
    for (let i = 1; i <= maxMachines; i++) {
        headers.push(`maquina ${i}`, `lado ${i}`, `turno ${i}`);
    }

    // 4. Build Flattened Rows
    const rows = [];
    for (const sRow of structuredRows) {
        const flatRow = {
            'Fecha': sRow.date,
            'TÍTULO': titulo
        };

        for (let i = 0; i < maxMachines; i++) {
            const maqData = sRow.machines[i];
            if (maqData) {
                flatRow[`maquina ${i+1}`] = String(maqData.maquinaNum);
                flatRow[`lado ${i+1}`] = Array.from(maqData.lados).sort().join(', ');
                flatRow[`turno ${i+1}`] = Array.from(maqData.turnos).sort().join(', ');
            } else {
                flatRow[`maquina ${i+1}`] = '';
                flatRow[`lado ${i+1}`] = '';
                flatRow[`turno ${i+1}`] = '';
            }
        }
        rows.push(flatRow);
    }

    return { headers, rows };
}
