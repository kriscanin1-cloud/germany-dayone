# Security review — OWASP Top 10 (2025)

Reviewed 26 Nov 2026. App: static PWA on GitHub Pages, data on the device, optional Supabase (EU) for anonymous events, consented research answers and — later — meetups. Policies were tested on a real PostgreSQL with Supabase-like roles (`anon`, `authenticated`, `auth.uid()`).

| # | Risk | Finding | Fix |
|---|---|---|---|
| A01 | Broken access control | Draft meetups schema: `exact_place` sat on `meetups`, readable by every signed-in user; all public profiles readable by everyone; RSVPs allowed on pending meetups; counts view leaked pending meetups. | Exact place in `meetup_places` (host + people going only); profiles only for people who share a meetup; RSVPs only to live meetups; counts only for live meetups; helper functions `security definer` with fixed `search_path`, not callable by `anon`. |
| A01 | | Anon could set `id`/`created_at` on inserts and read analysis views if default grants apply. | Column-level `grant insert (…)` per table; `revoke` on all views from API roles. |
| A02 | Security misconfiguration | No Content-Security-Policy; GitHub Pages cannot send headers. | CSP + referrer policy as meta tags, injected at build only (dev server needs inline scripts). `frame-ancestors` cannot be set by meta — clickjacking protection needs a host with headers (residual). |
| A02 | | Drafts shown in production by default (`VITE_SHOW_DRAFTS`). | Content risk, not a security hole; set to `false` at launch (backlog). |
| A03 | Software supply chain | 0 vulnerabilities in shipped dependencies; 4 moderate in build-only tooling (workbox-build → glob/minimatch). No update process. | Dependabot (npm + GitHub Actions); deploy fails on high/critical vulnerabilities in shipped deps (`npm audit --omit=dev --audit-level=high`); `npm ci` with lockfile; checkout without persisted credentials. Pinning actions to commit SHAs: optional next step. |
| A04 | Cryptographic failures | Fallback anonymous id used `Math.random`. No secrets in the client (anon key is public by design; `service_role` never used). HTTPS everywhere (GitHub Pages, Supabase). | Fallback uses `crypto.getRandomValues`. |
| A05 | Injection | React escapes all text; no `innerHTML`/`eval`. Links come from content JSON — a `javascript:` URL would be clickable. SQL only through PostgREST with checks. | `safeUrl()` allows only `https:` on every external link; test that all content links are https; event names restricted to `^[a-z][a-z0-9_]{0,63}$`; length/size checks on every text and JSON column. |
| A06 | Insecure design | Residence status is sensitive in practice. Spam/abuse: anyone with the public key can insert events. | Status never public, never in ads, research only with opt-in; size limits per row. Rate limiting via an edge function before meetups go live (residual). |
| A07 | Authentication failures | No accounts yet. Planned: Supabase e-mail magic link. | Use Supabase Auth defaults (short-lived JWT, refresh rotation); never roll our own (backlog). |
| A08 | Software and data integrity | `localStorage` was trusted as-is: an edited or old value could crash screens. | `sanitize()` validates every field on load (types, lengths, uuid, enums); unit-tested. Service worker serves only same-origin build files. |
| A09 | Logging and alerting | Analytics are anonymous; no personal data in events. No alerting. | Errors tracked as type only (`app_error`), never the message. Supabase logs + weekly check of inserts volume (residual). |
| A10 | Mishandling of exceptional conditions | Router's default error page printed raw errors; one effect-cleanup bug crashed navigation (fixed earlier). | Friendly error screen on every route with reload; analytics and storage never throw into the UI. |

## Residual risks / todo
- Clickjacking: move to a host with headers (Cloudflare Pages, Netlify) or accept for now — the app has no one-click destructive actions without a confirm dialog.
- Rate limits and moderation tooling before meetups go live; women-only cannot be verified technically.
- Privacy policy and Impressum pages before public launch; DPIA-light because residence status is processed.
- Pin GitHub Actions to commit SHAs.
