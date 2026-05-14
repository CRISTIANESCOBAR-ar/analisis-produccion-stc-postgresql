/**
 * import_metas_may_2026.mjs
 * Carga las metas de mayo 2026 en tb_metas usando el script genérico.
 *
 * Ejecutar desde la raíz del proyecto:
 *   node backend/scripts/import_metas_may_2026.mjs
 */
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generic   = path.join(__dirname, 'import_metas_monthly.mjs')
const input     = path.join(__dirname, 'input_metas_may_2026.txt')

execFileSync(process.execPath, [generic, input], { stdio: 'inherit' })
