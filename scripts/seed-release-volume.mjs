import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
const choices=readdirSync('artifacts').filter(n=>/^release-baseline-[a-f0-9]+\.sqlite$/.test(n))
if(choices.length!==1)throw new Error('Choose the intended consistent baseline backup explicitly; no volume was changed.')
const backup='artifacts/'+choices[0]
if(!existsSync(backup))throw new Error('Baseline backup missing.')
const db=new DatabaseSync(backup,{readOnly:true})
if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity failed; no volume was changed.')
if(Number(db.prepare("SELECT count(*) n FROM agent_grants WHERE mode='testnet'").get().n))throw new Error('Baseline has live grants. Stop and review canonical workers before copying financial state.')
db.close()
const code="const fs=require('node:fs');const path='/var/data/pathwise.sqlite';if(fs.existsSync(path)){console.error('Existing volume database preserved. No overwrite.');process.exit(2)}fs.writeFileSync(path,fs.readFileSync(0),{flag:'wx',mode:0o600});console.log('Consistent baseline copied to empty volume as non-root user.');"
const result=spawnSync('docker',['compose','run','--rm','-T','--no-deps','--entrypoint','node','app','-e',code],{input:readFileSync(backup),maxBuffer:1024*1024})
if(result.stdout)process.stdout.write(result.stdout)
if(result.status!==0){console.error('Volume seeding did not complete; existing data must be reviewed. No overwrite was permitted.');process.exitCode=result.status||1}
