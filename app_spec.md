# Outreach App — What to Build

Current app: pick a resume, pick a template, send the mail.
That is a sending tool. This turns it into something that gets better every week.

The Gemini prompt, response schema and candidate-facts block live in
[`gemini_prompt.md`](./gemini_prompt.md). This file is everything around it.

---

## Priority order

If you build only two things, build **#1 and #2**. They matter more than the
Gemini integration.

| # | Feature | Priority |
|---|---|---|
| 1 | Tracking table | **P0** |
| 2 | Follow-up scheduler | **P0** |
| 3 | Duplicate guard | **P0** |
| 4 | Send queue + rate limiting | **P0** |
| 5 | Gmail API (OAuth) instead of SMTP | **P0** |
| 6 | Gemini personalisation | **P0** — see `gemini_prompt.md` |
| 7 | Resume variant selection | P1 |
| 8 | Store the JD with the application | P1 |
| 9 | Contact storage | P1 |
| — | Open-tracking pixels | **Do not build** |

---

## 1. Tracking table — the biggest gap

Right now every send goes into a void and teaches you nothing. That is how 200
emails went out before anything looked wrong.

```sql
CREATE TABLE applications (
  id              INTEGER PRIMARY KEY,
  company         TEXT NOT NULL,
  person_name     TEXT,
  person_title    TEXT,
  email           TEXT NOT NULL,
  role_title      TEXT,
  role_type       TEXT,          -- 'ai' | 'backend'
  date_sent       TIMESTAMP NOT NULL,
  subject         TEXT,
  hook            TEXT,
  template        TEXT,          -- which template was used
  lead_project    TEXT,          -- which project Gemini led with
  resume_variant  TEXT,
  message_id      TEXT,          -- for threading the follow-up
  followup_sent   TIMESTAMP,
  status          TEXT NOT NULL, -- sent | replied | screening | interview | rejected | ghosted | bounced
  jd_text         TEXT,
  notes           TEXT
);
```

After ~40 sends you can answer: which template gets replies, which lead project
gets replies, which role type gets replies. Then you stop guessing.

**Report to build:** reply rate grouped by `template`, by `lead_project`, and by
`role_type`. That one screen is the entire point of the app.

---

## 2. Follow-up scheduler

A large share of replies come from the follow-up, not the first email.

- Store the `Message-ID` of the original send.
- Send the follow-up with `In-Reply-To` and `References` headers set, and the
  subject prefixed `Re:` — so it lands in the same thread, not as a new email.
- Queue it for **day 6**. **Once only.**
- **Auto-cancel if they reply.** Poll the inbox, or check for a thread response
  before firing.

Follow-up copy is in `outreach.md`, section F.

---

## 3. Duplicate guard

Refuse to send if:

- the same **person** has ever been contacted
- the same **company** was contacted in the last **30 days**

Emailing one company twice with the same pitch is worse than not emailing them.

---

## 4. Send queue + rate limiting

- Max **15–20 per day**.
- Randomised **2–10 minute** gap between sends.
- A queue, not a `for` loop that fires everything in five minutes. That burst
  pattern alone can land you in spam regardless of what the email says.
- Send window: **Tue–Thu, 09:30–11:00 IST**. Skip weekends.

---

## 5. Gmail API with OAuth, not SMTP + app password

- Better sender reputation.
- You get delivery failures and bounces back as **data** instead of silence.
- On a bounce: set `status = 'bounced'` and never retry that address.
- Store the OAuth token encrypted, never in the repo, never in the client bundle.

**Before anything else:** send one test email to a friend's Gmail and one to an
Outlook address. Check whether it lands in **Primary** or in Spam/Promotions.
If it is landing in Spam, no amount of copywriting fixes that.

---

## 6. Gemini personalisation

Full prompt, JSON schema, candidate facts and block rules: **`gemini_prompt.md`**.

Summary of the contract:
- Gemini writes the **subject**, the **hook**, and picks the **lead project**.
- Your app renders the body from a fixed template.
- Gemini may only *select* from `CANDIDATE_FACTS` — never add to it.
- `confidence: low` or empty hook → **block the send**.
- Mandatory human review screen. Never auto-send.
- Model `gemini-2.5-flash`, `temperature: 0.4`, server-side only.

---

## 7. Resume variant selection

Two positionings exist. The app should pick, not you:

| role_type | Resume | Template |
|---|---|---|
| `ai` | `Meet_Patel_AI_Engineer.pdf` | AI Engineer (`outreach.md` §0a) |
| `backend` | Python/backend variant | Python Developer (`outreach.md` §0b) |

Attachment filename must be `Meet_Patel_AI_Engineer.pdf`, never `ai.pdf`.

---

## 8. Store the JD with the application

When someone calls three weeks later, you will not remember what the role was.
Keep the full JD text on the row. It is also what Gemini personalised from, so
you can see what it saw.

---

## 9. Contact storage

Recipient names are manual right now. A contacts table with the LinkedIn URL
saved means you can re-approach a company later without re-researching it.

```sql
CREATE TABLE contacts (
  id           INTEGER PRIMARY KEY,
  name         TEXT,
  title        TEXT,
  email        TEXT UNIQUE,
  company      TEXT,
  linkedin_url TEXT,
  source       TEXT,
  added_at     TIMESTAMP
);
```

---

## Do not build: open-tracking pixels

Tempting, but:

- Gmail proxies all images, so the data is close to meaningless.
- Tracking pixels are a well-known spam signal.

You would be trading real deliverability for fake analytics. **Reply rate from
your tracking table is the only metric worth having.**

---

## Hard blocks before any send

- `confidence == "low"` or `hook == ""`
- rendered body contains `[`, `]`, or `{{`
- recipient matches `hr@ | careers@ | info@ | jobs@ | contact@`
- daily cap already reached
- company contacted within 30 days
- person contacted before

---

## The loop this creates

1. Send 15–20 targeted emails a week.
2. Follow up once at day 6.
3. Log every outcome.
4. After 40 sends, read the reply-rate report.
5. Drop what does not work, do more of what does.

That is the difference between 200 → 0 and 200 → 15.
