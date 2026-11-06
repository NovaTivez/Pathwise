import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultDatabasePath } from './database.ts'
import { paymentConfig } from './payment-config.ts'
import { reconcileEvidence } from './evidence.ts'
const path = process.env.DATABASE_PATH || defaultDatabasePath
if (!existsSync(path)) throw new Error('Database missing. Run migrations against the intended persistent database first.')
const db = new DatabaseSync(path, { readOnly: true })
db.exec('BEGIN') // Consistent local WAL snapshot while fresh on-chain evidence is read.
try {
  const report = await reconcileEvidence(db, paymentConfig())
  db.exec('COMMIT')
  const output = process.env.EVIDENCE_OUTPUT || (process.env.NODE_ENV === 'production' ? `${process.env.PERSISTENT_DATA_DIR}/testnet-reconciliation.json` : 'artifacts/testnet-reconciliation.json')
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify({ output, issues: report.issues, acceptance: report.acceptance, transactionReferences: report.purchases.filter(p => p.authorizationHash).length }, null, 2))
  process.exitCode = report.issues.length ? 1 : report.acceptance.completeFlowForSameGrant ? 0 : 2
} finally { db.close() }
