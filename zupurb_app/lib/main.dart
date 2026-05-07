import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/material.dart';
import 'l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/firebase/firebase_init.dart';
import 'core/services/crashlytics_service.dart';
import 'core/services/push_service.dart';
import 'state/analytics/analytics_providers.dart';
import 'state/crashlytics/crashlytics_providers.dart';
import 'state/deep_link/deep_link_providers.dart';
import 'state/push/push_providers.dart';
import 'theme/theme.dart';
import 'router.dart';

// Captures any startup error so it can be shown on screen instead of
// silently crashing. Cleared once the app boots successfully.
String? _startupError;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await initializeFirebase();
  } catch (e, st) {
    _startupError = 'initializeFirebase failed:\n$e\n\n$st';
    runApp(_ErrorApp(_startupError!));
    return;
  }

  if (!kIsWeb) {
    try {
      await CrashlyticsService().initialize();
    } catch (e) {
      // Non-fatal — continue without Crashlytics
      debugPrint('[Crashlytics] Init failed: $e');
    }

    PlatformDispatcher.instance.onError = (error, stack) {
      try {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      } catch (_) {}
      return true;
    };

    try {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (e) {
      debugPrint('[FCM] Background handler registration failed: $e');
    }
  }

  runApp(const ProviderScope(child: ZupurbApp()));
}

/// Shown instead of a blank crash when startup fails.
/// Displays the exact error so it can be reported without USB debugging.
class _ErrorApp extends StatelessWidget {
  const _ErrorApp(this.message);
  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF1A1A2E),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'Startup Error',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'The app crashed during initialization.\n'
                  'Screenshot this and send it for diagnosis.',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: SingleChildScrollView(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: SelectableText(
                        message,
                        style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ZupurbApp extends ConsumerWidget {
  const ZupurbApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!kIsWeb) {
      ref.watch(pushInitProvider);
      ref.watch(deepLinkInitProvider);
      ref.watch(crashlyticsAuthSyncProvider);
    }
    ref.read(analyticsServiceProvider);
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Zupurb',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', 'US'),
      ],
    );
  }
}
