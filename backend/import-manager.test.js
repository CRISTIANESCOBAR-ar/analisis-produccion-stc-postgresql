import { test, expect } from 'vitest';
import { readCSV, shouldSkipRecord } from './import-manager.js';
import fs from 'fs';
import path from 'path';

test('shouldSkipRecord correctly skips TOTAL rows with hyphens (Uncle Bob TDD)', () => {
    const headers = ['FILIAL', 'LOC. FISICO', 'MAQUINA', 'DATA_PRODUCAO'];
    
    const recordTotal = {
        'FILIAL': 'TOTAL:',
        'LOC. FISICO': '61.632,20',
        'MAQUINA': '-',
        'DATA_PRODUCAO': '-'
    };
    
    const recordNormal = {
        'FILIAL': 'NORMAL_ROW',
        'LOC. FISICO': '10',
        'MAQUINA': 'M1',
        'DATA_PRODUCAO': '01/01/2026'
    };
    
    expect(shouldSkipRecord(recordTotal, headers)).toBe(true);
    expect(shouldSkipRecord(recordNormal, headers)).toBe(false);
});
