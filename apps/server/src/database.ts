import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultDatabasePath = fileURLToPath(new URL('../data/pathwise.sqlite', import.meta.url))
export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)')
  db.exec('BEGIN IMMEDIATE')
  try {
    if (!db.prepare('SELECT version FROM schema_migrations WHERE version=1').get()) {
      db.exec(`CREATE TABLE learner_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
        CREATE TABLE learner_plans (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL REFERENCES learner_sessions(token_hash), payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX learner_plans_session ON learner_plans(session_hash, created_at);
        INSERT INTO schema_migrations VALUES (1);`)
    }
    if (!db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
      db.exec(`CREATE TABLE wallet_challenges (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, owner TEXT NOT NULL, xdr TEXT NOT NULL, server_key TEXT NOT NULL, expires INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE wallet_bindings (session_hash TEXT PRIMARY KEY REFERENCES learner_sessions(token_hash), owner TEXT NOT NULL, verified_at INTEGER NOT NULL);
        CREATE TABLE service_checkouts (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE REFERENCES learner_sessions(token_hash), plan_id TEXT NOT NULL REFERENCES learner_plans(id), owner TEXT NOT NULL, amount TEXT NOT NULL, asset TEXT NOT NULL, intent_id TEXT UNIQUE, checkout_url TEXT, status TEXT NOT NULL DEFAULT 'creating', success_event TEXT, tx_hash TEXT, active INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE velo_events (id TEXT PRIMARY KEY, delivery_id TEXT UNIQUE, intent_id TEXT, payload_hash TEXT NOT NULL, processed_at INTEGER NOT NULL);
        CREATE TABLE noir_experiments (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE REFERENCES learner_sessions(token_hash), plan_id TEXT NOT NULL REFERENCES learner_plans(id), owner TEXT NOT NULL UNIQUE, device_hash TEXT NOT NULL UNIQUE, agent TEXT NOT NULL, merchant TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL, limit_amount TEXT NOT NULL, funding TEXT NOT NULL, expires INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'planned', nonce TEXT NOT NULL, authorize_hash TEXT, claim_hash TEXT, start_ledger INTEGER, claim_amount TEXT, claim_start INTEGER, deployment TEXT NOT NULL);
        CREATE TABLE owner_operations (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES noir_experiments(id), kind TEXT NOT NULL, xdr TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, state TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE payment_locks (name TEXT PRIMARY KEY, holder TEXT NOT NULL);
        INSERT INTO schema_migrations VALUES (2);`)
    }
    if (!db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
      db.exec(`CREATE TABLE demo_providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, merchant TEXT, demo INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE demo_resources (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES demo_providers(id), title TEXT NOT NULL, skills TEXT NOT NULL, format TEXT NOT NULL, price TEXT NOT NULL, original_price TEXT NOT NULL, fulfillment TEXT NOT NULL);
        CREATE TABLE agent_grants (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL REFERENCES learner_sessions(token_hash), plan_id TEXT NOT NULL REFERENCES learner_plans(id), mode TEXT NOT NULL, owner TEXT NOT NULL, providers TEXT NOT NULL, snapshot TEXT NOT NULL, expires INTEGER NOT NULL, experiment_id TEXT, started INTEGER NOT NULL DEFAULT 0, UNIQUE(session_hash, mode), UNIQUE(owner, mode));
        CREATE TABLE agent_orders (id TEXT PRIMARY KEY, grant_id TEXT NOT NULL REFERENCES agent_grants(id), mode TEXT NOT NULL, owner TEXT NOT NULL, resource_id TEXT NOT NULL REFERENCES demo_resources(id), provider_id TEXT NOT NULL, merchant TEXT, asset TEXT NOT NULL, amount TEXT NOT NULL, coverage TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, authorization_state TEXT NOT NULL DEFAULT 'not_started', claim_state TEXT NOT NULL DEFAULT 'not_started', fulfillment_state TEXT NOT NULL DEFAULT 'locked', nonce TEXT NOT NULL, authorize_hash TEXT, start_ledger INTEGER, batch_id TEXT, code TEXT, UNIQUE(mode, owner, resource_id));
        CREATE TABLE agent_claim_batches (id TEXT PRIMARY KEY, merchant TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL, status TEXT NOT NULL, hash TEXT, start_ledger INTEGER NOT NULL);
        INSERT INTO schema_migrations VALUES (3);`)
    }
    if (!db.prepare('SELECT version FROM schema_migrations WHERE version=4').get()) {
      db.exec(`CREATE TABLE agent_decisions (grant_id TEXT NOT NULL REFERENCES agent_grants(id), resource_id TEXT NOT NULL, provider_id TEXT NOT NULL, amount TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(grant_id, resource_id)); INSERT INTO schema_migrations VALUES (4);`)
    }
    if (!db.prepare('SELECT version FROM schema_migrations WHERE version=5').get()) {
      db.exec(`CREATE UNIQUE INDEX service_payment_tx_once ON service_checkouts(tx_hash) WHERE tx_hash IS NOT NULL; INSERT INTO schema_migrations VALUES (5);`)
    }
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error }
  return db
}
