---
name: stc-narrativa-lotes
description: 'Use when editing /api/dashboard/narrativa-lotes, generarNarrativaLocal, and Gemini prompt so backend narrative keeps matrix parity with dashboard criteria.'
argument-hint: 'lote, ne, variable, expected narrative state'
user-invocable: true
---

# STC Narrativa Lotes

## Goal
Maintain a single source of truth for narrative criteria in backend local generation and LLM prompt output.

## Use When
- User asks to adjust narrative logic for lote audit output.
- Endpoint `/api/dashboard/narrativa-lotes` gives wrong status.
- Local fallback and Gemini output diverge.

## Primary Files
- `backend/server.js`

## Procedure
1. Find and review:
   - `generarNarrativaLocal(...)`
   - `MATRIZ_BASE`
   - Process audit block (`AUDITORIA DE APTITUD POR PROCESO`)
   - Prompt text used before Gemini call.
2. Keep matrix entries explicit per Ne with `ok` and `w` bands.
3. Use one evaluator for all variables:
   - `ok`, `warn`, `crit`, and `sin-dato` handling.
4. Build process status from severities:
   - Any `crit` -> `Rechazado`
   - No `crit` and any `warn` (or fiber warning) -> `Condicional`
   - Else -> `Aprobado`
5. Mirror the same rules in prompt text. Never keep binary prompt if local is tri-state.
6. Add comments only when they help production interpretation and do not contradict matrix logic.

## Validation
- Run syntax check:
  - `node --check backend/server.js`
- Search for stale binary status strings in backend.
- Confirm output template explicitly includes `Aprobado/Condicional/Rechazado`.

## Guardrails
- Do not silently change thresholds without documenting Ne and variable affected.
- Do not mix FLAME and liso criteria.
- Prefer deterministic local logic; prompt should explain, not redefine.
