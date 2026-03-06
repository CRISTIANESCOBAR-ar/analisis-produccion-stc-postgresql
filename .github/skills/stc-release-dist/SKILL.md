---
name: stc-release-dist
description: 'Use when preparing commit and push in this repo, especially when frontend/dist artifacts create many pending changes and source-vs-build commits must be separated.'
argument-hint: 'scope: source-only, dist-only, or both'
user-invocable: true
---

# STC Release Dist

## Goal
Create predictable git history for source and build artifacts while avoiding accidental commits.

## Use When
- User says `haz commit y push`.
- `git status` shows many `frontend/dist` changes.
- Need to split source logic and build output into separate commits.

## Procedure
1. Inspect current state:
   - `git status --short`
   - `git branch --show-current`
   - `git remote -v`
2. Classify changes:
   - Source files (`backend/`, `frontend/src/`, scripts, docs)
   - Build artifacts (`frontend/dist/**`)
3. Commit in two phases when both exist:
   - Commit 1: source logic only.
   - Commit 2: dist artifacts only (if requested or repository policy requires tracked dist).
4. Push branch and report:
   - Commit hash(es)
   - Branch and remote
   - Any remaining local changes

## Validation
- `git status --short` is clean after final push (unless user requested partial commit).
- Mention if line ending warnings appear; they are warnings, not push blockers.

## Guardrails
- Never use destructive git commands unless user explicitly requests them.
- Do not include unrelated files if user requested a scoped commit.
- If workspace has unknown external changes, stop and ask before continuing.
