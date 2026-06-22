import 'package:cloud_firestore/cloud_firestore.dart';

class MenuItem {
  final String id;
  final String name;
  final String description;
  final double price;
  final String category;
  final String imageUrl;
  final bool isAvailable;
  final int sortOrder;

  const MenuItem({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.category,
    required this.imageUrl,
    required this.isAvailable,
    required this.sortOrder,
  });

  String get priceLabel {
    final isWhole = price == price.roundToDouble();
    return '\$${price.toStringAsFixed(isWhole ? 0 : 2)}';
  }

  factory MenuItem.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return MenuItem(
      id: doc.id,
      name: d['name'] as String? ?? '',
      description: d['description'] as String? ?? '',
      price: (d['price'] as num?)?.toDouble() ?? 0.0,
      category: d['category'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
      isAvailable: d['isAvailable'] as bool? ?? true,
      sortOrder: (d['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
