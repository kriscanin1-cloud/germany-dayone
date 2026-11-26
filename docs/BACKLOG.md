# Backlog

Collected while building. Order inside a section = rough priority.

## Before the Circle U application (5 Dec 2026)
- [ ] Supabase: user creates EU (Frankfurt) project → run migrations 001–003, set repo variables, check analytics events arrive
- [ ] People: email sign-in, real meetups feed per city, Interested/Going, notify-me per city (meetup_alerts)
- [ ] Executive summary + progress statement for Circle U (numbers from analytics)
- [ ] 12–15 user interviews + survey (50+)
- [ ] Impressum + privacy policy pages (required before public launch in DE)

## Content — verify against official sources (now draft)
- [ ] Phone & bank comparisons: prices, “no Anmeldung” rules per nationality — check on provider sites
- [ ] Health insurance task + comparison (TK, AOK, Barmer, private/expat, students)
- [ ] Social security number, Rundfunkbeitrag, Chancenkarte job switch, general settlement permit
- [ ] Kinderzuschlag, tax refund, broadcasting exemption, Mieterverein fee, union fee
- [ ] Public holidays per state (activities.de.json) — compare with an official list
- [ ] Mark verified items with sources; set `VITE_SHOW_DRAFTS=false` for launch
- [ ] External review of verified texts by a migration counselling service

## Content — add
- [ ] Tafel (food banks): who can use it, proof of low income
- [ ] “Benefits and your permit” warning block: claiming Bürgergeld/Wohngeld can affect permit extension for many statuses
- [ ] Wohngeld, Sozialticket/city passes, free museum days per city
- [ ] Task details (choices, tips) for all tasks: transport, housing, enrolment, employer documents, tax ID
- [ ] Asylum/protection: dedicated content with counselling partners
- [ ] City events: Oktoberfest, carnival, Christmas markets, local festivals
- [ ] Research part of the questionnaire (“Help us improve”), currently disabled

## Security (see docs/SECURITY.md)
- [ ] Rate limits (edge function) + moderation tooling before meetups go live
- [ ] Host with real headers for frame-ancestors / HSTS (or accept residual)
- [ ] Pin GitHub Actions to commit SHAs

## Product
- [ ] Push/e-mail reminders: deadlines (visa end, passport, legal task deadlines), new meetups
- [ ] People safety: report/block, moderation queue, exact place only for “going” (RPC), rate limits, code of conduct page
- [ ] Translations: ru, uk, ar, tr, es (i18n already in place)
- [ ] Option to switch off anonymous usage counters
- [ ] “Do it with others” from tasks (e.g. Anmeldung together), not only from activities
- [ ] Offline check, install prompt on Android

## Business
- [ ] Proactive Anmeldung form: moved in + not registered → ask the few facts, generate the filled PDF on device, landlord-confirmation message, Bürgeramt booking link (pattern reused for permit and Kindergeld forms)
- [ ] Arrival Pack fake door with price (count taps)
- [ ] Monetisation experiments (strategy & business plan doc on claude.ai): affiliate disclosure, “Arrival pack” fake door, uni/employer pilot
- [ ] Legal check: RDG boundary for paid paperwork help, § 34d GewO (insurance tip-giver only), § 49b BRAO (no per-referral fees to lawyers), GDPR
- [ ] Company setup (Estonia) and where the business is registered for German affiliate contracts

## Personalisation (added 2026-11-26)
- Spots and day trips exist only for the 6 pilot cities (Dresden, Leipzig, Köln, Düsseldorf, München, Berlin). Extend city by city; re-verify `lastVerified` every 6 months.
- Leipzig → Halle trip is still DRAFT (travel time not checked).
- Halal: we only filter pork and alcohol — meat dishes are not certified halal. Consider a hint "ask for halal" on meat ideas.
- Translate taste survey and spot notes (RU/UK/AR/TR…).
- Later: local events (Oktoberfest, Karneval, Striezelmarkt dates) as a dated feed per city.
