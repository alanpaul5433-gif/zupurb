// deep_link_service.dart — Thin wrapper around app_links for Android App Links,
// iOS Universal Links, and the custom zupurb:// scheme (I10).
//
// Import path: package:zupurb_app/core/services/deep_link_service.dart
//
// Public API:
//   initialize([BuildContext? context]) → Future<void>
//     Start listening for incoming URIs. Call once from deepLinkInitProvider.
//   dispose() → void
//     Cancel the URI subscription. Called automatically via ref.onDispose.
//
// Handled URI paths:
//   /venue/{id}           → navigates to /establishment/{id}
//   /profile/{uid}        → navigates to /profile/{uid}
//   /reservation/{id}     → navigates to /reservation/pass (passes id as query param)
//   /referral/{code}      → stores code in SharedPreferences under pending_referral_code
//   <anything else>       → logged and ignored
//
// Analytics integration: TODO in I11 — print statements are placeholders.
// Cost tagging: no paid API calls in this service.

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Key used to persist a referral code until the user completes sign-up.
const String kPendingReferralCodeKey = 'pending_referral_code';

class DeepLinkService {
  DeepLinkService();

  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  // Stored before any async gap so _handleUri can reference it safely.
  BuildContext? _context;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Begin listening for incoming deep-link URIs.
  ///
  /// [context] is optional: if null, navigation paths are logged but not
  /// executed (safe during early app init before a GoRouter is mounted).
  Future<void> initialize([BuildContext? context]) async {
    // Store context before any await so _handleUri can reference it without
    // crossing an async gap (satisfies use_build_context_synchronously lint).
    _context = context;

    // Handle the URI that launched a cold start (app was not already running).
    final initialUri = await _appLinks.getInitialLink();
    if (initialUri != null) {
      print('[DeepLinkService] cold-start URI: $initialUri');
      _handleUri(initialUri);
    }

    // Subscribe to subsequent URIs while the app is running.
    _sub = _appLinks.uriLinkStream.listen(
      (uri) {
        print('[DeepLinkService] incoming URI: $uri');
        _handleUri(uri);
      },
      onError: (Object err) {
        // Convert vendor error to a generic log — callers never see app_links types.
        print('[DeepLinkService] stream error: $err');
      },
    );
  }

  /// Cancel the URI subscription.  Called via ref.onDispose in the provider.
  void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  // ---------------------------------------------------------------------------
  // Internal routing
  // ---------------------------------------------------------------------------

  void _handleUri(Uri uri) {
    // Normalise: strip the host prefix for custom scheme URIs so that
    // zupurb://app/venue/123 and https://zupurb.app/venue/123 both produce
    // the same [segments].
    final segments = uri.pathSegments;

    if (segments.isEmpty) {
      print('[DeepLinkService] empty path — ignored');
      return;
    }

    switch (segments[0]) {
      // /venue/{id}  →  /establishment/{id}
      case 'venue':
        if (segments.length >= 2) {
          final id = segments[1];
          print('[DeepLinkService] routing to establishment: $id');
          _context?.go('/establishment/$id');
        } else {
          print('[DeepLinkService] /venue missing id — ignored');
        }

      // /profile/{uid}  →  /profile/{uid}
      case 'profile':
        if (segments.length >= 2) {
          final uid = segments[1];
          print('[DeepLinkService] routing to profile: $uid');
          _context?.go('/profile/$uid');
        } else {
          print('[DeepLinkService] /profile missing uid — ignored');
        }

      // /reservation/{id}  →  /reservation/pass?id={id}
      case 'reservation':
        if (segments.length >= 2) {
          final id = segments[1];
          print('[DeepLinkService] routing to reservation pass: $id');
          _context?.go('/reservation/pass', extra: id);
        } else {
          print('[DeepLinkService] /reservation missing id — ignored');
        }

      // /referral/{code}  →  store in SharedPreferences for post-login pickup
      case 'referral':
        if (segments.length >= 2) {
          final code = segments[1];
          print('[DeepLinkService] storing referral code: $code');
          _storePendingReferral(code);
        } else {
          print('[DeepLinkService] /referral missing code — ignored');
        }

      default:
        print('[DeepLinkService] unrecognised path "${uri.path}" — ignored');
    }
  }

  Future<void> _storePendingReferral(String code) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(kPendingReferralCodeKey, code);
      print('[DeepLinkService] referral code stored: $code');
    } catch (e) {
      print('[DeepLinkService] failed to store referral code: $e');
    }
  }
}
