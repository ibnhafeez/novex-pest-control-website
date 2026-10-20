# Novex Pest Control — Official Website

Hygiene-first 5-page website for **Novex Pest Control Cleaning Services L.L.C** — pest control & building cleaning works in Abu Dhabi and Al Ain, U.A.E.

**Domain:** novexpestcountrol.com · **Abu Dhabi Licence:** CN-6758651 · **WhatsApp:** 054 1383 916

## Pages

| Page | Purpose |
|------|---------|
| `site/index.html` | Home — hero, hygiene pillars, services, process, reviews |
| `site/services.html` | 6 services with details + quote buttons that pre-select the service |
| `site/hygiene.html` | Hygiene Promise — standards, public-health framing, FAQ |
| `site/reviews.html` | Automatic review form (instant publish) + rating summary |
| `site/contact.html` | Quote form → redirects visitor details to WhatsApp |

## Features

- **WhatsApp integration** — floating button + 31 in-content links on every page, all routed to wa.me/971541383916 with smart pre-filled messages
- **Quote form → WhatsApp redirect** — visitor details (name, phone, area, property, service, timing) are formatted into a pre-filled WhatsApp message with an NVX reference number
- **Automatic reviews** — visitors submit a rating/comment and it publishes instantly to the page with a live-updating rating summary (stored per-browser in localStorage)
- **Service pre-selection** — service page "Get Quote" buttons pass `?service=` into the contact form
- **Hygiene-first messaging** throughout, matching public-health service-site design language

## Deploy

Plain HTML/CSS/JS — no build step. Upload the **contents of `site/`** to any static host (cPanel, Netlify, Vercel, GitHub Pages) and point the domain at it.

## Tests

Functional test suite (jsdom) covering WhatsApp deep links, quote form redirect, auto-review publishing and persistence:

```bash
node tests/functional.test.mjs
```

Requires jsdom (`npm install jsdom`) pointed to by `createRequire` in the test file.

## License

Proprietary — Novex Pest Control Cleaning Services L.L.C. All rights reserved.
