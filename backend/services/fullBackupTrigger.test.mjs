import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFullBackupService } from './fullBackupTrigger.js'

function fixture(t, platform = 'linux') {
  const tempRoot = path.resolve(os.tmpdir())
  const directory = fs.mkdtempSync(path.join(tempRoot, 'stc-backup-test-'))
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), tempRoot)
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const children = []
  const calls = []
  const service = createFullBackupService({
    platform,
    env: { STC_BACKUP_DIR: directory, PG_HOST: 'test-db', PG_PORT: '5432', PG_DATABASE: 'test', PG_USER: 'test-user', PG_PASSWORD: 'test-only' },
    spawnImpl(command, args, options) {
      calls.push({ command, args, options })
      const child = new EventEmitter()
      child.stdout = new PassThrough()
      child.stderr = new PassThrough()
      children.push(child)
      return child
    },
  })
  return { ...service, directory, calls, children }
}

test('Linux genera archivo persistente completo y conserva credenciales fuera de argumentos', t => {
  const f = fixture(t)
  assert.equal(f.triggerFullBackup('import').scheduled, true)
  const { command, args, options } = f.calls[0]
  assert.equal(command, 'pg_dump')
  assert.equal(args.includes('test-only'), false)
  assert.equal(options.env.PGPASSWORD, 'test-only')
  assert.equal(options.env.PGPORT, '5432')
  const partial = args.at(-1)
  assert.equal(path.dirname(partial), f.directory)
  assert.ok(partial.endsWith('.partial'))
  fs.writeFileSync(partial, 'PGDMP-fixture')
  f.children[0].emit('close', 0)
  assert.equal(f.getFullBackupStatus().running, false)
  assert.ok(f.getFullBackupStatus().lastRunAt)
  assert.ok(f.getFullBackupStatus().lastFile.endsWith('.dump'))
  assert.equal(fs.existsSync(partial), false)
  assert.equal(fs.readFileSync(f.getFullBackupStatus().lastFile, 'utf8'), 'PGDMP-fixture')
})

test('un fallo o respaldo vacío nunca se publica como exitoso y permite reintentar', t => {
  const f = fixture(t)
  f.triggerFullBackup()
  f.children[0].emit('close', 1)
  assert.equal(f.getFullBackupStatus().lastRunAt, null)
  assert.ok(f.getFullBackupStatus().lastError)
  assert.deepEqual(fs.readdirSync(f.directory), [])
  assert.equal(f.triggerFullBackup().scheduled, true)
  f.children[1].emit('close', 0)
  assert.equal(f.getFullBackupStatus().lastFile, null)
  assert.match(f.getFullBackupStatus().lastError, /vacío/)
  assert.deepEqual(fs.readdirSync(f.directory), [])
})

test('maneja ejecutable ausente y no deja un respaldo incompleto', t => {
  const f = fixture(t)
  f.triggerFullBackup()
  f.children[0].emit('error', new Error('ENOENT'))
  f.children[0].emit('close', -2)
  assert.equal(f.getFullBackupStatus().running, false)
  assert.equal(f.getFullBackupStatus().lastError, 'ENOENT')
  assert.deepEqual(fs.readdirSync(f.directory), [])
})

test('evita respaldos simultáneos', t => {
  const f = fixture(t)
  f.triggerFullBackup()
  assert.equal(f.triggerFullBackup().reason, 'already-running')
  assert.equal(f.calls.length, 1)
  f.children[0].emit('close', 1)
})

test('Windows conserva el script existente y la ventana oculta', t => {
  const f = fixture(t, 'win32')
  assert.equal(f.triggerFullBackup('prueba').scheduled, true)
  assert.equal(f.calls[0].command, 'powershell.exe')
  assert.equal(f.calls[0].options.windowsHide, true)
  assert.ok(f.calls[0].args.includes('Full'))
  assert.equal(f.calls[0].args.at(-1), 'prueba')
  f.children[0].emit('close', 0)
  assert.ok(f.getFullBackupStatus().lastRunAt)
})

test('Linux sin directorio configurado informa que no puede programar respaldo', () => {
  const f = createFullBackupService({ env: {}, platform: 'linux' })
  assert.equal(f.getFullBackupStatus().enabled, false)
  assert.equal(f.triggerFullBackup().reason, 'backup-dir-not-configured')
})
