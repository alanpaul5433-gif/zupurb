// gift_card_service.dart — Thin wrapper over the redeemGiftCard and
// listGiftCardCatalog Cloud Function callables.
//
// Consumers import this file and call:
//
//   getAvailableGiftCards()
//     Calls listGiftCardCatalog → returns List<GiftCardProduct>.
//
//   redeemGiftCard(productId, valuePoints)
//     Calls redeemGiftCard callable → returns GiftCardRedemptionResult.
//
// Models:
//   GiftCardProduct          — a gift card available in the catalog
//   GiftCardRedemptionResult — result of a successful (or failed) redemption
//
// All vendor-specific shapes are hidden behind these models.
// Errors are surfaced as AppFunctionsException (from functions_service.dart).
//
// Milestone: I7

import 'functions_service.dart';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// A gift card product available for redemption.
class GiftCardProduct {
  /// Tremendous product ID.
  final String id;

  /// Display name (e.g., "Starbucks eGift Card").
  final String name;

  /// Short description.
  final String description;

  /// Minimum dollar value (e.g., 5.00).
  final double minValue;

  /// Maximum dollar value (e.g., 100.00).
  final double maxValue;

  /// ISO 4217 currency code (e.g., "USD").
  final String currency;

  /// Category label from Tremendous (e.g., "Food & Drink").
  final String category;

  const GiftCardProduct({
    required this.id,
    required this.name,
    required this.description,
    required this.minValue,
    required this.maxValue,
    required this.currency,
    required this.category,
  });

  factory GiftCardProduct.fromJson(Map<String, dynamic> json) {
    return GiftCardProduct(
      id:          json['id'] as String,
      name:        json['name'] as String,
      description: json['description'] as String? ?? '',
      minValue:    (json['minValue'] as num).toDouble(),
      maxValue:    (json['maxValue'] as num).toDouble(),
      currency:    json['currency'] as String? ?? 'USD',
      category:    json['category'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id':          id,
    'name':        name,
    'description': description,
    'minValue':    minValue,
    'maxValue':    maxValue,
    'currency':    currency,
    'category':    category,
  };
}

/// Result of a gift card redemption attempt.
class GiftCardRedemptionResult {
  /// Whether the redemption succeeded.
  final bool success;

  /// Tremendous order/reward ID — stored for reconciliation.
  final String rewardId;

  /// Human-readable delivery message to surface to the user.
  final String deliveryMessage;

  const GiftCardRedemptionResult({
    required this.success,
    required this.rewardId,
    required this.deliveryMessage,
  });

  factory GiftCardRedemptionResult.fromJson(Map<String, dynamic> json) {
    return GiftCardRedemptionResult(
      success:         json['success'] as bool,
      rewardId:        json['rewardId'] as String,
      deliveryMessage: json['deliveryMessage'] as String,
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/// Gift card service — wraps the I7 Cloud Function callables.
///
/// Usage:
///   final service = GiftCardService();
///   final catalog = await service.getAvailableGiftCards();
///   final result  = await service.redeemGiftCard('PROD_ID', 3500);
class GiftCardService {
  final FunctionsService _functions;

  GiftCardService({FunctionsService? functions})
      : _functions = functions ?? FunctionsService();

  /// Fetch the gift card catalog from Tremendous via Cloud Function.
  ///
  /// Returns a list of available [GiftCardProduct]s.
  /// Throws [AppFunctionsException] on error.
  Future<List<GiftCardProduct>> getAvailableGiftCards() async {
    final response = await _functions.call(
      'listGiftCardCatalog',
      {},
      (data) {
        final map      = Map<String, dynamic>.from(data as Map);
        final rawList  = map['products'] as List<dynamic>;
        return rawList
            .map((e) => GiftCardProduct.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      },
    );
    return response;
  }

  /// Redeem [valuePoints] points for the gift card identified by [productId].
  ///
  /// [productId]   — Tremendous product ID (from [getAvailableGiftCards]).
  /// [valuePoints] — Integer points to spend (must be > 0).
  ///
  /// Returns a [GiftCardRedemptionResult] on success.
  /// Throws [AppFunctionsException] on error (insufficient points, cap exceeded, etc.).
  Future<GiftCardRedemptionResult> redeemGiftCard(
    String productId,
    int valuePoints,
  ) async {
    return _functions.call(
      'redeemGiftCard',
      {
        'productId':   productId,
        'valuePoints': valuePoints,
      },
      (data) => GiftCardRedemptionResult.fromJson(
        Map<String, dynamic>.from(data as Map),
      ),
    );
  }
}
