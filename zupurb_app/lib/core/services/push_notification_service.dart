// push_notification_service.dart — FCM integration wrapper (I8).
//
// Responsibilities:
//   - Request iOS/Android notification permission
//   - Obtain FCM token and persist it to Firestore via the updateFcmToken callable
//   - Refresh token on rotation via onTokenRefresh listener
//   - Show local notifications for foreground messages (flutter_local_notifications)
//   - Route notification taps to the correct screen via GoRouter deep links
//   - Create the zupurb_main Android notification channel (high importance)
//
// Usage (call once after login):
//   final service = PushNotificationService(functionsService);
//   await service.initialize(uid, router);
//
// Background handler (register before runApp in main.dart):
//   FirebaseMessaging.onBackgroundMessage(pushNotificationBackgroundHandler);
//
// Deep-link routing (data.type → route):
//   new_follower          → /profile/{data.uid}
//   badge_earned          → /badges
//   deal_expiring         → /discover  (deals surface in discover)
//   reservation_reminder  → /reservation/my
//   points_expiring       → /points
//   review_liked          → /establishment/:estId  (fallback /notifications)
//   default               → /home

import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

import '../firebase/firebase_options.dart';
import 'functions_service.dart';

// ---------------------------------------------------------------------------
// Background handler — top-level function required by Firebase isolate model.
// ---------------------------------------------------------------------------

/// Register this in main.dart before runApp:
///   FirebaseMessaging.onBackgroundMessage(pushNotificationBackgroundHandler);
@pragma('vm:entry-point')
Future<void> pushNotificationBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // No business logic needed here. FCM system tray display is handled
  // automatically by the OS for notification messages.
}

// ---------------------------------------------------------------------------
// Android notification channels
// ---------------------------------------------------------------------------

/// Primary channel used for all non-categorised notifications.
const AndroidNotificationChannel _mainChannel = AndroidNotificationChannel(
  'zupurb_main',
  'Zupurb Notifications',
  description: 'General Zupurb notifications',
  importance: Importance.high,
);

const AndroidNotificationChannel _messagesChannel = AndroidNotificationChannel(
  'messages',
  'Messages',
  description: 'Chat messages',
  importance: Importance.high,
);

const AndroidNotificationChannel _reservationsChannel =
    AndroidNotificationChannel(
  'reservations',
  'Reservations',
  description: 'Reservation updates and reminders',
  importance: Importance.high,
);

const AndroidNotificationChannel _rewardsChannel = AndroidNotificationChannel(
  'rewards',
  'Rewards',
  description: 'Points, badges, deals, and tier updates',
  importance: Importance.defaultImportance,
);

// ---------------------------------------------------------------------------
// PushNotificationService
// ---------------------------------------------------------------------------

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  final FunctionsService _functions;

  PushNotificationService(this._functions);

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  /// Request permission, create Android channels, get + save the FCM token,
  /// register foreground and tap handlers.
  ///
  /// [uid]    — the authenticated user's UID, used when saving the token.
  /// [router] — GoRouter instance for deep-link navigation.
  Future<void> initialize(String uid, GoRouter router) async {
    // 1. Request permission (prompts on iOS; registers channel on Android 13+).
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return; // User declined — skip all further setup.
    }

    // 2. Create Android notification channels.
    await _createAndroidChannels();

    // 3. Initialise flutter_local_notifications (foreground display).
    await _initLocalNotifications();

    // 4. Get initial token and register with backend.
    final token = await _messaging.getToken();
    if (token != null) {
      await updateFcmToken(token);
    }

    // 5. Listen for token rotation and update automatically.
    _messaging.onTokenRefresh.listen(updateFcmToken);

    // 6. Wire foreground message handler.
    FirebaseMessaging.onMessage.listen(onMessageReceived);

    // 7. Wire notification tap handlers.
    onNotificationTapped(router);
  }

  // ---------------------------------------------------------------------------
  // onMessageReceived — foreground messages
  // ---------------------------------------------------------------------------

  /// Called when a push message arrives while the app is in the foreground.
  /// Displays a local notification via flutter_local_notifications.
  Future<void> onMessageReceived(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final type = message.data['type'] as String? ?? 'general';
    final channelId = _channelIdForType(type);

    await _local.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          _channelNameForId(channelId),
          importance: (channelId == 'messages' || channelId == 'reservations')
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
      // Encode type + entityId as "|"-separated payload for tap routing.
      payload: _buildPayload(message.data),
    );
  }

  // ---------------------------------------------------------------------------
  // onNotificationTapped — tap routing
  // ---------------------------------------------------------------------------

  /// Sets up handlers for:
  ///   - App launched from a terminated state by a notification tap
  ///   - App brought to foreground from background by a notification tap
  ///   - Local notification tap (foreground message)
  ///
  /// Routes based on data.type:
  ///   new_follower          → /profile/{data.uid}
  ///   badge_earned          → /badges
  ///   deal_expiring         → /discover
  ///   reservation_reminder  → /reservation/my
  ///   points_expiring       → /points
  ///   review_liked          → /notifications  (reviewId deep link not yet in router)
  ///   default               → /home
  void onNotificationTapped(GoRouter router) {
    // App started from terminated state via notification.
    _messaging.getInitialMessage().then((message) {
      if (message != null) _navigateFromMessage(message, router);
    });

    // App in background, tapped to foreground.
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _navigateFromMessage(message, router);
    });

    // Local notification tapped (foreground message shown by flutter_local_notifications).
    _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (details) {
        if (details.payload == null) return;
        final parts = details.payload!.split('|');
        final type = parts.isNotEmpty ? parts[0] : 'general';
        final extra = parts.length > 1 ? parts[1] : null;
        _navigateFromType(type, extra, router);
      },
    );
  }

  // ---------------------------------------------------------------------------
  // updateFcmToken — save token to backend
  // ---------------------------------------------------------------------------

  /// Persist [token] to Firestore via the updateFcmToken Cloud Function (I8).
  /// Fire-and-forget: errors are logged but never surfaced to the caller.
  Future<void> updateFcmToken(String token) async {
    try {
      await _functions.call(
        'updateFcmToken',
        {'token': token},
        (_) => null,
      );
    } catch (e) {
      // Non-fatal — token registration failure must not affect UX.
      // ignore: avoid_print
      print('[PushNotificationService] updateFcmToken error: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  Future<void> _createAndroidChannels() async {
    if (!Platform.isAndroid) return;
    final plugin = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (plugin == null) return;
    await Future.wait([
      plugin.createNotificationChannel(_mainChannel),
      plugin.createNotificationChannel(_messagesChannel),
      plugin.createNotificationChannel(_reservationsChannel),
      plugin.createNotificationChannel(_rewardsChannel),
    ]);
  }

  Future<void> _initLocalNotifications() async {
    // Intentionally no onDidReceiveNotificationResponse here — that callback
    // is registered in onNotificationTapped() (called after initialize()).
    // Registering it here would clobber the router-aware callback.
    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          // Permissions already requested via FirebaseMessaging above.
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
  }

  void _navigateFromMessage(RemoteMessage message, GoRouter router) {
    final type = message.data['type'] as String? ?? 'general';
    // Prefer 'uid' for follower; 'relatedEntityId' as fallback for review.
    final extra = (message.data['uid'] as String?) ??
        (message.data['relatedEntityId'] as String?);
    _navigateFromType(type, extra, router);
  }

  void _navigateFromType(String type, String? extra, GoRouter router) {
    switch (type) {
      case 'new_follower':
        if (extra != null && extra.isNotEmpty) {
          router.go('/profile/$extra');
        } else {
          router.go('/home');
        }
      case 'badge_earned':
      case 'badge_unlocked': // backward-compat alias
        router.go('/badges');
      case 'deal_expiring':
        router.go('/discover');
      case 'reservation_reminder':
      case 'reservation_reminder_24h':
      case 'reservation_reminder_2h':
        router.go('/reservation/my');
      case 'points_expiring':
      case 'points_expiring_soon':
      case 'points_expiring_urgent':
        router.go('/points');
      case 'review_liked':
      case 'review_helpful_vote':
        // Full deep link to /establishment/:id requires the estId which may not
        // always be present in the payload. Fall back to notifications list.
        // TODO (FIX_LIST): add /reviews/:id route and route here when available.
        router.go('/notifications');
      default:
        router.go('/home');
    }
  }

  /// Build the payload string stored in local notifications for tap routing.
  /// Format: [type]|[extra] where extra is uid or relatedEntityId (may be empty).
  String _buildPayload(Map<String, dynamic> data) {
    final type = data['type'] as String? ?? 'general';
    final extra = (data['uid'] as String?) ??
        (data['relatedEntityId'] as String?) ??
        '';
    return '$type|$extra';
  }

  String _channelIdForType(String type) {
    if (type == 'new_message') return 'messages';
    if (type.startsWith('reservation_')) return 'reservations';
    if (type.startsWith('points_') ||
        type.startsWith('badge_') ||
        type.startsWith('tier_') ||
        type.startsWith('challenge_') ||
        type == 'deal_expiring' ||
        type == 'deal_ready') {
      return 'rewards';
    }
    return 'zupurb_main';
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
        return 'Zupurb Notifications';
    }
  }
}
