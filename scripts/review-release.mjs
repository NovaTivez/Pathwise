import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createHash } from 'node:crypto'

// Read the staged bytes, not just the working files. Never print matched values.
const git = args => execFileSync('git', args, { maxBuffer: 20 * 1024 * 1024 })
const paths = git(['ls-files', '-z']).toString().split('\0').filter(Boolean).sort()
if (!paths.length) throw new Error('Stage the explicit release allowlist first.')
const envs = ['.env', '.env.production'].filter(existsSync).map(p => parseEnv(readFileSync(p, 'utf8')))
const secrets = [...new Set(envs.flatMap(e => Object.entries(e).filter(([k,v]) => /SECRET|API_KEY|PASSWORD|ACCESS_TOKEN/.test(k) && v.length >= 12).map(([,v]) => v)))]
const findings = [], manifest = []
for (const path of paths) {
  const bytes = git(['show', ':' + path]), text = bytes.toString('utf8')
  if ((/(^|\/)\.env(?:$|\.)/.test(path) && !path.endsWith('.example')) || /(?:^|\/)(?:artifacts|data|\.git|\.tools|\.aws|\.codex|node_modules|dist)(?:\/|$)|\.sqlite|\.(?:pem|key|log)$/.test(path)) findings.push({path, issue:'Private or generated path'})
  if (secrets.some(s => text.includes(s)) || /\bS[A-Z2-7]{55}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}/.test(text)) findings.push({path, issue:'Possible credential; value omitted'})
  manifest.push({path, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')})
}
mkdirSync('artifacts', {recursive:true})
writeFileSync('artifacts/release-manifest.json', JSON.stringify({checkedAt:new Date().toISOString(), manifest, findings},null,2)+'\n', {mode:0o600})
console.log(JSON.stringify({stagedFiles:paths.length, findings, passed:!findings.length},null,2))
if(findings.length) process.exitCode=1
