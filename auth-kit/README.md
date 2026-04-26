# auth-kit

Drop-in login / register / forgot-password / admin-dashboard pages for any
Next.js (App Router) app in this repo.

## Architecture

The kit ships **complete page components**. Each consuming app provides an
`AuthAdapter` that abstracts where user data lives (localStorage, REST API,
SQLite, Supabase, etc.). The same UI works against any backend.

```
auth-kit/
  AuthShell.tsx      — shared chrome for login/register/forgot
  LoginPage.tsx      — full <Page adapter brand toast />
  RegisterPage.tsx
  ForgotPage.tsx
  AdminPage.tsx
  types.ts           — AuthAdapter, UserProfile, ToastFn
  constants.ts       — SECURITY_QUESTIONS, AVATARS
  index.ts           — re-exports
```

## Usage in a consuming app

### 1. Implement an AuthAdapter

```ts
// src/lib/myAuthAdapter.ts
import type { AuthAdapter, UserProfile } from "auth-kit";

export const myAdapter: AuthAdapter = {
  async register(input) { /* persist + return UserProfile */ },
  async login(email, password) { /* check + return UserProfile */ },
  logout() { /* clear session */ },
  async resetPassword(email, answer, newPassword) { /* … */ },
  byEmail(email) { /* sync or async */ },
  current() { /* sync or async */ },
  list() { /* admin: list all profiles */ },
  remove(id) { /* admin */ },
  promoteAdmin(id) { /* admin */ },
  demoteAdmin(id) { /* admin */ },
};
```

BeatStream's adapter wraps localStorage. EmailBlaster's adapter calls
`/api/auth/...` REST endpoints. Both consume the same UI.

### 2. Mount the pages

```tsx
// src/app/login/page.tsx
"use client";
import { LoginPage } from "auth-kit";
import { myAdapter } from "@/lib/myAuthAdapter";
import { useToast } from "@/contexts/ToastContext";
import { Headphones } from "lucide-react";

export default function Page() {
  const { toast } = useToast();
  return (
    <LoginPage
      adapter={myAdapter}
      brand={
        <>
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Headphones className="w-6 h-6 text-black" />
          </div>
          <span className="text-2xl font-extrabold">My App</span>
        </>
      }
      toast={toast}
      onSuccessRedirect="/"
    />
  );
}
```

Same pattern for `/register`, `/forgot-password`, `/admin`.

### 3. Configure Tailwind to scan auth-kit

In `app/globals.css` add a `@source` directive so Tailwind picks up the
classes used inside the kit:

```css
@import "tailwindcss";
@source "../../../auth-kit/**/*.{ts,tsx}";
```

### 4. tsconfig path alias (optional, for nicer imports)

```json
{
  "compilerOptions": {
    "paths": {
      "auth-kit": ["../auth-kit/index.ts"],
      "auth-kit/*": ["../auth-kit/*"]
    }
  }
}
```

### 5. Next.js — allow imports outside the project

In `next.config.ts`:

```ts
const nextConfig = {
  outputFileTracingRoot: __dirname + "/..",
};
```

(Or use a relative `import "../../../auth-kit/index"` if you'd rather skip
the alias.)

## Required CSS variables

The kit assumes the host app exposes these utility classes (so theming
works):

- `.bg-bg`, `.bg-card`, `.text-secondary`, `.text-accent`
- `.btn-primary`
- `.fade-in` keyframes
- `.shadow-accent-glow` (optional)

BeatStream's `globals.css` already defines these.
