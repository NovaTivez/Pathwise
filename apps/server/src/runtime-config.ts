import { isAbsolute, relative, resolve, sep } from 'node:path'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { defaultDatabasePath } from './database.ts'
import { paymentConfig, supportedNode } from './payment-config.ts'
export class ConfigurationError extends Error {}

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env, version = process.versions.node) {
  const production = env.NODE_ENV === 'production'
  const port = Number(env.PORT || (production ? '10000' : '3001'))
  if (!Number.isInteger(port) || port < (production ? 1 : 0) || port > 65535) throw new ConfigurationError('PORT must be a valid listening port.')
  if (env.PAYMENTS_ENABLED && !['true', 'false'].includes(env.PAYMENTS_ENABLED)) throw new ConfigurationError('PAYMENTS_ENABLED must be true or false.')
  const paymentsEnabled = env.PAYMENTS_ENABLED === 'true'
  let origin = env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || env.WEB_ORIGIN || 'http://localhost:5173'
  const databasePath = env.DATABASE_PATH || defaultDatabasePath
  const persistentDir = env.PERSISTENT_DATA_DIR || ''
  if (production) {
    if (!supportedNode(version)) throw new ConfigurationError('Production requires a Node release supported by Noir: Node 24.22.1+ on the Node 24 line.')
    if (!env.PUBLIC_URL && !env.RENDER_EXTERNAL_URL) throw new ConfigurationError('Set PUBLIC_URL to the actual public HTTPS origin (or use Render RENDER_EXTERNAL_URL).')
    const url = new URL(origin)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname) || url.hostname.endsWith('.invalid')) throw new ConfigurationError('PUBLIC_URL must be the actual public HTTPS origin, without a path, credentials, query, or fragment.')
    origin = url.origin
    if (env.WEB_ORIGIN && env.WEB_ORIGIN !== origin) throw new ConfigurationError('WEB_ORIGIN must exactly match the public HTTPS origin. Frontend and API are served together.')
    if (!persistentDir || !isAbsolute(persistentDir) || !isAbsolute(databasePath)) throw new ConfigurationError('Production requires absolute PERSISTENT_DATA_DIR and DATABASE_PATH on durable storage.')
    const inside = relative(resolve(persistentDir), resolve(databasePath))
    if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) throw new ConfigurationError('DATABASE_PATH must be a file below PERSISTENT_DATA_DIR, never an ephemeral fallback.')
    if (!['render-disk', 'docker-volume'].includes(env.STORAGE_KIND || '')) throw new ConfigurationError('Set STORAGE_KIND=render-disk or docker-volume after attaching that persistent storage.')
    if (env.AGENT_INSTANCES !== '1') throw new ConfigurationError('AGENT_INSTANCES must be 1. This SQLite deployment supports one server/worker instance.')
    if (env.TRUST_PROXY_HOPS && env.TRUST_PROXY_HOPS !== '1') throw new ConfigurationError('This deployment supports exactly one trusted ingress proxy hop.')
    const config = paymentConfig({ ...env, PAYMENTS_ENABLED: 'true' })
    if (paymentsEnabled) {
      const keys = [config.agent?.publicKey, ...['cloudtrail', 'sandbox', 'lantern'].map(p => config.providers[p]?.publicKey)]
      if (config.noirProblems.length || config.veloProblems.length || keys.some(k => !k) || new Set(keys).size !== 4) throw new ConfigurationError('Live Testnet mode needs valid distinct agent/provider keys and complete Velo API key, project ID, secret, and fee configuration. Keep PAYMENTS_ENABLED=false during setup.')
    }
    if (Object.keys(env).some(k => k.startsWith('VITE_') && /(SECRET|TOKEN|KEY|PASSWORD)/i.test(k) && env[k])) throw new ConfigurationError('Do not place credentials in VITE_* variables.')
  }
  return { production, port, host: production ? '0.0.0.0' : '127.0.0.1', origin, databasePath, persistentDir, paymentsEnabled }
}

// A configured path is not proof of persistence. On Linux, require an actual disk/volume mount.
export function assertDurableMount(dir: string) {
  if (!existsSync(dir)) throw new ConfigurationError('Persistent storage mount is missing; startup refused.')
  if (process.platform !== 'linux') throw new ConfigurationError('Public production mode requires the prepared Linux container or Render disk runtime.')
  const mounted = readFileSync('/proc/self/mountinfo', 'utf8').split('\n').some(line => {
    const path = line.split(' ')[4]?.replace(/\\040/g, ' ')
    const filesystem = line.split(' - ')[1]?.split(' ')[0]
    return path === realpathSync(dir) && filesystem && !['tmpfs', 'ramfs', 'overlay'].includes(filesystem)
  })
  if (!mounted) throw new ConfigurationError('PERSISTENT_DATA_DIR is not a mounted disk/volume; ephemeral SQLite is refused.')
}
