/**
 * crashlytics_alerts.ts — D8: Crashlytics Alerting Cloud Functions
 *
 * Triggers on Firebase Crashlytics alert events and POSTs structured
 * Slack webhook messages. If SLACK_WEBHOOK_URL is unset, each handler
 * logs a warning and exits cleanly (graceful no-op).
 */

import {
  onNewFatalIssuePublished,
  onNewAnrIssuePublished,
  onVelocityAlertPublished,
  onStabilityDigestPublished,
  CrashlyticsEvent,
  NewFatalIssuePayload,
  NewAnrIssuePayload,
  VelocityAlertPayload,
  StabilityDigestPayload,
} from "firebase-functions/v2/alerts/crashlytics";

import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Shared helper: POST to Slack
// ---------------------------------------------------------------------------

interface SlackBlock {
  type: "section";
  text: { type: "mrkdwn"; text: string };
}

interface SlackBody {
  text: string;
  blocks: SlackBlock[];
}

async function postToSlack(body: SlackBody): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    log.warn("SLACK_WEBHOOK_URL not set — skipping Slack notification", {
      traceId: newTraceId(),
      domain: "alerts",
    });
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    log.warn("Slack webhook returned non-OK status", {
      traceId: newTraceId(),
      domain: "alerts",
      status: res.status,
    });
  }
}

// ---------------------------------------------------------------------------
// 1. New Fatal Issue
// ---------------------------------------------------------------------------

export const alerts_onNewFatalIssue = onNewFatalIssuePublished(
  async (event: CrashlyticsEvent<NewFatalIssuePayload>) => {
    const traceId = newTraceId();
    const { issue } = event.data.payload;
    const appId = event.appId;

    log.info("Crashlytics new fatal issue", {
      traceId,
      domain: "alerts",
      eventId: event.id,
      issueId: issue.id,
      appId,
    });

    const details = [
      `*App:* \`${appId}\``,
      `*Issue ID:* \`${issue.id}\``,
      `*Title:* ${issue.title}`,
      `*Version:* ${issue.appVersion}`,
    ].join("\n");

    await postToSlack({
      text: "🔴 New Fatal Crash on Zupurb",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🔴 New Fatal Crash*\n${details}`,
          },
        },
      ],
    });
  }
);

// ---------------------------------------------------------------------------
// 2. New ANR Issue
// ---------------------------------------------------------------------------

export const alerts_onNewAnrIssue = onNewAnrIssuePublished(
  async (event: CrashlyticsEvent<NewAnrIssuePayload>) => {
    const traceId = newTraceId();
    const { issue } = event.data.payload;
    const appId = event.appId;

    log.info("Crashlytics new ANR issue", {
      traceId,
      domain: "alerts",
      eventId: event.id,
      issueId: issue.id,
      appId,
    });

    const details = [
      `*App:* \`${appId}\``,
      `*Issue ID:* \`${issue.id}\``,
      `*Title:* ${issue.title}`,
      `*Version:* ${issue.appVersion}`,
    ].join("\n");

    await postToSlack({
      text: "🟠 New ANR Issue on Zupurb",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🟠 New ANR Issue*\n${details}`,
          },
        },
      ],
    });
  }
);

// ---------------------------------------------------------------------------
// 3. Velocity Alert
// ---------------------------------------------------------------------------

export const alerts_onVelocityAlert = onVelocityAlertPublished(
  async (event: CrashlyticsEvent<VelocityAlertPayload>) => {
    const traceId = newTraceId();
    const { issue, crashCount, crashPercentage, firstVersion } =
      event.data.payload;

    log.info("Crashlytics velocity alert", {
      traceId,
      domain: "alerts",
      eventId: event.id,
      issueId: issue.id,
      crashCount,
    });

    const details = [
      `*Issue ID:* \`${issue.id}\``,
      `*Title:* ${issue.title}`,
      `*Crashes:* ${crashCount} (${(crashPercentage * 100).toFixed(1)}% of sessions)`,
      `*First Seen Version:* ${firstVersion}`,
    ].join("\n");

    await postToSlack({
      text: "⚡ Velocity Alert on Zupurb",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*⚡ Velocity Alert*\n${details}`,
          },
        },
      ],
    });
  }
);

// ---------------------------------------------------------------------------
// 4. Stability Digest
// ---------------------------------------------------------------------------

export const alerts_onStabilityDigest = onStabilityDigestPublished(
  async (event: CrashlyticsEvent<StabilityDigestPayload>) => {
    const traceId = newTraceId();
    const { digestDate, trendingIssues } = event.data.payload;

    log.info("Crashlytics stability digest", {
      traceId,
      domain: "alerts",
      eventId: event.id,
      digestDate,
      trendingIssueCount: trendingIssues.length,
    });

    const top3 = trendingIssues.slice(0, 3);
    const issueLines = top3
      .map(
        (ti, i) =>
          `${i + 1}. *${ti.issue.title}* (\`${ti.issue.id}\`) — ${ti.eventCount} events`
      )
      .join("\n");

    const details = [
      `*Digest Date:* ${digestDate}`,
      `*Top Issues:*\n${issueLines || "_No trending issues_"}`,
    ].join("\n");

    await postToSlack({
      text: "📊 Stability Digest for Zupurb",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📊 Stability Digest*\n${details}`,
          },
        },
      ],
    });
  }
);
