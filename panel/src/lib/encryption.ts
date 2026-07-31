/**
 * AES-256-GCM field encryption — format: base64(nonce[12] + tag[16] + ciphertext[n])
 * Compatible with Python supabase_store._encrypt_field / _decrypt_field
 */

const KEY_HEX = process.env.ENCRYPTION_KEY || ''
let _key: CryptoKey | null = null

async function getKey(): Promise<CryptoKey | null> {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null
  if (_key) return _key
  const keyBytes = Buffer.from(KEY_HEX, 'hex')
  _key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return _key
}

export async function encryptField(value: string): Promise<string> {
  const key = await getKey()
  if (!key || !value) return value
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)
  const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, encoded)
  const full = new Uint8Array(result)
  // AES-GCM in WebCrypto appends tag at the end: ciphertext[n] + tag[16]
  const ct = full.slice(0, full.length - 16)
  const tag = full.slice(full.length - 16)
  const combined = new Uint8Array(12 + 16 + ct.length)
  combined.set(nonce, 0)
  combined.set(tag, 12)
  combined.set(ct, 28)
  return Buffer.from(combined).toString('base64')
}

export async function decryptField(value: string): Promise<string> {
  const key = await getKey()
  if (!key || !value) return value
  try {
    const buf = Buffer.from(value, 'base64')
    const nonce = buf.subarray(0, 12)
    const tag   = buf.subarray(12, 28)
    const ct    = buf.subarray(28)
    // Reconstruct for WebCrypto: ciphertext + tag
    const ctWithTag = new Uint8Array(ct.length + 16)
    ctWithTag.set(ct, 0)
    ctWithTag.set(tag, ct.length)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ctWithTag)
    return new TextDecoder().decode(decrypted)
  } catch {
    return value  // plaintext fallback during migration window
  }
}
