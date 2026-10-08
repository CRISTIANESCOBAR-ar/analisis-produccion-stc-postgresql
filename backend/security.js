import { createHash, timingSafeEqual } from 'node:crypto'
import cors from 'cors'

const digest = (value) => createHash('sha256').update(value).digest()

// Instalar antes de las rutas, del parser JSON y de los archivos estáticos.
export function installSecurity(app, env = process.env) {
  const production = env.NODE_ENV === 'production'
  const username = env.STC_AUTH_USER || ''
  const password = env.STC_AUTH_PASSWORD || ''
  const enabled = Boolean(username && password)
  if ((production || username || password) && !enabled) {
    throw new Error('Configure STC_AUTH_USER y STC_AUTH_PASSWORD antes de iniciar el servidor.')
  }
  if (enabled && (username.includes(':') || password.length < 16)) {
    throw new Error('STC_AUTH_USER no admite dos puntos y STC_AUTH_PASSWORD requiere al menos 16 caracteres.')
  }
  const allowedOrigins = new Set((env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean))
  const expectedUser = digest(username)
  const expectedPassword = digest(password)

  app.use((req, res, next) => {
    const origin = req.get('Origin')
    const host = req.get('Host')
    const sameOrigin = origin === `http://${host}` || origin === `https://${host}`
    const localDevOrigin = !production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '')
    if (origin && !sameOrigin && !localDevOrigin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Origen no permitido.' })
    }
    // Basic Auth se envía automáticamente por el navegador: bloquear también
    // peticiones de otros sitios sin Origin (por ejemplo, navegadores antiguos).
    if (!origin && req.get('Sec-Fetch-Site') === 'cross-site' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ error: 'Origen no permitido.' })
    }
    next()
  })
  app.use(cors({ origin: true, credentials: true }))

  app.use((req, res, next) => {
    // La sonda solo revela disponibilidad; no datos ni configuración.
    if (['GET', 'HEAD'].includes(req.method) && req.path === '/api/health') return next()
    if (!enabled) return next() // Desarrollo local: activar definiendo ambas variables.

    res.set('Cache-Control', 'no-store')
    const authorization = req.get('Authorization') || ''
    const match = authorization.length <= 4096 && /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)
    if (match) {
      const credentials = Buffer.from(match[1], 'base64').toString('utf8')
      const separator = credentials.indexOf(':')
      if (separator >= 0) {
        const userMatches = timingSafeEqual(digest(credentials.slice(0, separator)), expectedUser)
        const passwordMatches = timingSafeEqual(digest(credentials.slice(separator + 1)), expectedPassword)
        if (userMatches && passwordMatches) return next()
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="STC Produccion", charset="UTF-8"')
    return res.status(401).json({ error: 'Se requiere iniciar sesión.' })
  })
}
