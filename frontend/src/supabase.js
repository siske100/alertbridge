import { createClient } from '@supabase/supabase-js'

const demoRequested = import.meta.env.VITE_LOCAL_DEMO === 'true'
export const LOCAL_DEMO = demoRequested && ['localhost', '127.0.0.1'].includes(window.location.hostname)
export const isAdminEmail = email => email?.trim().toLowerCase() === 'joelkesis014@gmail.com'
const DEMO_EMAIL = 'test@alertbridge.local'
const DEMO_PASSWORD = 'Demo123!'
const PROFILE_KEY = 'alertbridge-local-demo-profile'
const SESSION_KEY = 'alertbridge-local-demo-session'
const PAYMENTS_KEY = 'alertbridge-local-demo-payments'
const demoUser = { id: 'local-demo-user', email: DEMO_EMAIL }
const subscribers = new Set()

function getDemoProfile() {
  const saved = localStorage.getItem(PROFILE_KEY)
  if (saved) return JSON.parse(saved)
  const profile = { id: demoUser.id, trial_ends_at: new Date(Date.now() + 2 * 864e5).toISOString(), connected: false }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}

function saveDemoProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

function getDemoPayments() {
  return JSON.parse(localStorage.getItem(PAYMENTS_KEY) || '[]')
}

function emitDemoAuth(event, session) {
  subscribers.forEach((callback) => callback(event, session))
}

function createLocalDemoClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } }),
      onAuthStateChange: (callback) => {
        subscribers.add(callback)
        return { data: { subscription: { unsubscribe: () => subscribers.delete(callback) } } }
      },
      signInWithPassword: async ({ email, password }) => {
        if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
          return { data: {}, error: { message: 'Invalid local demo email or password.' } }
        }
        const session = { user: demoUser, access_token: 'local-demo-token' }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        emitDemoAuth('SIGNED_IN', session)
        return { data: { user: demoUser, session }, error: null }
      },
      signUp: async () => ({ data: {}, error: { message: 'Use the local demo account shown below; no sign-up is needed.' } }),
      signInWithOAuth: async () => ({ error: { message: 'Google sign-in is disabled in local demo mode.' } }),
      signOut: async () => {
        localStorage.removeItem(SESSION_KEY)
        emitDemoAuth('SIGNED_OUT', null)
        return { error: null }
      }
    },
    from: (table) => {
      let filters = {}
      const query = {
        select: () => query,
        eq: (field, value) => { filters[field] = value; return query },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({
          data: table === 'profiles' && filters.id === demoUser.id ? getDemoProfile() : null,
          error: null
        }),
        then: (resolve, reject) => Promise.resolve({
          data: table === 'payments' ? getDemoPayments() : [],
          error: null
        }).then(resolve, reject)
      }
      return query
    }
  }
}

export const supabase = LOCAL_DEMO
  ? createLocalDemoClient()
  : createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const API = import.meta.env.VITE_API_URL

export async function api(path, body) {
  if (LOCAL_DEMO) {
    if (path === '/api/connect') {
      saveDemoProfile({ ...getDemoProfile(), connected: true })
      return { ok: true }
    }
    if (path === '/api/pay') {
      const payments = getDemoPayments()
      payments.unshift({
        id: `demo-${Date.now()}`,
        amount: 780,
        status: 'simulated',
        receipt: 'LOCAL-DEMO',
        created_at: new Date().toISOString()
      })
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments))
      return { ok: true }
    }
    throw new Error('This action is unavailable in local demo mode.')
  }
  const { data } = await supabase.auth.getSession()
  const r = await fetch(API + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
    body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.detail || 'Something went wrong. Try again.')
  return j
}
