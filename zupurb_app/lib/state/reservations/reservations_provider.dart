import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/reservation.dart';
import '../auth/auth_providers.dart';

/// Calls `createReservation` and returns the typed result (with OTP/QR).
final createReservationProvider = Provider((ref) {
  return (Map<String, dynamic> payload) async {
    final res = await ref.read(functionsServiceProvider).createReservation(payload);
    return CreateReservationResult.fromMap(res);
  };
});

/// Loads the current user's reservations for the My Reservations screen.
final myReservationsProvider = FutureProvider<List<Reservation>>((ref) async {
  final res = await ref.read(functionsServiceProvider).getReservations();
  final list = (res['reservations'] as List?) ?? const [];
  return list
      .map((e) => Reservation.fromMap(Map<String, dynamic>.from(e as Map)))
      .toList();
});
