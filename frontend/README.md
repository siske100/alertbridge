# AlertBridge front end (static React)
1. Copy `.env.example` to `.env` and fill in your Supabase and backend URLs.
2. Run `supabase.sql`, then `admin_mfa.sql` in the Supabase SQL editor. Enable Google under Auth > Providers.
   The account `joelkesis014@gmail.com` is marked as admin and exempt from subscription checks. Create or invite it in Supabase Auth; the first email/password login prompts for Google Authenticator enrollment.
3. `npm install` then `npm run dev`.
4. Add real screenshots as `public/guide/step1.png` to `step5.png` (they replace the drawn placeholders automatically).
5. Deploy: Render Static Site, build `npm run build`, publish directory `dist`. `public/_redirects` handles page refreshes.
The backend endpoints this calls (not built yet): POST /api/connect and POST /api/pay.
