// deep_link_service.dart — Branch.io deep-link wrapper for Zupurb (I10).
//
// Import path: package:zupurb_app/core/services/deep_link_service.dart
//
// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
//   initialize()
//     Initialises Branch SDK and registers the incoming deep-link listener.
//     Call once, non-blocking, via deepLinkInitProvider at app root.
//
//   dispose()
//     Cancels the Branch listener stream.  Called via ref.onDispose.
//
//   setRouter(GoRouter)
//     Injects the GoRouter so onDeepLink can navigate.  Called by the provider.
//
//   createReferralLink(String referralCode) → Future<String?>
//     Returns a Branch short URL with type=referral, code=<referralCode>.
//
//   createEstablishmentLink(String establishmentId, String name) → Future<String?>
//     Returns a Branch short URL that deep-links to /establishment/:id.
//
//   createReviewLink(String reviewId, String establishmentName) → Future<String?>
//     Returns a Branch short URL that deep-links to /review/detail/:id.
//
//   createDealLink(String dealId, String dealTitle) → Future<String?>
//     Returns a Branch short URL that deep-links to /deal/:id.
//
// ─────────────────────────────────────────────────────────────────────────────
// Deep-link routing  (handled inside onDeepLink)
// ─────────────────────────────────────────────────────────────────────────────
//   type=referral,      code=XXX      → /signup?referralCode=XXX (pre-fill)
//                                       code also persisted in SharedPreferences
//   type=establishment, id=XXX        → /establishment/:id
//   type=review,        id=XXX        → /review/detail/:id
//   type=deal,          id=XXX        → /deal/:id
//   type=profile,       uid=XXX       → /profile/:uid
//
// ─────────────────────────────────────────────────────────────────────────────
// Platform setup checklist (one-time, manual steps)
// ─────────────────────────────────────────────────────────────────────────────
//
// ANDROID — android/app/src/main/AndroidManifest.xml
//   1. Inside the <application> tag, paste:
//
//      <!-- Branch.io initialisation keys -->
//      <meta-data android:name="io.branch.sdk.BranchKey"
//                 android:value="key_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
//      <meta-data android:name="io.branch.sdk.BranchKey.test"
//                 android:value="key_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
//
//   2. Inside the <activity> tag that has android:name=".MainActivity", add:
//
//      <!-- App Link intent-filter for https://zupurb.app -->
//      <intent-filter android:autoVerify="true">
//        <action android:name="android.intent.action.VIEW" />
//        <category android:name="android.intent.category.DEFAULT" />
//        <category android:name="android.intent.category.BROWSABLE" />
//        <data android:scheme="https"
//              android:host="zupurb.app" />
//      </intent-filter>
//
//      <!-- Custom URI scheme fallback -->
//      <intent-filter>
//        <action android:name="android.intent.action.VIEW" />
//        <category android:name="android.intent.category.DEFAULT" />
//        <category android:name="android.intent.category.BROWSABLE" />
//        <data android:scheme="zupurb" />
//      </intent-filter>
//
//   3. Serve /.well-known/assetlinks.json from https://zupurb.app
//      with sha256_cert_fingerprints for the release keystore.
//
// IOS — Xcode project
//   1. Target → Signing & Capabilities → "+ Capability" → Associated Domains.
//      Add: applinks:zupurb.app
//   2. Info.plist — add URL scheme:
//      <key>CFBundleURLTypes</key>
//      <array>
//        <dict>
//          <key>CFBundleURLSchemes</key>
//          <array><string>zupurb</string></array>
//        </dict>
//      </array>
//   3. Info.plist — add Branch keys (replace with real keys):
//      <key>branch_key</key>
//      <dict>
//        <key>live</key>  <string>key_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</string>
//        <key>test</key>  <string>key_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</string>
//      </dict>
//   4. Serve apple-app-site-association at https://zupurb.app/.well-known/
//      with the app's Team ID + Bundle ID.
//
// BRANCH DASHBOARD
//   1. Create app → configure iOS Bundle ID + Android package name.
//   2. Set custom link domain: zupurb.app (or use Branch bnc.lt during testing).
//   3. Enable "Universal Links" + "App Links" in Link Settings panel.
//   4. Copy live + test SDK keys into the plist/manifest placeholders above.
//   5. Add link routing rules:
//        $deeplink_path=establishment/:id → /establishment/:id
//        $deeplink_path=review/detail/:id → /review/detail/:id
//        $deeplink_path=deal/:id          → /deal/:id
//        $deeplink_path=profile/:uid      → /profile/:uid
//
// ─────────────────────────────────────────────────────────────────────────────
// Cost tagging
// ─────────────────────────────────────────────────────────────────────────────
//   Branch pricing (2026): free up to 10 k MAU links; $59/mo above that.
//   Every createXxxLink() call counts as one tracked link impression.
//   Cost band: LOW for MVP traffic.
//
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_branch_sdk/flutter_branch_sdk.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// SharedPreferences key used to persist a referral code from the deep link
/// through the sign-up flow.  Read by the sign-up screen after auth completes.
const String kPendingReferralCodeKey = 'pending_referral_code';

/// Thin wrapper around [FlutterBranchSdk].
///
/// All Branch-specific types are contained within this file.  Consumers receive
/// plain Dart types (String, Map) and internal error types — never Branch SDK
/// shapes.
class DeepLinkService {
  DeepLinkService();

  StreamSubscription<Map<dynamic, dynamic>>? _sub;

  // GoRouter reference injected by the provider via [setRouter].
  // Kept nullable so navigation silently no-ops before the router is mounted.
  GoRouter? _router;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /// Wire in the [GoRouter] so [onDeepLink] can navigate without a BuildContext.
  ///
  /// Called by [deepLinkInitProvider] after the Riverpod tree is ready.
  void setRouter(GoRouter router) {
    _router = router;
  }

  /// Initialise Branch SDK and start listening for incoming deep-link params.
  ///
  /// Safe to call more than once — Branch de-dupes cold-start internally.
  Future<void> initialize() async {
    await FlutterBranchSdk.init(
      useTestKey: kDebugMode, // use test key in debug builds
      enableLogging: kDebugMode,
    );

    _sub = FlutterBranchSdk.listSession().listen(
      (data) {
        debugPrint('[DeepLinkService] session data: $data');
        // Branch passes +clicked_branch_link=true only when a real link was
        // followed.  Ignore organic opens to avoid spurious navigation.
        final clicked = data['+clicked_branch_link'] as bool? ?? false;
        if (clicked) {
          // Cast to Map<String, dynamic> — Branch always uses string keys.
          onDeepLink(
            data.map((k, v) => MapEntry(k.toString(), v)),
          );
        }
      },
      onError: (Object err) {
        // Convert Branch error to a generic log; callers never see SDK types.
        debugPrint('[DeepLinkService] stream error: $err');
      },
    );
  }

  /// Cancel the Branch listener.  Called via [ref.onDispose] in the provider.
  void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------

  /// Route an incoming Branch session payload to the correct in-app screen.
  ///
  /// [params] is the Branch data map with string keys.
  /// All vendor-specific keys remain internal to this method.
  @visibleForTesting
  void onDeepLink(Map<String, dynamic> params) {
    final type = params['type'] as String?;

    switch (type) {
      // ── Referral ───────────────────────────────────────────────────────────
      case 'referral':
        final code = params['code'] as String?;
        if (code == null || code.isEmpty) {
          debugPrint('[DeepLinkService] referral: missing code — ignored');
          return;
        }
        debugPrint('[DeepLinkService] storing referral code: $code');
        _storePendingReferral(code);
        // If no router yet (cold-start before auth), the code is preserved in
        // SharedPreferences and picked up by SignUpScreen on load.
        _router?.go('/signup', extra: {'referralCode': code});

      // ── Establishment ──────────────────────────────────────────────────────
      case 'establishment':
        final id = params['id'] as String?;
        if (id == null || id.isEmpty) {
          debugPrint('[DeepLinkService] establishment: missing id — ignored');
          return;
        }
        debugPrint('[DeepLinkService] routing to establishment: $id');
        _router?.go('/establishment/$id');

      // ── Review ─────────────────────────────────────────────────────────────
      case 'review':
        final id = params['id'] as String?;
        if (id == null || id.isEmpty) {
          debugPrint('[DeepLinkService] review: missing id — ignored');
          return;
        }
        debugPrint('[DeepLinkService] routing to review detail: $id');
        _router?.go('/review/detail/$id');

      // ── Deal ───────────────────────────────────────────────────────────────
      case 'deal':
        final id = params['id'] as String?;
        if (id == null || id.isEmpty) {
          debugPrint('[DeepLinkService] deal: missing id — ignored');
          return;
        }
        debugPrint('[DeepLinkService] routing to deal: $id');
        _router?.go('/deal/$id');

      // ── User profile ───────────────────────────────────────────────────────
      case 'profile':
        final uid = params['uid'] as String?;
        if (uid == null || uid.isEmpty) {
          debugPrint('[DeepLinkService] profile: missing uid — ignored');
          return;
        }
        debugPrint('[DeepLinkService] routing to profile: $uid');
        _router?.go('/profile/$uid');

      default:
        debugPrint('[DeepLinkService] unrecognised type "$type" — ignored');
    }
  }

  // ---------------------------------------------------------------------------
  // Link creation
  // ---------------------------------------------------------------------------

  /// Creates a Branch short URL for referral attribution.
  ///
  /// The generated link carries custom metadata [type]=referral, [code]=referralCode
  /// so that [onDeepLink] can pre-fill the sign-up form.
  ///
  /// Returns null on failure — callers should fall back to a plain app-store URL.
  Future<String?> createReferralLink(String referralCode) async {
    final metadata = BranchContentMetaData()
      ..addCustomMetadata('type', 'referral')
      ..addCustomMetadata('code', referralCode);

    final content = BranchUniversalObject(
      canonicalIdentifier: 'referral/$referralCode',
      title: 'Join Zupurb',
      contentDescription:
          'Use my referral code $referralCode and earn bonus points!',
      contentMetadata: metadata,
    );

    final properties = BranchLinkProperties(
      channel: 'app',
      feature: 'referral',
    );

    return _shortUrl(content, properties);
  }

  /// Creates a Branch short URL for sharing an establishment.
  Future<String?> createEstablishmentLink(
    String establishmentId,
    String name,
  ) async {
    final metadata = BranchContentMetaData()
      ..addCustomMetadata('type', 'establishment')
      ..addCustomMetadata('id', establishmentId);

    final content = BranchUniversalObject(
      canonicalIdentifier: 'establishment/$establishmentId',
      title: name,
      contentDescription: 'Check out $name on Zupurb',
      contentMetadata: metadata,
    );

    final properties = BranchLinkProperties(
      channel: 'app',
      feature: 'sharing',
    )..addControlParam(r'$deeplink_path', 'establishment/$establishmentId');

    return _shortUrl(content, properties);
  }

  /// Creates a Branch short URL for sharing a review.
  Future<String?> createReviewLink(
    String reviewId,
    String establishmentName,
  ) async {
    final metadata = BranchContentMetaData()
      ..addCustomMetadata('type', 'review')
      ..addCustomMetadata('id', reviewId);

    final content = BranchUniversalObject(
      canonicalIdentifier: 'review/$reviewId',
      title: 'My review of $establishmentName',
      contentDescription: 'Read my Zupurb review of $establishmentName',
      contentMetadata: metadata,
    );

    final properties = BranchLinkProperties(
      channel: 'app',
      feature: 'sharing',
    )..addControlParam(r'$deeplink_path', 'review/detail/$reviewId');

    return _shortUrl(content, properties);
  }

  /// Creates a Branch short URL for sharing a deal.
  Future<String?> createDealLink(String dealId, String dealTitle) async {
    final metadata = BranchContentMetaData()
      ..addCustomMetadata('type', 'deal')
      ..addCustomMetadata('id', dealId);

    final content = BranchUniversalObject(
      canonicalIdentifier: 'deal/$dealId',
      title: dealTitle,
      contentDescription: 'Check out this Zupurb deal: $dealTitle',
      contentMetadata: metadata,
    );

    final properties = BranchLinkProperties(
      channel: 'app',
      feature: 'sharing',
    )..addControlParam(r'$deeplink_path', 'deal/$dealId');

    return _shortUrl(content, properties);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// Calls Branch SDK to generate a short URL.
  ///
  /// Returns null and logs on any error so callers always get a clean result
  /// type without catching Branch-specific exceptions.
  Future<String?> _shortUrl(
    BranchUniversalObject content,
    BranchLinkProperties properties,
  ) async {
    try {
      final response = await FlutterBranchSdk.getShortUrl(
        buo: content,
        linkProperties: properties,
      );
      if (response.success) {
        final url = response.result;
        debugPrint('[DeepLinkService] created link: $url');
        // cost-tag: branch-link-creation × 1
        return url;
      } else {
        debugPrint(
          '[DeepLinkService] link creation failed: ${response.errorMessage}',
        );
        return null;
      }
    } catch (e) {
      debugPrint('[DeepLinkService] link creation exception: $e');
      return null;
    }
  }

  Future<void> _storePendingReferral(String code) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(kPendingReferralCodeKey, code);
      debugPrint('[DeepLinkService] referral code persisted: $code');
    } catch (e) {
      debugPrint('[DeepLinkService] failed to persist referral code: $e');
    }
  }
}
