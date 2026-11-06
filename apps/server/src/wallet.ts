import { Keypair, Networks, StrKey, TransactionBuilder, WebAuth } from '@stellar/stellar-sdk'
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export function walletAuth(db: DatabaseSync, origin: string) {
  const server = Keypair.random() // Authentication only; never funded or used to submit transactions.
  const domain = new URL(origin).hostname
  return {
    challenge(session: string, owner: unknown) {
      if (typeof owner !== 'string' || !StrKey.isValidEd25519PublicKey(owner)) throw new Error('Connect a single-key Stellar G-address wallet.')
      const binding = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)
      if (binding && binding.owner !== owner) throw new Error('This session is already bound to a different wallet. Use a new browser session.')
      const xdr = WebAuth.buildChallengeTx(server, owner, domain, 300, Networks.TESTNET, domain)
      const id = randomUUID()
      db.prepare('INSERT INTO wallet_challenges (id, session_hash, owner, xdr, server_key, expires) VALUES (?, ?, ?, ?, ?, ?)').run(id, session, owner, xdr, server.publicKey(), Date.now() + 300000)
      return { id, xdr, networkPassphrase: Networks.TESTNET, serverPublicKey: server.publicKey(), domain }
    },
    verify(session: string, id: unknown, signedXdr: unknown) {
      if (typeof id !== 'string' || typeof signedXdr !== 'string') throw new Error('A signed challenge is required.')
      const challenge = db.prepare('SELECT * FROM wallet_challenges WHERE id=? AND session_hash=? AND consumed=0 AND expires>?').get(id, session, Date.now())
      if (!challenge) throw new Error('Challenge expired or already used.')
      const unsigned = TransactionBuilder.fromXDR(challenge.xdr as string, Networks.TESTNET)
      const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)
      if (!unsigned.hash().equals(signed.hash())) throw new Error('Signed challenge does not match this session.')
      const owner = challenge.owner as string
      const signers = WebAuth.verifyChallengeTxSigners(signedXdr, challenge.server_key as string, Networks.TESTNET, [owner], domain, domain)
      if (!signers.includes(owner)) throw new Error('Wallet signature is missing.')
      db.exec('BEGIN IMMEDIATE')
      try {
        const binding = db.prepare('SELECT owner FROM wallet_bindings WHERE session_hash=?').get(session)
        if (binding && binding.owner !== owner) throw new Error('Session wallet cannot be changed.')
        if (!db.prepare('UPDATE wallet_challenges SET consumed=1 WHERE id=? AND consumed=0').run(id).changes) throw new Error('Challenge already used.')
        db.prepare('INSERT INTO wallet_bindings VALUES (?, ?, ?) ON CONFLICT(session_hash) DO UPDATE SET verified_at=excluded.verified_at').run(session, owner, Date.now())
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return { owner }
    },
  }
}
