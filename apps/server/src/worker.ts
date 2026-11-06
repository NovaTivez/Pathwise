import { operationalLog } from './logging.ts'
export function startWorker(tick: () => Promise<void>, intervalMs = 1500) {
  let pending: Promise<void> | null = null, stopping = false, completedAt = Date.now(), lastErrorLog = 0
  async function run() {
    if (pending || stopping) return
    pending = tick().then(() => { completedAt = Date.now() }).catch(() => { if (Date.now() - lastErrorLog > 30000) { operationalLog('worker_error'); lastErrorLog = Date.now() } }).finally(() => { pending = null })
    await pending
  }
  const timer = setInterval(() => { void run() }, intervalMs)
  void run()
  return {
    status: () => ({ running: !stopping, inFlight: Boolean(pending), lastCompletedAt: completedAt }),
    async stop(timeoutMs = 20000) {
      stopping = true; clearInterval(timer)
      if (!pending) return true
      let deadline: ReturnType<typeof setTimeout> | undefined
      const drained = await Promise.race([pending.then(() => true), new Promise<boolean>(resolve => { deadline = setTimeout(() => resolve(false), timeoutMs) })])
      if (deadline) clearTimeout(deadline)
      return drained
    },
  }
}
