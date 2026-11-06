import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseEnv } from 'node:util'
const ignored = new Set(['node_modules', '.git', '.tools', '.aws', '.codex', 'data', 'artifacts'])
const environments = [process.env, ...['.env', '.env.production'].filter(existsSync).map(path => parseEnv(readFileSync(path, 'utf8')))]
const secrets = [...new Set(environments.flatMap(env => Object.entries(env).filter(([k, v]) => /(SECRET|API_KEY|PASSWORD|ACCESS_TOKEN)$/.test(k) && v && v.length >= 12).map(([, v]) => v)))]
const findings = []
let files = 0
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || (entry.name.startsWith('.env') && !entry.name.endsWith('.example')) || /\.sqlite|\.log$|tsbuildinfo/.test(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) { walk(path); continue }
    if (!/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json|html|css|md|ya?ml|svg|example)$/.test(path) && !['Dockerfile', '.gitignore', '.dockerignore'].includes(entry.name)) continue
    const body = readFileSync(path, 'utf8'); files++
    if (secrets.some(secret => body.includes(secret)) || /\bS[A-Z2-7]{55}\b/.test(body)) findings.push({ file: relative('.', path), issue: 'Possible private credential; value intentionally omitted.' })
  }
}
walk('.')
let repository = 'not initialized'
if (existsSync('.git')) {
  repository = 'checked tracked paths'
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  for (const path of tracked) if ((/(^|\/)\.env($|\.)/.test(path) && !path.endsWith('.example')) || /\.sqlite|\.(pem|key)$/.test(path) || ['.tools/', '.aws/', '.codex/', 'artifacts/'].some(prefix => path.startsWith(prefix))) findings.push({ file: path, issue: 'Private/local runtime file is tracked.' })
}
console.log(JSON.stringify({ filesChecked: files, repository, findings, passed: findings.length === 0 }, null, 2))
if (findings.length) process.exitCode = 1
