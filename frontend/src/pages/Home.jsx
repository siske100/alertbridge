import { Link } from 'react-router-dom'

// Drop your real screenshots into public/guide/ as step1.png ... step5.png.
// Until then, the drawn placeholder below is shown.
function Shot({ n, title, hint }) {
  return (<div className="shot">
    <img src={`/guide/step${n}.png`} alt={title} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block' }} />
    <svg viewBox="0 0 360 210" style={{ display: 'none' }} role="img" aria-label={title}>
      <rect x="1" y="1" width="358" height="208" rx="10" fill="#16263D" stroke="#2A3F5E" />
      <circle cx="16" cy="16" r="4" fill="#E5675A" /><circle cx="30" cy="16" r="4" fill="#F2B84B" /><circle cx="44" cy="16" r="4" fill="#2BB5A0" />
      <rect x="20" y="40" width="150" height="10" rx="3" fill="#2A3F5E" />
      <rect x="20" y="62" width="320" height="30" rx="6" fill="#0F1B2D" stroke="#2A3F5E" />
      <rect x="20" y="104" width="320" height="30" rx="6" fill="#0F1B2D" stroke="#F2B84B" strokeWidth="2" />
      <rect x="28" y="115" width="140" height="8" rx="3" fill="#F2B84B" opacity=".7" />
      <rect x="20" y="152" width="110" height="34" rx="8" fill="#2BB5A0" />
      <text x="75" y="174" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F1B2D">{hint}</text>
    </svg></div>)
}

function MarketPreview() {
    const candles = [
      [35, 155, 171, 146, 150], [61, 150, 164, 135, 141], [87, 141, 153, 129, 148],
      [113, 148, 157, 125, 132], [139, 132, 145, 119, 124], [165, 124, 140, 112, 134],
      [191, 134, 143, 108, 116], [217, 116, 128, 99, 106], [243, 106, 119, 91, 112],
      [269, 112, 124, 96, 101], [295, 101, 114, 81, 88], [321, 88, 104, 78, 97],
      [347, 97, 108, 72, 81], [373, 81, 93, 65, 72], [399, 72, 87, 59, 80],
      [425, 80, 91, 53, 62], [451, 62, 78, 48, 56]
    ]
    return (<div className="market-preview" aria-label="Sample forex chart and sent Telegram signal">
      <article className="market-chart">
        <div className="market-head"><span><i /> FOREX MARKET SAMPLE</span><span>15 MIN</span></div>
        <div className="market-pair"><strong>EUR/USD</strong><span>1.08426</span><b>+0.42%</b></div>
        <svg className="price-chart" viewBox="0 0 520 220" role="img" aria-label="Sample EUR/USD candlestick chart trending upward">
          <g className="chart-grid">
            <path d="M12 35H508M12 75H508M12 115H508M12 155H508M12 195H508" />
            <path d="M110 20V200M210 20V200M310 20V200M410 20V200" />
          </g>
          <path className="chart-average" d="M20 164 C72 148 89 153 126 133 S190 138 226 117 S285 121 322 102 S384 109 420 83 S467 75 493 58" />
          {candles.map(([x, open, high, low, close]) => {
            const rising = close < open
            return <g key={x} className={rising ? 'candle-up' : 'candle-down'}>
              <path d={`M${x} ${high}V${low}`} />
              <rect x={x - 5} y={Math.min(open, close)} width="10" height={Math.max(4, Math.abs(open - close))} rx="1" />
            </g>
          })}
          <path className="chart-price-line" d="M12 58H508" />
          <text x="468" y="51">1.084</text>
        </svg>
        <div className="chart-footer"><span>RSI (14)</span><svg viewBox="0 0 360 34" aria-hidden="true"><path d="M2 25 C28 22 32 10 54 16 S82 27 104 15 S135 22 156 12 S183 19 204 9 S231 18 250 11 S283 16 302 7 S333 14 358 4" /></svg><b>62.8</b></div>
      </article>
      <article className="sent-signal">
        <div className="signal-head"><span className="signal-icon">AB</span><span>Telegram signal</span><span className="signal-sent"><i /> SENT</span></div>
        <p className="signal-pair">EUR/USD <strong>BUY</strong></p>
        <div className="signal-details"><span>Entry <b>1.08426</b></span><span>Stop loss <b>1.08290</b></span><span>Take profit <b>1.08710</b></span></div>
        <p className="signal-caption">Sample alert delivered to Telegram</p>
        <small>Demo preview · not a live trade</small>
      </article>
    </div>)
}

const steps = [
  { t: 'Create your Telegram bot', d: <>Open Telegram, search for <b>@BotFather</b> and send <code>/newbot</code>. Pick a name. BotFather replies with a <b>bot token</b>. Copy it. Then open your new bot and press Start.</>, h: 'Copy token' },
  { t: 'Find your chat ID', d: <>Search for <b>@userinfobot</b> in Telegram and press Start. It replies with your <b>chat ID</b>, a number like 123456789. Copy it.</>, h: 'Copy ID' },
  { t: 'Make a Gmail app password', d: <>In your Google account, turn on <b>2-Step Verification</b>. Then open <b>App passwords</b>, create one named AlertBridge, and copy the 16 characters. This is not your normal Gmail password.</>, h: 'Create' },
  { t: 'Set up your TradingView alert', d: <>Create an alert on your chart. Under <b>Notifications</b>, tick <b>Send email</b>. TradingView sends it from noreply@tradingview.com to the Gmail you will connect.</>, h: 'Create alert' },
  { t: 'Connect everything', d: <>Log in, open your dashboard, and paste your Gmail, app password, bot token and chat ID. Press <b>Test connection</b>. Your 2-day free trial starts when the test passes.</>, h: 'Test connection' },
]

export default function Home({ session }) {
  return (<main>
    <section className="hero" id="top">
      <p className="eyebrow">A quieter way to stay on top of the market</p><h1>Your TradingView alerts, on your phone in Telegram.</h1>
      <p>AlertBridge watches your Gmail for TradingView alert emails and forwards each one to your Telegram within seconds.</p>
      <div className="row"><Link className="btn" to={session ? '/dashboard' : '/signup'}>Start 2-day free trial</Link><span className="price"><b>KES 780</b> / month after trial. Pay with M-Pesa.</span></div>
      <div className="ticker" aria-hidden="true"><span>BTCUSD crossed 98,000</span><span>EURUSD RSI below 30</span><span>XAUUSD 4H close above 2,700</span></div>
      <MarketPreview />
    </section>
    <section className="guide"><h2>Set up in 5 steps</h2>
      <p className="muted">Takes about 10 minutes. You only do it once.</p>
      {steps.map((s, i) => (<article key={i} className={i % 2 ? 'step flip' : 'step'}>
        <div><h3><span className="n">{i + 1}</span>{s.t}</h3><p>{s.d}</p></div>
        <Shot n={i + 1} title={s.t} hint={s.h} /></article>))}
    </section>
    <section className="faq"><h2>Questions</h2>
      <details><summary>Is it safe to share my app password?</summary><p>Your app password is encrypted before it is stored, and only lets AlertBridge read your inbox. You can revoke it in your Google account any time, and delete your data from the dashboard.</p></details>
      <details><summary>What happens when my trial ends?</summary><p>Forwarding pauses and the dashboard asks for KES 780 by M-Pesa. Your settings stay saved for 7 days.</p></details>
      <details><summary>An alert did not arrive. What do I check?</summary><p>Confirm TradingView sent the email, then look at Recent alerts in your dashboard. If it shows Failed, press Test connection.</p></details>
      <details><summary>Does it work with other email providers?</summary><p>Not yet. Gmail only for now.</p></details>
    </section>
    <footer className="foot">
      <section className="contact-help" aria-labelledby="contact-help-title">
        <h2 id="contact-help-title">Need help?</h2>
        <p>Call or WhatsApp us at <a href="tel:+254142719885">0142719885</a>.</p>
        <div className="contact-links">
          <a className="btn sm" href="tel:+254142719885">Call us</a>
          <a className="btn sm" href="https://wa.me/254142719885" target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </section>
      <p className="foot-note">AlertBridge. Not affiliated with TradingView or Telegram.</p>
    </footer>
  </main>)
}
