// push_service.dart — Thin FCM wrapper (I6).
//
// Responsibilities:
//   - Request iOS push permission
//   - Obtain and register the FCM token with the backend (registerFCMToken callable)
//   - Refresh token on rotation
//   - Show foreground messages as local notifications (flutter_local_notifications)
//   - Route notification taps to GoRouter deep links
//   - Unregister token on logout (unregisterFCMToken callable)
//
// Usage:
//   final push = ref.read(pushServiceProvider);
//   await push.initialize(uid);           // call once after login
//   push.setupForegroundHandler();        // call once after initialize
//   push.setupNotificationTapHandler(router); // call once with router ref
//   await push.unregister(uid);           // call on logout
//
// The background handler must be registered before runApp (see main.dart):
//   FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
//
// Notification type → route mapping:
//   new_message      → /messages (GoRouter)
//   reservation_*    → /reservations placeholder (no dedicated route yet; logs to FIX_LIST)
//   badge_unlocked   → /badges
//   points_* | tier_* → /points
//   default          → /notifications

import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import '../firebase/firebase_options.dart';
import 'functions_service.dart';

// ---------------------------------------------------------------------------
// Background handler — must be a top-level function (Flutter/isolate requirement)
// ---------------------------------------------------------------------------

/// Top-level FCM background handler. Registered in main.dart before runApp.
/// On Android, FCM delivers data-only messages here while the app is terminated/
/// backgrounded. Notification messages with a notification block are shown
/// automatically by the system; no local notification needed here.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Re-initialise Firebase for the background isolate.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // No business logic — just ensure Firebase is ready. Foreground display is
  // handled by PushService.setupForegroundHandler().
}

// ---------------------------------------------------------------------------
// Android notification channels
// ---------------------------------------------------------------------------

const AndroidNotificationChannel _messagesChannel = AndroidNotificationChannel(
  'messages',
  'Messages',
  description: 'Chat messages',
  importance: Importance.high,
);

const AndroidNotificationChannel _reservationsChannel = AndroidNotificationChannel(
  'reservations',
  'Reservations',
  description: 'Reservation updates',
  importance: Importance.high,
);

const AndroidNotificationChannel _rewardsChannel = AndroidNotificationChannel(
  'rewards',
  'Rewards',
  description: 'Points, badges, and tier updates',
  importance: Importance.defaultImportance,
);

const AndroidNotificationChannel _generalChannel = AndroidNotificationChannel(
  'general',
  'General',
  description: 'General notifications',
  importance: Importance.defaultImportance,
);

// ---------------------------------------------------------------------------
// PushService
// ---------------------------------------------------------------------------

class PushService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final FunctionsService _functions;

  PushService(this._functions);

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  /// Request permission (iOS), obtain FCM token, register with backend,
  /// create Android notification channels, and set up token refresh listener.
  ///
  /// Safe to call multiple times — subsequent calls refresh the token if changed.
  Future<void> initialize(String uid) async {
    // 1. Request permission (iOS prompt; no-op on Android 12 and below).
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      // User declined — do not proceed. Token registration skipped.
      return;
    }

    // 2. Create Android notification channels.
    await _createAndroidChannels();

    // 3. Initialise flutter_local_notifications for foreground display.
    await _initLocalNotifications();

    // 4. Obtain token and register with backend.
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerToken(token, uid);
    }

    // 5. Listen for token rotation and re-register automatically.
    _messaging.onTokenRefresh.listen((newToken) async {
      await _registerToken(newToken, uid);
    });
  }

  // ---------------------------------------------------------------------------
  // setupForegroundHandler
  // ---------------------------------------------------------------------------

  /// Display local notifications for messages received while the app is in the
  /// foreground. Must be called after initialize().
  void setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      await showLocalNotification(message);
    });
  }

  // ---------------------------------------------------------------------------
  // setupNotificationTapHandler
  // ---------------------------------------------------------------------------

  /// Route notification taps to the appropriate screen via [router].
  /// Handles both app-launch-from-notification and foreground tap scenarios.
  void setupNotificationTapHandler(GoRouter router) {
    // App opened from a terminated state via notification tap.
    _messaging.getInitialMessage().then((message) {
      if (message != null) _routeFromMessage(message, router);
    });

    // App in background, brought to foreground via notification tap.
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _routeFromMessage(message, router);
    });

    // Local notification taps (foreground messages shown via flutter_local_notifications).
    _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;
        if (payload != null) {
          _routeFromType(payload, null, router);
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // showLocalNotification
  // ---------------------------------------------------------------------------

  /// Display a local notification for a [message] received in the foreground.
  Future<void> showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final type = message.data['type'] as String? ?? 'general';
    final channelId = _channelIdForType(type);
    final channelName = _channelNameForId(channelId);

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelName,
          importance: channelId == 'messages' || channelId == 'reservations'
              ? Importance.high
              : Importance.defaultImportance,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      // Pass the notification type as payload so the tap handler can route.
      payload: type,
    );
  }

  // ---------------------------------------------------------------------------
  // unregister
  // ---------------------------------------------------------------------------

  /// Delete the FCM token and remove it from the backend. Call on logout.
  Future<void> unregister(String uid) async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _functions.call(
          'unregisterFCMToken',
          {'token': token},
          (_) => null,
        );
      }
      await _messaging.deleteToken();
    } catch (e) {
      // Non-fatal — token cleanup failure must not block logout.
      // ignore: avoid_print
      print('[PushService] unregister error: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  Future<void> _registerToken(String token, String uid) async {
    try {
      await _functions.call(
        'registerFCMToken',
        {
          'token': token,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
        (_) => null,
      );
      // ignore: avoid_print
      print('[PushService] FCM token registered uid=$uid platform=${Platform.isIOS ? "ios" : "android"}');
    } catch (e) {
      // Non-fatal — registration failure is logged but does not surface to the user.
      // ignore: avoid_print
      print('[PushService] registerFCMToken error: $e');
    }
  }

  Future<void> _createAndroidChannels() async {
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin == null) return;

    await Future.wait([
      androidPlugin.createNotificationChannel(_messagesChannel),
      androidPlugin.createNotificationChannel(_reservationsChannel),
      androidPlugin.createNotificationChannel(_rewardsChannel),
      androidPlugin.createNotificationChannel(_generalChannel),
    ]);
  }

  Future<void> _initLocalNotifications() async {
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false, // Already requested via FirebaseMessaging
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _localNotifications.initialize(initSettings);
  }

  void _routeFromMessage(RemoteMessage message, GoRouter router) {
    final type = message.data['type'] as String? ?? 'general';
    final relatedEntityId = message.data['relatedEntityId'] as String?;
    _routeFromType(type, relatedEntityId, router);
  }

  void _routeFromType(String type, String? entityId, GoRouter router) {
    if (type == 'new_message') {
      if (entityId != null && entityId.isNotEmpty) {
        router.go('/messages/$entityId');
      } else {
        router.go('/messages');
      }
    } else if (type.startsWith('reservation_')) {
      router.go('/reservations');
    } else if (type == 'badge_unlocked') {
      router.go('/badges');
    } else if (type.startsWith('points_') || type.startsWith('tier_')) {
      router.go('/points');
    } else {
      router.go('/notifications');
    }
  }

  String _channelIdForType(String type) {
    if (type == 'new_message') return 'messages';
    if (type.startsWith('reservation_')) { return 'reservations'; }
    if (type.startsWith('points_') ||
        type.startsWith('badge_') ||
        type.startsWith('tier_') ||
        type.startsWith('challenge_')) {
      return 'rewards';
    }
    return 'general';
  }

  String _channelNameForId(String id) {
    switch (id) {
      case 'messages':
        return 'Messages';
      case 'reservations':
        return 'Reservations';
      case 'rewards':
        return 'Rewards';
      default:
        return 'General';
    }
  }
}
