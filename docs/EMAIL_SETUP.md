# Email setup — Google SMTP, branded templates, password reset

Everything Kakeez mails out, and how to turn it on. Two independent chains share
one Google mailbox:

| Chain | Sent by | Templates | Triggered by |
| --- | --- | --- | --- |
| **Order mail** — confirmation, status updates, admin new-order alert | Our own code (`nodemailer`) | `src/lib/notifications/email.ts` | DB trigger → `notifications` queue → Vercel Cron drains `/api/notifications/process` |
| **Auth mail** — signup confirmation, password reset, magic link, email change, invite | Supabase Auth (GoTrue) | `supabase/templates/*.html` | `signUp()`, `resetPasswordForEmail()`, etc. |

They are configured separately. The order chain reads `GOOGLE_SMTP_*` from the
environment; the auth chain needs those same credentials pushed into the hosted
Supabase project. **Do the order chain first** — it is the one that can be tested
without risk, and a pass there proves the credentials before you let Supabase
depend on them.

---

## 1. Create the Google app password

1. The account must have 2-Step Verification on.
2. Go to <https://myaccount.google.com/apppasswords>, create one named `Kakeez`.
3. Google shows 16 characters in four groups. The spaces are cosmetic —
   `src/lib/notifications/smtp.ts` strips them, so paste either form.

**Sender alignment.** Google rewrites the `From` header to the authenticated
mailbox unless the address you want is a verified alias on it. If
`GOOGLE_SMTP_USER` is a `@gmail.com` account and you set
`GOOGLE_SMTP_FROM=orders@kakeez.com`, mail still sends but arrives *from the
gmail address* — and because `kakeez.com` publishes SPF `-all` with DMARC
`p=quarantine`, an unaligned `From` gets quarantined. Either:

- use a Google **Workspace** account that owns `orders@kakeez.com`, or
- add `orders@kakeez.com` under Gmail → Settings → Accounts → *Send mail as* and
  verify it, or
- set `GOOGLE_SMTP_FROM` to the actual Gmail address and accept the branding hit.

Step 2 below tells you which one you actually got.

---

## 2. Prove the credentials (before anything depends on them)

Set the vars locally in `.env.local` (see `.env.example`), then:

```bash
curl -s -H "Authorization: Bearer $NOTIFICATIONS_PROCESS_SECRET" "http://localhost:3000/api/notifications/test?to=you@example.com" | python -m json.tool
```

`/api/notifications/test` resolves the same config the queue drain uses, opens an
authenticated SMTP connection, and sends one fully rendered branded email built
from invented order data — no real order or customer is touched. It sends even
when `NOTIFICATIONS_DRY_RUN=true`, because proving delivery is exactly what you
need while still in dry run.

The response names the stage that failed:

| `stage` | Meaning | Fix |
| --- | --- | --- |
| `config` | A `GOOGLE_SMTP_*` var is unset | The response lists which ones |
| `connect` | Host reachable but auth rejected | A 535 means an account password instead of an app password, or 2-Step Verification is off. Check `settings.passwordLength` — it should be **16** |
| `send` | Authenticated but the message was refused | Read `message`; usually a rejected `From` |
| `sent` | Working | Now check the **delivered** mail: what does it say the sender is, and did it land in inbox or spam? |

Other useful forms:

```bash
# Preview the HTML in a browser without sending anything
curl -H "Authorization: Bearer $NOTIFICATIONS_PROCESS_SECRET" "http://localhost:3000/api/notifications/test?preview=1&template=admin_new_order"

# Templates: order_confirmed (default) | admin_new_order | order_status_out_for_delivery
```

Send one to a **non-Gmail** inbox too. Gmail is lenient about mail from Gmail;
Outlook and Yahoo are where a DMARC problem shows up.

---

## 3. Turn on order mail in production

On Vercel → Project → Settings → Environment Variables → **Production**:

| Variable | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Project Settings → API |
| `NOTIFICATIONS_PROCESS_SECRET` | a long random string |
| `CRON_SECRET` | a long random string (Vercel sends this on cron invocations) |
| `GOOGLE_SMTP_HOST` / `PORT` / `SECURE` / `USER` / `PASS` / `FROM` | from step 1 |
| `KAKEEZ_ADMIN_EMAIL` | where new-order alerts go |
| `NOTIFICATIONS_DRY_RUN` | `false` — **this is the switch**; anything else keeps it logging |

Deploy, then re-run the step-2 check against the production URL.

`vercel.json` already schedules `/api/notifications/process` every 2 minutes.
That cadence needs Vercel **Pro**; on Hobby, cron runs once a day, in which case
move the drain to a Supabase Edge Function on `pg_cron` instead.

**The queued backlog.** There are rows sitting in `public.notifications` with
`status='queued'` from before any of this worked. Do not drain them in dry run —
dry run marks rows `sent` without sending, destroying the record that they are
still owed. Drain only once real SMTP is live, and decide deliberately whether
months-old order confirmations should go out at all.

---

## 4. Turn on branded auth mail

Supabase Auth sends its own mail and needs its own copy of the credentials.
Until this step, Supabase uses its built-in sender, which **only delivers to
project team members** — which is why password reset appeared to do nothing for
real customers.

```bash
export GOOGLE_SMTP_USER='...'
export GOOGLE_SMTP_PASS='...'
npx supabase link --project-ref crzqqvbvaguttrkzvpqh
npx supabase config push
```

`supabase/config.toml` already carries `[auth.email.smtp]` and the six template
bindings, so this one push enables custom SMTP and the branded templates
together.

**Order matters here.** The same push also sets `enable_confirmations = true`,
which makes new signups require a working confirmation email. If the SMTP
credentials are wrong, signups break silently — nobody outside the Supabase org
can create an account. Confirm step 2 passes first.

If the push fails with `Email template modification is not available for free
tier projects using the default email provider`, the SMTP block did not take
effect; fix that before retrying the templates. If it complains that a template
file cannot be found, the `content_path` values are resolved relative to the
repo root (`./supabase/templates/…`, matching Supabase's own docs) — try
`./templates/…` instead.

Afterwards, verify in the dashboard: Authentication → Emails should show the
Kakeez-branded HTML, and Project Settings → Auth → SMTP should show the Google
host.

---

## 5. How password reset actually flows

```
/forgot-password
  └─ resetPasswordForEmail(email, { redirectTo: authRecoverUrl() })   → https://www.kakeez.com/auth/recover
       └─ Supabase mails supabase/templates/reset-password.html
            └─ link → /auth/recover?token_hash=…&type=recovery
                 └─ verifyOtp() redeems it, writes the session to cookies
                      └─ redirect → /reset-password
                           └─ auth.updateUser({ password })
```

**Why recovery has its own route** instead of sharing `/auth/confirm`: the
destination is the one thing a reset link cannot afford to lose, and Supabase's
*stock* template loses it. That template links to `{{ .ConfirmationURL }}`, which
round-trips through GoTrue and comes back carrying a PKCE `code` and nothing
else — no `type`, no `next`. Pointed at `/auth/confirm`, that redirected to `/`:
the customer ended up signed in on the homepage, password unchanged, with no
route to the form that would change it. That was the "reset password is broken"
bug.

Putting the destination in the path makes every combination land correctly,
whether or not the branded templates have been pushed:

| Link shape | Comes from | Result |
| --- | --- | --- |
| `/auth/recover?token_hash=…&type=recovery` | branded template | redeemed server-side, works on **any** device |
| `/auth/recover?code=…` | stock template, dashboard buttons | redeemed server-side, **same browser only** (PKCE needs the verifier cookie) |
| `/auth/recover#access_token=…` | implicit flow | forwarded to `/reset-password`, which reads the fragment client-side |

`/reset-password` waits for `onAuthStateChange` before declaring a link dead, so
a session that arrives a tick late — fragment parsing, cookie hydration — no
longer shows a spurious "Link expired".

### The redirect allow-list

`redirectTo` is only honoured if it matches Supabase's allow-list. Anything that
does not match is **silently** replaced with the project's Site URL — no error,
the mail just links somewhere else. `supabase/config.toml` lists
`https://www.kakeez.com/**` and friends under `additional_redirect_urls`, and
the `/**` covers `/auth/recover`.

But that file only describes the hosted project once `supabase config push` has
succeeded, and it never has. **Check the live list** in Dashboard →
Authentication → URL Configuration → Redirect URLs before trusting reset in
production, and confirm it includes a path wildcard rather than bare origins.

Cross-device `code` links fail by design and say so in plain words: *"This link
has to be opened in the same browser that asked for it."* Once the branded
templates are pushed, links use `token_hash` and that limitation goes away.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Reset link lands on the homepage, signed in | Pre-fix behaviour. Confirm `redirectTo` is `authRecoverUrl()` and `/auth/recover` exists |
| Reset link goes to the site root, not `/auth/recover` | `https://www.kakeez.com/**` is missing from the redirect allow-list, so Supabase fell back to Site URL |
| "This link has to be opened in the same browser" | Stock template + different device. Push the branded templates (step 4) |
| "Link expired" immediately | Genuinely spent (one hour, single use) — or the link was consumed by a corporate mail scanner that pre-fetches URLs |
| Reset mail never arrives | Step 4 not done: Supabase's built-in sender only mails project team members |
| Order mail queued but never sent | `NOTIFICATIONS_DRY_RUN` is not `false`, or the cron cannot authenticate — check `CRON_SECRET` |
| Mail sends but lands in spam | `From` not SPF/DKIM-aligned — see the sender alignment note in step 1 |
| Customer gets no confirmation but admin does | The DB trigger only enqueues customer mail when `orders.user_id` is set. Checkout requires sign-in today, so this only bites if guest checkout is ever added |
