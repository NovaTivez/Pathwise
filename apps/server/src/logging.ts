type Event = 'server_started' | 'startup_rejected' | 'shutdown_started' | 'shutdown_complete' | 'shutdown_deadline' | 'worker_error' | 'http_error' | 'action_rejected' | 'velo_webhook_rejected' | 'velo_webhook_processed'
// Never log arbitrary error messages, stacks, URLs, bodies, headers, XDR, wallet keys, or tokens.
export function operationalLog(event: Event, context: { requestId?: string; operation?: string; status?: number } = {}) {
  const safe = { timestamp: new Date().toISOString(), event, requestId: context.requestId && /^[a-f0-9-]{36}$/i.test(context.requestId) ? context.requestId : undefined, operation: context.operation && /^[a-z/]{1,60}$/.test(context.operation) ? context.operation : undefined, status: context.status }
  console.error(JSON.stringify(safe))
}
