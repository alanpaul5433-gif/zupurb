/**
 * SETUP_REQUIRED.ts — Tremendous account setup and KYC checklist for I7 (Gift Cards).
 *
 * This file has no runtime exports. It is a living checklist that must be
 * completed before gift card redemptions can go live in production.
 *
 * ============================================================
 * STEP 1 — Create a Tremendous account
 * ============================================================
 *
 *  1. Go to https://www.tremendous.com and click "Sign Up".
 *  2. Choose "Rewards & Incentives" as your use case.
 *  3. Enter your business name ("Zupurb" or parent LLC), work email, and
 *     a strong password.
 *  4. Verify your email address via the confirmation link.
 *
 * ============================================================
 * STEP 2 — KYC / Business Verification (estimated: 2–4 weeks)
 * ============================================================
 *
 *  Tremendous performs standard financial KYC under FinCEN / BSA rules
 *  because they transmit value on your behalf.
 *
 *  Documents typically required:
 *    - Certificate of Incorporation or Articles of Organization
 *    - EIN / Tax ID confirmation letter (IRS CP575)
 *    - Government-issued ID for the beneficial owner(s) (≥ 25% ownership)
 *    - Proof of business address (utility bill or bank statement, ≤ 3 months old)
 *    - Business bank account details for ACH funding
 *
 *  Timeline: Tremendous typically reviews within 2–4 business weeks.
 *  Expedited review may be available — contact your account rep.
 *
 *  IMPORTANT: Apply for KYC as early as possible — do not wait until app launch.
 *  Gift card redemptions will be non-functional in production until approved.
 *
 * ============================================================
 * STEP 3 — Fund your Tremendous account
 * ============================================================
 *
 *  After KYC approval:
 *    1. Log in → Funding → Add Funds via ACH or credit card.
 *    2. Minimum recommended initial deposit: $500–$1,000 (covers initial
 *       user redemptions; top up via automated alerts).
 *    3. Set a low-balance alert (recommended: $200) so redemptions don't fail
 *       due to insufficient funds.
 *    4. Note your Funding Source ID from the Funding tab — this is the
 *       TREMENDOUS_FUNDING_SOURCE_ID secret value.
 *
 * ============================================================
 * STEP 4 — Retrieve your API keys
 * ============================================================
 *
 *  Dashboard → Developers → API Keys:
 *    - "Test" key  → for sandbox (testflight.tremendous.com)
 *    - "Live" key  → for production (www.tremendous.com)
 *
 *  NEVER commit keys to source control. Store as:
 *    - Dev / Staging:  Firebase Functions config secret (GCP Secret Manager)
 *                      Secret name: TREMENDOUS_API_KEY
 *                      Set TREMENDOUS_SANDBOX=true
 *    - Production:     Same secret name in prod project; TREMENDOUS_SANDBOX unset
 *                      (or set to "false")
 *
 *  CLI to set secrets (run from /functions):
 *    firebase functions:secrets:set TREMENDOUS_API_KEY
 *    firebase functions:secrets:set TREMENDOUS_FUNDING_SOURCE_ID
 *
 * ============================================================
 * STEP 5 — Sandbox vs Production environment switching
 * ============================================================
 *
 *  The client.ts module reads TREMENDOUS_SANDBOX at runtime:
 *    TREMENDOUS_SANDBOX=true  → https://testflight.tremendous.com/api/v1
 *    TREMENDOUS_SANDBOX unset → https://www.tremendous.com/api/v1
 *
 *  Sandbox (testflight) behaviour:
 *    - API calls are fully functional but no real value is transferred.
 *    - Gift card emails are sent to a simulated inbox (check Tremendous dashboard).
 *    - Use the Sandbox API key (not the Live key) to avoid accidental charges.
 *    - Webhook events can be manually triggered via the Tremendous sandbox UI.
 *
 *  To switch to production:
 *    1. Remove TREMENDOUS_SANDBOX (or set to "false") in GCP Secret Manager.
 *    2. Rotate the TREMENDOUS_API_KEY secret to the Live key.
 *    3. Confirm TREMENDOUS_FUNDING_SOURCE_ID points to the live funding source.
 *    4. Deploy: firebase deploy --only functions
 *
 * ============================================================
 * STEP 6 — Required environment variables (summary)
 * ============================================================
 *
 *  Variable                       | Required | Notes
 *  -------------------------------|----------|-------------------------------------
 *  TREMENDOUS_API_KEY             | Yes      | Bearer token from Tremendous dashboard
 *  TREMENDOUS_FUNDING_SOURCE_ID   | Yes      | Funding source ID from dashboard
 *  TREMENDOUS_SANDBOX             | Dev only | Set to "true" in dev/staging; omit in prod
 *
 * ============================================================
 * STEP 7 — Webhook configuration (optional but recommended)
 * ============================================================
 *
 *  Tremendous can POST delivery status events to your endpoint.
 *  The existing webhookHandler.ts at integrations/tremendous/webhookHandler.ts
 *  already handles REWARDS.CLAIMED, REWARDS.FAILED, ORDERS.FAILED events.
 *
 *  To register the webhook:
 *    Dashboard → Developers → Webhooks → Add endpoint
 *    URL: https://<region>-<project>.cloudfunctions.net/tremendousWebhook
 *    Events: REWARDS.CLAIMED, REWARDS.FAILED, ORDERS.FAILED
 *
 * ============================================================
 * STEP 8 — Compliance notes
 * ============================================================
 *
 *  - Gift card delivery is CCPA-relevant: recipient email is transmitted to
 *    Tremendous. This is disclosed in the Zupurb Privacy Policy under
 *    "Third-party service providers" → "Gift card fulfillment."
 *  - Gift card codes are NOT stored in Firestore — they are delivered directly
 *    by Tremendous to the user's email. Zupurb only retains the Tremendous
 *    order ID (rewardId) for reconciliation.
 *  - IRS 1099-K reporting: Tremendous handles tax reporting for rewards above
 *    IRS thresholds. Ensure your Tremendous account settings include your EIN.
 *  - Gift cards are non-refundable once EXECUTED by Tremendous.
 *    Redemption refunds (point restoration) must happen BEFORE calling sendReward
 *    or only on FAILED/CANCELED orders — see redeem.ts for the guardrail.
 */

export {};
