import { existsSync, mkdirSync, openSync, closeSync, renameSync, rmSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_SCRIPT_PATH = fileURLToPath(new URL('../../backup-database.ps1', import.meta.url))

export function createFullBackupService({ env = process.env, platform = process.platform, spawnImpl = spawn } = {}) {
  let running = false
  let lastRunAt = null
  let lastReason = null
  let lastError = null
  let lastFile = null
  const windows = platform === 'win32'
  const directory = env.STC_BACKUP_DIR ? path.resolve(env.STC_BACKUP_DIR) : null

  function getFullBackupStatus() {
    return {
      enabled: windows ? existsSync(DEFAULT_SCRIPT_PATH) : Boolean(directory),
      running, scriptPath: windows ? DEFAULT_SCRIPT_PATH : null,
      lastRunAt, lastReason, lastError, lastFile,
    }
  }

  function triggerFullBackup(reason = 'bulk-import') {
    if (!getFullBackupStatus().enabled) {
      return { scheduled: false, reason: windows ? 'script-not-found' : 'backup-dir-not-configured' }
    }
    if (running) return { scheduled: false, reason: 'already-running' }

    let partialFile
    let finalFile
    let child
    running = true
    lastReason = reason
    lastError = null

    const fail = (error) => {
      lastError = error.message
      running = false
      if (partialFile) {
        try { rmSync(partialFile, { force: true }) } catch (cleanupError) {
          console.error('[full-backup] No se pudo quitar el archivo incompleto:', cleanupError.message)
        }
      }
      console.error('[full-backup]', lastError)
    }

    try {
      if (windows) {
        // Conserva el respaldo y la copia secundaria existentes en Windows.
        child = spawnImpl('powershell.exe', [
          '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', DEFAULT_SCRIPT_PATH,
          '-Mode', 'Full', '-Reason', reason,
        ], { windowsHide: true, cwd: path.dirname(DEFAULT_SCRIPT_PATH), stdio: ['ignore', 'pipe', 'pipe'] })
      } else {
        mkdirSync(directory, { recursive: true, mode: 0o700 })
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        finalFile = path.join(directory, `stc_produccion_${stamp}_${randomUUID()}.dump`)
        partialFile = `${finalFile}.partial`
        closeSync(openSync(partialFile, 'wx', 0o600))
        // PG* mantiene credenciales fuera de la línea de comandos y los logs.
        child = spawnImpl('pg_dump', ['--format=custom', '--no-password', '--file', partialFile], {
          env: {
            ...env,
            PGHOST: env.PG_HOST || env.PGHOST || 'localhost',
            PGPORT: String(env.PG_PORT || env.PGPORT || '5433'),
            PGDATABASE: env.PG_DATABASE || env.PGDATABASE || 'stc_produccion',
            PGUSER: env.PG_USER || env.PGUSER || 'stc_user',
            PGPASSWORD: env.PG_PASSWORD || env.PGPASSWORD || '',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      }
    } catch (error) {
      fail(error)
      return { scheduled: false, reason: 'backup-start-failed' }
    }

    child.stdout.on('data', chunk => console.log(`[full-backup] ${String(chunk).trim()}`))
    child.stderr.on('data', chunk => console.error(`[full-backup] ${String(chunk).trim()}`))
    let failed = false
    child.once('error', error => { failed = true; fail(error) })
    child.once('close', (code) => {
      if (failed) return
      if (code !== 0) return fail(new Error(`El respaldo terminó con código ${code}`))
      try {
        if (partialFile) {
          if (statSync(partialFile).size === 0) throw new Error('El respaldo está vacío')
          // Publicar solo respaldos completos; los .partial nunca se restauran.
          renameSync(partialFile, finalFile)
          lastFile = finalFile
        }
        lastRunAt = new Date().toISOString()
        running = false
        console.log('[full-backup] Respaldo completo finalizado')
      } catch (error) { fail(error) }
    })
    return { scheduled: true, reason, scriptPath: windows ? DEFAULT_SCRIPT_PATH : null }
  }

  return { getFullBackupStatus, triggerFullBackup }
}

const service = createFullBackupService()
export const getFullBackupStatus = service.getFullBackupStatus
export const triggerFullBackup = service.triggerFullBackup
