import type { RequestHandler } from 'express'
export function publicApiLimiter(): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>()
  return (req, res, next) => {
    if (req.method !== 'POST') { next(); return }
    const now = Date.now(), sessionCreation = req.path === '/session'
    for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key)
    const key = `${req.ip || 'unknown'}:${sessionCreation ? 'session' : 'write'}`
    if (!buckets.has(key) && buckets.size >= 5000) { res.status(503).json({ error: 'Service is busy. Retry shortly.' }); return }
    const bucket = buckets.get(key) || { count: 0, until: now + 60000 }
    bucket.count++; buckets.set(key, bucket)
    if (bucket.count > (sessionCreation ? 12 : 120)) { res.set('Retry-After', '60'); res.status(429).json({ error: 'Too many requests. Wait one minute, then retry status.' }); return }
    next()
  }
}
