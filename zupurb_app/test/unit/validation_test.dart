/// Unit tests for lib/utils/validators.dart
///
/// Covers:
///   - validatePhone: E.164 format acceptance and rejection
///   - validateEmail: basic RFC-5322 subset validation
///   - validateReviewText: min/max character length
///
/// T1 — Milestone B3 / B5

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/utils/validators.dart';

void main() {
  // -------------------------------------------------------------------------
  // validatePhone
  // -------------------------------------------------------------------------

  group('validatePhone', () {
    group('valid E.164 numbers → null', () {
      test('US number +14155550100', () {
        expect(validatePhone('+14155550100'), isNull);
      });

      test('UK number +447700900123', () {
        expect(validatePhone('+447700900123'), isNull);
      });

      test('minimum length E.164 (+1XXXXXXX — 8 chars after +)', () {
        // +1 + 7 digits = 9 chars total, 8 digits — within 7..14 subscriber range
        expect(validatePhone('+11234567'), isNull);
      });

      test('15-digit max length E.164', () {
        // +[1 country digit][13 subscriber] = 15 chars total
        expect(validatePhone('+12345678901234'), isNull);
      });

      test('international format with country code 44', () {
        expect(validatePhone('+441234567890'), isNull);
      });
    });

    group('invalid numbers → error string', () {
      test('null input → required error', () {
        expect(validatePhone(null), isNotNull);
      });

      test('empty string → required error', () {
        expect(validatePhone(''), isNotNull);
      });

      test('missing leading + → invalid', () {
        expect(validatePhone('14155550100'), isNotNull);
      });

      test('starts with +0 (invalid country code) → invalid', () {
        expect(validatePhone('+014155550100'), isNotNull);
      });

      test('too short (fewer than 7 subscriber digits) → invalid', () {
        // +1 + 5 digits = 6 total subscriber digits < 6 minimum
        expect(validatePhone('+12345'), isNotNull);
      });

      test('too long (16+ chars) → invalid', () {
        expect(validatePhone('+123456789012345'), isNotNull);
      });

      test('contains letters → invalid', () {
        expect(validatePhone('+1415ABC5678'), isNotNull);
      });

      test('contains spaces → invalid', () {
        expect(validatePhone('+1 415 555 0100'), isNotNull);
      });

      test('contains dashes → invalid', () {
        expect(validatePhone('+1-415-555-0100'), isNotNull);
      });

      test('plain digits without + → invalid', () {
        expect(validatePhone('4155550100'), isNotNull);
      });
    });
  });

  // -------------------------------------------------------------------------
  // validateEmail
  // -------------------------------------------------------------------------

  group('validateEmail', () {
    group('valid emails → null', () {
      test('standard email', () {
        expect(validateEmail('user@example.com'), isNull);
      });

      test('email with subdomain', () {
        expect(validateEmail('user@mail.example.co.uk'), isNull);
      });

      test('email with + in local part', () {
        expect(validateEmail('user+tag@example.com'), isNull);
      });

      test('email with dots in local part', () {
        expect(validateEmail('first.last@example.org'), isNull);
      });

      test('email with numbers', () {
        expect(validateEmail('user123@example123.com'), isNull);
      });

      test('uppercase email (valid, case-insensitive)', () {
        expect(validateEmail('User@Example.COM'), isNull);
      });

      test('minimal valid email (a@b.co)', () {
        expect(validateEmail('a@b.co'), isNull);
      });
    });

    group('invalid emails → error string', () {
      test('null input → required', () {
        expect(validateEmail(null), isNotNull);
      });

      test('empty string → required', () {
        expect(validateEmail(''), isNotNull);
      });

      test('missing @ → invalid', () {
        expect(validateEmail('userexample.com'), isNotNull);
      });

      test('missing domain → invalid', () {
        expect(validateEmail('user@'), isNotNull);
      });

      test('missing TLD → invalid', () {
        expect(validateEmail('user@example'), isNotNull);
      });

      test('double @@ → invalid', () {
        expect(validateEmail('user@@example.com'), isNotNull);
      });

      test('spaces in email → invalid', () {
        expect(validateEmail('user @example.com'), isNotNull);
      });

      test('only @ sign → invalid', () {
        expect(validateEmail('@'), isNotNull);
      });

      test('TLD too short (1 char) → invalid', () {
        expect(validateEmail('user@example.c'), isNotNull);
      });
    });
  });

  // -------------------------------------------------------------------------
  // validateReviewText
  // -------------------------------------------------------------------------

  group('validateReviewText', () {
    group('valid review text → null', () {
      test('exactly minimum length ($kReviewMinLength chars) → valid', () {
        final text = 'a' * kReviewMinLength;
        expect(validateReviewText(text), isNull);
      });

      test('exactly maximum length ($kReviewMaxLength chars) → valid', () {
        final text = 'a' * kReviewMaxLength;
        expect(validateReviewText(text), isNull);
      });

      test('typical review text → valid', () {
        const text =
            'The food was absolutely delicious and the service was excellent. '
            'I would highly recommend this restaurant to anyone looking for a great experience.';
        expect(validateReviewText(text), isNull);
      });

      test('min+1 chars → valid', () {
        final text = 'a' * (kReviewMinLength + 1);
        expect(validateReviewText(text), isNull);
      });

      test('max-1 chars → valid', () {
        final text = 'a' * (kReviewMaxLength - 1);
        expect(validateReviewText(text), isNull);
      });
    });

    group('too short → error', () {
      test('null → required error', () {
        expect(validateReviewText(null), isNotNull);
      });

      test('empty string → required error', () {
        expect(validateReviewText(''), isNotNull);
      });

      test('one character → too short', () {
        expect(validateReviewText('a'), isNotNull);
      });

      test('min-1 chars → too short', () {
        final text = 'a' * (kReviewMinLength - 1);
        expect(validateReviewText(text), isNotNull);
      });

      test('whitespace-only string → too short (trim applied)', () {
        // 25 spaces: trimmed = '', which is < 20
        expect(validateReviewText('                         '), isNotNull);
      });

      test('error message references minimum length', () {
        final error = validateReviewText('short');
        expect(error, contains(kReviewMinLength.toString()));
      });
    });

    group('too long → error', () {
      test('max+1 chars → too long', () {
        final text = 'a' * (kReviewMaxLength + 1);
        expect(validateReviewText(text), isNotNull);
      });

      test('double max chars → too long', () {
        final text = 'a' * (kReviewMaxLength * 2);
        expect(validateReviewText(text), isNotNull);
      });

      test('error message references maximum length', () {
        final text = 'a' * (kReviewMaxLength + 1);
        final error = validateReviewText(text);
        expect(error, contains(kReviewMaxLength.toString()));
      });
    });

    group('constants are correctly defined', () {
      test('kReviewMinLength = 20', () {
        expect(kReviewMinLength, 20);
      });

      test('kReviewMaxLength = 2000', () {
        expect(kReviewMaxLength, 2000);
      });

      test('min < max', () {
        expect(kReviewMinLength, lessThan(kReviewMaxLength));
      });
    });
  });
}
