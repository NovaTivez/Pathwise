import type { DatabaseSync } from 'node:sqlite'
import type { NoirSigner } from '@noirx402/agent-sdk'

export const skillMap = {
  certification: 'AWS Certified Cloud Practitioner',
  disclaimer: 'Pathwise curated demonstration skill map. Not an official or guaranteed exam-preparation syllabus.',
  skills: ['Cloud concepts', 'Security', 'Billing', 'Technology and services'],
}
export const providerDefinitions = [
  { id: 'cloudtrail', name: 'CloudTrail Academy' },
  { id: 'sandbox', name: 'Sandbox Grove' },
  { id: 'lantern', name: 'Exam Lantern' },
]
export type Provider = { id: string; name: string; merchant: string | null; demo: boolean }
export type Resource = { id: string; providerId: string; title: string; skills: string[]; format: string; priceStroops: string; originalPriceStroops: string; fulfillment: { description: string; codePrefix: string } }
const resources: Resource[] = [
  { id: 'cloud-foundations', providerId: 'cloudtrail', title: 'Cloud foundations course', skills: ['Cloud concepts'], format: 'course', priceStroops: '80000000', originalPriceStroops: '100000000', fulfillment: { description: 'Fictional course access; demonstration code only.', codePrefix: 'DEMO-CLOUD' } },
  { id: 'iam-lab', providerId: 'sandbox', title: 'IAM essentials lab', skills: ['Security'], format: 'lab', priceStroops: '60000000', originalPriceStroops: '60000000', fulfillment: { description: 'Fictional lab access; demonstration code only.', codePrefix: 'DEMO-IAM' } },
  { id: 'billing-practice', providerId: 'lantern', title: 'Billing practice exam', skills: ['Billing'], format: 'practice', priceStroops: '140000000', originalPriceStroops: '160000000', fulfillment: { description: 'Fictional practice questions, not an exam voucher.', codePrefix: 'DEMO-BILLING' } },
  { id: 'services-lab', providerId: 'lantern', title: 'Services discovery lab', skills: ['Technology and services'], format: 'lab', priceStroops: '90000000', originalPriceStroops: '110000000', fulfillment: { description: 'Fictional service discovery lab.', codePrefix: 'DEMO-SERVICES' } },
  { id: 'cloud-refresher', providerId: 'lantern', title: 'Cloud concepts refresher', skills: ['Cloud concepts'], format: 'course', priceStroops: '90000000', originalPriceStroops: '90000000', fulfillment: { description: 'Fictional refresher course.', codePrefix: 'DEMO-REFRESH' } },
  { id: 'complete-overview', providerId: 'cloudtrail', title: 'Cloud and security overview', skills: ['Cloud concepts', 'Security'], format: 'course', priceStroops: '180000000', originalPriceStroops: '200000000', fulfillment: { description: 'Fictional overview course.', codePrefix: 'DEMO-OVERVIEW' } },
]
export function seedCatalog(db: DatabaseSync, merchants: Record<string, NoirSigner | undefined>) {
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const p of providerDefinitions) db.prepare('INSERT INTO demo_providers (id,name,merchant) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET merchant=excluded.merchant').run(p.id, p.name, merchants[p.id]?.publicKey || null)
    for (const r of resources) db.prepare('INSERT OR IGNORE INTO demo_resources VALUES (?,?,?,?,?,?,?,?)').run(r.id, r.providerId, r.title, JSON.stringify(r.skills), r.format, r.priceStroops, r.originalPriceStroops, JSON.stringify(r.fulfillment))
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
export function readCatalog(db: DatabaseSync) {
  const providers = db.prepare('SELECT * FROM demo_providers ORDER BY id').all().map(p => ({ id: String(p.id), name: String(p.name), merchant: p.merchant as string | null, demo: true }))
  const resources = db.prepare('SELECT * FROM demo_resources ORDER BY id').all().map(r => ({ id: String(r.id), providerId: String(r.provider_id), title: String(r.title), skills: JSON.parse(String(r.skills)) as string[], format: String(r.format), priceStroops: String(r.price), originalPriceStroops: String(r.original_price), fulfillment: JSON.parse(String(r.fulfillment)) as Resource['fulfillment'] }))
  return { providers, resources }
}
