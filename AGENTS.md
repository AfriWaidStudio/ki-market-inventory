<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Email Confirmation Issue

If users report "email is sent but won't receive it":

1. **Root Cause**: Supabase's default email provider has low rate limits and may not deliver emails properly. Email confirmation is enabled by default.

2. **For Testing**: 
   - Go to Supabase Dashboard → Authentication → Settings → Email
   - Uncheck "Confirm email" requirement

3. **For Production**:
   - Configure SMTP (Mailtrap, Resend, Postmark) in Supabase Dashboard → Authentication → SMTP
   - Or use a verified domain email

4. **Alternative**: Users can sign in with Google OAuth which doesn't require email confirmation.

## Recent Changes

- Added exchange synchronization for Binance and Bybit
- Added pagination to history and journal pages
- Updated settings page with sync status display
- Added schema compatibility for pre/post-migration databases
- Updated auth page with SMTP help text
- Created custom auth service (`src/lib/auth/`) with hooks and helpers
- Added landing page with SVG illustrations
- Added OAuth callback route (`/auth/callback`)
- Updated `.env` with proper Supabase credentials

## Landing Page

The landing page is in `src/components/LandingPage.tsx` and is rendered at `/` via `src/routes/index.tsx`.

### Features Section
1. **Opportunity Scanner** - P2P price comparison
2. **Paper Trading** - Simulate trades without risk
3. **Profit Analytics** - Daily/weekly profit tracking
4. **KI Intelligence** - AI chat for trading insights
5. **Risk Management** - Capital flow and risk tracking
6. **Trade Journal** - Document lessons learned

### SVG Illustrations
Located in `src/assets/illustrations/index.tsx`:
- `IllustrationScanner` - Opportunity scanner view
- `IllustrationPaperTrading` - Paper trade visualization
- `IllustrationAnalytics` - Profit charts
- `IllustrationKI` - AI chat interface
- `IllustrationRiskManagement` - Risk dashboard
- `IllustrationJournal` - Trade journal

### Generated Images
To generate PNG/SVG files from the React SVG components, run:
```bash
node scripts/generate-illustrations.cjs
```

## Troubleshooting Login Issues

If users get a 404 when trying to login:

1. **OAuth Redirect URL Configuration**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your app URL: `https://your-app.vercel.app/auth/callback`
   - For Google OAuth: Enable in Providers → Google
   - Add redirect URL: `https://your-app.vercel.app/auth/callback`

2. **Email Verification**:
   - For testing: Disable "Confirm email" in Supabase → Auth → Settings
   - For production: Configure SMTP (Mailtrap, Resend, Postmark)

3. **Clear Sessions**:
   - Try incognito mode to clear cached sessions
   - Clear browser localStorage for the app domain

### Custom Auth Routes
- `/auth` - Sign in / Sign up page
- `/auth/callback` - OAuth callback handler
