import express from 'express'
import cors from 'cors'
import { ImapFlow } from 'imapflow'
import { sb, now, active, hsh, enc, tgSend } from './common.js'

const E = process.env
const PRICE = Number(E.PRICE_KES || 780)
const BASE = E.DARAJA_BASE || 'https://sandbox.safaricom.co.ke'
const DAY = 864e5

const app = express()
app.use(cors({ origin: E.FRONTEND_URL }))
app.use(express.json())

class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
const h = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (!e.status) console.error(e)
  res.status(e.status || 500).json({ detail: e.status ? e.message : 'Something went wrong. Try again.' })
})

async function uidFrom(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '')
  const { data, error } = t ? await sb.auth.getUser(t) : { error: true }
  if (error || !data?.user) throw new HttpError(401, 'Please log in again.')
  const payload = t.split('.')[1]
  let claims
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) }
  catch { throw new HttpError(401, 'Please log in again.') }
  const methods = (claims.amr || []).map((method) => typeof method === 'string' ? method : method.method)
  return { id: data.user.id, aal: claims.aal, methods }
}
async function profile(uid) {
  const { data } = await sb.from('profiles').select('*').eq('id', uid).limit(1)
  if (!data?.length) throw new HttpError(404, 'Profile not found.')
  return data[0]
}
function requireAdminMfa(user, p) {
  if (p.is_admin && (user.aal !== 'aal2' || !user.methods.includes('password') || !user.methods.includes('totp'))) {
    throw new HttpError(403, 'Admin access requires an email/password login and an authenticator code.')
  }
}

app.get('/health', (_q, r) => r.json({ ok: true }))

app.post('/api/connect', h(async (req, res) => {
  const user = await uidFrom(req), uid = user.id, p = await profile(uid)
  requireAdminMfa(user, p)
  const { gmail = '', app_password = '', bot_token = '', chat_id = '' } = req.body
  if (!gmail || !app_password || !bot_token || !chat_id) throw new HttpError(400, 'Fill in all four fields.')
  const paid = active(p.subscription_expires_at), trial = active(p.trial_ends_at)
  if (!p.is_admin && p.trial_ends_at && !paid && !trial) throw new HttpError(402, 'Your trial has ended. Subscribe to continue.')

  const gh = hsh(gmail), ch = hsh(chat_id)
  const { data: dup } = await sb.from('credentials').select('user_id').or(`gmail_hash.eq.${gh},chat_hash.eq.${ch}`).neq('user_id', uid)
  if (dup?.length) throw new HttpError(409, 'This Gmail or Telegram chat is already linked to another account.')

  const pw = app_password.replace(/\s/g, '')
  const im = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: gmail.trim(), pass: pw }, logger: false })
  try { await im.connect(); await im.logout() }
  catch { throw new HttpError(400, 'Gmail login failed. Check the address and the 16-character app password.') }
  try { await tgSend(bot_token.trim(), chat_id.trim(), 'AlertBridge connected. Your TradingView alerts will arrive here.') }
  catch { throw new HttpError(400, 'Telegram test failed. Press Start on your bot, then check the token and chat ID.') }

  await sb.from('credentials').upsert({ user_id: uid, gmail: gmail.trim(), app_password_enc: enc(pw),
    bot_token_enc: enc(bot_token.trim()), chat_id: chat_id.trim(), gmail_hash: gh, chat_hash: ch })
  const upd = { connected: true }
  if (!p.is_admin && !p.trial_ends_at && !paid) upd.trial_ends_at = new Date(Date.now() + 2 * DAY).toISOString()
  await sb.from('profiles').update(upd).eq('id', uid)
  res.json({ ok: true })
}))

function normPhone(ph = '') {
  let d = ph.replace(/\D/g, '')
  if (d.startsWith('0')) d = '254' + d.slice(1)
  else if (/^[71]/.test(d)) d = '254' + d
  if (!/^254\d{9}$/.test(d)) throw new HttpError(400, 'Enter a valid Safaricom number like 0712345678.')
  return d
}

app.post('/api/pay', h(async (req, res) => {
  const user = await uidFrom(req), uid = user.id, p = await profile(uid)
  requireAdminMfa(user, p)
  if (p.is_admin) throw new HttpError(403, 'Admin accounts do not need a subscription.')
  const phone = normPhone(req.body.phone)
  let r
  try {
    const t = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: 'Basic ' + Buffer.from(`${E.MPESA_CONSUMER_KEY}:${E.MPESA_CONSUMER_SECRET}`).toString('base64') } })
    const { access_token } = await t.json()
    const ts = now().toISOString().replace(/\D/g, '').slice(0, 14)
    const body = { BusinessShortCode: E.MPESA_SHORTCODE, Password: Buffer.from(E.MPESA_SHORTCODE + E.MPESA_PASSKEY + ts).toString('base64'),
      Timestamp: ts, TransactionType: 'CustomerPayBillOnline', Amount: PRICE, PartyA: phone, PartyB: E.MPESA_SHORTCODE,
      PhoneNumber: phone, CallBackURL: `${E.PUBLIC_URL}/api/mpesa/callback/${E.CALLBACK_SECRET}`,
      AccountReference: 'AlertBridge', TransactionDesc: 'AlertBridge 30 days' }
    r = await (await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, { method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
    if (r.ResponseCode !== '0') throw new Error(JSON.stringify(r))
  } catch (e) { console.error('stk', e.message); throw new HttpError(502, 'Could not send the M-Pesa prompt. Try again in a minute.') }
  await sb.from('payments').insert({ user_id: uid, checkout_id: r.CheckoutRequestID, phone, amount: PRICE, status: 'pending' })
  res.json({ ok: true })
}))

app.post('/api/mpesa/callback/:secret', h(async (req, res) => {
  if (req.params.secret !== E.CALLBACK_SECRET) throw new HttpError(404, 'Not found')
  const d = req.body?.Body?.stkCallback || {}, ok = { ResultCode: 0, ResultDesc: 'Accepted' }
  const { data } = await sb.from('payments').select('*').eq('checkout_id', d.CheckoutRequestID || '').limit(1)
  const pay = data?.[0]
  if (!pay || pay.status !== 'pending') return res.json(ok)
  if (d.ResultCode !== 0) { await sb.from('payments').update({ status: 'failed' }).eq('id', pay.id); return res.json(ok) }
  const items = Object.fromEntries((d.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]))
  if (Number(items.Amount || 0) < PRICE) {
    await sb.from('payments').update({ status: 'underpaid', receipt: items.MpesaReceiptNumber }).eq('id', pay.id); return res.json(ok)
  }
  const cur = (await profile(pay.user_id)).subscription_expires_at
  const start = cur && new Date(cur) > now() ? new Date(cur) : now()
  await sb.from('profiles').update({ subscription_expires_at: new Date(start.getTime() + 30 * DAY).toISOString() }).eq('id', pay.user_id)
  await sb.from('payments').update({ status: 'paid', receipt: items.MpesaReceiptNumber }).eq('id', pay.id)
  res.json(ok)
}))

app.listen(E.PORT || 3000, () => console.log('API listening'))
