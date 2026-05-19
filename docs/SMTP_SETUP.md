# SMTP + Email Confirmation Setup

Supabase default SMTP has a **4 emails/hour** rate limit — fine for dev, not for production.
Below is how to set up a real SMTP provider so:

1. Email confirmation works without rate limits.
2. Password reset emails get delivered.
3. New signups are required to verify their email.

## Recommended: Resend (free 3,000 emails/month, no credit card)

### 1. Create a Resend account

- Sign up at <https://resend.com>
- Verify your email
- (Optional but recommended) Add and verify a custom domain
  - If you don't have a custom domain yet, you can use Resend's onboarding domain
    `onboarding@resend.dev` for testing, but production needs your own domain.

### 2. Create an API key

- Resend dashboard → **API Keys** → **Create API Key**
- Name: `shopqr-supabase`
- Permission: **Sending access**
- Copy the key (starts with `re_...`)

### 3. Configure Supabase to use Resend SMTP

Supabase dashboard → **Project Settings → Authentication → SMTP Settings**

| Field | Value |
|---|---|
| Enable Custom SMTP | **ON** |
| Sender email | `noreply@your-domain.com` (or `onboarding@resend.dev` for test) |
| Sender name | `ShopQR` (or your restaurant brand) |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the API key from step 2 |
| Min interval between emails | `60` (seconds, optional) |

Save.

### 4. Re-enable email confirmation

Supabase dashboard → **Authentication → Sign In / Providers → Email**

- Toggle **Confirm email** → **ON**
- Save.

### 5. Update Site URL + Redirect URLs (important after deploy)

Supabase dashboard → **Authentication → URL Configuration**

| Field | Value |
|---|---|
| Site URL | `https://your-deployed-domain.com` |
| Redirect URLs | `https://your-deployed-domain.com/**` |

Without this, confirmation links will redirect to `localhost:3000` instead of your live site.

### 6. (Optional) Customize email templates

Supabase dashboard → **Authentication → Email Templates**

Templates you can override (HTML supported):
- **Confirm signup** — link customers click after signup
- **Reset password** — link after "forgot password"
- **Magic link** — passwordless login (if enabled)
- **Change email** — verify new email
- **Invite user** — invite-only auth

Subject lines and body all support `{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.

---

## Test the flow

1. Open an incognito window → go to `/signup`
2. Use a real email you can check
3. Submit → check email inbox → click the confirmation link
4. Should redirect to `/dashboard` and you should be logged in

If email doesn't arrive:
- Check Resend dashboard → **Emails** for delivery status
- Check Supabase **Logs → Auth Logs** for SMTP errors
- Check spam folder

---

## Alternative providers

| Service | Free tier | Notes |
|---|---|---|
| **Resend** | 3,000/mo | Easiest, modern API |
| **SendGrid** | 100/day | Long-time leader |
| **Mailgun** | 100/day for 3 mo trial | Strong reputation |
| **AWS SES** | 62,000/mo if from EC2, else paid | Cheapest at scale, harder to set up |
| **Postmark** | 100/mo | Excellent deliverability for transactional |

Whichever you pick, the Supabase SMTP settings page accepts standard SMTP credentials.
