import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAdminEmail, LOCAL_DEMO, supabase } from '../supabase'

export default function Auth({ mode }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const [mfaStep, setMfaStep] = useState(''), [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState(''), [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const signup = mode === 'signup'

  async function startAdminMfa() {
    setBusy(true); setMsg('')
    try {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError) throw assuranceError
      const methods = assurance.currentAuthenticationMethods.map(method => typeof method === 'string' ? method : method.method)
      if (!methods.includes('password')) {
        await supabase.auth.signOut()
        setMsg('Admin login requires your email and password before the authenticator code.')
        return
      }
      if (assurance.currentLevel === 'aal2' && methods.includes('totp')) return

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const verified = factors.totp.find(factor => factor.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        setMfaStep('verify')
        return
      }

      for (const factor of factors.all.filter(item => item.factor_type === 'totp' && item.status !== 'verified')) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (error) throw error
      }
      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AlertBridge admin'
      })
      if (enrollmentError) throw enrollmentError
      setFactorId(enrollment.id)
      setQrCode(enrollment.totp.qr_code)
      setSecret(enrollment.totp.secret)
      setMfaStep('enroll')
    } catch (error) {
      setMsg(error.message || 'Could not set up authenticator verification.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (signup || LOCAL_DEMO) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !error && isAdminEmail(data.session?.user.email)) startAdminMfa()
    })
    return () => { active = false }
  }, [signup])

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg('')
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({ email, password: pw })
        : await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) throw error
      if (signup) {
        if (data.session && isAdminEmail(data.user?.email)) {
          await startAdminMfa()
        } else if (!data.session) {
          setMsg('Account created, but email confirmation is still enabled in Supabase. Turn it off to sign in immediately.')
        }
      } else if (isAdminEmail(data.user?.email)) {
        await startAdminMfa()
      }
    } catch (error) {
      setMsg(error.message || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }
  async function verifyCode(e) {
    e.preventDefault(); setBusy(true); setMsg('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
      if (error) throw error
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(data.access_token)
      if (assuranceError) throw assuranceError
      const methods = assurance.currentAuthenticationMethods.map(method => typeof method === 'string' ? method : method.method)
      if (assurance.currentLevel !== 'aal2' || !methods.includes('password') || !methods.includes('totp')) {
        throw new Error('Authenticator verification did not complete. Please try again.')
      }
      setMfaStep('')
      setCode('')
    } catch (error) {
      setMsg(error.message || 'The authenticator code could not be verified.')
    } finally {
      setBusy(false)
    }
  }
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard' } })
    if (error) setMsg(error.message)
  }

  if (mfaStep) return <main className="narrow">
    <h1>{mfaStep === 'enroll' ? 'Set up Google Authenticator' : 'Authenticator verification'}</h1>
    {mfaStep === 'enroll' && <>
      <p className="muted">Scan this QR code with Google Authenticator, then enter its six-digit code to finish setup.</p>
      <img className="mfa-qr" src={`data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`} alt="Authenticator setup QR code" />
      <p className="muted">Can't scan it? Enter this setup key manually:</p>
      <p><code>{secret}</code></p>
    </>}
    {mfaStep === 'verify' && <p className="muted">Enter the current six-digit code from Google Authenticator.</p>}
    <form onSubmit={verifyCode}>
      <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} /></label>
      <button className="btn wide" disabled={busy}>{busy ? 'Verifying...' : 'Verify code'}</button>
    </form>
    {msg && <p className="note" role="alert">{msg}</p>}
    <button className="link" onClick={() => supabase.auth.signOut()}>Cancel and log out</button>
  </main>

  return (<main className="narrow"><h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
    <p className="muted">{signup ? '2 days free. No payment needed to start.' : 'Log in to see your alerts.'}</p>
    {LOCAL_DEMO
      ? <p className="note">Local-only demo account: <b>test@alertbridge.local</b> / <b>Demo123!</b>. Demo data stays in this browser; no production account or payment is used.</p>
      : <><button className="btn ghost wide" onClick={google}>Continue with Google</button><p className="or">or use email</p></>}
    <form onSubmit={submit}>
      <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} /></label>
      <button className="btn wide" disabled={busy}>{signup ? 'Create account' : 'Log in'}</button>
    </form>
    {msg && <p className="note">{msg}</p>}
    <p className="muted">{signup ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}</p>
  </main>)
}
