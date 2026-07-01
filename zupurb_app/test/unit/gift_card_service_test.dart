/// Unit tests for the PURE value classes in
/// lib/core/services/gift_card_service.dart:
///
///   - GiftCardProduct.fromJson(`Map<String, dynamic>`)
///   - GiftCardRedemptionResult.fromJson(`Map<String, dynamic>`)
///
/// Both factories take a plain Map (NOT a DocumentSnapshot), so the tests
/// pass maps directly — no fake_cloud_firestore required.
///
/// Covers:
///   GiftCardProduct
///     - full map → every field populated
///     - defaults for description (''), currency ('USD'), category ('')
///       when the field is missing OR explicitly null
///     - numeric coercion: minValue / maxValue accept int and double,
///       always exposed as double (int→double, zero, large)
///     - required fields (id, name, minValue, maxValue) throw when
///       missing / null / wrong type
///     - toJson round-trip
///   GiftCardRedemptionResult
///     - success shape (success: true) and failure shape (success: false)
///     - all three fields preserved verbatim
///     - required fields (success, rewardId, deliveryMessage) throw when
///       missing / null / wrong type
///
/// The GiftCardService methods (getAvailableGiftCards, redeemGiftCard) hit
/// Cloud Function callables via FunctionsService and are integration-only —
/// not exercised here.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/services/gift_card_service.dart';

void main() {
  group('GiftCardProduct.fromJson', () {
    test('parses a full, well-typed map into every field', () {
      final product = GiftCardProduct.fromJson(const <String, dynamic>{
        'id': 'PROD_123',
        'name': 'Starbucks eGift Card',
        'description': 'Coffee, anywhere.',
        'minValue': 5.0,
        'maxValue': 100.0,
        'currency': 'USD',
        'category': 'Food & Drink',
      });

      expect(product.id, 'PROD_123');
      expect(product.name, 'Starbucks eGift Card');
      expect(product.description, 'Coffee, anywhere.');
      expect(product.minValue, 5.0);
      expect(product.maxValue, 100.0);
      expect(product.currency, 'USD');
      expect(product.category, 'Food & Drink');
    });

    group('optional-field defaults', () {
      test('description defaults to "" when missing', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.description, '');
      });

      test('description defaults to "" when explicitly null', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'description': null,
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.description, '');
      });

      test('currency defaults to "USD" when missing', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.currency, 'USD');
      });

      test('currency defaults to "USD" when explicitly null', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'currency': null,
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.currency, 'USD');
      });

      test('currency is honoured when present (non-default)', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'currency': 'EUR',
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.currency, 'EUR');
      });

      test('category defaults to "" when missing', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.category, '');
      });

      test('category defaults to "" when explicitly null', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'category': null,
          'minValue': 1,
          'maxValue': 2,
        });
        expect(product.category, '');
      });
    });

    group('numeric coercion (minValue / maxValue)', () {
      test('int values are coerced to double', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 5,
          'maxValue': 100,
        });
        expect(product.minValue, isA<double>());
        expect(product.maxValue, isA<double>());
        expect(product.minValue, 5.0);
        expect(product.maxValue, 100.0);
      });

      test('double values are preserved', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 5.50,
          'maxValue': 99.99,
        });
        expect(product.minValue, 5.50);
        expect(product.maxValue, 99.99);
      });

      test('zero int coerces to 0.0', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 0,
          'maxValue': 0,
        });
        expect(product.minValue, 0.0);
        expect(product.maxValue, 0.0);
      });

      test('large numeric value retains precision as double', () {
        final product = GiftCardProduct.fromJson(const <String, dynamic>{
          'id': 'P',
          'name': 'N',
          'minValue': 1,
          'maxValue': 1000000,
        });
        expect(product.maxValue, 1000000.0);
      });
    });

    group('required fields throw on missing / null / wrong type', () {
      test('throws when id is missing', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'name': 'N',
            'minValue': 1,
            'maxValue': 2,
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when id is null', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'id': null,
            'name': 'N',
            'minValue': 1,
            'maxValue': 2,
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when name is missing', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'id': 'P',
            'minValue': 1,
            'maxValue': 2,
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when minValue is missing (null is not a num)', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'id': 'P',
            'name': 'N',
            'maxValue': 2,
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when maxValue is missing', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'id': 'P',
            'name': 'N',
            'minValue': 1,
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when minValue is a non-numeric String', () {
        expect(
          () => GiftCardProduct.fromJson(const <String, dynamic>{
            'id': 'P',
            'name': 'N',
            'minValue': 'five',
            'maxValue': 2,
          }),
          throwsA(isA<TypeError>()),
        );
      });
    });

    test('toJson round-trips through fromJson', () {
      const original = <String, dynamic>{
        'id': 'PROD_RT',
        'name': 'Round Trip',
        'description': 'desc',
        'minValue': 10.0,
        'maxValue': 50.0,
        'currency': 'GBP',
        'category': 'Retail',
      };

      final json = GiftCardProduct.fromJson(original).toJson();

      expect(json, original);

      // And the re-parsed product equals the first across all fields.
      final reparsed = GiftCardProduct.fromJson(json);
      expect(reparsed.id, 'PROD_RT');
      expect(reparsed.name, 'Round Trip');
      expect(reparsed.description, 'desc');
      expect(reparsed.minValue, 10.0);
      expect(reparsed.maxValue, 50.0);
      expect(reparsed.currency, 'GBP');
      expect(reparsed.category, 'Retail');
    });
  });

  group('GiftCardRedemptionResult.fromJson', () {
    test('parses a success shape (success: true)', () {
      final result = GiftCardRedemptionResult.fromJson(const <String, dynamic>{
        'success': true,
        'rewardId': 'REWARD_42',
        'deliveryMessage': 'Sent to your email.',
      });

      expect(result.success, isTrue);
      expect(result.rewardId, 'REWARD_42');
      expect(result.deliveryMessage, 'Sent to your email.');
    });

    test('parses a failure shape (success: false) — still a valid parse', () {
      final result = GiftCardRedemptionResult.fromJson(const <String, dynamic>{
        'success': false,
        'rewardId': '',
        'deliveryMessage': 'Insufficient points.',
      });

      expect(result.success, isFalse);
      expect(result.rewardId, '');
      expect(result.deliveryMessage, 'Insufficient points.');
    });

    test('preserves all three fields verbatim', () {
      final result = GiftCardRedemptionResult.fromJson(const <String, dynamic>{
        'success': true,
        'rewardId': 'TREMENDOUS_ORDER_ABC',
        'deliveryMessage': 'Your \$25 card is on its way.',
      });

      expect(result.success, isTrue);
      expect(result.rewardId, 'TREMENDOUS_ORDER_ABC');
      expect(result.deliveryMessage, 'Your \$25 card is on its way.');
    });

    group('required fields throw on missing / null / wrong type', () {
      test('throws when success is missing', () {
        expect(
          () => GiftCardRedemptionResult.fromJson(const <String, dynamic>{
            'rewardId': 'R',
            'deliveryMessage': 'M',
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when success is null', () {
        expect(
          () => GiftCardRedemptionResult.fromJson(const <String, dynamic>{
            'success': null,
            'rewardId': 'R',
            'deliveryMessage': 'M',
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when rewardId is missing', () {
        expect(
          () => GiftCardRedemptionResult.fromJson(const <String, dynamic>{
            'success': true,
            'deliveryMessage': 'M',
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when deliveryMessage is missing', () {
        expect(
          () => GiftCardRedemptionResult.fromJson(const <String, dynamic>{
            'success': true,
            'rewardId': 'R',
          }),
          throwsA(isA<TypeError>()),
        );
      });

      test('throws when success is a non-bool (e.g. the string "true")', () {
        expect(
          () => GiftCardRedemptionResult.fromJson(const <String, dynamic>{
            'success': 'true',
            'rewardId': 'R',
            'deliveryMessage': 'M',
          }),
          throwsA(isA<TypeError>()),
        );
      });
    });
  });
}
