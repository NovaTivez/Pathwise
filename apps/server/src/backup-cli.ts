import { DatabaseSync, backup } from 'node:sqlite'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultDatabasePath } from './database.ts'
const source = new DatabaseSync(process.env.DATABASE_PATH || defaultDatabasePath, { readOnly: true })
const output = process.env.BACKUP_PATH
if (!output) throw new Error('Set BACKUP_PATH to a private persistent backup filename; never copy the live WAL database file directly.')
mkdirSync(dirname(output), { recursive: true })
try { await backup(source, output); chmodSync(output, 0o600); console.log('Consistent SQLite backup completed. Keep backups private and off the repository.') } finally { source.close() }
