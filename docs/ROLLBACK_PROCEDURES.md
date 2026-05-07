# Zupurb — Rollback Procedures (D8)

---

## 1. Mobile App Rollback

### Google Play

**Halt rollout (preferred — no new users receive broken build):**
1. Play Console → Your app → Production → [active release] → Manage release → Halt rollout.
2. Post incident update to Statuspage within 30 minutes.
3. Notify on-call engineer; open P0 issue in issue tracker.

**Promote previous version to production:**
1. Play Console → Release → Production → View releases.
2. Locate the last stable release (the one before the current rollout).
3. Click "Promote to production" → set rollout to match previous percentage or 100%.
4. The previous AAB is already on Play's servers; no re-upload needed.
5. Confirm the promoted release is live via "What's new" version number in Play Console.

**Rollback timeline:** Play promotion typically propagates within 1–2 hours.

### App Store

**Pause phased release:**
1. App Store Connect → App → App Store tab → Version (current) → Phased Release → Pause.
2. Post Statuspage update.

**Expedited review for hotfix build:**
1. App Store Connect → Contact Us → App Review → Request expedited review.
2. Provide: clear description of the issue, proof of crash or data loss, version number affected.
3. Apple typically responds within 24 hours for valid P0 requests.
4. While waiting: use Remote Config kill switches to disable the affected feature if possible (see §4).

**Removing a version that is not yet fully rolled out:**
1. App Store Connect → Version → Remove from sale (this removes the version; users on prior version are unaffected).
2. Submit hotfix build immediately after.

**Rollback timeline:** Expedited review typically 24–48 h. Kill switch is immediate.

### User Communication

For any rollback that affects a visible user-facing feature:
- Post Statuspage incident.
- If push notifications are safe to send: use FCM to notify affected users (coordinate with backend pillar).
- Update App Store / Play Store "What's New" text in the hotfix release to acknowledge the fix.

---

## 2. Cloud Functions Rollback

Firebase does not natively support `firebase functions:rollback` as a standalone command. The procedure is tag-based re-deploy.

**Steps:**

```bash
# 1. Identify the last stable backend tag
git tag --sort=-creatordate | grep "^backend-v" | head -10

# 2. Check out the stable tag in a detached state
git checkout backend-v1.2.3

# 3. Re-deploy only functions (not hosting or Firestore rules, unless also rolling those back)
firebase deploy --only functions --project zupurb-production

# 4. Verify deployment
firebase functions:list --project zupurb-production

# 5. Return to main branch after rollback
git checkout main
```

**Notes:**
- If Cloud Functions v2 (Cloud Run backed) is in use: use GCP Console → Cloud Run → select function → Traffic → route 100% to the previous revision.
- Monitor Cloud Monitoring for error rate after re-deploy; confirm it drops below 1% threshold within 5 minutes.
- Open a post-incident review (see §6 template) and track the root cause fix on `main`.

---

## 3. Firestore Rules Rollback

Firestore security rules changes are the highest-risk deploy. A broken rules deploy can either lock out all users or expose data.

**Immediate rollback:**

```bash
# 1. Identify previous rules file from git
git log --oneline -- firestore.rules | head -5

# 2. Check out the last known-good rules
git show <commit-hash>:firestore.rules > /tmp/firestore_safe.rules

# 3. Deploy only the rules (not indexes, not functions)
firebase deploy --only firestore:rules --project zupurb-production

# 4. Verify in Firebase Console → Firestore → Rules → Rules playground
```

**Alternative via Firebase Console (no CLI needed in emergency):**
1. Firebase Console → Firestore → Rules tab.
2. The editor shows current rules. Paste the last known-good rules directly.
3. Click "Publish."
4. Console propagates changes within 60 seconds globally.

**Important:** Firestore data migrations are forward-only. If a schema migration was paired with a rules deploy:
- Roll back rules first.
- Assess whether the migrated data is still readable with old rules.
- If not, ship a "dual-read" version that handles both old and new schema before proceeding.
- Never delete migrated data as part of a rollback without a data backup.

---

## 4. Remote Config Rollback

Remote Config maintains a full version history. This is the fastest rollback mechanism and should be the first tool used when a feature flag controls the broken behavior.

**Steps via Firebase Console:**
1. Firebase Console → Remote Config → (three-dot menu top right) → Version history.
2. Locate the version active before the broken deploy.
3. Click the version → "Rollback to this version."
4. Confirm. The change propagates to all clients within ~1 minute (fetch interval).

**Steps via Firebase CLI:**

```bash
# List versions
firebase remoteconfig:versions:list --project zupurb-production

# Roll back to a specific version number
firebase remoteconfig:rollback --version-number <N> --project zupurb-production
```

**Kill switch flags (pre-built for risky features):**

| Flag name | Controlled feature | Default |
|---|---|---|
| `enable_new_scoring_weights` | Updated UAR scoring algorithm | `false` |
| `enable_deal_type_v2` | New deal card format | `false` |
| `enable_badge_system_v2` | Revised badge logic | `false` |
| `enable_ocr_v2` | New OCR provider or model | `false` |
| `enable_plus_features` | Zupurb Plus gated features | `true` |

Set any flag to `false` to disable the feature for 100% of users instantly without a new app build.

---

## 5. Emergency Contacts (Placeholder)

> Complete before D7 production submission.

| Role | Name | Contact |
|---|---|---|
| On-call engineer (primary) | [TBD] | [PagerDuty handle] |
| On-call engineer (secondary) | [TBD] | [PagerDuty handle] |
| Engineering lead | [TBD] | [Email / phone] |
| Founder / product owner | [TBD] | [Email / phone] |
| Firebase support | Google Firebase | https://firebase.google.com/support |
| Apple Developer support | App Store Connect | https://developer.apple.com/contact/ |
| Play Console support | Google Play | https://support.google.com/googleplay/android-developer |

---

## 6. Post-Incident Review Template

To be completed within 48 hours of every P0 incident resolution.

```
## Post-Incident Review — [Incident Title]

**Date:** YYYY-MM-DD
**Severity:** P0 / P1
**Duration:** [start time] → [resolution time] (total: X hours Y minutes)
**Affected users:** [number or % of active users]

### Timeline

| Time (UTC) | Event |
|---|---|
| HH:MM | Incident detected (how: alert / user report / on-call) |
| HH:MM | On-call acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Rollback / mitigation applied |
| HH:MM | Confirmed resolved |

### Root Cause

[One paragraph. What failed, why, and why it was not caught before production.]

### Impact

[Quantified: number of users affected, transactions failed, data at risk, revenue impact.]

### Resolution

[What was done: rollback, kill switch, hotfix build, config change.]

### Action Items

| Action | Owner | Due date |
|---|---|---|
| [Fix root cause in code] | [Engineer] | [date] |
| [Add test coverage] | [QA] | [date] |
| [Improve alert sensitivity] | [Release engineer] | [date] |

### What Went Well

[Things that worked: detection speed, communication, rollback time.]

### What Could Improve

[Gaps: delayed detection, unclear runbook, missing kill switch.]
```

---

*Milestone: D8 | Owner: Release Engineer | Last updated: 2026-05-07*
