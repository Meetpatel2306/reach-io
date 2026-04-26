# Auth & Admin Setup

This app now has full login/register/admin features. Here's what you need to set up.

## What was added

- `/login` — sign in with email + password (configurable session expiry: 1h, 24h, 7d, 30d, never, or custom)
- `/register` — create account (first user automatically becomes admin)
- `/forgot-password` — generates a reset link (admin manages distribution)
- `/reset-password?token=...` — set new password from reset link
- `/admin` — admin dashboard (only `meetpatel4384@gmail.com` or first registered user)
- User menu in header with avatar, role badge, and logout

## Environment variables (Vercel → Settings → Environment Variables)

### Required for production

```
SESSION_SECRET=<32+ character random string>
```

Generate one: `openssl rand -base64 32` or use [randomkeygen.com](https://randomkeygen.com).

### Optional (for persistent multi-user data)

```
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Get these by **enabling Vercel KV**:

1. Vercel dashboard → your project → Storage tab
2. Create Database → KV (free tier)
3. Connect to project → env vars are auto-added
4. Redeploy

**Without KV:** Users are stored in memory + a local JSON file. On Vercel (read-only filesystem), users won't persist across deploys. Use KV for production.

### For Google Sign-In (already documented)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

See [SETUP-GOOGLE-OAUTH.md](SETUP-GOOGLE-OAUTH.md).

## First-time setup

1. Deploy with `SESSION_SECRET` set
2. Open the deployed URL → you'll be redirected to `/login`
3. Click "Create account" → register with `meetpatel4384@gmail.com`
4. Since you're the first user, you're auto-promoted to admin
5. Use the admin dashboard to manage other users

## Admin features

The admin can:

- See all users (search + filter by role)
- Reset any user's password directly
- Delete users (except admin account)
- View user stats: total users, admins, new this week, active today
- See join date, last login, session preferences

## Session expiry

When logging in, users choose how long to stay signed in:

- Presets: 1h, 24h, 7d, 30d, Never
- Custom: any number of hours/days/weeks

The choice is remembered for next login.

## Forgot password flow

Since there's no transactional email service:

1. User goes to `/forgot-password`
2. Enters their email
3. App generates a reset link (1-hour expiry)
4. Link is shown on screen — user copies it and pastes in browser
5. New password is set

For production, hook up a service like Resend or SendGrid to email the link automatically (not done in this version).

## Local development

Create `.env.local`:

```
SESSION_SECRET=local-dev-secret-must-be-at-least-32-chars-long
```

Run `npm run dev`. Without KV configured, users persist in `.local-storage.json` (gitignored).

## Security notes

- Passwords hashed with bcrypt (10 rounds)
- Sessions stored in encrypted httpOnly cookies (iron-session)
- CSRF protection: sameSite=lax cookies
- All auth API routes validate input
- Admin role enforced server-side, not just client-side
- Password reset tokens expire after 1 hour
