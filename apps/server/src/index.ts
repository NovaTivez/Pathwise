import { createApp } from './app.ts'
import { runtimeConfig, assertDurableMount, ConfigurationError } from './runtime-config.ts'
import { startWorker } from './worker.ts'
import { operationalLog } from './logging.ts'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

try {
  const settings = runtimeConfig()
  if (settings.production) {
    process.umask(0o077)
    assertDurableMount(settings.persistentDir)
    if (!existsSync(fileURLToPath(new URL('../../web/dist/index.html', import.meta.url)))) throw new Error('Build the frontend before starting production.')
  }
  let worker: ReturnType<typeof startWorker> | undefined
  let stopping = false
  const { app, db, agent } = createApp(settings.databasePath, settings.origin, {}, { production: settings.production, workerStatus: () => worker?.status() || { running: false, inFlight: false, lastCompletedAt: 0 } })
  const server = app.listen(settings.port, settings.host, (error?: Error) => {
    if (error) { operationalLog('startup_rejected'); db.close(); process.exitCode = 1; return }
    worker = startWorker(() => agent.tick())
    operationalLog('server_started')
    if (!settings.production) console.log(`Pathwise backend: http://localhost:${(server.address() as { port: number }).port}`)
  })
  async function shutdown() {
    if (stopping) return
    stopping = true; operationalLog('shutdown_started')
    server.close(); server.closeIdleConnections()
    const deadline = setTimeout(() => { operationalLog('shutdown_deadline'); process.exit(0) }, 25000)
    const drained = await worker?.stop(20000)
    if (drained !== false) db.close()
    operationalLog(drained === false ? 'shutdown_deadline' : 'shutdown_complete')
    clearTimeout(deadline)
    process.exit(0) // A forced exit leaves already persisted hashes/commitments for startup reconciliation.
  }
  process.on('SIGINT', () => { void shutdown() })
  process.on('SIGTERM', () => { void shutdown() })
} catch (error) {
  operationalLog('startup_rejected')
  console.error(error instanceof ConfigurationError ? error.message : 'Startup refused. Check Node version, public HTTPS origin, attached disk/volume, one-instance setting, built frontend, and (if enabled) payment credentials. No configuration values were logged.')
  process.exitCode = 1
}
