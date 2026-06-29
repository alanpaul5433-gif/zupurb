/// Unit tests for lib/state/collections/collections_provider.dart
///
/// Covers collectionVenuesProvider — the logic that resolves a collection's
/// memberEstIds against the active-establishments stream and drives the
/// data-driven category rows on the Discover screen:
///   - members resolve in curation order (not establishments-list order)
///   - ids that don't resolve to an active venue are skipped (self-healing)
///   - unknown collection id → empty
///   - collection with no members → empty (row hides on Discover)
///
/// Phase 4 — admin-managed category collections.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zupurb_app/models/collection.dart';
import 'package:zupurb_app/models/establishment.dart';
import 'package:zupurb_app/state/collections/collections_provider.dart';
import 'package:zupurb_app/state/establishments/establishments_provider.dart';

Establishment _est(String id) => Establishment(
      id: id,
      name: id,
      type: 'Bar',
      area: '',
      imageUrl: '',
      score: 4.5,
      priceRange: r'$$',
      distanceKm: 1,
      openUntil: '2 AM',
      hasAlcohol: true,
      hasReservations: false,
      hasDeals: false,
      isActive: true,
      tags: const [],
    );

VenueCollection _col(String id, List<String> members) => VenueCollection(
      id: id,
      kind: 'editorial',
      title: id,
      description: '',
      emoji: null,
      memberEstIds: members,
      sortOrder: 0,
      isActive: true,
    );

/// Container with both stream providers overridden and their first values
/// already emitted, so collectionVenuesProvider sees AsyncData.
Future<ProviderContainer> _containerWith({
  required List<VenueCollection> collections,
  required List<Establishment> ests,
}) async {
  final container = ProviderContainer(overrides: [
    collectionsProvider.overrideWith((ref) => Stream.value(collections)),
    establishmentsProvider.overrideWith((ref) => Stream.value(ests)),
  ]);
  await container.read(collectionsProvider.future);
  await container.read(establishmentsProvider.future);
  return container;
}

void main() {
  group('collectionVenuesProvider', () {
    test('resolves members in curation order, not establishments order', () async {
      final container = await _containerWith(
        collections: [_col('late-night', ['c', 'a'])],
        ests: [_est('a'), _est('b'), _est('c')],
      );
      addTearDown(container.dispose);

      final venues = container.read(collectionVenuesProvider('late-night'));
      expect(venues.map((e) => e.id).toList(), ['c', 'a']);
    });

    test('skips member ids that do not resolve to an active venue', () async {
      final container = await _containerWith(
        collections: [_col('mix', ['a', 'ghost-venue', 'b'])],
        ests: [_est('a'), _est('b')],
      );
      addTearDown(container.dispose);

      final venues = container.read(collectionVenuesProvider('mix'));
      expect(venues.map((e) => e.id).toList(), ['a', 'b']);
    });

    test('returns empty list for an unknown collection id', () async {
      final container = await _containerWith(
        collections: [_col('x', ['a'])],
        ests: [_est('a')],
      );
      addTearDown(container.dispose);

      expect(container.read(collectionVenuesProvider('nope')), isEmpty);
    });

    test('returns empty list when a collection has no members', () async {
      final container = await _containerWith(
        collections: [_col('empty', const [])],
        ests: [_est('a')],
      );
      addTearDown(container.dispose);

      expect(container.read(collectionVenuesProvider('empty')), isEmpty);
    });
  });
}
