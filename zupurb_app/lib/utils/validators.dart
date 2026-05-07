/// validators.dart — Pure validation functions used across the app.
///
/// All functions return null when valid, or an error string when invalid.
/// Compatible with Flutter's [FormField.validator] signature.

library;

// ---------------------------------------------------------------------------
// Phone number (E.164)
// ---------------------------------------------------------------------------

/// Validates that [phone] is a well-formed E.164 phone number.
///
/// E.164 format: +[country code][subscriber number], 8–15 digits total
/// (including leading +).
///
/// Returns null when valid, error string when invalid.
String? validatePhone(String? phone) {
  if (phone == null || phone.isEmpty) return 'Phone number is required.';
  final e164 = RegExp(r'^\+[1-9]\d{6,14}$');
  if (!e164.hasMatch(phone)) {
    return 'Enter a valid phone number (e.g. +14155550100).';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/// Basic RFC-5322 email validator (practical subset).
///
/// Returns null when valid, error string when invalid.
String? validateEmail(String? email) {
  if (email == null || email.isEmpty) return 'Email is required.';
  // Practical email regex: local@domain.tld
  final emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$',
  );
  if (!emailRegex.hasMatch(email)) {
    return 'Enter a valid email address.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Review text
// ---------------------------------------------------------------------------

/// Minimum and maximum character counts for review body text.
const int kReviewMinLength = 20;
const int kReviewMaxLength = 2000;

/// Validates the length of a review body.
///
/// Returns null when valid, error string when too short or too long.
String? validateReviewText(String? text) {
  if (text == null || text.isEmpty) return 'Review text is required.';
  final trimmed = text.trim();
  if (trimmed.length < kReviewMinLength) {
    return 'Review must be at least $kReviewMinLength characters.';
  }
  if (trimmed.length > kReviewMaxLength) {
    return 'Review must not exceed $kReviewMaxLength characters.';
  }
  return null;
}
