# Zupurb — D8 Rollback Playbook

**Last updated:** 2026-05-06
**Milestone:** D8 — Post-submission monitoring
**Firebase projects:** `zupurb-dev` | `zupurb-staging` | `zupurb-prod`

---

## 1. Play Store — Halt Staged Rollout

**When to halt:** crash-free sessions drop below 98% OR ANR rate exceeds 0.5% within the active rollout cohort.

**Steps:**
1. Open [Play Console](https://play.google.com/console) → select Zupurb → **Release > Production**.
2. Click the active release → **Halt rollout**.
3. Confirm the prompt. The rollout stops immediately; users already updated keep the new version.
4. Post a Statuspage incident if user-facing impact is confirmed.

**To resume after fix:**
1. Prepare and merge a hotfix (see §6).
2. Upload the new AAB to Play Console → create a new release in the Production track.
3. Start rollout at 5% → monitor for 24 hours → promote to 20% → 50% → 100%.
4. Do NOT re-promote the halted release; always ship a new version with a monotonically incremented build number.

---

## 2. iOS — Pause Phased Release

**When to pause:** same thresholds as §1 (crash-free < 98%, ANR-equivalent crashes > 0.5%).

**Steps:**
1. Open [App Store Connect](https://appstoreconnect.apple.com) → Zupurb → **App Store** → select the live version.
2. Scroll to **Phased Release** → click **Pause**.
3. Note: Apple's phased release system has up to a **24-hour delay** before a pause takes effect. Do not assume the pause is immediate.
4. If the crash is severe (P0), submit a prior-version binary with an expedited review request while the pause propagates (see §6).

**To resume:**
1. After a hotfix is submitted and approved, resume or replace the release from App Store Connect.
2. Apple phased release does not reset to day 1 on resume — it continues from the paused day tier.

---

## 3. Firebase Remote Config Kill Switches

Use these to disable features instantly without a new app build.
Changes propagate to clients within 60 seconds.

**How to flip:**
Firebase Console → `zupurb-prod` → **Remote Config** → find the key → Edit → set value → **Publish changes**.

| Flag | Default | Set to | Effect |
|------|---------|--------|--------|
| `enable_review_submission` | `true` | `false` | Disables the review write flow in-app |
| `enable_gift_card_redemption` | `true` | `false` | Disables deal redemption (gift card fulfillment) |
| `enable_plus_subscription` | `true` | `false` | Hides IAP paywall; disables Plus purchase entry points |
| `moderation_block_threshold` | `0.7` | `0.5` | Tightens Perspective API auto-block sensitivity immediately |

Note: kill switches affect ALL users on ALL versions simultaneously.
For version-targeted rollbacks, use Play staged rollout halt (§1) or iOS phased release pause (§2) instead.

---

## 4. Cloud Functions — Version Rollback

Rolling back a Cloud Function does NOT roll back Firestore data written by that function.
If the function wrote malformed data, handle Firestore separately (see §5).

```bash
# List currently deployed functions and their status
firebase use production
firebase functions:list

# Check out the last known-good release tag
git checkout v1.2.3

# Redeploy a single function from that tag
cd functions && npm ci
firebase deploy --only functions:submitReview

# Redeploy multiple specific functions
firebase deploy --only functions:submitReview,functions:redeemDeal,functions:verifyCheckIn

# Return to main branch after rollback
git checkout main
```

After rollback: open a hotfix branch, apply the fix, merge to `main`, and redeploy from `main`.
Tag the rollback event: `git tag rollback/submitReview/v1.2.3 && git push origin --tags`.

---

## 5. Firestore Data Rollback

Firestore schema migrations are **forward-only**. There is no automated undo.
Use point-in-time recovery only when data is corrupted or mass-deleted.

**Point-in-time recovery (PITR):**
- Firebase Console → `zupurb-prod` → **Firestore** → **Import/Export** → Restore from backup.
- Automatic daily backups are retained for **7 days** (Spark plan default; verify this is enabled on Blaze plan in production).
- Restoring overwrites the live database. Coordinate with all team members before restoring.
- If only a subset of documents is corrupted, export the backup to GCS and cherry-pick documents via the Admin SDK instead of a full restore.

**Before any risky migration:** ship dual-read code first (read new field if present, fall back to old field). This allows rollback of the function without data loss.

---

## 6. Hotfix Release Process

```bash
# 1. Branch from main (or the exact release tag if main has moved ahead)
git checkout main
git pull origin main
git checkout -b hotfix/crash-fix-description

# 2. Apply the fix
# (edit source files)

# 3. Bump patch version in pubspec.yaml, e.g. 1.0.1+2
#    Build number must be monotonically higher than the halted build.

# 4. Push and open a PR — CI must pass (analyze + test + build matrix)
git push origin hotfix/crash-fix-description
# Open PR → review → merge to main

# 5. Tag the hotfix release
git tag v1.0.1-hotfix.1
git push origin v1.0.1-hotfix.1

# 6. Submit via D7 flow (Fastlane deliver for iOS, AAB upload for Play)
#    For iOS: include an expedited review request in the App Review notes,
#    citing crash rate data from Crashlytics as justification.
```

**Expedited review (iOS):** App Store Connect → submission → **Request Expedited Review**.
Provide crash-free session percentage and number of affected users in the notes.
Apple typically responds within 24–48 hours on expedited requests.

**Play:** Upload the new AAB to the Production track. Because the prior release was halted,
you can start the new release immediately without waiting for the halted release to clear.
