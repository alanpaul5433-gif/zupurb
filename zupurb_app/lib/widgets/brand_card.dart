import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import '../models/brand.dart';
import '../theme/colors.dart';
import 'entity_detail_sheet.dart';

/// A compact list card for a [Brand]: logo/image + name + category + tagline.
class BrandCard extends StatelessWidget {
  final Brand brand;
  const BrandCard({super.key, required this.brand});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showEntityDetailSheet(
        context,
        imageUrl: brand.imageUrl,
        title: brand.name,
        subtitle: brand.category,
        body: brand.tagline,
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
              child: brand.imageUrl.isNotEmpty
                  ? Image.network(brand.imageUrl, fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(color: AppColors.border))
                  : Container(color: AppColors.border),
            ),
          ),
          const Gap(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(brand.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (brand.category.isNotEmpty) ...[
                  const Gap(2),
                  Text(brand.category, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
                if (brand.tagline.isNotEmpty) ...[
                  const Gap(2),
                  Text(brand.tagline, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary), maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}
