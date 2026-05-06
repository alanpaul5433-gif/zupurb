import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/firebase/firebase_init.dart';
import 'core/services/push_service.dart';
import 'state/push/push_providers.dart';
import 'theme/theme.dart';
import 'router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeFirebase();
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
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Zupurb',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
