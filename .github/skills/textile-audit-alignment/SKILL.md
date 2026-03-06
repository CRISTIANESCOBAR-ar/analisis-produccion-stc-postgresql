---
name: textile-audit-alignment
description: 'Use when comparing DashboardMezclaHilo vs InformeAuditoriaLote and aligning criteria for Ne, FLAME vs liso, MIC, CVm, Neps, tenacidad, elongacion, and state Aprobado/Condicional/Rechazado.'
argument-hint: 'lote actual, lotes referencia, variable en conflicto, criterio esperado'
user-invocable: true
---

# Textile Audit Alignment

## Goal
Align technical criteria between textile quality reports so both outputs produce the same decision for the same data.

## Use When
- User reports inconsistencies between `DashboardMezclaHilo.vue` and `InformeAuditoriaLote.vue`.
- Cases involve `Ne 12.5`, `FLAME`, `CVm`, `Neps`, `tenacidad`, `elongacion`, or `MIC`.
- Backend narrative in `server.js` disagrees with frontend status.

## Inputs To Capture
- Lote actual and lotes de referencia.
- Target Ne (for example `12.5`) and if it is `FLAME` or liso.
- Expected final state (`Aprobado`, `Condicional`, `Rechazado`).
- Which variable caused the discrepancy.

## Procedure
1. Locate threshold and decision rules in frontend and backend:
   - `frontend/src/components/ensayos/DashboardMezclaHilo.vue`
   - `frontend/src/components/ensayos/InformeAuditoriaLote.vue`
   - `backend/server.js`
2. Normalize decision model to tri-state:
   - `ok` -> `Aprobado`
   - `warn` -> `Condicional`
   - `crit` -> `Rechazado`
3. Ensure FLAME is evaluated as independent series:
   - Never apply liso CVm/Neps limits to FLAME.
   - Keep label as `Ne X FLAME` when `is_flame=true`.
4. Reconcile per-variable thresholds by Ne and process path:
   - Trama (`Ne <= 9`) -> focus CVm stability.
   - Urdimbre (`Ne >= 10`) -> strict with elongacion and CVm.
5. Keep backend local narrative and AI prompt aligned with exactly the same matrix and state mapping.
6. Add concise domain text for operators only when it reflects the same technical decision.

## Validation Checklist
- `node --check backend/server.js` passes.
- No VS Code errors in edited files.
- Case `Ne 12.5` in warn zone returns `Condicional`, not automatic `Rechazado`.
- FLAME case with acceptable FLAME bands does not get penalized by liso thresholds.
- Frontend and backend produce same state for identical lote/Ne input.

## Output Contract
When reporting results, include:
- Files changed.
- Exact decision logic changed.
- What test case was used (`lote`, `Ne`, `FLAME/liso`).
- Remaining risk or missing runtime validation.
