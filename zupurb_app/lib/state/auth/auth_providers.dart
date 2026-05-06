// Core auth + service providers consumed across the app.
//
// Import path: package:zupurb_app/state/auth/auth_providers.dart
//
// Providers:
//   authServiceProvider       → AuthService singleton
//   functionsServiceProvider  → FunctionsService singleton
//   firestoreServiceProvider  → FirestoreService singleton
//   authStateProvider         → StreamProvider<User?> — login/logout transitions
//   currentUidProvider        → Provider<String?> — convenience UID accessor
//   isAuthenticatedProvider   → Provider<bool>   — used by router guard

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/functions_service.dart';
import '../../core/services/firestore_service.dart';

/// Singleton [AuthService] — stable across the app lifetime.
final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(),
  name: 'authServiceProvider',
);

/// Singleton [FunctionsService] — stable across the app lifetime.
final functionsServiceProvider = Provider<FunctionsService>(
  (ref) => FunctionsService(),
  name: 'functionsServiceProvider',
);

/// Singleton [FirestoreService] — stable across the app lifetime.
final firestoreServiceProvider = Provider<FirestoreService>(
  (ref) => FirestoreService(),
  name: 'firestoreServiceProvider',
);

/// Streams [User] changes (login / logout / token refresh).
/// Null means unauthenticated.
final authStateProvider = StreamProvider<User?>(
  (ref) => ref.watch(authServiceProvider).authStateChanges,
  name: 'authStateProvider',
);

/// The current user's UID string, or null if not authenticated.
/// Prefer this over reading authStateProvider directly for simple UID checks.
final currentUidProvider = Provider<String?>(
  (ref) => ref.watch(authStateProvider).value?.uid,
  name: 'currentUidProvider',
);

/// True when a user is signed in and the auth state has resolved.
/// Used by the router guard to decide redirect target.
final isAuthenticatedProvider = Provider<bool>(
  (ref) => ref.watch(authStateProvider).value != null,
  name: 'isAuthenticatedProvider',
);
