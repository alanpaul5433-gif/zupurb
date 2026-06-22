import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../models/vendor.dart';
import '../theme/colors.dart';
import 'entity_detail_sheet.dart';

/// A compact list card for a [Vendor]: thumbnail + name + "category · city" +
/// a small ★ rating chip.
class VendorCard extends StatelessWidget {
  final Vendor vendor;
  const VendorCard({super.key, required this.vendor});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showEntityDetailSheet(
        context,
        imageUrl: vendor.imageUrl,
        title: vendor.name,
        subtitle: '${vendor.category} · ${vendor.city}',
        rating: vendor.rating,
        body: vendor.tagline,
      ),
      child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 56,
              height: 56,
              child: vendor.imageUrl.isNotEmpty
                  ? Image.network(vendor.imageUrl, fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(color: AppColors.border))
                  : Container(color: AppColors.border),
            ),
          ),
          const Gap(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vendor.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                const Gap(2),
                Text('${vendor.category} · ${vendor.city}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const Gap(8),
          _RatingChip(rating: vendor.rating),
        ],
      ),
      ),
    );
  }
}

class _RatingChip extends StatelessWidget {
  final double rating;
  const _RatingChip({required this.rating});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star, size: 14, color: AppColors.pointsGold),
          const Gap(3),
          Text(rating.toStringAsFixed(1), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
