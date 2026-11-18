import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64') // 32 bytes

export const now = () => new Date()
export const active = (s) => !!s && new Date(s) > now()
export const hsh = (v) => crypto.createHash('sha256').update((process.env.HASH_SALT || '') + v.trim().toLowerCase()).digest('hex')

export function enc(text) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const e = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), e]).toString('base64')
}
export function dec(s) {
  const b = Buffer.from(s, 'base64')
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12))
  d.setAuthTag(b.subarray(12, 28))
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
}

export async function tgSend(token, chat, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 4000) }) })
  if (!r.ok) throw Object.assign(new Error('telegram ' + r.status), { status: r.status })
}
