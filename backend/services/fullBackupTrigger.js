import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'backup-database.ps1')

let running = false
let lastRunAt = 0
let lastReason = null

export function getFullBackupStatus() {
  return {
    enabled: existsSync(DEFAULT_SCRIPT_PATH),
    running,
    scriptPath: DEFAULT_SCRIPT_PATH,
    lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
    lastReason,
  }
}

export function triggerFullBackup(reason = 'bulk-import') {
  if (!existsSync(DEFAULT_SCRIPT_PATH)) {
    console.warn(`[full-backup] Script no disponible: ${DEFAULT_SCRIPT_PATH}`)
    return { scheduled: false, reason: 'script-not-found', scriptPath: DEFAULT_SCRIPT_PATH }
  }

  if (running) {
    console.log('[full-backup] Ya hay un backup full en ejecución, no se lanza otro.')
    return { scheduled: false, reason: 'already-running', scriptPath: DEFAULT_SCRIPT_PATH }
  }

  running = true
  lastReason = reason

  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', DEFAULT_SCRIPT_PATH,
    '-Mode', 'Full',
    '-Reason', reason,
  ], {
    windowsHide: true,
    detached: false,
    cwd: path.dirname(DEFAULT_SCRIPT_PATH),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text) console.log(`[full-backup] ${text}`)
  })

  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text) console.error(`[full-backup] ${text}`)
  })

  child.on('error', (error) => {
    running = false
    console.error('[full-backup] Error lanzando backup full:', error.message)
  })

  child.on('close', (code) => {
    running = false
    if (code === 0) {
      lastRunAt = Date.now()
      console.log(`[full-backup] Backup full completado por: ${reason}`)
      return
    }
    console.error(`[full-backup] backup-database.ps1 terminó con código ${code}`)
  })

  return { scheduled: true, reason, scriptPath: DEFAULT_SCRIPT_PATH }
}