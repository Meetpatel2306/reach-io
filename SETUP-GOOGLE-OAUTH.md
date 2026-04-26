# Google OAuth Setup (5 minutes, one-time)

To enable "Sign in with Google" in Reach.io, you need to create a Google OAuth Client.

## Why?

This replaces the App Password flow. Users sign in with one click instead of generating an App Password. Emails are sent via the Gmail API (not SMTP).

## Steps

### 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown (top-left) → **New Project**
3. Name it `email-blaster` (or anything) → Create
4. Select your new project from the dropdown

### 2. Enable the Gmail API

1. Go to **APIs & Services → Library**
2. Search for **Gmail API**
3. Click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** → Create
3. Fill in:
   - App name: `Reach.io`
   - User support email: your email
   - Developer email: your email
4. Save & Continue
5. **Scopes** → Add or Remove Scopes → search for and add:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Save & Continue → Save & Continue → Back to Dashboard
7. Under **Test users**, add your Gmail address (only test users can use it until verified)

### 4. Create OAuth Client ID

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Reach.io Web`
5. **Authorized redirect URIs** — add ALL of these:
   - `http://localhost:3000/api/auth/google/callback` (local dev)
   - `https://reach-io-orpin.vercel.app/api/auth/google/callback` (your Vercel URL)
   - Any other domain you deploy to
6. Click **Create**
7. **Copy the Client ID and Client Secret** — you'll need them next

### 5. Add Credentials to Vercel

1. Go to your [Vercel dashboard](https://vercel.com/dashboard)
2. Open the `email-blaster` project → Settings → **Environment Variables**
3. Add two variables:
   - `GOOGLE_CLIENT_ID` = the Client ID you copied
   - `GOOGLE_CLIENT_SECRET` = the Client Secret you copied
4. Apply to: **Production, Preview, Development**
5. Save

### 6. Redeploy

After saving env vars, trigger a fresh deploy:

```bash
npx vercel --prod
```

Or just push a commit to trigger auto-deploy.

### 7. Test It

1. Open your deployed app
2. Click the gear icon (Settings)
3. Click **"Sign in with Google"**
4. Grant permission
5. Send a test email!

## Local Development

For local testing, create `.env.local`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Then `npm run dev` → http://localhost:3000

## Going Public (Beyond 100 Users)

Google requires app verification once you have more than 100 users. To submit for verification:

1. OAuth consent screen → **Publish app**
2. Submit verification form
3. Provide demo video showing the OAuth flow
4. Wait 1-7 business days for review

For personal use (just you), keep it in **Testing** mode and add yourself as a test user. No verification needed.

## Security Notes

- Tokens are stored in browser localStorage (your machine only)
- Refresh tokens never leave the server (handled by `/api/auth/google/refresh`)
- You can revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
- The `gmail.send` scope only allows sending — the app cannot read your email

## Troubleshooting

**"Error 400: redirect_uri_mismatch"** — The redirect URI in Google Cloud doesn't match. Check that your URI exactly matches `https://your-domain/api/auth/google/callback`.

**"Access blocked: This app's request is invalid"** — Your OAuth consent screen is in Testing mode and your email isn't added as a test user. Go to OAuth consent screen → Test users → Add users.

**"oauth_error=not_configured"** — Vercel env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` aren't set, or the deployment hasn't been refreshed since adding them.
