import { useEffect, useState, useCallback } from 'react'
import { LOCAL_DEMO, supabase, api } from '../supabase'

const fmt = d => new Date(d).toLocaleString()
const daysLeft = d => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 864e5))
const sections = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'connections', label: 'Connections' }
]

export default function Dashboard({ session }) {
  const [section, setSection] = useState('dashboard')
  const [p, setP] = useState(null), [alerts, setAlerts] = useState([]), [payments, setPayments] = useState([])
  const [transactionError, setTransactionError] = useState('')
  const [f, setF] = useState({ gmail: '', app_password: '', bot_token: '', chat_id: '' })
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(''), [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setP(data || {})
    const a = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20)
    setAlerts(a.data || [])
    const history = await supabase.from('payments')
      .select('id, amount, status, receipt, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (history.error) {
      setTransactionError('Could not load transaction history.')
    } else {
      setTransactionError('')
      setPayments(history.data || [])
    }
  }, [session])
  useEffect(() => { load() }, [load])
  if (!p) return <main className="narrow"><p className="muted">Loading...</p></main>

  const now = Date.now()
  const exempt = p.is_admin === true
  const paid = p.subscription_expires_at && new Date(p.subscription_expires_at) > now
  const trial = !paid && p.trial_ends_at && new Date(p.trial_ends_at) > now
  const locked = !paid && !trial && !!p.trial_ends_at
  const status = exempt ? 'Admin access' : paid ? 'Active' : trial ? 'Free trial' : locked ? 'Expired' : 'Not started'
  const endsAt = paid ? p.subscription_expires_at : p.trial_ends_at

  async function connect(e) {
    e.preventDefault(); setBusy(true); setMsg('')
    try {
      await api('/api/connect', f)
      setMsg(LOCAL_DEMO ? 'Demo only: connection simulated; no Gmail or Telegram account was contacted.' : 'Connected. Your alerts are now being forwarded.')
      setF({ gmail: '', app_password: '', bot_token: '', chat_id: '' })
      await load()
    } catch (err) {
      setMsg(err.message)
    }
    setBusy(false)
  }

  async function pay(e) {
    e.preventDefault(); setPaying(true); setMsg('')
    try {
      await api('/api/pay', { phone, amount: 780 })
      if (LOCAL_DEMO) {
        setMsg('Demo only: no payment was sent or charged.')
        await load()
      } else {
        setMsg('Check your phone and enter your M-Pesa PIN.')
        const t = setInterval(async () => { await load() }, 4000)
        setTimeout(() => clearInterval(t), 60000)
      }
    } catch (err) {
      setMsg(err.message)
    }
    setPaying(false)
  }

  const field = (k, label, type = 'text') => <label key={k}>{label}<input type={type} required value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} autoComplete="off" /></label>
  const alertList = alerts.length === 0
    ? <p className="muted">{LOCAL_DEMO ? 'No alerts in the local demo.' : 'No alerts yet. Once TradingView emails your Gmail, they appear here.'}</p>
    : <ul className="alerts">{alerts.map(a => <li key={a.id}><span className={'dot ' + (a.delivered ? 'ok' : 'bad')} />
      <div><b>{a.subject}</b><small>{fmt(a.created_at)} · {a.delivered ? 'Delivered' : 'Failed'}</small></div></li>)}</ul>

  return (<div className="dash-layout">
    <aside className="dash-sidebar" aria-label="Dashboard sections">
      <p className="sidebar-label">Workspace</p>
      <nav className="side-nav" aria-label="Dashboard navigation">
        {sections.map(item => <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => { setSection(item.id); setMsg('') }}>
          {item.label}
        </button>)}
      </nav>
      <p className="sidebar-account">{session.user.email}</p>
    </aside>

    <main className="dash-view">
      {section === 'dashboard' && <>
        <header className="dash-heading"><h1>Dashboard</h1><p className="muted">Your latest TradingView alert activity.</p></header>
        <section className="card"><h3>Recent alerts</h3>{alertList}</section>
      </>}

      {section === 'subscription' && <>
        <header className="dash-heading"><h1>Subscription</h1><p className="muted">Manage your plan and review transactions.</p></header>
        <section className={'card status ' + (locked ? 'bad' : 'ok')}>
          <span className="badge">{status}</span>
          <h2>{exempt ? 'No subscription required' : paid ? 'Subscription active' : trial ? 'Free trial running' : locked ? 'Your access has ended' : 'Connect to start your free trial'}</h2>
          {endsAt && <p className="muted">{locked ? 'Ended' : `${daysLeft(endsAt)} day(s) left, ends ${fmt(endsAt)}`}</p>}
        </section>

        {!exempt && (locked || trial) && <section className="card">
          <h3>{locked ? 'Renew with M-Pesa' : 'Subscribe early'}</h3>
          <p className="muted">{LOCAL_DEMO ? 'Demo only: payment is simulated; no charge will be made.' : 'KES 780 for 30 days. You get an M-Pesa prompt on your phone.'}</p>
          <form onSubmit={pay} className="inline">
            <input aria-label="M-Pesa phone number" placeholder="07XX XXX XXX" required value={phone} onChange={e => setPhone(e.target.value)} />
            <button className="btn" disabled={paying}>{LOCAL_DEMO ? 'Simulate payment' : 'Pay KES 780'}</button>
          </form>
        </section>}

        {msg && <p className="note">{msg}</p>}

        <section className="card">
          <h3>Transaction history</h3>
          {transactionError ? <p className="note" role="alert">{transactionError}</p> : payments.length === 0
            ? <p className="muted">No transactions yet.</p>
            : <div className="table-scroll"><table className="transactions">
              <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
              <tbody>{payments.map(payment => <tr key={payment.id}>
                <td>{fmt(payment.created_at)}</td>
                <td>KES {payment.amount}</td>
                <td><span className="badge">{payment.status}</span></td>
                <td>{payment.receipt || '—'}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>
      </>}

      {section === 'connections' && <>
        <header className="dash-heading"><h1>Connections</h1><p className="muted">Connect Gmail and Telegram to receive your alerts.</p></header>
        <section className={'card status ' + (p.connected ? 'ok' : locked ? 'bad' : '')}>
          <span className="badge">{p.connected ? 'Connected' : locked ? 'Subscription expired' : 'Not connected'}</span>
          <p className="muted">{p.connected
            ? LOCAL_DEMO ? 'Demo connection active; no messages are forwarded.' : 'Forwarding alerts to Telegram.'
            : locked ? 'Renew your subscription before connecting accounts.' : 'Connect your accounts below to start.'}</p>
        </section>

        {!locked && <section className="card">
          <h3>Connect your accounts</h3>
          <p className="muted">{LOCAL_DEMO ? 'Demo only: connection is simulated; credentials are not checked or saved.' : <>Stuck? <a href="/#top">See the setup guide.</a> Saved details are encrypted and never shown again.</>}</p>
          <form onSubmit={connect}>
            {field('gmail', 'Gmail address', 'email')}
            {field('app_password', 'Gmail app password', 'password')}
            {field('bot_token', 'Telegram bot token', 'password')}
            {field('chat_id', 'Telegram chat ID')}
            <button className="btn" disabled={busy}>{busy ? 'Testing...' : 'Test connection and save'}</button>
          </form>
        </section>}
        {msg && <p className="note">{msg}</p>}
      </>}
    </main>
  </div>)
}
