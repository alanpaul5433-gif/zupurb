/// Unit tests for lib/models/menu_item.dart
///
/// Covers:
///   - MenuItem.fromFirestore: full document mapping (id pulled from doc.id)
///   - Every documented default for missing fields (name/description/category/
///     imageUrl '' , price 0.0, sortOrder 0, isAvailable defaults to TRUE)
///   - Type coercion: int supplied for `price` (num→double), double supplied
///     for `sortOrder` (num→int, truncates)
///   - null-valued fields fall back to defaults
///   - priceLabel getter across both branches (whole → no decimals,
///     fractional → 2 decimals) plus zero/edge cases (pure-constructor tests)
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/menu_item.dart';

Future<DocumentSnapshot> _snap(Map<String, dynamic> data,
    {String id = 'doc1'}) async {
  final fs = FakeFirebaseFirestore();
  await fs.collection('c').doc(id).set(data);
  return fs.collection('c').doc(id).get();
}

void main() {
  group('MenuItem.fromFirestore', () {
    test('maps a full document and takes id from doc.id', () async {
      final item = MenuItem.fromFirestore(await _snap({
        'name': 'Margherita Pizza',
        'description': 'Tomato, mozzarella, basil',
        'price': 14.5,
        'category': 'Mains',
        'imageUrl': 'https://img/pizza.png',
        'isAvailable': true,
        'sortOrder': 3,
      }, id: 'menu-42'));

      expect(item.id, 'menu-42');
      expect(item.name, 'Margherita Pizza');
      expect(item.description, 'Tomato, mozzarella, basil');
      expect(item.price, 14.5);
      expect(item.category, 'Mains');
      expect(item.imageUrl, 'https://img/pizza.png');
      expect(item.isAvailable, true);
      expect(item.sortOrder, 3);
    });

    test('applies defaults for a completely empty document', () async {
      final item = MenuItem.fromFirestore(await _snap({}));

      expect(item.id, 'doc1');
      expect(item.name, '');
      expect(item.description, '');
      expect(item.price, 0.0);
      expect(item.category, '');
      expect(item.imageUrl, '');
      // Documented default: missing isAvailable => true.
      expect(item.isAvailable, true);
      expect(item.sortOrder, 0);
    });

    test('isAvailable honors an explicit false', () async {
      final item = MenuItem.fromFirestore(await _snap({'isAvailable': false}));
      expect(item.isAvailable, false);
    });

    test('coerces an int price to double', () async {
      final item = MenuItem.fromFirestore(await _snap({'price': 12}));
      expect(item.price, 12.0);
      expect(item.price, isA<double>());
    });

    test('coerces a double sortOrder to int (truncating)', () async {
      final item = MenuItem.fromFirestore(await _snap({'sortOrder': 3.7}));
      expect(item.sortOrder, 3);
      expect(item.sortOrder, isA<int>());
    });

    test('null-valued fields fall back to defaults', () async {
      final item = MenuItem.fromFirestore(await _snap({
        'name': null,
        'description': null,
        'price': null,
        'category': null,
        'imageUrl': null,
        'isAvailable': null,
        'sortOrder': null,
      }));

      expect(item.name, '');
      expect(item.description, '');
      expect(item.price, 0.0);
      expect(item.category, '');
      expect(item.imageUrl, '');
      expect(item.isAvailable, true);
      expect(item.sortOrder, 0);
    });
  });

  group('MenuItem.priceLabel', () {
    MenuItem withPrice(double price) => MenuItem(
          id: 'x',
          name: 'x',
          description: '',
          price: price,
          category: '',
          imageUrl: '',
          isAvailable: true,
          sortOrder: 0,
        );

    test('whole-number price renders with no decimals', () {
      expect(withPrice(14.0).priceLabel, r'$14');
    });

    test('fractional price renders with two decimals', () {
      expect(withPrice(14.5).priceLabel, r'$14.50');
    });

    test('two-decimal price preserved exactly', () {
      expect(withPrice(9.99).priceLabel, r'$9.99');
    });

    test('zero price renders as whole', () {
      expect(withPrice(0.0).priceLabel, r'$0');
    });
  });
}
