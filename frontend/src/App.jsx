import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { isAdminEmail, supabase } from './supabase'
import Home from './pages/Home.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)
  const location = useLocation()
  useEffect(() => {
    let active = true
    async function applySession(s) {
      if (!active) return
      if (s && isAdminEmail(s.user.email)) {
        const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(s.access_token)
        const methods = assurance?.currentAuthenticationMethods.map(method => typeof method === 'string' ? method : method.method) || []
        if (error || assurance?.currentLevel !== 'aal2' || !methods.includes('password') || !methods.includes('totp')) {
          setSession(null)
          return
        }
      }
      if (active) setSession(s)
    }
    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      window.setTimeout(() => applySession(s), 0)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  if (session === undefined) return null
  return (<>
    <header className="top"><Link to="/" className="brand">AlertBridge</Link>
      <nav>{session && location.pathname !== '/'
        ? <><Link to="/dashboard">Dashboard</Link><button className="link" onClick={() => supabase.auth.signOut()}>Log out</button></>
        : !session && <><Link to="/login">Log in</Link><Link to="/signup" className="btn sm">Start free trial</Link></>}</nav></header>
    <Routes>
      <Route path="/" element={<Home session={session} />} />
      <Route path="/login" element={session ? <Navigate to="/dashboard" /> : <Auth mode="login" />} />
      <Route path="/signup" element={session ? <Navigate to="/dashboard" /> : <Auth mode="signup" />} />
      <Route path="/dashboard" element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
    </Routes>
  </>)
}
