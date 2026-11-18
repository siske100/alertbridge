import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { sb, active, dec, tgSend } from './common.js'

const POLL = Number(process.env.POLL_SECONDS || 20) * 1000
const disable = (uid) => sb.from('profiles').update({ connected: false }).eq('id', uid)
const logAlert = (uid, subject, ok) => sb.from('alerts').insert({ user_id: uid, subject: subject.slice(0, 200), delivered: ok })

async function check(c) {
  const token = dec(c.bot_token_enc), chat = c.chat_id
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: c.gmail, pass: dec(c.app_password_enc) }, logger: false })
  client.on('error', () => {})
  try { await client.connect() }
  catch (e) {
    if (e.authenticationFailed) {
      await disable(c.user_id)
      await tgSend(token, chat, 'AlertBridge could not log in to your Gmail. Open your dashboard and reconnect.').catch(() => {})
    } else console.warn('connect', c.user_id, e.message)
    return
  }
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const uids = await client.search({ from: 'noreply@tradingview.com', seen: false }, { uid: true })
      for (const uid of uids) {
        const m = await client.fetchOne(uid, { source: true }, { uid: true })
        const p = await simpleParser(m.source)
        const subject = p.subject || '(no subject)'
        let ok = true
        try { await tgSend(token, chat, `${subject}\n\n${(p.text || '').trim()}`) }
        catch (e) { ok = false; if (e.status === 403) await disable(c.user_id) }
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
        await logAlert(c.user_id, subject, ok)
      }
    } finally { lock.release() }
  } catch (e) { console.warn('check', c.user_id, e.message) }
  finally { await client.logout().catch(() => {}) }
}

async function loop() {
  try {
    const { data: ps } = await sb.from('profiles').select('id,is_admin,trial_ends_at,subscription_expires_at').eq('connected', true)
    const ids = (ps || []).filter((p) => p.is_admin || active(p.subscription_expires_at) || active(p.trial_ends_at)).map((p) => p.id)
    if (ids.length) {
      const { data: creds } = await sb.from('credentials').select('*').in('user_id', ids)
      for (let i = 0; i < creds.length; i += 10) await Promise.allSettled(creds.slice(i, i + 10).map(check))
    }
  } catch (e) { console.error('loop', e.message) }
  setTimeout(loop, POLL)
}
loop()
