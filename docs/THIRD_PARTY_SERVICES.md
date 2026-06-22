# Zupurb — Accounts & Services Needed to Go Live

This is the list of third-party accounts/services required to take Zupurb from the
working demo to a fully live, store-ready app. Most have free tiers; many are only
needed for specific features. We'll wire each one up as soon as we receive access
or the API keys.

**Already set up (no action needed):** Firebase / Google Cloud — handles login,
database, server logic, file storage, push notifications, analytics, and crash
reporting. This is why the current demo works end to end.

Legend: 🔴 Required to launch · 🟡 Required for that feature · 🟢 Optional / nice-to-have

---

## 1. App store accounts (required to publish)
| Service | What it's for | Cost | What we need from you |
|---|---|---|---|
| 🔴 **Apple Developer Program** | Publishing to the iOS App Store; Apple Sign-In; iOS push | **$99 / year** | Enrollment (company account recommended) + invite us as developers |
| 🔴 **Google Play Developer** | Publishing to the Google Play Store; app security checks | **$25 one-time** | Account creation + invite us |

## 2. Sign-in options
| Service | What it's for | Cost | What we need |
|---|---|---|---|
| 🔴 **Google Sign-In** | "Continue with Google" | Free | Handled within your Google account |
| 🟡 **Facebook Login** | "Continue with Facebook" | Free | A Meta/Facebook Developer app |
| 🟡 **Phone / SMS login** | One-time-code login by phone | Pay-per-SMS (small) | Enable + budget for SMS |

## 3. Core feature services
| Service | What it powers in the app | Cost | What we need |
|---|---|---|---|
| 🔴 **Google Maps Platform** | Maps & "near me" location | Usage-based (free monthly credit) | Maps API keys + billing enabled |
| 🔴 **SendGrid** (email) | Reservation confirmations & notification emails | Free tier (~100/day), then paid | Account + a verified sending domain (e.g. mail.zupurb.com) |
| 🟡 **RevenueCat** | "Zupurb Plus" subscriptions / in-app purchases | Free under ~$2.5k/mo revenue | Account + the Plus product set up in both stores |
| 🟡 **Tremendous** | Sending gift-card rewards when users redeem | Free to use; you fund the rewards | Account + a funding source |
| 🟡 **Algolia** | Fast search for venues & people | Free tier | Account (API keys) |

## 4. Trust, safety & content quality
| Service | What it's for | Cost | What we need |
|---|---|---|---|
| 🟡 **Receipt scanning — pick ONE:** Mindee / Veryfi / Google Document AI | Reads receipts for "Verified Visit" reviews | Per-scan pricing (varies) | One vendor chosen + account |
| 🟡 **AWS Rekognition** | Screens uploaded photos for unsafe content | Usage-based (free tier) | AWS account |
| 🟢 **Google Perspective API** | Flags toxic review/comment text | Free | API key |
| 🟢 **FingerprintJS Pro** | Anti-fraud device detection | Paid | Account |

## 5. Growth & operations
| Service | What it's for | Cost | What we need |
|---|---|---|---|
| 🟡 **Branch.io** | Shareable links & referral tracking | Free tier | Account + a link domain |
| 🟢 **Upstash (Redis)** | Speed/rate-limiting behind the scenes | Free tier | Account |
| 🟢 **Slack** | Internal alerts for the ops/support team | Free | A webhook URL |
| 🟡 **Domain name + DNS** | Website, business portal (owner.zupurb.com), email domain, app deep-links | Registrar fee (~$10–20/yr) | Domain ownership / access |

---

## Recommended order

**Phase A — Get into the stores (minimum to launch):**
Apple Developer · Google Play · Google Maps · SendGrid · domain name.

**Phase B — Turn on the paid/loyalty features:**
RevenueCat (+ store products) · Tremendous · one receipt-scanning vendor.

**Phase C — Scale, growth & safety:**
Algolia · AWS Rekognition · Perspective · Branch · FingerprintJS · Upstash · Slack.

---

## What happens after you provide each one
For every service above, you (or the client) create the account and send us the
API key / credentials. We plug it into the secure server configuration — no code
changes needed on your side. Until a given key is provided, that feature simply
shows a graceful "coming soon" state instead of breaking.

**Note:** all of these keys are stored securely on the server (never in the app),
and the demo build you're testing today already works without them.
