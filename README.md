# AlertBridge: full project
frontend/  static React site (Render Static Site)
backend/   Node/Express API (Render Web Service) + src/worker.js (Render Background Worker)

## Setup order
1. Supabase: run frontend/supabase.sql, frontend/admin_mfa.sql, then backend/supabase_payments.sql. Auth > Providers: enable Google and turn off Confirm email for immediate signup. Auth > URL config: set your site URL and add `https://your-site.onrender.com/**` to Redirect URLs for password recovery.
   The admin account is joelkesis014@gmail.com. Sign up or invite this address in Supabase Auth and set a password; if the address is already registered, use Forgot password. The first login prompts you to enroll Google Authenticator; scan the QR code and verify a six-digit code. Admin access is subscription-exempt.
2. Daraja (developer.safaricom.co.ke): create an app, enable Lipa Na M-Pesa. Test in sandbox first (DARAJA_BASE sandbox, shortcode 174379), then go live with your Paybill and passkey and DARAJA_BASE=https://api.safaricom.co.ke.
3. Push this folder to GitHub, then in Render: New > Blueprint, pick the repo. Fill in the environment variables (backend/.env.example lists them).
4. Set PUBLIC_URL to the API's Render URL and VITE_API_URL to the same. Redeploy the site after setting it.
5. Test: sign up, connect, send a TradingView alert, then pay in sandbox.
