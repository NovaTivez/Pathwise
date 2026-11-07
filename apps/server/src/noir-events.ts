import { cursorLedger, decodeEvent } from '@noirx402/agent-sdk'
import type { NoirContracts, NoirEvent } from '@noirx402/agent-sdk'
import type { NoirPort } from './noir.ts'

type RawEvent = Parameters<typeof decodeEvent>[0]
type EventPage = { events: RawEvent[]; cursor: string; latestLedger: number }
type EventClient = NoirPort & {
  contracts?: NoirContracts
  server: NoirPort['server'] & { getEvents?: (request: { filters: { type: 'contract'; contractIds: string[] }[]; startLedger?: number; cursor?: string; limit?: number }) => Promise<EventPage> }
}

// The public Testnet RPC marks successful Noir receipts with inSuccessfulContractCall=false.
// getTransaction remains the success check. This only lets the decoder read the receipt.
function readable(raw: RawEvent): RawEvent {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(raw)), raw) as RawEvent
  copy.inSuccessfulContractCall = true
  return copy
}

export async function ledgerEvents(client: EventClient, fromLedger: number): Promise<NoirEvent[]> {
  if (!client.contracts || typeof client.server.getEvents !== 'function') return client.pastEvents(fromLedger)
  const filters = [{ type: 'contract' as const, contractIds: Object.values(client.contracts) }]
  const events: NoirEvent[] = []
  let cursor = ''
  for (let page = 0; page < 20; page++) {
    const result = cursor
      ? await client.server.getEvents({ filters, cursor, limit: 100 })
      : await client.server.getEvents({ filters, startLedger: fromLedger, limit: 100 })
    for (const raw of result.events) {
      const event = decodeEvent(readable(raw), client.contracts)
      if (event) events.push(event)
    }
    if (result.events.length < 100 && cursorLedger(result.cursor) >= result.latestLedger) break
    if (!result.cursor || result.cursor === cursor) break
    cursor = result.cursor
  }
  return events
}
