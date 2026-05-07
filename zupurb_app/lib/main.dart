import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/material.dart';
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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeFirebase();

  // Initialise Crashlytics — must run after Firebase.initializeApp().
  // Uses a direct instance here because ProviderScope is not yet available.
  await CrashlyticsService().initialize();

  // Catch platform-level errors (outside the Flutter framework) and report
  // them as fatal crashes.
  PlatformDispatcher.instance.onError = (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };

  // Register the FCM background handler before runApp (Flutter requirement:
  // must be a top-level function and registered before the isolate is spawned).
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const ProviderScope(child: ZupurbApp()));
}

class ZupurbApp extends ConsumerWidget {
  const ZupurbApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch pushInitProvider so FCM initialises automatically when the user
    // signs in and tears down on logout.
    ref.watch(pushInitProvider);
    // Watch deepLinkInitProvider so the deep-link stream is active whenever
    // the user is authenticated (I10).
    ref.watch(deepLinkInitProvider);
    // Activate Crashlytics user identity sync — keeps the UID attached to
    // crash reports whenever auth state changes (I12).
    ref.watch(crashlyticsAuthSyncProvider);
    // Warm up the analytics singleton on app start so it's available
    // immediately when the first screen fires logScreen (I11).
    ref.read(analyticsServiceProvider);
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Zupurb',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
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
