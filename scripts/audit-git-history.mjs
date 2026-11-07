import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Read-only audit of every locally available ref. Never print matched bytes.
const git = args => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 })
if (!existsSync('.git')) throw new Error('Run from the Git repository root.')
const environments = readdirSync('.').filter(p => /^\.env(?:$|\.)/.test(p) && !p.endsWith('.example'))
const secrets = [...new Set(environments.flatMap(p => Object.entries(parseEnv(readFileSync(p, 'utf8'))).filter(([k,v]) => /SECRET|API_KEY|PASSWORD|TOKEN/.test(k) && v.length >= 12).map(([,v]) => v)))]
const commits = git(['rev-list', '--all']).toString().trim().split('\n').filter(Boolean)
const blobs = new Map()
const findings = []
const privatePath = p => ((/(^|\/)\.env(?:$|\.)/.test(p) && !p.endsWith('.example')) || /(?:^|\/)(?:artifacts|data|\.tools|\.aws|\.codex|node_modules)(?:\/|$)|\.sqlite|\.(?:pem|key)$/.test(p))
for (const commit of commits) {
  for (const entry of git(['ls-tree', '-r', '-z', commit]).toString().split('\0').filter(Boolean)) {
    const [meta,path] = entry.split('\t'), [,type,hash] = meta.split(' ')
    if (type !== 'blob') continue
    if (privatePath(path)) findings.push({commit:commit.slice(0,12),path,issue:'Private/local path in history'})
    if (!blobs.has(hash)) blobs.set(hash,path)
  }
}
const hashes = [...blobs.keys()]
const batch = hashes.length ? execFileSync('git', ['cat-file', '--batch'], { input:hashes.join('\n')+'\n', maxBuffer:100 * 1024 * 1024 }) : Buffer.alloc(0)
let offset = 0
for (const hash of hashes) {
  const end = batch.indexOf(10,offset)
  if (end < 0) throw new Error('Incomplete Git object response.')
  const [actual,type,sizeText] = batch.subarray(offset,end).toString().split(' ')
  const size = Number(sizeText)
  if (actual !== hash || type !== 'blob' || !Number.isSafeInteger(size) || size < 0) throw new Error('Unexpected Git object response.')
  const text = batch.subarray(end+1,end+1+size).toString('utf8')
  if (secrets.some(s => text.includes(s)) || /\bS[A-Z2-7]{55}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}/.test(text)) findings.push({object:hash.slice(0,12),path:blobs.get(hash),issue:'Possible credential; value omitted'})
  offset = end+1+size+1
}
console.log(JSON.stringify({scope:'all locally available Git refs; known configured values and key patterns only; no OCR',commits:commits.length,uniqueBlobs:hashes.length,findings,passed:findings.length===0},null,2))
if(findings.length)process.exitCode=1
