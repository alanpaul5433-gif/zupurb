# Screenshot Specifications — Zupurb

> Milestone: D5
> Last updated: 2026-05-07
> Status: Specifications defined — screenshots must be captured manually (see PLACEHOLDER.txt)

IMPORTANT: Screenshots must be captured from a physical device or simulator in release mode. Placeholder images are not accepted by the App Store or Google Play. Marketing-style overlays and device frames are permitted on the App Store; Play Store allows but does not require them.

---

## 1. App Store Required Sizes

Apple requires screenshots for each device class you support. At minimum, the 6.9" and 6.5" sizes are mandatory for iPhone listings. iPad Pro 13" is required if the app supports iPad.

| Device Class | Resolution (portrait) | Required | Notes |
|---|---|---|---|
| iPhone 16 Pro Max / 6.9" display | 1320 x 2868 px | Yes — mandatory | Primary iPhone showcase slot |
| iPhone 14 Pro Max / 6.5" display | 1284 x 2778 px | Yes — mandatory | Legacy slot; still widely displayed |
| iPhone 8 Plus / 5.5" display | 1242 x 2208 px | Recommended | Required only if you target iOS devices without Face ID |
| iPad Pro 13" (M4) | 2064 x 2752 px | Yes — if iPad supported | Required to appear on iPad in search results |
| iPad Pro 12.9" (2nd gen) | 2048 x 2732 px | Recommended | Covers older iPad Pro buyers |

Upload up to 10 screenshots per device class. Minimum 1 required; 8 recommended (see subjects below).

Screenshot orientation: portrait unless the app is landscape-only. Zupurb is portrait — submit portrait screenshots.

App Preview videos (optional, 15–30 seconds, .mov): recommended for the 6.9" slot. Autoplay in search results significantly improves conversion.

---

## 2. Google Play Required Sizes

| Device Class | Resolution | Required | Notes |
|---|---|---|---|
| Phone (portrait) | Min 320 px wide; 16:9 or 9:16 aspect ratio; max 3840 px on longest side | Yes — minimum 2 screenshots | Recommended: 1080 x 1920 px or 1080 x 2340 px |
| 7-inch tablet (portrait) | Min 320 px wide; recommended 1200 x 1920 px | Optional | Strongly recommended to unlock tablet discovery |
| 10-inch tablet (portrait) | Min 320 px wide; recommended 1600 x 2560 px | Optional | Strongly recommended for tablet store ranking |

Upload 2–8 screenshots per form factor. PNG or JPEG, max 8 MB per file.

Feature Graphic (1024 x 500 px) is separate from screenshots and is displayed at the top of the store listing — treat it as a banner, not a screenshot.

---

## 3. Screenshot Subjects (8 recommended)

Capture these 8 screens in the order listed. This sequence tells a cohesive product story from first impression to core value loops.

### Screenshot 1 — Onboarding / Welcome

Screen: Onboarding Welcome or Incentive Hook step.
Caption: "Welcome to Zupurb — your city's dining universe."
Alt text: Zupurb onboarding welcome screen showing the app tagline and a Get Started button.
Goal: Communicate brand identity and value proposition immediately.
Suggested overlay text (App Store frame optional): "Discover. Dine. Earn."

---

### Screenshot 2 — Home / Discovery Feed

Screen: Home feed showing venue cards across All / Reviews / Deals tabs.
Caption: "Discover what's trending near you."
Alt text: Zupurb home feed showing restaurant and bar cards with ratings, distance, and a filter bar.
Goal: Show breadth and vibrancy of content.
Suggested overlay text: "Thousands of venues, curated for you."

---

### Screenshot 3 — Establishment Detail

Screen: Venue detail page with photos, rating, description, and Reserve button.
Caption: "Everything you need to decide, in one place."
Alt text: Venue detail page showing photos, community rating, menu highlights, and a Book Reservation button.
Goal: Demonstrate depth of listing information and the reservation entry point.
Suggested overlay text: "Real reviews. Real ratings. Book instantly."

---

### Screenshot 4 — Write a Review

Screen: Review flow — Rate Experience or Written Review step.
Caption: "Your voice builds the community."
Alt text: Review submission screen with star rating sliders, category breakdowns, and a text field for a written review.
Goal: Show that Zupurb is a two-way platform — users contribute, not just consume.
Suggested overlay text: "Verified reviews earn real points."

---

### Screenshot 5 — Points Wallet

Screen: Points Wallet screen showing current balance, recent transactions, and points history.
Caption: "Every visit pays you back."
Alt text: Points Wallet screen displaying a loyalty points balance, recent point earnings from check-ins and reviews, and a Redeem button.
Goal: Reinforce the loyalty loop and make the reward feel tangible.
Suggested overlay text: "Earn points for every check-in and review."

---

### Screenshot 6 — Rewards and Badges

Screen: Badges and Challenges screen or Redeem Rewards screen.
Caption: "Rewards worth earning. Badges worth showing."
Alt text: Rewards screen showing available badge achievements, locked and unlocked challenges, and redeemable gift cards.
Goal: Drive aspiration — show both earned rewards and what is attainable.
Suggested overlay text: "Unlock badges. Redeem for real rewards."

---

### Screenshot 7 — Zupurb Plus Subscription

Screen: Zupurb Plus / Exclusive Benefits screen.
Caption: "Go Plus. Get more from every night out."
Alt text: Zupurb Plus membership screen listing premium benefits including priority booking, exclusive deals, and point multipliers.
Goal: Convert free users by surfacing tangible premium value.
Suggested overlay text: "Priority access. Exclusive deals. More points."

---

### Screenshot 8 — Profile

Screen: Own profile screen showing reviews, badges, points summary, and activity.
Caption: "Your dining story, all in one place."
Alt text: User profile screen showing earned badges, review count, points balance, and a feed of past reviews and check-ins.
Goal: Show the long-term engagement loop — your history becomes your identity on Zupurb.
Suggested overlay text: "Build your dining reputation."

---

## 4. Production Guidance

- Capture on a physical device or in a simulator set to release mode (no debug banners, no flutter dev tool overlays).
- Use realistic mock data — not "Test User" or "Lorem Ipsum." Venue names, review text, and point balances should look production-ready.
- Ensure status bar shows clean time (9:41 AM is convention for App Store; Play Store has no enforced convention).
- Disable notification badges and system alerts before capture.
- For the App Store, device frames and marketing overlays are allowed and encouraged for visual polish. Use Figma, Sketch, or AppLaunchpad.
- For Google Play, overlaid text and device frames are permitted but the screenshot area itself must be the actual app UI.
- All screenshots must be in portrait orientation (Zupurb is a portrait app).
- Captions/overlay text must not contain pricing claims that conflict with actual IAP pricing in the listing.

---

## 5. Directory

Captured screenshots belong in `C:\Projects\Zupurb\docs\store\screenshots\`.

See `screenshots\PLACEHOLDER.txt` for instructions on file naming and submission checklist.
