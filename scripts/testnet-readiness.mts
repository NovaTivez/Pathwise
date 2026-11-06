import { paymentConfig } from '../apps/server/src/payment-config.ts'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultDatabasePath } from '../apps/server/src/database.ts'
import { StrKey } from '@stellar/stellar-sdk'
const config = paymentConfig()
const dbPath = process.env.DATABASE_PATH || defaultDatabasePath
let bound: string[] = []
if (existsSync(dbPath)) { const db = new DatabaseSync(dbPath, { readOnly: true }); bound = db.prepare('SELECT DISTINCT owner FROM wallet_bindings').all().map(row=>String(row.owner)); db.close() }
const ownerArgument = process.argv.find(a=>StrKey.isValidEd25519PublicKey(a))
const owner = ownerArgument || (bound.length===1 ? bound[0] : undefined)
const accounts = [{role:'owner',address:owner},{role:'agent',address:config.agent?.publicKey},...Object.entries(config.providers).map(([id,s])=>({role:`provider:${id}`,address:s?.publicKey}))]
const results=[]
for (const account of accounts) {
  if (!account.address) { results.push({...account,status:'missing or not yet verified'}); continue }
  const response=await fetch(`https://horizon-testnet.stellar.org/accounts/${account.address}`,{signal:AbortSignal.timeout(10000)})
  if(response.status===404){results.push({...account,status:'not funded on Testnet'});continue}
  if(!response.ok)throw new Error('Testnet account read failed; no funding or payment attempted.')
  const value=await response.json()
  const native=value.balances?.find((b:{asset_type?:string})=>b.asset_type==='native')
  results.push({...account,status:'Testnet account exists',nativeTestXlm:native?.balance || null,sellingLiabilities:native?.selling_liabilities || '0',ownerVerified:account.role==='owner'?bound.includes(account.address):undefined})
}
const report={checkedAt:new Date().toISOString(),purpose:'read-only account and configuration readiness; no transactions submitted',network:config.network.networkPassphrase,rpc:config.network.rpcUrl,contracts:config.network.contracts,asset:config.asset,paymentsEnabled:config.paymentsEnabled,accounts:results,plannedDemo:{learningBudget:'30',examReserve:'10',perPurchaseLimit:'10',escrowDeposit:'20',serviceFee:config.velo.amount,resourcePrices:['6','8'],fees:'Additional Testnet network/resource fees; exact fees are calculated by SDK simulation before each operation, not included in resource prices.'},veloBlockers:config.veloProblems}
const output=process.env.READINESS_OUTPUT || 'artifacts/testnet-readiness.json';mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2))
