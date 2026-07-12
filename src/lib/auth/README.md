# First-party authentication

Authentication is owned by this application. Supabase is used only as a server-side data store.

## Supported flows

- Email/password registration and login
- Seven-day rolling, revocable HttpOnly cookie sessions
- Direct Google OAuth Authorization Code + PKCE
- Single-use password reset tokens (links are logged to the server in development)

## Required configuration

Run the latest Supabase migration, then configure only server environment variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Register `/auth/callback` as the Google OAuth redirect. Do not expose Supabase or Google credentials through `VITE_` variables. Production password recovery intentionally fails closed until a real mail transport is added.

The browser communicates only with TanStack server functions and the cookie-authenticated `/api/chat` endpoint. Feature code must use `requireAuth` and constrain every service-role query by `context.userId`.
