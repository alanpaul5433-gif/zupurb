# Zupurb User App — Functional Inventory

**Generated:** 2026-06-10 by screen-by-screen audit of `zupurb_app/lib/screens/`.
**Purpose:** Honest map of what actually works vs. what's a UI mock, so features can be prioritised and built deliberately (not whack-a-mole).

**Legend:** ✅ Functional · 🟡 Partial (renders real data OR some actions work) · 🔴 Mock/Static (cosmetic, no real data/action) · 🧩 Stub ("coming soon")

**Root cause pattern:** The app **reads** live Firestore data on several screens, but the **write flows** (submit review, book reservation, add place, redeem) and most **interactions** (search, filters, follow, favourites, comments, content tabs) were built as visual mockups and never wired. Only `settings` (account deletion) calls a backend callable.

---

## Auth & Onboarding
| Screen | State | Notes |
|---|---|---|
| Splash | ✅ | Timer → routes to login/home |
| Login | 🟡 | Email/password **works**; Google/Facebook/Apple = 🧩 "coming soon"; "Try Demo" now logs into seeded Ava account ✅ |
| Sign Up | 🟡 | Email/password **works** (creates user + Firestore doc); social = 🧩 |
| Forgot password / Email sent | 🟡 | Sends reset via Firebase Auth (works if SMTP/templates set) |
| OTP / Phone OTP | 🔴 | Phone auth provider not enabled; SMS OTP won't deliver |
| ATT prompt | ✅ | Cosmetic consent screen |
| Onboarding steps 1–10 | 🟡 | Collect prefs in local state; step 10 persists to user doc. Mostly functional |

## Home / Discover / Search
| Screen | State | Notes |
|---|---|---|
| **Home feed** | 🟡 | Reads real reviews ✅; review card → detail ✅; likes persist ✅; **category tabs (All/Reviews/Feed/Creators/Deals) don't filter** 🔴; top deal banner links to a hardcoded venue |
| **Discover** | 🟡 | Reads real establishments ✅; **search field + filters not wired** 🔴; **favourite heart not wired + inconsistent icon** between rails 🔴 |
| **Search** | 🔴 | Search field navigates to a **hardcoded results** screen; filters are cosmetic local toggles |
| Search results | 🔴 | Static cards; not driven by the query |

## Establishment / Deals
| Screen | State | Notes |
|---|---|---|
| **Establishment detail** | 🟡 | Reads real establishment + reviews + **deals** ✅ (just wired); **deal tap → 🧩 "coming soon"** (no deal-detail screen); Write a Review / Reserve launch mock flows |
| Deal detail | 🔴 | Not built — tapping a deal shows a snackbar |

## Reviews
| Screen | State | Notes |
|---|---|---|
| **Review detail** | ✅ | New — full review, AI summary, persistent like, share; **comments = 🧩** |
| Verify Visit → Rate → Disclosure → Written → Submitted | 🔴 | **Mock flow** — does NOT call `submitReview`; "Review Submitted" is cosmetic, nothing persists |

## Reservations
| Screen | State | Notes |
|---|---|---|
| Time slot / Confirm booking / Reservation pass | 🔴 | **Mock** — does NOT call `createReservation`; QR/OTP are static |
| My Reservations | 🔴 | Hardcoded list |
| Zupurb Plus | 🔴 | Pricing fails — **RevenueCat placeholder key**, no products configured |
| Exclusive benefits | 🔴 | Static |

## Messages
| Screen | State | Notes |
|---|---|---|
| Conversation list | 🟡 | Reads provider; tab row scrolls (fixed); mutual-follow gating is visual |
| Chat | 🔴 | Send message not wired to backend |

## Profile / Social
| Screen | State | Notes |
|---|---|---|
| Own profile | 🟡 | Reads real user doc (name/avatar/points) ✅; **content tabs (Posts/Reels/Reviews/Places) hardcoded** 🔴; **Edit Profile = 🧩** |
| Other profile | 🔴 | Hardcoded content; **Follow not wired**; Photos/Lists tabs empty |
| Notifications | 🟡 | Reads notifications provider |

## Points / Badges / Rewards
| Screen | State | Notes |
|---|---|---|
| Points Wallet | 🟡 | Real points balance ✅; **activity list hardcoded** 🔴 |
| Redeem Rewards | 🔴 | Static reward grid; **redemption history = 🧩**; redeem not wired |
| Badges & Challenges | 🔴 | Fully hardcoded (no data) |

## Settings / Misc
| Screen | State | Notes |
|---|---|---|
| Settings | ✅ | Navigation works; **Delete Account calls backend** ✅ (new); toggles are local; Help Center = 🧩 |
| Privacy Settings | 🟡 | Toggles are local state |
| Add a Place | 🔴 | Form does not persist (no backend call) |

---

## Build priority (recommended)
**Tier 1 — client-side, high demo impact, low risk (no backend writes):**
1. Discover search (filter real establishments by query) + filters
2. Home category tab filtering
3. Deal detail screen (tap a deal → details)
4. Favourites (heart persists + favourites list) — mirror the persistent-like pattern
5. Follow/unfollow (persist)

**Tier 2 — backend write flows (call the deployed callables; handle App Check):**
6. Submit Review (wire the review flow to `submitReview`)
7. Create Reservation (wire booking to `createReservation`)
8. Redeem deal / points

**Tier 3 — larger features / external setup:**
9. Review comments (data model + UI + backend)
10. Profile content tabs (posts/reels feed)
11. Chat send (messaging backend)
12. Zupurb Plus pricing (RevenueCat account + products — external)
13. Phone OTP (enable phone auth provider — external)
