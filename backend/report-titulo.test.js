import { test, expect } from 'vitest';
import { parseMachineNumber, processReportData } from './report-titulo.js';

test('parseMachineNumber extracts integer from last 2 chars', () => {
    expect(parseMachineNumber('050403')).toBe(3);
    expect(parseMachineNumber('050412')).toBe(12);
    expect(parseMachineNumber('M01')).toBe(1);
    expect(parseMachineNumber('5')).toBe(5);
    expect(parseMachineNumber('')).toBe(0);
    expect(parseMachineNumber(null)).toBe(0);
});

test('processReportData groups by day and pivots machines horizontally', () => {
    const rawData = [
        { data_producao: '2026-01-01', maquina: '050405', lado: 'A', turno: '1' },
        { data_producao: '2026-01-01', maquina: '050405', lado: 'A', turno: '2' },
        { data_producao: '2026-01-01', maquina: '050403', lado: 'B', turno: '1' },
        
        { data_producao: '2026-01-02', maquina: '050412', lado: 'A', turno: '3' },
    ];

    const result = processReportData(rawData, '12.5');

    // Expected headers: Fecha, TÍTULO, maquina 1, lado 1, turno 1, maquina 2, lado 2, turno 2
    expect(result.headers).toEqual([
        'Fecha', 'TÍTULO', 
        'maquina 1', 'lado 1', 'turno 1',
        'maquina 2', 'lado 2', 'turno 2'
    ]);

    // Rows
    expect(result.rows).toHaveLength(2);

    // 2026-01-01 -> machines: 3 and 5 (sorted)
    const row1 = result.rows[0];
    expect(row1['Fecha']).toBe('2026-01-01');
    expect(row1['TÍTULO']).toBe('12.5');
    expect(row1['maquina 1']).toBe('3'); // machine 050403
    expect(row1['lado 1']).toBe('B');
    expect(row1['turno 1']).toBe('1');
    
    expect(row1['maquina 2']).toBe('5'); // machine 050405
    expect(row1['lado 2']).toBe('A');
    expect(row1['turno 2']).toBe('1, 2'); // grouped turns

    // 2026-01-02 -> machine 12
    const row2 = result.rows[1];
    expect(row2['Fecha']).toBe('2026-01-02');
    expect(row2['TÍTULO']).toBe('12.5');
    expect(row2['maquina 1']).toBe('12');
    expect(row2['lado 1']).toBe('A');
    expect(row2['turno 1']).toBe('3');
    expect(row2['maquina 2']).toBe('');
    expect(row2['lado 2']).toBe('');
    expect(row2['turno 2']).toBe('');
});
