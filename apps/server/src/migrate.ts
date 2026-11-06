import { openDatabase, defaultDatabasePath } from './database.ts'
import { runtimeConfig, assertDurableMount } from './runtime-config.ts'
if (process.env.NODE_ENV === 'production') assertDurableMount(runtimeConfig().persistentDir)
const db = openDatabase(process.env.DATABASE_PATH || defaultDatabasePath)
db.close()
console.log('SQLite migrations are up to date.')
