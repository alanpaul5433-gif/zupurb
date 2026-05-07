// PostHogService — stub for optional session-replay / product-analytics via PostHog.
//
// IMPORT PATH
//   package:zupurb_app/core/services/posthog_service.dart
//
// STATUS: STUB — not yet enabled.
//
// TO ENABLE
//   1. Add to pubspec.yaml:
//        posthog_flutter: ^4.x.x
//   2. Obtain a PostHog API key from https://app.posthog.com → Project Settings.
//   3. Pass via --dart-define=POSTHOG_API_KEY=<key> in launch configs.
//   4. Replace the UnimplementedError body below with:
//        await Posthog().setup(
//          'https://app.posthog.com',
//          const String.fromEnvironment('POSTHOG_API_KEY'),
//        );
//   5. Replace [capture] body with: Posthog().capture(eventName: event, properties: props);
//   6. Enable session replay in the PostHog dashboard and set the sample rate.
//
// PRIVACY NOTE
//   PostHog session replay can record screen content.  Before enabling, ensure:
//   - Sensitive fields (OTP inputs, card numbers) are masked via the SDK's
//     mask configuration.
//   - Privacy Policy and ATT prompt are updated to disclose session recording.
//   - CCPA / GDPR opt-out is wired to [optOut] before enabling.

class PostHogService {
  PostHogService._();

  static final PostHogService instance = PostHogService._();

  /// Captures a product-analytics event.
  ///
  /// Throws [UnimplementedError] until the PostHog SDK is integrated.
  // ignore: prefer_void_to_null
  void capture(String event, {Map<String, Object>? props}) {
    throw UnimplementedError(
      'PostHog session replay — add posthog_flutter package and '
      'POSTHOG_API_KEY to --dart-define to enable.',
    );
  }
}
