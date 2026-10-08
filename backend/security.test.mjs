import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { installSecurity } from './security.js'

const settings = {
  NODE_ENV: 'production',
  STC_AUTH_USER: 'operador',
  STC_AUTH_PASSWORD: 'solo-pruebas-contraseña:1234',
  FRONTEND_ORIGIN: 'https://stc.example',
}

function fixture(env = settings) {
  const app = express()
  installSecurity(app, env)
  app.use(express.json())
  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.all('/api/config/standards', (req, res) => res.json({ saved: true }))
  app.get('/api/database/tables', (req, res) => res.json({ tables: [] }))
  app.delete('/api/uster/delete/:id', (req, res) => res.json({ deleted: true }))
  app.get('/', (req, res) => res.send('STC'))
  return app
}

test('producción exige ambas credenciales y una contraseña larga', () => {
  for (const env of [
    { NODE_ENV: 'production' },
    { ...settings, STC_AUTH_PASSWORD: '' },
    { ...settings, STC_AUTH_USER: '' },
    { ...settings, STC_AUTH_PASSWORD: 'corta' },
    { ...settings, STC_AUTH_USER: 'user:name' },
  ]) assert.throws(() => fixture(env), /STC_AUTH/)
})

test('protege lectura, escritura, eliminación y página de entrada', async () => {
  const app = fixture()
  for (const [method, url] of [
    ['get', '/'], ['get', '/api/database/tables'],
    ['post', '/api/config/standards'], ['delete', '/api/uster/delete/1'],
  ]) {
    const response = await request(app)[method](url)
    assert.equal(response.status, 401)
    assert.match(response.headers['www-authenticate'], /^Basic /)
    assert.equal(response.headers['cache-control'], 'no-store')
  }
})

test('permite al usuario autenticado operar desde la interfaz', async () => {
  const app = fixture()
  for (const [method, url] of [['get', '/'], ['post', '/api/config/standards'], ['delete', '/api/uster/delete/1']]) {
    const response = await request(app)[method](url).auth(settings.STC_AUTH_USER, settings.STC_AUTH_PASSWORD)
    assert.equal(response.status, 200)
  }
})

test('rechaza contraseña incorrecta, usuario incorrecto y autorización malformada', async () => {
  const app = fixture()
  assert.equal((await request(app).get('/').auth('otro', settings.STC_AUTH_PASSWORD)).status, 401)
  assert.equal((await request(app).get('/').auth(settings.STC_AUTH_USER, 'incorrecta')).status, 401)
  for (const header of ['Bearer test', 'Basic !!!', 'Basic ' + Buffer.from('sin-separador').toString('base64')]) {
    assert.equal((await request(app).get('/').set('Authorization', header)).status, 401)
  }
})

test('solo GET/HEAD de salud quedan públicos', async () => {
  const app = fixture()
  assert.equal((await request(app).get('/api/health')).status, 200)
  assert.equal((await request(app).head('/api/health')).status, 200)
  assert.equal((await request(app).post('/api/health')).status, 401)
})

test('bloquea orígenes ajenos incluso con credenciales correctas, antes de escribir', async () => {
  const app = fixture()
  const response = await request(app).post('/api/config/standards')
    .set('Origin', 'https://ajeno.example').auth(settings.STC_AUTH_USER, settings.STC_AUTH_PASSWORD)
  assert.equal(response.status, 403)
  assert.equal(response.headers['access-control-allow-origin'], undefined)
  assert.equal((await request(app).options('/api/config/standards').set('Origin', 'https://ajeno.example')).status, 403)
})

test('permite preflight configurado y el mismo origen, sin comodines', async () => {
  const app = fixture()
  const preflight = await request(app).options('/api/config/standards')
    .set('Origin', 'https://stc.example').set('Access-Control-Request-Method', 'POST')
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://stc.example')
  const response = await request(app).post('/api/config/standards')
    .set('Host', 'produccion:3001').set('Origin', 'http://produccion:3001')
    .auth(settings.STC_AUTH_USER, settings.STC_AUTH_PASSWORD)
  assert.equal(response.status, 200)
  assert.equal(response.headers['access-control-allow-origin'], 'http://produccion:3001')
})

test('bloquea solicitudes de escritura cross-site sin Origin', async () => {
  const response = await request(fixture()).post('/api/config/standards')
    .set('Sec-Fetch-Site', 'cross-site').auth(settings.STC_AUTH_USER, settings.STC_AUTH_PASSWORD)
  assert.equal(response.status, 403)
})

test('desarrollo local sigue compatible y permite activar el mismo control de acceso', async () => {
  const response = await request(fixture({ NODE_ENV: 'development' })).get('/api/database/tables')
    .set('Origin', 'http://localhost:5173')
  assert.equal(response.status, 200)
  assert.equal((await request(fixture({ ...settings, NODE_ENV: 'development' })).get('/')).status, 401)
})
