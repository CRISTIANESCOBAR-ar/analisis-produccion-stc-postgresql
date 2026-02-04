/**
 * Data Service - API calls to PostgreSQL backend
 * Base URL: /api (proxied through Vite to http://localhost:3001)
 */

const API_BASE = '/api'

// Data source (always PostgreSQL in this project)
let currentSource = 'postgresql'

export function getDataSource() {
  return currentSource
}

export function setDataSource(source) {
  currentSource = source
  console.log(`Data source: ${currentSource}`)
}

async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`)
  if (!response.ok) throw new Error(`API error: ${response.statusText}`)
  const data = await response.json()
  return data.rows || data
}

async function postJson(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`API error: ${response.statusText}`)
  return response.json()
}

async function deleteRequest(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`API error: ${response.statusText}`)
  return response.json()
}

// =====================
// USTER FUNCTIONS
// =====================

export async function fetchUsterPar() {
  return fetchJson('/uster/par')
}

export async function fetchUsterTbl(testnr = null) {
  return fetchJson(testnr ? `/uster/tbl?testnr=${testnr}` : '/uster/tbl')
}

export async function checkUsterStatus(testnrs) {
  return postJson('/uster/status', { testnrs })
}

export async function uploadUster(par, tbl) {
  return postJson('/uster/upload', { par, tbl })
}

export async function deleteUster(testnr) {
  return deleteRequest(`/uster/delete/${testnr}`)
}

export async function getUsterHusos(testnr) {
  return postJson('/uster/husos', { testnr })
}

// =====================
// TENSORAPID FUNCTIONS
// =====================

export async function fetchTensorapidPar() {
  return fetchJson('/tensorapid/par')
}

export async function fetchTensorapidTbl(testnr = null) {
  return fetchJson(testnr ? `/tensorapid/tbl?testnr=${testnr}` : '/tensorapid/tbl')
}

export async function checkTensorapidStatus(testnrs) {
  return postJson('/tensorapid/status', { testnrs })
}

export async function uploadTensorapid(par, tbl) {
  return postJson('/tensorapid/upload', { par, tbl })
}

export async function deleteTensorapid(testnr) {
  return deleteRequest(`/tensorapid/delete/${testnr}`)
}

// =====================
// COMBINED FUNCTIONS
// =====================

export async function fetchAllStatsData() {
  const [usterPar, usterTbl, tensorapidPar, tensorapidTbl] = await Promise.all([
    fetchUsterPar(),
    fetchUsterTbl(),
    fetchTensorapidPar(),
    fetchTensorapidTbl()
  ])
  return { usterPar, usterTbl, tensorapidPar, tensorapidTbl, source: currentSource }
}

export default {
  getDataSource,
  setDataSource,
  fetchUsterPar,
  fetchUsterTbl,
  fetchTensorapidPar,
  fetchTensorapidTbl,
  checkUsterStatus,
  checkTensorapidStatus,
  uploadUster,
  uploadTensorapid,
  deleteUster,
  deleteTensorapid,
  getUsterHusos,
  fetchAllStatsData
}
