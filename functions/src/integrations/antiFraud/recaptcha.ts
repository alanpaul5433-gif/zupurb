/**
 * integrations/antiFraud/recaptcha.ts — I11 Anti-Fraud (reCAPTCHA Enterprise stub).
 *
 * STUB IMPLEMENTATION — production wiring deferred until reCAPTCHA Enterprise
 * site keys are provisioned.
 *
 * To complete setup:
 *   1. Google Cloud Console → Security → reCAPTCHA Enterprise.
 *   2. Create Android + iOS keys; note the project ID.
 *   3. Enable the reCAPTCHA Enterprise API on the GCP project.
 *   4. Add the @google-cloud/recaptcha-enterprise npm package.
 *   5. Replace validateRecaptchaToken() below with a real API call:
 *        const client = new RecaptchaEnterpriseServiceClient();
 *        const [assessment] = await client.createAssessment({
 *          parent: `projects/${projectId}`,
 *          assessment: { token, event: { siteKey, expectedAction: action } },
 *        });
 *        return assessment.riskAnalysis.score >= 0.5;
 *   6. Set RECAPTCHA_PROJECT_ID and RECAPTCHA_SITE_KEY in Secret Manager.
 *
 * Call sites (server-side validation):
 *   - submitReview callable: validate token before writing review.
 *   - completeOnboarding callable: validate token on sign-up.
 *   - applyReferralCode callable: validate token before redemption.
 */

/**
 * Validates a reCAPTCHA Enterprise token returned by the client SDK.
 *
 * STUB: Always returns `true` until real validation is wired.
 *
 * TODO(I11): Replace with real reCAPTCHA Enterprise API call.
 * See class-level doc for full setup instructions.
 *
 * @param token    Token from RecaptchaService.executeRecaptcha() on the client.
 * @param action   The expected action string (e.g., 'submit_review').
 * @returns        true if the token is valid and risk score is acceptable.
 */
export async function validateRecaptchaToken(
  token: string,
  action: string
): Promise<boolean> {
  // TODO(I11): Implement real reCAPTCHA Enterprise token validation.
  if (token === "recaptcha-not-configured") {
    console.warn(
      JSON.stringify({
        domain: "antiFraud",
        eventType: "validateRecaptchaToken",
        action,
        result: "stub-pass",
        note: "recaptcha-not-configured token — stub always passes",
      })
    );
    return true;
  }

  // Real token received but validation not yet wired — log and pass.
  console.warn(
    JSON.stringify({
      domain: "antiFraud",
      eventType: "validateRecaptchaToken",
      action,
      result: "stub-pass",
      note: "reCAPTCHA Enterprise validation not yet implemented (I11 TODO)",
    })
  );
  return true;
}
