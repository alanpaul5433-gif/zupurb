/// Result returned once by the `createReservation` callable. The OTP + QR are
/// only available here (getReservations strips them), so they must be carried
/// to the pass screen immediately after creation.
class CreateReservationResult {
  final String reservationId;
  final String status;
  final String qrPayload;
  final String? otpCode;
  final String scheduledAt;

  const CreateReservationResult({
    required this.reservationId,
    required this.status,
    required this.qrPayload,
    required this.otpCode,
    required this.scheduledAt,
  });

  factory CreateReservationResult.fromMap(Map<String, dynamic> m) {
    return CreateReservationResult(
      reservationId: (m['reservationId'] ?? '').toString(),
      status: (m['status'] ?? 'confirmed').toString(),
      qrPayload: (m['qrPayload'] ?? '').toString(),
      otpCode: m['otpCode']?.toString(),
      scheduledAt: (m['scheduledAt'] ?? '').toString(),
    );
  }
}

/// A reservation as returned by `getReservations` (for the My Reservations list).
class Reservation {
  final String reservationId;
  final String estId;
  final String estName;
  final int partySize;
  final DateTime? scheduledAt;
  final String status; // confirmed | checked_in | completed | no_show | cancelled

  const Reservation({
    required this.reservationId,
    required this.estId,
    required this.estName,
    required this.partySize,
    required this.scheduledAt,
    required this.status,
  });

  factory Reservation.fromMap(Map<String, dynamic> m) {
    return Reservation(
      reservationId: (m['reservationId'] ?? '').toString(),
      estId: (m['estId'] ?? '').toString(),
      estName: (m['estName'] ?? 'Venue').toString(),
      partySize: (m['partySize'] as num?)?.toInt() ?? 1,
      scheduledAt: DateTime.tryParse((m['scheduledAt'] ?? '').toString())?.toLocal(),
      status: (m['status'] ?? 'confirmed').toString(),
    );
  }

  bool get isUpcoming =>
      (status == 'confirmed' || status == 'checked_in') &&
      (scheduledAt == null || scheduledAt!.isAfter(DateTime.now().subtract(const Duration(hours: 6))));
  bool get isCancelled => status == 'cancelled';
}
